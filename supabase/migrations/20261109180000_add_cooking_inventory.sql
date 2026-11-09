begin;

create table if not exists public.cooking_inventory_items (
  id text primary key,
  position integer not null check (position >= 0),
  record jsonb not null
);

create table if not exists public.cooking_inventory_state (
  singleton boolean primary key default true check (singleton),
  revision uuid not null default gen_random_uuid()
);

insert into public.cooking_inventory_state (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.cooking_inventory_items enable row level security;
alter table public.cooking_inventory_state enable row level security;
revoke all on table public.cooking_inventory_items, public.cooking_inventory_state from public, anon, authenticated;
grant select, insert, update, delete on table public.cooking_inventory_items to service_role;
grant select, insert, update on table public.cooking_inventory_state to service_role;

create or replace function public.load_cooking_inventory()
returns table (revision text, items jsonb)
language sql
security definer
set search_path = ''
as $$
  select state.revision::text,
    coalesce(
      (select pg_catalog.jsonb_agg(item.record order by item.position)
       from public.cooking_inventory_items as item),
      '[]'::jsonb
    )
  from public.cooking_inventory_state as state
  where state.singleton = true;
$$;

create or replace function public.replace_cooking_inventory(
  p_items jsonb,
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
  measure jsonb;
  entry_id text;
  item_position integer := 0;
begin
  if pg_catalog.jsonb_typeof(p_items) <> 'array' or p_expected_revision is null then
    raise exception 'Invalid cooking inventory update';
  end if;

  select state.revision into current_revision
  from public.cooking_inventory_state as state
  where state.singleton = true
  for update;

  if current_revision is null or current_revision::text <> p_expected_revision then
    return;
  end if;

  delete from public.cooking_inventory_items
  where id is not null;

  for entry in select pg_catalog.jsonb_array_elements(p_items)
  loop
    entry_id := entry ->> 'id';
    if pg_catalog.jsonb_typeof(entry) <> 'object'
      or coalesce(entry_id, '') = ''
      or coalesce(pg_catalog.jsonb_typeof(entry -> 'name'), '') <> 'string'
      or coalesce(pg_catalog.btrim(entry ->> 'name'), '') = ''
      or coalesce(pg_catalog.jsonb_typeof(entry -> 'category'), '') <> 'string'
      or coalesce(pg_catalog.jsonb_typeof(entry -> 'measures'), '') <> 'array'
    then
      raise exception 'Invalid cooking inventory item';
    end if;
    for measure in select pg_catalog.jsonb_array_elements(entry -> 'measures')
    loop
      if pg_catalog.jsonb_typeof(measure) <> 'object'
        or coalesce(measure ->> 'id', '') = ''
        or coalesce(pg_catalog.jsonb_typeof(measure -> 'unit'), '') <> 'string'
        or coalesce(pg_catalog.btrim(measure ->> 'unit'), '') = ''
        or coalesce(pg_catalog.jsonb_typeof(measure -> 'stockQuantity'), '') not in ('number', 'null')
        or coalesce(pg_catalog.jsonb_typeof(measure -> 'unitPrice'), '') not in ('number', 'null')
        or (pg_catalog.jsonb_typeof(measure -> 'stockQuantity') = 'number' and (measure ->> 'stockQuantity')::numeric < 0)
        or (pg_catalog.jsonb_typeof(measure -> 'unitPrice') = 'number' and (measure ->> 'unitPrice')::numeric < 0)
      then
        raise exception 'Invalid cooking inventory measure';
      end if;
    end loop;
    insert into public.cooking_inventory_items (id, position, record)
    values (entry_id, item_position, entry);
    item_position := item_position + 1;
  end loop;

  update public.cooking_inventory_state as state
  set revision = pg_catalog.gen_random_uuid()
  where state.singleton = true
  returning state.revision into next_revision;

  revision := next_revision::text;
  return next;
end;
$$;

revoke all on function public.load_cooking_inventory() from public, anon, authenticated;
grant execute on function public.load_cooking_inventory() to service_role;
revoke all on function public.replace_cooking_inventory(jsonb, text) from public, anon, authenticated;
grant execute on function public.replace_cooking_inventory(jsonb, text) to service_role;

notify pgrst, 'reload schema';
commit;
