create table if not exists public.daybook_data (
  id text primary key check (id = 'shared'),
  data jsonb not null,
  revision text not null,
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.daybook_data enable row level security;
revoke all on table public.daybook_data from public, anon, authenticated;
grant select, insert, update, delete on table public.daybook_data to service_role;

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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_data:shared')::bigint
  );

  select d.revision into current_revision
  from public.daybook_data as d
  where d.id = 'shared'
  for update;

  if not found then
    if p_expected_revision is not null then
      return;
    end if;

    next_revision := pg_catalog.gen_random_uuid()::text;
    insert into public.daybook_data (id, data, revision, updated_at)
    values ('shared', p_data, next_revision, pg_catalog.now());
    revision := next_revision;
    return next;
  end if;

  if current_revision is distinct from p_expected_revision then
    return;
  end if;

  next_revision := pg_catalog.gen_random_uuid()::text;
  update public.daybook_data as d
  set data = p_data, revision = next_revision, updated_at = pg_catalog.now()
  where d.id = 'shared';

  revision := next_revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data(jsonb, text) to service_role;

notify pgrst, 'reload schema';
