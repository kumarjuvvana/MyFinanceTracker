create table if not exists public.daybook_state (
  id text primary key check (id = 'shared'),
  data_version integer not null check (data_version = 1),
  stock_seed_version integer,
  revision text not null,
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.shopping_items (
  id text primary key,
  position integer not null,
  record jsonb not null
);
create table if not exists public.purchases (
  id text primary key,
  position integer not null,
  record jsonb not null
);
create table if not exists public.shopping_trips (
  id text primary key,
  position integer not null,
  record jsonb not null
);
create table if not exists public.shopping_trip_purchases (
  trip_id text not null references public.shopping_trips(id) on delete cascade,
  purchase_id text not null references public.purchases(id) on delete cascade,
  position integer not null,
  primary key (trip_id, purchase_id)
);
create table if not exists public.stores (id text primary key, position integer not null, record jsonb not null);
create table if not exists public.products (id text primary key, position integer not null, record jsonb not null);
create table if not exists public.reminders (id text primary key, position integer not null, record jsonb not null);
create table if not exists public.reminder_categories (name text primary key, position integer not null);
create table if not exists public.brokers (name text primary key, position integer not null);
create table if not exists public.stocks (
  id text primary key,
  symbol text not null,
  exchange text not null,
  position integer not null,
  record jsonb not null,
  unique (exchange, symbol)
);
create table if not exists public.stock_quotes (
  id text primary key,
  stock_id text not null references public.stocks(id) on delete cascade,
  position integer not null,
  record jsonb not null
);
create table if not exists public.assets (id text primary key, position integer not null, record jsonb not null);
create table if not exists public.learning_records (id text primary key, position integer not null, record jsonb not null);
create table if not exists public.education_records (id text primary key, position integer not null, record jsonb not null);
create table if not exists public.education_subjects (
  id text primary key,
  education_id text not null references public.education_records(id) on delete cascade,
  position integer not null,
  record jsonb not null
);
create table if not exists public.education_exams (
  id text primary key,
  education_id text not null references public.education_records(id) on delete cascade,
  position integer not null,
  record jsonb not null
);
create table if not exists public.education_payments (
  id text primary key,
  education_id text not null references public.education_records(id) on delete cascade,
  position integer not null,
  record jsonb not null
);
create table if not exists public.vehicles (id text primary key, position integer not null, record jsonb not null);
create table if not exists public.vehicle_journeys (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  position integer not null,
  record jsonb not null
);
create table if not exists public.vehicle_maintenance (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  position integer not null,
  record jsonb not null
);
create table if not exists public.personal_records (id text primary key, position integer not null, record jsonb not null);
create table if not exists public.credential_vault (
  id text primary key check (id = 'shared'),
  vault jsonb not null
);

create index if not exists stock_quotes_stock_id_idx on public.stock_quotes (stock_id);
create index if not exists education_subjects_education_id_idx on public.education_subjects (education_id);
create index if not exists education_exams_education_id_idx on public.education_exams (education_id);
create index if not exists education_payments_education_id_idx on public.education_payments (education_id);
create index if not exists vehicle_journeys_vehicle_id_idx on public.vehicle_journeys (vehicle_id);
create index if not exists vehicle_maintenance_vehicle_id_idx on public.vehicle_maintenance (vehicle_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'daybook_state', 'shopping_items', 'purchases', 'shopping_trips',
    'shopping_trip_purchases', 'stores', 'products', 'reminders', 'reminder_categories', 'brokers',
    'stocks', 'stock_quotes', 'assets', 'learning_records', 'education_records',
    'education_subjects', 'education_exams', 'education_payments', 'vehicles',
    'vehicle_journeys', 'vehicle_maintenance', 'personal_records', 'credential_vault'
  ]
  loop
    execute pg_catalog.format('alter table public.%I enable row level security', table_name);
    execute pg_catalog.format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute pg_catalog.format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end;
$$;

create or replace function public.save_daybook_data(
  p_data jsonb,
  p_expected_revision text
)
returns table (revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision text;
  next_revision text;
begin
  if pg_catalog.jsonb_typeof(p_data) <> 'object'
    or pg_catalog.jsonb_typeof(p_data -> 'items') <> 'array'
    or pg_catalog.jsonb_typeof(p_data -> 'purchases') <> 'array'
    or pg_catalog.jsonb_typeof(p_data -> 'trips') <> 'array'
  then
    raise exception 'Invalid Daybook data document';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_state:shared')::bigint
  );

  select s.revision into current_revision
  from public.daybook_state as s
  where s.id = 'shared'
  for update;

  if not found then
    if p_expected_revision is not null then
      return;
    end if;
  elsif current_revision is distinct from p_expected_revision then
    return;
  end if;

  next_revision := pg_catalog.gen_random_uuid()::text;
  insert into public.daybook_state (id, data_version, stock_seed_version, revision, updated_at)
  values (
    'shared',
    (p_data ->> 'version')::integer,
    nullif(p_data ->> 'stockSeedVersion', '')::integer,
    next_revision,
    pg_catalog.now()
  )
  on conflict (id) do update
  set data_version = excluded.data_version,
      stock_seed_version = excluded.stock_seed_version,
      revision = excluded.revision,
      updated_at = excluded.updated_at;

  delete from public.shopping_trip_purchases where trip_id is not null;
  delete from public.stock_quotes where id is not null;
  delete from public.education_subjects where id is not null;
  delete from public.education_exams where id is not null;
  delete from public.education_payments where id is not null;
  delete from public.vehicle_journeys where id is not null;
  delete from public.vehicle_maintenance where id is not null;
  delete from public.shopping_items where id is not null;
  delete from public.purchases where id is not null;
  delete from public.shopping_trips where id is not null;
  delete from public.stores where id is not null;
  delete from public.products where id is not null;
  delete from public.reminders where id is not null;
  delete from public.brokers where name is not null;
  delete from public.stocks where id is not null;
  delete from public.assets where id is not null;
  delete from public.learning_records where id is not null;
  delete from public.education_records where id is not null;
  delete from public.vehicles where id is not null;
  delete from public.personal_records where id is not null;
  delete from public.credential_vault where id is not null;

  insert into public.shopping_items (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'items', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.purchases (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'purchases', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.shopping_trips (id, position, record)
  select entry ->> 'id', position::integer, entry - 'purchaseIds'
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'trips', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.shopping_trip_purchases (trip_id, purchase_id, position)
  select trip ->> 'id', purchase_id #>> '{}', position::integer
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'trips', '[]'::jsonb)) as trips(trip)
  cross join lateral pg_catalog.jsonb_array_elements(coalesce(trip -> 'purchaseIds', '[]'::jsonb))
    with ordinality as purchase_ids(purchase_id, position);

  insert into public.stores (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'stores', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.products (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'products', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.reminders (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'reminders', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.brokers (name, position)
  select broker, position::integer
  from pg_catalog.jsonb_array_elements_text(coalesce(p_data -> 'brokers', '[]'::jsonb))
    with ordinality as brokers(broker, position);

  insert into public.stocks (id, symbol, exchange, position, record)
  select entry ->> 'id', entry ->> 'symbol', entry ->> 'exchange', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'stocks', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.stock_quotes (id, stock_id, position, record)
  select entry ->> 'id', entry ->> 'stockId', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'stockQuotes', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.assets (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'assets', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.learning_records (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'learningRecords', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.education_records (id, position, record)
  select entry ->> 'id', position::integer, entry - 'subjects' - 'exams' - 'payments'
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'educationRecords', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.education_subjects (id, education_id, position, record)
  select child ->> 'id', education ->> 'id', child_position::integer, child
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'educationRecords', '[]'::jsonb)) as records(education)
  cross join lateral pg_catalog.jsonb_array_elements(coalesce(education -> 'subjects', '[]'::jsonb))
    with ordinality as children(child, child_position);

  insert into public.education_exams (id, education_id, position, record)
  select child ->> 'id', education ->> 'id', child_position::integer, child
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'educationRecords', '[]'::jsonb)) as records(education)
  cross join lateral pg_catalog.jsonb_array_elements(coalesce(education -> 'exams', '[]'::jsonb))
    with ordinality as children(child, child_position);

  insert into public.education_payments (id, education_id, position, record)
  select child ->> 'id', education ->> 'id', child_position::integer, child
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'educationRecords', '[]'::jsonb)) as records(education)
  cross join lateral pg_catalog.jsonb_array_elements(coalesce(education -> 'payments', '[]'::jsonb))
    with ordinality as children(child, child_position);

  insert into public.vehicles (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'vehicles', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.vehicle_journeys (id, vehicle_id, position, record)
  select entry ->> 'id', entry ->> 'vehicleId', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'vehicleJourneys', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.vehicle_maintenance (id, vehicle_id, position, record)
  select entry ->> 'id', entry ->> 'vehicleId', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'vehicleMaintenance', '[]'::jsonb))
    with ordinality as entries(entry, position);

  insert into public.personal_records (id, position, record)
  select entry ->> 'id', position::integer, entry
  from pg_catalog.jsonb_array_elements(coalesce(p_data -> 'personalRecords', '[]'::jsonb))
    with ordinality as entries(entry, position);

  if p_data ? 'credentialVault' and p_data -> 'credentialVault' <> 'null'::jsonb then
    insert into public.credential_vault (id, vault)
    values ('shared', p_data -> 'credentialVault');
  end if;

  revision := next_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  state_row public.daybook_state%rowtype;
  vault_data jsonb;
begin
  select s.* into state_row
  from public.daybook_state as s
  where s.id = 'shared';

  if not found then
    return;
  end if;

  data := pg_catalog.jsonb_build_object(
    'version', state_row.data_version,
    'items', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.shopping_items as t), '[]'::jsonb),
    'purchases', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.purchases as t), '[]'::jsonb),
    'trips', coalesce((
      select pg_catalog.jsonb_agg(
        t.record || pg_catalog.jsonb_build_object('purchaseIds', coalesce(links.ids, '[]'::jsonb))
        order by t.position
      )
      from public.shopping_trips as t
      left join lateral (
        select pg_catalog.jsonb_agg(to_jsonb(link.purchase_id) order by link.position) as ids
        from public.shopping_trip_purchases as link
        where link.trip_id = t.id
      ) as links on true
    ), '[]'::jsonb),
    'stores', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.stores as t), '[]'::jsonb),
    'products', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.products as t), '[]'::jsonb),
    'reminders', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.reminders as t), '[]'::jsonb),
    'brokers', coalesce((select pg_catalog.jsonb_agg(t.name order by t.position) from public.brokers as t), '[]'::jsonb),
    'stocks', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.stocks as t), '[]'::jsonb),
    'stockQuotes', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.stock_quotes as t), '[]'::jsonb),
    'assets', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.assets as t), '[]'::jsonb),
    'learningRecords', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.learning_records as t), '[]'::jsonb),
    'educationRecords', coalesce((
      select pg_catalog.jsonb_agg(
        t.record || pg_catalog.jsonb_build_object(
          'subjects', coalesce(children.subjects, '[]'::jsonb),
          'exams', coalesce(children.exams, '[]'::jsonb),
          'payments', coalesce(children.payments, '[]'::jsonb)
        )
        order by t.position
      )
      from public.education_records as t
      left join lateral (
        select
          (select pg_catalog.jsonb_agg(c.record order by c.position) from public.education_subjects as c where c.education_id = t.id) as subjects,
          (select pg_catalog.jsonb_agg(c.record order by c.position) from public.education_exams as c where c.education_id = t.id) as exams,
          (select pg_catalog.jsonb_agg(c.record order by c.position) from public.education_payments as c where c.education_id = t.id) as payments
      ) as children on true
    ), '[]'::jsonb),
    'vehicles', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.vehicles as t), '[]'::jsonb),
    'vehicleJourneys', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.vehicle_journeys as t), '[]'::jsonb),
    'vehicleMaintenance', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.vehicle_maintenance as t), '[]'::jsonb),
    'personalRecords', coalesce((select pg_catalog.jsonb_agg(t.record order by t.position) from public.personal_records as t), '[]'::jsonb)
  );

  if state_row.stock_seed_version is not null then
    data := data || pg_catalog.jsonb_build_object('stockSeedVersion', state_row.stock_seed_version);
  end if;

  select v.vault into vault_data
  from public.credential_vault as v
  where v.id = 'shared';

  if found then
    data := data || pg_catalog.jsonb_build_object('credentialVault', vault_data);
  end if;

  revision := state_row.revision;
  return next;
end;
$$;

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

revoke all on function public.save_daybook_data(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data(jsonb, text) to service_role;
revoke all on function public.load_daybook_data() from public, anon, authenticated;
grant execute on function public.load_daybook_data() to service_role;
revoke all on function public.load_reminder_categories() from public, anon, authenticated;
grant execute on function public.load_reminder_categories() to service_role;
revoke all on function public.save_reminder_categories(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_reminder_categories(jsonb, text) to service_role;

do $$
declare
  legacy_data jsonb;
  imported_revision text;
begin
  if pg_catalog.to_regclass('public.daybook_data') is not null
    and not exists (select 1 from public.daybook_state where id = 'shared')
  then
    execute 'select data from public.daybook_data where id = $1'
      into legacy_data
      using 'shared';

    if legacy_data is not null
      and pg_catalog.jsonb_typeof(legacy_data) = 'object'
      and pg_catalog.jsonb_typeof(legacy_data -> 'items') = 'array'
      and pg_catalog.jsonb_typeof(legacy_data -> 'purchases') = 'array'
      and pg_catalog.jsonb_typeof(legacy_data -> 'trips') = 'array'
    then
      select saved.revision into imported_revision
      from public.save_daybook_data(legacy_data, null) as saved;
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';
