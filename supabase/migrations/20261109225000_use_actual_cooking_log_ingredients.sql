begin;

create or replace function public.save_daybook_data_with_cooking_inventory(
  p_data jsonb,
  p_expected_revision text
)
returns table (revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_revision text;
  old_log record;
  old_usage record;
  submitted_log jsonb;
  old_record jsonb;
  submitted_dish jsonb;
  ingredient jsonb;
  inventory_record jsonb;
  inventory_measure jsonb;
  cooking_log_id text;
  v_recipe_id text;
  v_inventory_item_id text;
  v_inventory_measure_id text;
  used_quantity numeric;
  recipe_name text;
  item_name text;
  unit_name text;
  cooking_date date;
  usage_changed boolean := false;
begin
  if pg_catalog.jsonb_typeof(p_data) <> 'object' then
    raise exception 'Invalid Daybook data';
  end if;

  if p_data ? 'cookingLogs' and pg_catalog.jsonb_typeof(p_data -> 'cookingLogs') <> 'array' then
    raise exception 'Daybook collection cookingLogs must be a JSON array';
  end if;

  select saved.revision into saved_revision
  from public.save_daybook_data_with_account_credentials(
    p_data - 'cookingLogs',
    p_expected_revision
  ) as saved;
  if saved_revision is null then
    return;
  end if;

  if p_data ? 'cookingLogs' then
    perform 1
    from public.cooking_inventory_state as state
    where state.singleton = true
    for update;

    for old_log in
      select stored.id
      from public.cooking_logs as stored
      where not exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_data -> 'cookingLogs') as submitted(entry)
        where submitted.entry ->> 'id' = stored.id
      )
    loop
      for old_usage in
        select usage.inventory_item_id, usage.inventory_measure_id, usage.quantity
        from public.cooking_inventory_usage as usage
        where usage.log_id = old_log.id
      loop
        perform public.apply_cooking_inventory_stock_delta(
          old_usage.inventory_item_id,
          old_usage.inventory_measure_id,
          old_usage.quantity
        );
        usage_changed := true;
      end loop;
      delete from public.cooking_inventory_usage as stored_usage
      where stored_usage.log_id = old_log.id;
    end loop;

    for submitted_log in
      select submitted.entry
      from pg_catalog.jsonb_array_elements(p_data -> 'cookingLogs') as submitted(entry)
    loop
      cooking_log_id := submitted_log ->> 'id';
      cooking_date := (submitted_log ->> 'date')::date;
      select stored.record into old_record
      from public.cooking_logs as stored
      where stored.id = cooking_log_id;

      if found and old_record is not distinct from submitted_log then
        continue;
      end if;

      for old_usage in
        select usage.recipe_id, usage.inventory_item_id, usage.inventory_measure_id, usage.quantity
        from public.cooking_inventory_usage as usage
        where usage.log_id = cooking_log_id
          and (
            not exists (
              select 1
              from pg_catalog.jsonb_array_elements(coalesce(submitted_log -> 'dishes', '[]'::jsonb)) as dish(entry)
              where dish.entry ->> 'recipeId' = usage.recipe_id
            )
            or exists (
              select 1
              from pg_catalog.jsonb_array_elements(coalesce(submitted_log -> 'dishes', '[]'::jsonb)) as dish(entry)
              where dish.entry ->> 'recipeId' = usage.recipe_id
                and coalesce(pg_catalog.jsonb_typeof(dish.entry -> 'actualIngredients'), '') = 'array'
            )
          )
      loop
        perform public.apply_cooking_inventory_stock_delta(
          old_usage.inventory_item_id,
          old_usage.inventory_measure_id,
          old_usage.quantity
        );
        delete from public.cooking_inventory_usage as stored_usage
        where stored_usage.log_id = cooking_log_id
          and stored_usage.recipe_id = old_usage.recipe_id
          and stored_usage.inventory_item_id = old_usage.inventory_item_id
          and stored_usage.inventory_measure_id = old_usage.inventory_measure_id;
        usage_changed := true;
      end loop;

      for submitted_dish in
        select dish.entry
        from pg_catalog.jsonb_array_elements(coalesce(submitted_log -> 'dishes', '[]'::jsonb)) as dish(entry)
      loop
        v_recipe_id := submitted_dish ->> 'recipeId';
        if coalesce(v_recipe_id, '') = '' or
          coalesce(pg_catalog.jsonb_typeof(submitted_dish -> 'actualIngredients'), '') <> 'array' then
          continue;
        end if;
        recipe_name := coalesce(submitted_dish ->> 'name', 'Recipe');

        for ingredient in
          select ingredient_entry.entry
          from pg_catalog.jsonb_array_elements(submitted_dish -> 'actualIngredients') as ingredient_entry(entry)
        loop
          if coalesce(pg_catalog.jsonb_typeof(ingredient -> 'quantity'), '') <> 'number'
            or coalesce((ingredient ->> 'quantity')::numeric, 0) <= 0
          then
            continue;
          end if;
          v_inventory_item_id := ingredient ->> 'inventoryItemId';
          v_inventory_measure_id := ingredient ->> 'inventoryMeasureId';
          if coalesce(v_inventory_item_id, '') = '' or coalesce(v_inventory_measure_id, '') = '' then
            continue;
          end if;

          used_quantity := (ingredient ->> 'quantity')::numeric;
          select item.record into inventory_record
          from public.cooking_inventory_items as item
          where item.id = v_inventory_item_id;
          item_name := coalesce(inventory_record ->> 'name', ingredient ->> 'name', 'Kitchen item');
          select measure.value into inventory_measure
          from pg_catalog.jsonb_array_elements(coalesce(inventory_record -> 'measures', '[]'::jsonb)) as measure(value)
          where measure.value ->> 'id' = v_inventory_measure_id
          limit 1;
          unit_name := coalesce(
            nullif(pg_catalog.btrim(ingredient ->> 'unit'), ''),
            nullif(pg_catalog.btrim(inventory_measure ->> 'unit'), ''),
            'unit'
          );

          perform public.apply_cooking_inventory_stock_delta(
            v_inventory_item_id,
            v_inventory_measure_id,
            -used_quantity
          );
          insert into public.cooking_inventory_usage (
            log_id, recipe_id, recipe_name, inventory_item_id, item_name,
            inventory_measure_id, unit, cooking_date, quantity
          ) values (
            cooking_log_id, v_recipe_id, recipe_name, v_inventory_item_id, item_name,
            v_inventory_measure_id, unit_name, cooking_date, used_quantity
          )
          on conflict (log_id, recipe_id, inventory_item_id, inventory_measure_id)
          do update set
            quantity = cooking_inventory_usage.quantity + excluded.quantity,
            cooking_date = excluded.cooking_date,
            recipe_name = excluded.recipe_name,
            item_name = excluded.item_name,
            unit = excluded.unit;
          usage_changed := true;
        end loop;
      end loop;
    end loop;

    delete from public.cooking_logs
    where id is not null;
    insert into public.cooking_logs (id, position, record)
    select submitted.entry ->> 'id', submitted.entry_position::integer, submitted.entry
    from pg_catalog.jsonb_array_elements(p_data -> 'cookingLogs')
      with ordinality as submitted(entry, entry_position);

    if usage_changed then
      update public.cooking_inventory_state as state
      set revision = pg_catalog.gen_random_uuid()
      where state.singleton = true;
    end if;
  end if;

  revision := saved_revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_with_cooking_inventory(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_with_cooking_inventory(jsonb, text) to service_role;

notify pgrst, 'reload schema';
commit;
