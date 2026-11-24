begin;

create table if not exists public.documents (
  id text primary key,
  position integer not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_documents (
  id text primary key,
  position integer not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.account_credentials (
  id text primary key,
  position integer not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.archived_account_credentials (
  id text primary key,
  position integer not null,
  record jsonb not null,
  archived_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.credential_vault (
  id text primary key check (id = 'shared'),
  vault jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.document_categories (
  id text primary key,
  position integer not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_document_attachments (
  personal_document_id text not null references public.personal_documents(id) on delete cascade,
  document_id text not null references public.documents(id) on delete cascade,
  position integer not null default 0,
  primary key (personal_document_id, document_id)
);

create table if not exists public.document_activity (
  id text primary key,
  module text not null check (module in ('Documents', 'Personal Documents', 'Account credentials')),
  record_id text not null,
  action text not null,
  performed_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.document_renewals (
  id text primary key,
  personal_document_id text not null references public.personal_documents(id) on delete cascade,
  previous_due_date date,
  new_due_date date,
  recorded_at timestamptz not null default now(),
  notes text not null default ''
);

create table if not exists public.document_reminders (
  id text primary key,
  document_id text references public.documents(id) on delete cascade,
  personal_document_id text references public.personal_documents(id) on delete cascade,
  due_on date not null,
  days_before integer not null check (days_before >= 0),
  delivery_status text not null default 'in-app'
    check (delivery_status in ('in-app', 'pending', 'sent', 'failed', 'not-configured')),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  check ((document_id is not null)::integer + (personal_document_id is not null)::integer = 1)
);

create index if not exists documents_record_gin_idx
  on public.documents using gin (record jsonb_path_ops);
create index if not exists personal_documents_record_gin_idx
  on public.personal_documents using gin (record jsonb_path_ops);
create index if not exists account_credentials_record_gin_idx
  on public.account_credentials using gin (record jsonb_path_ops);
create index if not exists document_activity_record_idx
  on public.document_activity (module, record_id, performed_at desc);
create index if not exists document_renewals_recorded_at_idx
  on public.document_renewals (personal_document_id, recorded_at desc);
create index if not exists document_reminders_due_on_idx
  on public.document_reminders (due_on, delivery_status);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'documents',
    'personal_documents',
    'account_credentials',
    'archived_account_credentials',
    'credential_vault',
    'document_categories',
    'personal_document_attachments',
    'document_activity',
    'document_renewals',
    'document_reminders'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end;
$$;

insert into public.document_categories (id, position, record)
values
  ('identity', 1, '{"id":"identity","name":"Identity","description":"","icon":"id-card","color":"#3B82F6","isSystem":true}'::jsonb),
  ('education', 2, '{"id":"education","name":"Education","description":"","icon":"graduation-cap","color":"#8B5CF6","isSystem":true}'::jsonb),
  ('employment', 3, '{"id":"employment","name":"Employment","description":"","icon":"briefcase","color":"#0D9488","isSystem":true}'::jsonb),
  ('financial', 4, '{"id":"financial","name":"Financial","description":"","icon":"wallet","color":"#16A34A","isSystem":true}'::jsonb),
  ('property', 5, '{"id":"property","name":"Property","description":"","icon":"house","color":"#F59E0B","isSystem":true}'::jsonb),
  ('vehicle', 6, '{"id":"vehicle","name":"Vehicle","description":"","icon":"car","color":"#2563EB","isSystem":true}'::jsonb),
  ('medical', 7, '{"id":"medical","name":"Medical","description":"","icon":"heart-pulse","color":"#EF4444","isSystem":true}'::jsonb),
  ('legal', 8, '{"id":"legal","name":"Legal","description":"","icon":"scale","color":"#64748B","isSystem":true}'::jsonb),
  ('other', 9, '{"id":"other","name":"Other","description":"","icon":"folder","color":"#94A3B8","isSystem":true}'::jsonb)
on conflict (id) do nothing;

commit;
