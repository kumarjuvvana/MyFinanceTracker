begin;

create table if not exists public.important_date_categories (
  id text primary key,
  name text not null check (pg_catalog.length(pg_catalog.btrim(name)) between 1 and 80),
  position integer not null check (position >= 0),
  constraint important_date_categories_name_unique unique (name)
);

create table if not exists public.important_date_feelings (
  id text primary key,
  name text not null check (pg_catalog.length(pg_catalog.btrim(name)) between 1 and 60),
  sentiment text not null check (sentiment in ('Good', 'Bad', 'Mixed')),
  position integer not null check (position >= 0),
  constraint important_date_feelings_name_unique unique (name)
);

create table if not exists public.important_dates (
  id text primary key,
  title text not null check (pg_catalog.length(pg_catalog.btrim(title)) between 1 and 160),
  event_date date not null,
  category_id text not null references public.important_date_categories(id) on update cascade on delete restrict,
  feeling_id text references public.important_date_feelings(id) on update cascade on delete restrict,
  person_name text not null default '' check (pg_catalog.length(person_name) <= 120),
  note text not null default '' check (pg_catalog.length(note) <= 500),
  link text not null default '',
  show_reminder boolean not null default false,
  position integer not null check (position >= 0)
);

create index if not exists important_dates_event_date_idx
  on public.important_dates (event_date, position);

create table if not exists public.important_dates_state (
  singleton boolean primary key default true check (singleton),
  revision uuid not null default gen_random_uuid()
);

insert into public.important_dates_state (singleton)
values (true)
on conflict (singleton) do nothing;

insert into public.important_date_categories (id, name, position)
values
  ('important-category-personal', 'Personal', 0),
  ('important-category-family', 'Family', 1),
  ('important-category-education', 'Education', 2),
  ('important-category-career', 'Career', 3),
  ('important-category-purchase', 'Purchase', 4),
  ('important-category-other', 'Other', 5)
on conflict (id) do nothing;

insert into public.important_date_feelings (id, name, sentiment, position)
values
  ('important-feeling-good', 'Good', 'Good', 0),
  ('important-feeling-bad', 'Bad', 'Bad', 1),
  ('important-feeling-mixed', 'Mixed / neutral', 'Mixed', 2)
on conflict (id) do nothing;

alter table public.important_date_categories enable row level security;
alter table public.important_date_feelings enable row level security;
alter table public.important_dates enable row level security;
alter table public.important_dates_state enable row level security;
revoke all on table public.important_date_categories, public.important_date_feelings,
  public.important_dates, public.important_dates_state from public, anon, authenticated;
grant select, insert, update, delete on table public.important_date_categories,
  public.important_date_feelings, public.important_dates to service_role;
grant select, insert, update on table public.important_dates_state to service_role;

create or replace function public.load_important_dates()
returns table (revision text, dates jsonb, categories jsonb, feelings jsonb)
language sql
security definer
set search_path = ''
as $$
  select state.revision::text,
    coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', entry.id,
        'title', entry.title,
        'date', entry.event_date::text,
        'categoryId', entry.category_id,
        'feelingId', coalesce(entry.feeling_id, ''),
        'person', entry.person_name,
        'note', entry.note,
        'link', entry.link,
        'reminder', entry.show_reminder
      ) order by entry.position)
      from public.important_dates as entry
    ), '[]'::jsonb),
    coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', category.id, 'name', category.name
      ) order by category.position)
      from public.important_date_categories as category
    ), '[]'::jsonb),
    coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', feeling.id, 'name', feeling.name, 'sentiment', feeling.sentiment
      ) order by feeling.position)
      from public.important_date_feelings as feeling
    ), '[]'::jsonb)
  from public.important_dates_state as state
  where state.singleton = true;
$$;

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
      id, title, event_date, category_id, feeling_id, person_name, note, link, show_reminder, position
    )
    values (
      entry ->> 'id',
      pg_catalog.btrim(entry ->> 'title'),
      (entry ->> 'date')::date,
      entry ->> 'categoryId',
      nullif(entry ->> 'feelingId', ''),
      coalesce(entry ->> 'person', ''),
      coalesce(entry ->> 'note', ''),
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

revoke all on function public.load_important_dates() from public, anon, authenticated;
grant execute on function public.load_important_dates() to service_role;
revoke all on function public.replace_important_dates(jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.replace_important_dates(jsonb, jsonb, jsonb, text) to service_role;

notify pgrst, 'reload schema';
commit;
