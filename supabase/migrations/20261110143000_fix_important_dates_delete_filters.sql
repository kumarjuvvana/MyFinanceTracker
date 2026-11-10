begin;

create or replace function public.replace_important_dates(
  p_dates jsonb,
  p_categories jsonb,
  p_feelings jsonb,
  p_expected_revision text
)
returns table (revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision uuid;
  next_revision uuid;
  entry jsonb;
  category jsonb;
  feeling jsonb;
  item_position integer := 0;
begin
  if pg_catalog.jsonb_typeof(p_dates) <> 'array'
    or pg_catalog.jsonb_typeof(p_categories) <> 'array'
    or pg_catalog.jsonb_typeof(p_feelings) <> 'array'
    or p_expected_revision is null then
    raise exception 'Invalid important dates update';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.important_dates:shared')::bigint
  );

  select state.revision into current_revision
  from public.important_dates_state as state
  where state.singleton = true
  for update;

  if current_revision is null or current_revision::text <> p_expected_revision then
    return;
  end if;

  delete from public.important_dates where id is not null;
  delete from public.important_date_categories where id is not null;
  delete from public.important_date_feelings where id is not null;

  item_position := 0;
  for category in select pg_catalog.jsonb_array_elements(p_categories)
  loop
    insert into public.important_date_categories (id, name, position)
    values (category ->> 'id', pg_catalog.btrim(category ->> 'name'), item_position);
    item_position := item_position + 1;
  end loop;

  item_position := 0;
  for feeling in select pg_catalog.jsonb_array_elements(p_feelings)
  loop
    insert into public.important_date_feelings (id, name, sentiment, position)
    values (
      feeling ->> 'id',
      pg_catalog.btrim(feeling ->> 'name'),
      feeling ->> 'sentiment',
      item_position
    );
    item_position := item_position + 1;
  end loop;

  item_position := 0;
  for entry in select pg_catalog.jsonb_array_elements(p_dates)
  loop
    insert into public.important_dates (
      id, title, event_date, category_id, feeling_id, link, show_reminder, position
    )
    values (
      entry ->> 'id',
      pg_catalog.btrim(entry ->> 'title'),
      (entry ->> 'date')::date,
      entry ->> 'categoryId',
      nullif(entry ->> 'feelingId', ''),
      coalesce(entry ->> 'link', ''),
      coalesce((entry ->> 'reminder')::boolean, false),
      item_position
    );
    item_position := item_position + 1;
  end loop;

  update public.important_dates_state as state
  set revision = pg_catalog.gen_random_uuid()
  where state.singleton = true
  returning state.revision into next_revision;

  revision := next_revision::text;
  return next;
end;
$$;

notify pgrst, 'reload schema';
commit;
