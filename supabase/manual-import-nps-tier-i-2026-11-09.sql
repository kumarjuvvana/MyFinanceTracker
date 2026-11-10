-- Run in the Supabase SQL Editor after the normalized storage migration.
-- Re-runs update the Tier I snapshot by its display name; PRAN and subscriber identifiers are not imported.
begin;

do $$
declare
  v_nps jsonb := '{
    "id":"nps-tier-i",
    "name":"National Pension System - Tier I",
    "type":"NPS",
    "institution":"LIC Pension Fund",
    "reference":"",
    "startDate":"2022-06-01",
    "valuationDate":"2026-11-09",
    "npsTier":"Tier I",
    "investedValue":135500.00,
    "currentValue":138692.91,
    "withdrawnValue":33570.26,
    "chargesValue":565.62,
    "lastWithdrawalDate":"2025-11-06",
    "npsSchemes":[
      {"schemeName":"LIC Pension Fund Scheme E - Tier I POP","allocationPercent":31,"units":950.6715,"nav":45.9680,"currentValue":43700.46},
      {"schemeName":"LIC Pension Fund Scheme C - Tier I POP","allocationPercent":35,"units":1617.6286,"nav":29.8347,"currentValue":48261.46},
      {"schemeName":"LIC Pension Fund Scheme G - Tier I POP","allocationPercent":34,"units":1487.4194,"nav":31.4175,"currentValue":46730.99}
    ],
    "notes":"Statement issued 10 Nov 2026; investment valuation as of 09 Nov 2026. Total contributions: INR 135500.00. Total withdrawals: INR 33570.26, including the partial withdrawal dated 06 Nov 2025. Statement charges: INR 565.62. Statement notional gain/loss after withdrawals: INR 36763.17. Values are a statement snapshot, not live. Historical transaction log is not imported."
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
  where record ->> 'type' = 'NPS'
    and record ->> 'name' = v_nps ->> 'name';

  if v_existing_count > 1 then
    raise exception 'More than one NPS Tier I asset already uses this display name; resolve duplicates before importing.';
  elsif v_existing_count = 1 then
    select id into v_existing_id
    from public.assets
    where record ->> 'type' = 'NPS'
      and record ->> 'name' = v_nps ->> 'name'
    for update;

    update public.assets
    set record = record || pg_catalog.jsonb_build_object(
      'name', v_nps ->> 'name',
      'type', 'NPS',
      'institution', v_nps ->> 'institution',
      'reference', '',
      'currency', 'INR',
      'quantity', null,
      'interestRate', null,
      'maturityDate', '',
      'installmentsPaid', null,
      'npsTier', v_nps ->> 'npsTier',
      'investedValue', (v_nps ->> 'investedValue')::numeric,
      'currentValue', (v_nps ->> 'currentValue')::numeric,
      'withdrawnValue', (v_nps ->> 'withdrawnValue')::numeric,
      'chargesValue', (v_nps ->> 'chargesValue')::numeric,
      'lastWithdrawalDate', v_nps ->> 'lastWithdrawalDate',
      'startDate', v_nps ->> 'startDate',
      'valuationDate', v_nps ->> 'valuationDate',
      'npsSchemes', v_nps -> 'npsSchemes',
      'notes', v_nps ->> 'notes'
    )
    where id = v_existing_id;
  else
    if exists (select 1 from public.assets where id = v_nps ->> 'id') then
      raise exception 'Asset id % is already in use by a different record; resolve it before importing.',
        v_nps ->> 'id';
    end if;

    select coalesce(max(position), 0) + 1 into v_position
    from public.assets;

    insert into public.assets (id, position, record)
    values (
      v_nps ->> 'id',
      v_position,
      pg_catalog.jsonb_build_object(
        'id', v_nps ->> 'id',
        'name', v_nps ->> 'name',
        'type', 'NPS',
        'institution', v_nps ->> 'institution',
        'reference', '',
        'link', '',
        'currency', 'INR',
        'investedValue', (v_nps ->> 'investedValue')::numeric,
        'currentValue', (v_nps ->> 'currentValue')::numeric,
        'quantity', null,
        'interestRate', null,
        'startDate', v_nps ->> 'startDate',
        'maturityDate', '',
        'valuationDate', v_nps ->> 'valuationDate',
        'installmentsPaid', null,
        'npsTier', v_nps ->> 'npsTier',
        'withdrawnValue', (v_nps ->> 'withdrawnValue')::numeric,
        'chargesValue', (v_nps ->> 'chargesValue')::numeric,
        'lastWithdrawalDate', v_nps ->> 'lastWithdrawalDate',
        'npsSchemes', v_nps -> 'npsSchemes',
        'location', '',
        'notes', v_nps ->> 'notes',
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
