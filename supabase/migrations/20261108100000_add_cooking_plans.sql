begin;

create table if not exists public.cooking_plans (
  id text primary key,
  position integer not null,
  record jsonb not null
);

alter table public.cooking_plans enable row level security;
revoke all on table public.cooking_plans from public, anon, authenticated;
grant select, insert, update, delete on table public.cooking_plans to service_role;

create or replace function public.save_daybook_data_with_cooking_plans(
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
begin
  select saved.revision into saved_revision
  from public.save_daybook_data_with_plans(p_data - 'cookingPlans', p_expected_revision) as saved;
  if saved_revision is null then
    return;
  end if;

  if p_data ? 'cookingPlans' then
    if pg_catalog.jsonb_typeof(p_data -> 'cookingPlans') <> 'array' then
      raise exception 'Daybook collection cookingPlans must be a JSON array';
    end if;

    delete from public.cooking_plans where id is not null;
    insert into public.cooking_plans (id, position, record)
    select plan.entry ->> 'id', plan.entry_position::integer, plan.entry
    from pg_catalog.jsonb_array_elements(p_data -> 'cookingPlans')
      with ordinality as plan(entry, entry_position);
  end if;

  revision := saved_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data_with_cooking_plans()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored record;
begin
  select current_data.data, current_data.revision into stored
  from public.load_daybook_data_with_plans() as current_data;
  if not found then
    return;
  end if;

  data := stored.data || pg_catalog.jsonb_build_object(
    'cookingPlans',
    coalesce(
      (
        select pg_catalog.jsonb_agg(plan.record order by plan.position)
        from public.cooking_plans as plan
      ),
      '[]'::jsonb
    )
  );
  revision := stored.revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_with_cooking_plans(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_with_cooking_plans(jsonb, text) to service_role;
revoke all on function public.load_daybook_data_with_cooking_plans() from public, anon, authenticated;
grant execute on function public.load_daybook_data_with_cooking_plans() to service_role;

notify pgrst, 'reload schema';
commit;
