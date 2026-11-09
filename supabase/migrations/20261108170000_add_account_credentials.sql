begin;

create table if not exists public.account_credentials (
  id text primary key,
  position integer not null,
  record jsonb not null
);

alter table public.account_credentials enable row level security;
revoke all on table public.account_credentials from public, anon, authenticated;
grant select, insert, update, delete on table public.account_credentials to service_role;

create or replace function public.save_daybook_data_with_account_credentials(
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
  from public.save_daybook_data_with_bank_accounts(
    p_data - 'credentialRecords',
    p_expected_revision
  ) as saved;
  if saved_revision is null then
    return;
  end if;

  if p_data ? 'credentialRecords' then
    if pg_catalog.jsonb_typeof(p_data -> 'credentialRecords') <> 'array' then
      raise exception 'Daybook collection credentialRecords must be a JSON array';
    end if;

    for entry in select pg_catalog.jsonb_array_elements(p_data -> 'credentialRecords')
    loop
      if pg_catalog.jsonb_typeof(entry) <> 'object'
        or coalesce(entry ->> 'id', '') = ''
        or coalesce(entry ->> 'provider', '') = ''
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'category'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'website'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'username'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'password'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'recoveryInfo'), '') <> 'string'
        or coalesce(pg_catalog.jsonb_typeof(entry -> 'notes'), '') <> 'string'
        or pg_catalog.jsonb_typeof(entry -> 'tags') <> 'array'
        or pg_catalog.jsonb_typeof(entry -> 'additionalFields') <> 'array'
      then
        raise exception 'Invalid account credential record';
      end if;
    end loop;

    delete from public.account_credentials where id is not null;
    insert into public.account_credentials (id, position, record)
    select credential.entry ->> 'id', credential.entry_position::integer, credential.entry
    from pg_catalog.jsonb_array_elements(p_data -> 'credentialRecords')
      with ordinality as credential(entry, entry_position);
  end if;

  revision := saved_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data_with_account_credentials()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored record;
begin
  select current_data.data, current_data.revision into stored
  from public.load_daybook_data_with_bank_accounts() as current_data;
  if not found then
    return;
  end if;

  data := stored.data || pg_catalog.jsonb_build_object(
    'credentialRecords',
    coalesce(
      (
        select pg_catalog.jsonb_agg(credential.record order by credential.position)
        from public.account_credentials as credential
      ),
      '[]'::jsonb
    )
  );
  revision := stored.revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_with_account_credentials(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_with_account_credentials(jsonb, text) to service_role;
revoke all on function public.load_daybook_data_with_account_credentials() from public, anon, authenticated;
grant execute on function public.load_daybook_data_with_account_credentials() to service_role;

notify pgrst, 'reload schema';
commit;
