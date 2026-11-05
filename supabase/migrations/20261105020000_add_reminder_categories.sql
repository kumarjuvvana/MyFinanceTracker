create table if not exists public.reminder_categories (
  name text primary key,
  position integer not null
);

alter table public.reminder_categories enable row level security;
revoke all on table public.reminder_categories from public, anon, authenticated;
grant select, insert, update, delete on table public.reminder_categories to service_role;

create or replace function public.load_reminder_categories()
returns table (categories jsonb)
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_agg(category.name order by category.position),
    '[]'::jsonb
  )
  from public.reminder_categories as category;
$$;

create or replace function public.save_reminder_categories(p_categories jsonb, p_expected_revision text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_count integer;
  unique_category_count integer;
  current_revision text;
begin
  if pg_catalog.jsonb_typeof(p_categories) <> 'array' then
    raise exception 'Reminder categories must be a JSON array';
  end if;

  select pg_catalog.count(*),
         pg_catalog.count(distinct pg_catalog.lower(pg_catalog.btrim(category)))
  into category_count, unique_category_count
  from pg_catalog.jsonb_array_elements_text(p_categories) as entries(category);

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(p_categories) as entries(category)
    where pg_catalog.length(pg_catalog.btrim(category)) = 0
      or pg_catalog.length(pg_catalog.btrim(category)) > 80
  ) or category_count <> unique_category_count then
    raise exception 'Reminder categories must be unique, non-empty names of at most 80 characters';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_state:shared')::bigint
  );

  select state.revision into current_revision
  from public.daybook_state as state
  where state.id = 'shared'
  for update;

  if not found or current_revision is distinct from p_expected_revision then
    return false;
  end if;

  delete from public.reminder_categories where name is not null;
  insert into public.reminder_categories (name, position)
  select pg_catalog.btrim(category), position::integer
  from pg_catalog.jsonb_array_elements_text(p_categories)
    with ordinality as entries(category, position);

  return true;
end;
$$;

revoke all on function public.load_reminder_categories() from public, anon, authenticated;
grant execute on function public.load_reminder_categories() to service_role;
revoke all on function public.save_reminder_categories(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_reminder_categories(jsonb, text) to service_role;

notify pgrst, 'reload schema';
