-- Run in the Supabase SQL Editor after the normalized storage migration.
-- Re-runs update matching provider records; calendar valuation dates were not visible in the screenshots.
-- Personal name and mobile number from the jeweller screenshot are intentionally omitted.
begin;

do $$
declare
  v_holdings jsonb := '[
    {
      "id":"gold-safegold-wallet",
      "name":"SafeGold wallet",
      "type":"Digital gold",
      "institution":"SafeGold",
      "reference":"SafeGold wallet",
      "quantity":3.0333,
      "investedValue":20811.00,
      "currentValue":46076.00,
      "installmentsPaid":null,
      "notes":"Gold weight, purchased amount, and current value copied from the supplied SafeGold screenshot. Calendar valuation date was not visible; figures are not live."
    },
    {
      "id":"gold-paytm-locker",
      "name":"Paytm Gold locker",
      "type":"Digital gold",
      "institution":"Paytm Gold",
      "reference":"Paytm Gold locker",
      "quantity":2.5595,
      "investedValue":17484.73,
      "currentValue":37939.50,
      "installmentsPaid":null,
      "notes":"Gold weight, invested amount, and current value copied from the supplied Paytm screenshot. Calendar valuation date was not visible; figures are not live."
    },
    {
      "id":"gold-vummidi-akshaya-sea-9",
      "name":"Vummidi Bangaru Akshaya Savings Scheme",
      "type":"Gold savings scheme",
      "institution":"Vummidi Bangaru Jewellers",
      "reference":"SEA - 9",
      "quantity":2.518,
      "investedValue":11000.00,
      "currentValue":null,
      "installmentsPaid":11,
      "notes":"Screenshot shows amount 11000.00, installment 11, and weight 2.518 g; confirm whether the amount is cumulative contributions or an installment amount. Maturity date was not visible; screenshot says gold can be claimed after maturity."
    }
  ]'::jsonb;
  v_holding jsonb;
  v_existing_count integer;
  v_existing_id text;
  v_position integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_state:shared')::bigint
  );

  for v_holding in
    select value from pg_catalog.jsonb_array_elements(v_holdings)
  loop
    select count(*) into v_existing_count
    from public.assets
    where record ->> 'type' = v_holding ->> 'type'
      and record ->> 'reference' = v_holding ->> 'reference';

    if v_existing_count > 1 then
      raise exception 'More than one asset already uses reference % and type %; resolve duplicates before importing.',
        v_holding ->> 'reference', v_holding ->> 'type';
    elsif v_existing_count = 1 then
      select id into v_existing_id
      from public.assets
      where record ->> 'type' = v_holding ->> 'type'
        and record ->> 'reference' = v_holding ->> 'reference'
      for update;

      update public.assets
      set record = record || pg_catalog.jsonb_build_object(
        'name', v_holding ->> 'name',
        'type', v_holding ->> 'type',
        'institution', v_holding ->> 'institution',
        'reference', v_holding ->> 'reference',
        'currency', 'INR',
        'investedValue', (v_holding ->> 'investedValue')::numeric,
        'currentValue', (v_holding ->> 'currentValue')::numeric,
        'quantity', (v_holding ->> 'quantity')::numeric,
        'valuationDate', '',
        'installmentsPaid', (v_holding ->> 'installmentsPaid')::integer,
        'notes', v_holding ->> 'notes'
      )
      where id = v_existing_id;
    else
      if exists (select 1 from public.assets where id = v_holding ->> 'id') then
        raise exception 'Asset id % is already in use by a different record; resolve it before importing.',
          v_holding ->> 'id';
      end if;

      select coalesce(max(position), 0) + 1 into v_position
      from public.assets;

      insert into public.assets (id, position, record)
      values (
        v_holding ->> 'id',
        v_position,
        pg_catalog.jsonb_build_object(
          'id', v_holding ->> 'id',
          'name', v_holding ->> 'name',
          'type', v_holding ->> 'type',
          'institution', v_holding ->> 'institution',
          'reference', v_holding ->> 'reference',
          'link', '',
          'currency', 'INR',
          'investedValue', (v_holding ->> 'investedValue')::numeric,
          'currentValue', (v_holding ->> 'currentValue')::numeric,
          'quantity', (v_holding ->> 'quantity')::numeric,
          'interestRate', null,
          'startDate', '',
          'maturityDate', '',
          'valuationDate', '',
          'installmentsPaid', (v_holding ->> 'installmentsPaid')::integer,
          'location', '',
          'notes', v_holding ->> 'notes',
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
