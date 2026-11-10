-- Run in the Supabase SQL Editor after the normalized storage migration.
-- Re-runs update matching funds by ISIN; full folio numbers are not imported.
begin;

do $$
declare
  v_holdings jsonb := '[
    {"isin":"INF846K01EW2","name":"Axis ELSS - Tax Saver Fund Direct Plan Growth Option","institution":"Axis Mutual Fund","units":293.486,"invested":15700.83,"current":33741.56},
    {"isin":"INF174K01AT3","name":"Kotak Gold Fund Regular Growth","institution":"Kotak Mahindra Mutual Fund","units":629.355,"invested":38211.38,"current":33937.40},
    {"isin":"INF179K01KZ8","name":"HDFC Nifty 50 Index Fund","institution":"HDFC Mutual Fund","units":163.723,"invested":38998.05,"current":39188.16},
    {"isin":"INF846K01859","name":"Axis Midcap Fund Regular Growth","institution":"Axis Mutual Fund","units":346.495,"invested":38998.05,"current":42064.49},
    {"isin":"INF109K01AF8","name":"ICICI Prudential Value Fund Regular Growth","institution":"ICICI Prudential Mutual Fund","units":93.381,"invested":39612.58,"current":44081.43},
    {"isin":"INF740K01243","name":"DSP Large Cap Fund Regular Plan Growth","institution":"DSP Mutual Fund","units":94.126,"invested":44997.75,"current":44807.74},
    {"isin":"INF179K01608","name":"HDFC Flexi Cap Fund Regular Growth","institution":"HDFC Mutual Fund","units":22.622,"invested":44997.75,"current":48133.28},
    {"isin":"INF579M01563","name":"360 ONE Liquid Fund Regular Daily Reinvestment of Income Distribution cum Capital Withdrawal","institution":"360 ONE Mutual Fund","units":134.835,"invested":134926.60,"current":134932.76},
    {"isin":"INF109K01TL6","name":"ICICI Prudential Gold ETF FoF Reinvestment of Income Distribution cum Capital Withdrawal","institution":"ICICI Prudential Mutual Fund","units":3616.663,"invested":108662.64,"current":157273.12}
  ]'::jsonb;
  v_holding jsonb;
  v_existing_id text;
  v_existing_count integer;
  v_asset_id text;
  v_position integer;
  v_statement_date text := '2026-11-09';
  v_snapshot_note text := 'Holdings snapshot from statement dated 09 Nov 2026. Values are statement-provided, not live NAV.';
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_state:shared')::bigint
  );

  for v_holding in
    select value from pg_catalog.jsonb_array_elements(v_holdings)
  loop
    select count(*) into v_existing_count
    from public.assets
    where record ->> 'type' = 'Mutual fund'
      and record ->> 'reference' = v_holding ->> 'isin';

    if v_existing_count > 1 then
      raise exception 'More than one mutual fund asset already uses ISIN %; resolve duplicates before importing.',
        v_holding ->> 'isin';
    elsif v_existing_count = 1 then
      select id into v_existing_id
      from public.assets
      where record ->> 'type' = 'Mutual fund'
        and record ->> 'reference' = v_holding ->> 'isin'
      for update;

      update public.assets
      set record = record || pg_catalog.jsonb_build_object(
        'name', v_holding ->> 'name',
        'type', 'Mutual fund',
        'institution', v_holding ->> 'institution',
        'reference', v_holding ->> 'isin',
        'currency', 'INR',
        'investedValue', (v_holding ->> 'invested')::numeric,
        'currentValue', (v_holding ->> 'current')::numeric,
        'quantity', (v_holding ->> 'units')::numeric,
        'valuationDate', v_statement_date
      )
      where id = v_existing_id;
    else
      v_asset_id := 'mf-' || pg_catalog.lower(v_holding ->> 'isin');
      if exists (select 1 from public.assets where id = v_asset_id) then
        raise exception 'Asset id % is already in use by a different record; resolve it before importing.',
          v_asset_id;
      end if;

      select coalesce(max(position), 0) + 1 into v_position
      from public.assets;

      insert into public.assets (id, position, record)
      values (
        v_asset_id,
        v_position,
        pg_catalog.jsonb_build_object(
          'id', v_asset_id,
          'name', v_holding ->> 'name',
          'type', 'Mutual fund',
          'institution', v_holding ->> 'institution',
          'reference', v_holding ->> 'isin',
          'link', '',
          'currency', 'INR',
          'investedValue', (v_holding ->> 'invested')::numeric,
          'currentValue', (v_holding ->> 'current')::numeric,
          'quantity', (v_holding ->> 'units')::numeric,
          'interestRate', null,
          'startDate', '',
          'maturityDate', '',
          'valuationDate', v_statement_date,
          'location', '',
          'notes', v_snapshot_note,
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
