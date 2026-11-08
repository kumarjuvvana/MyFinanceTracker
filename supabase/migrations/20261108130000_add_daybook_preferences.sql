begin;

create table if not exists public.daybook_preferences (
  id text primary key check (id = 'shared'),
  favorite_pages jsonb not null default '[]'::jsonb,
  preferences jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default pg_catalog.now(),
  check (pg_catalog.jsonb_typeof(favorite_pages) = 'array'),
  check (pg_catalog.jsonb_typeof(preferences) = 'object')
);

alter table public.daybook_preferences enable row level security;
revoke all on table public.daybook_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.daybook_preferences to service_role;

create or replace function public.load_daybook_preferences()
returns table (favorite_pages jsonb, preferences jsonb, revision text)
language sql
security definer
set search_path = ''
as $$
  select saved.favorite_pages, saved.preferences, saved.revision::text
  from public.daybook_preferences as saved
  where saved.id = 'shared';
$$;

create or replace function public.save_daybook_preferences(
  p_favorite_pages jsonb,
  p_preferences jsonb
)
returns table (revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_revision bigint;
begin
  if pg_catalog.jsonb_typeof(p_favorite_pages) is distinct from 'array' then
    raise exception 'Daybook favorite pages must be a JSON array';
  end if;
  if pg_catalog.jsonb_typeof(p_preferences) is distinct from 'object' then
    raise exception 'Daybook preferences must be a JSON object';
  end if;

  insert into public.daybook_preferences as existing (id, favorite_pages, preferences)
  values ('shared', p_favorite_pages, p_preferences)
  on conflict (id) do update
  set favorite_pages = excluded.favorite_pages,
      preferences = excluded.preferences,
      revision = existing.revision + 1,
      updated_at = pg_catalog.now()
  returning existing.revision into saved_revision;

  revision := saved_revision::text;
  return next;
end;
$$;

revoke all on function public.load_daybook_preferences() from public, anon, authenticated;
grant execute on function public.load_daybook_preferences() to service_role;
revoke all on function public.save_daybook_preferences(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_daybook_preferences(jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
