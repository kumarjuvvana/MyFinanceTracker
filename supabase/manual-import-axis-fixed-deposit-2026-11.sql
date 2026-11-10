-- Run in the Supabase SQL Editor after the normalized storage migration.
-- Account number and personal address/name details from the advice are intentionally omitted.
begin;

do $$
declare
  v_deposit jsonb := '{
    "id":"axis-fixed-deposit-mic-2026-09-13",
    "name":"Axis Bank Fixed Deposit (MIC)",
    "type":"Fixed deposit",
    "institution":"Axis Bank",
    "currency":"INR",
    "depositAmount":64500.00,
    "principalBalance":64500.00,
    "maturityAmount":64500.00,
    "interestRate":5.75,
    "startDate":"2026-09-13",
    "maturityDate":"2027-06-25",
    "depositTerm":"9 months 12 days",
    "depositScheme":"MIC",
    "maturityInstruction":"Re-Invest",
    "notes":"Axis Bank deposit advice reports deposit amount INR 64500.00, interest rate 5.75% p.a., start date 13 Sep 2026, maturity date 25 Jun 2027, and maturity amount INR 64500.00. The maturity amount is preserved exactly as printed and is not recalculated. Principal is a statement snapshot, not a live accrued balance."
  }'::jsonb;
  v_existing_count integer;
  v_existing_id text;
  v_position integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_state:shared')::bigint
  );

  select count(*) into v_existing_count
  from public.assets
  where record ->> 'type' = 'Fixed deposit'
    and record ->> 'name' = v_deposit ->> 'name';

  if v_existing_count > 1 then
    raise exception 'More than one fixed-deposit asset already uses display name %; resolve duplicates before importing.',
      v_deposit ->> 'name';
  elsif v_existing_count = 1 then
    select id into v_existing_id
    from public.assets
    where record ->> 'type' = 'Fixed deposit'
      and record ->> 'name' = v_deposit ->> 'name'
    for update;

    update public.assets
    set record = record || pg_catalog.jsonb_build_object(
      'name', v_deposit ->> 'name',
      'type', 'Fixed deposit',
      'institution', v_deposit ->> 'institution',
      'reference', '',
      'link', '',
      'currency', 'INR',
      'investedValue', (v_deposit ->> 'depositAmount')::numeric,
      'currentValue', (v_deposit ->> 'principalBalance')::numeric,
      'quantity', null,
      'interestRate', (v_deposit ->> 'interestRate')::numeric,
      'startDate', v_deposit ->> 'startDate',
      'maturityDate', v_deposit ->> 'maturityDate',
      'valuationDate', '',
      'maturityAmount', (v_deposit ->> 'maturityAmount')::numeric,
      'depositTerm', v_deposit ->> 'depositTerm',
      'depositScheme', v_deposit ->> 'depositScheme',
      'maturityInstruction', v_deposit ->> 'maturityInstruction',
      'location', '',
      'notes', v_deposit ->> 'notes',
      'tags', '[]'::jsonb
    )
    where id = v_existing_id;
  else
    if exists (select 1 from public.assets where id = v_deposit ->> 'id') then
      raise exception 'Asset id % is already in use by a different record; resolve it before importing.',
        v_deposit ->> 'id';
    end if;

    select coalesce(max(position), 0) + 1 into v_position
    from public.assets;

    insert into public.assets (id, position, record)
    values (
      v_deposit ->> 'id',
      v_position,
      pg_catalog.jsonb_build_object(
        'id', v_deposit ->> 'id',
        'name', v_deposit ->> 'name',
        'type', 'Fixed deposit',
        'institution', v_deposit ->> 'institution',
        'reference', '',
        'link', '',
        'currency', 'INR',
        'investedValue', (v_deposit ->> 'depositAmount')::numeric,
        'currentValue', (v_deposit ->> 'principalBalance')::numeric,
        'quantity', null,
        'interestRate', (v_deposit ->> 'interestRate')::numeric,
        'startDate', v_deposit ->> 'startDate',
        'maturityDate', v_deposit ->> 'maturityDate',
        'valuationDate', '',
        'maturityAmount', (v_deposit ->> 'maturityAmount')::numeric,
        'depositTerm', v_deposit ->> 'depositTerm',
        'depositScheme', v_deposit ->> 'depositScheme',
        'maturityInstruction', v_deposit ->> 'maturityInstruction',
        'location', '',
        'notes', v_deposit ->> 'notes',
        'tags', '[]'::jsonb
      )
    );
  end if;

  insert into public.daybook_state (id, data_version, revision, updated_at)
  values ('shared', 1, pg_catalog.gen_random_uuid()::text, pg_catalog.now())
  on conflict (id) do update
  set revision = excluded.revision,
      updated_at = excluded.updated_at;
end;
$$;

commit;
