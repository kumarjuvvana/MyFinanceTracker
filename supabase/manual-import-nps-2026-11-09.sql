-- Run in the Supabase SQL Editor after the normalized storage migration.
-- Re-runs update each tier by its display name; PRAN and subscriber identifiers are not imported.
begin;

do $$
declare
  v_accounts jsonb := '[
    {
      "id":"nps-tier-i",
      "name":"National Pension System - Tier I",
      "type":"NPS",
      "institution":"LIC Pension Fund",
      "npsTier":"Tier I",
      "investedValue":135500.00,
      "currentValue":138692.91,
      "withdrawnValue":33570.26,
      "chargesValue":565.62,
      "lastWithdrawalDate":"2025-11-06",
      "startDate":"2022-06-01",
      "valuationDate":"2026-11-09",
      "npsSchemes":[
        {"schemeName":"LIC Pension Fund Scheme E - Tier I POP","allocationPercent":31,"units":950.6715,"nav":45.9680,"currentValue":43700.46},
        {"schemeName":"LIC Pension Fund Scheme C - Tier I POP","allocationPercent":35,"units":1617.6286,"nav":29.8347,"currentValue":48261.46},
        {"schemeName":"LIC Pension Fund Scheme G - Tier I POP","allocationPercent":34,"units":1487.4194,"nav":31.4175,"currentValue":46730.99}
      ],
      "notes":"Statement issued 10 Nov 2026; investment valuation as of 09 Nov 2026. Total contributions: INR 135500.00. Total withdrawals: INR 33570.26, including the partial withdrawal dated 06 Nov 2025. Statement charges: INR 565.62. Statement notional gain/loss after withdrawals: INR 36763.17. Values are a statement snapshot, not live. Historical transaction log is not imported."
    },
    {
      "id":"nps-tier-ii",
      "name":"National Pension System - Tier II",
      "type":"NPS",
      "institution":"Axis Pension Fund Management Limited",
      "npsTier":"Tier II",
      "investedValue":46500.00,
      "currentValue":34217.60,
      "withdrawnValue":22651.74,
      "chargesValue":190.30,
      "lastWithdrawalDate":"2026-10-06",
      "startDate":"2022-06-01",
      "valuationDate":"2026-11-09",
      "npsSchemes":[
        {"schemeName":"NPS Trust A/C Axis Pension Fund Management Limited Scheme E - Tier II Direct","allocationPercent":52,"units":1217.2672,"nav":15.0085,"currentValue":18269.35},
        {"schemeName":"NPS Trust A/C Axis Pension Fund Management Limited Scheme C - Tier II Direct","allocationPercent":23,"units":592.8616,"nav":13.0977,"currentValue":7765.12},
        {"schemeName":"NPS Trust A/C Axis Pension Fund Management Limited Scheme G - Tier II Direct","allocationPercent":25,"units":636.9489,"nav":12.8474,"currentValue":8183.13}
      ],
      "notes":"Statement issued 10 Nov 2026; investment valuation as of 09 Nov 2026. Total contributions: INR 46500.00. Total withdrawals: INR 22651.74; the most recent withdrawal shown is 06 Oct 2026. Statement charges: INR 190.30. Statement notional gain/loss after withdrawals: INR 10369.34. Values are a statement snapshot, not live. Historical transaction log is not imported."
    }
  ]'::jsonb;
  v_account jsonb;
  v_existing_count integer;
  v_existing_id text;
  v_position integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_state:shared')::bigint
  );

  for v_account in
    select value from pg_catalog.jsonb_array_elements(v_accounts)
  loop
    select count(*) into v_existing_count
    from public.assets
    where record ->> 'type' = 'NPS'
      and record ->> 'name' = v_account ->> 'name';

    if v_existing_count > 1 then
      raise exception 'More than one NPS asset already uses display name %; resolve duplicates before importing.',
        v_account ->> 'name';
    elsif v_existing_count = 1 then
      select id into v_existing_id
      from public.assets
      where record ->> 'type' = 'NPS'
        and record ->> 'name' = v_account ->> 'name'
      for update;

      update public.assets
      set record = record || pg_catalog.jsonb_build_object(
        'name', v_account ->> 'name',
        'type', 'NPS',
        'institution', v_account ->> 'institution',
        'reference', '',
        'currency', 'INR',
        'quantity', null,
        'interestRate', null,
        'maturityDate', '',
        'installmentsPaid', null,
        'npsTier', v_account ->> 'npsTier',
        'investedValue', (v_account ->> 'investedValue')::numeric,
        'currentValue', (v_account ->> 'currentValue')::numeric,
        'withdrawnValue', (v_account ->> 'withdrawnValue')::numeric,
        'chargesValue', (v_account ->> 'chargesValue')::numeric,
        'lastWithdrawalDate', v_account ->> 'lastWithdrawalDate',
        'startDate', v_account ->> 'startDate',
        'valuationDate', v_account ->> 'valuationDate',
        'npsSchemes', v_account -> 'npsSchemes',
        'notes', v_account ->> 'notes'
      )
      where id = v_existing_id;
    else
      if exists (select 1 from public.assets where id = v_account ->> 'id') then
        raise exception 'Asset id % is already in use by a different record; resolve it before importing.',
          v_account ->> 'id';
      end if;

      select coalesce(max(position), 0) + 1 into v_position
      from public.assets;

      insert into public.assets (id, position, record)
      values (
        v_account ->> 'id',
        v_position,
        pg_catalog.jsonb_build_object(
          'id', v_account ->> 'id',
          'name', v_account ->> 'name',
          'type', 'NPS',
          'institution', v_account ->> 'institution',
          'reference', '',
          'link', '',
          'currency', 'INR',
          'investedValue', (v_account ->> 'investedValue')::numeric,
          'currentValue', (v_account ->> 'currentValue')::numeric,
          'quantity', null,
          'interestRate', null,
          'startDate', v_account ->> 'startDate',
          'maturityDate', '',
          'valuationDate', v_account ->> 'valuationDate',
          'installmentsPaid', null,
          'npsTier', v_account ->> 'npsTier',
          'withdrawnValue', (v_account ->> 'withdrawnValue')::numeric,
          'chargesValue', (v_account ->> 'chargesValue')::numeric,
          'lastWithdrawalDate', v_account ->> 'lastWithdrawalDate',
          'npsSchemes', v_account -> 'npsSchemes',
          'location', '',
          'notes', v_account ->> 'notes',
          'tags', '[]'::jsonb
        )
      );
    end if;
  end loop;

  insert into public.daybook_state (id, data_version, revision, updated_at)
  values ('shared', 1, pg_catalog.gen_random_uuid()::text, pg_catalog.now())
  on conflict (id) do update
  set revision = excluded.revision,
      updated_at = excluded.updated_at;
end;
$$;

commit;
