begin;

create table if not exists public.database_connection_vault (
  id text primary key check (id = 'shared'),
  vault jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.database_connection_vault enable row level security;
revoke all on table public.database_connection_vault from public, anon, authenticated;
grant select, insert, update, delete on table public.database_connection_vault to service_role;

notify pgrst, 'reload schema';

commit;
