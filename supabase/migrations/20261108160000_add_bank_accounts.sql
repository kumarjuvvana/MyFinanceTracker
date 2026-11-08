-- Adds direct-access bank account storage and backup-aware RPCs.
begin;

create table if not exists public.bank_accounts (
  id text primary key,
  position integer not null,
  bank_name text not null,
  account_holder text not null,
  account_type text not null,
  account_number text not null,
  routing_code text not null,
  branch text not null,
  website text not null,
  customer_service text not null,
  notes text not null
);

alter table public.bank_accounts enable row level security;
revoke all on table public.bank_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.bank_accounts to service_role;

create or replace function public.save_daybook_data_with_bank_accounts(
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
  entry jsonb;
begin
  select saved.revision into saved_revision
  from public.save_daybook_data_with_daily_prayer_logs(
    p_data - 'bankAccounts',
    p_expected_revision
  ) as saved;
  if saved_revision is null then
    return;
  end if;

  if p_data ? 'bankAccounts' then
    if pg_catalog.jsonb_typeof(p_data -> 'bankAccounts') <> 'array' then
      raise exception 'Daybook collection bankAccounts must be a JSON array';
    end if;

    for entry in select pg_catalog.jsonb_array_elements(p_data -> 'bankAccounts')
    loop
      if pg_catalog.jsonb_typeof(entry) <> 'object'
        or coalesce(entry ->> 'id', '') = ''
        or coalesce(entry ->> 'bankName', '') = ''
        or coalesce(entry ->> 'accountHolder', '') = ''
        or coalesce(entry ->> 'accountType', '') = ''
        or coalesce(entry ->> 'accountNumber', '') = ''
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'routingCode'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'branch'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'website'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'customerService'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'notes'), '') <> 'string'
      then
        raise exception 'Invalid bank account record';
      end if;
    end loop;

    delete from public.bank_accounts where id is not null;
    insert into public.bank_accounts (
      id, position, bank_name, account_holder, account_type, account_number,
      routing_code, branch, website, customer_service, notes
    )
    select
      bank.entry ->> 'id',
      bank.entry_position::integer,
      bank.entry ->> 'bankName',
      bank.entry ->> 'accountHolder',
      bank.entry ->> 'accountType',
      bank.entry ->> 'accountNumber',
      bank.entry ->> 'routingCode',
      bank.entry ->> 'branch',
      bank.entry ->> 'website',
      bank.entry ->> 'customerService',
      bank.entry ->> 'notes'
    from pg_catalog.jsonb_array_elements(p_data -> 'bankAccounts')
      with ordinality as bank(entry, entry_position);
  end if;

  revision := saved_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data_with_bank_accounts()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored record;
begin
  select current_data.data, current_data.revision into stored
  from public.load_daybook_data_with_daily_prayer_logs() as current_data;
  if not found then
    return;
  end if;

  data := stored.data || pg_catalog.jsonb_build_object(
    'bankAccounts',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', bank.id,
            'bankName', bank.bank_name,
            'accountHolder', bank.account_holder,
            'accountType', bank.account_type,
            'accountNumber', bank.account_number,
            'routingCode', bank.routing_code,
            'branch', bank.branch,
            'website', bank.website,
            'customerService', bank.customer_service,
            'notes', bank.notes
          ) order by bank.position
        )
        from public.bank_accounts as bank
      ),
      '[]'::jsonb
    )
  );
  revision := stored.revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_with_bank_accounts(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_with_bank_accounts(jsonb, text) to service_role;
revoke all on function public.load_daybook_data_with_bank_accounts() from public, anon, authenticated;
grant execute on function public.load_daybook_data_with_bank_accounts() to service_role;

notify pgrst, 'reload schema';
commit;
