-- Run in the Supabase SQL Editor after the normalized storage migration.
-- Personal name, address, and the full bond ledger account number are intentionally omitted.
begin;

do $$
declare
  v_bond jsonb := '{
    "id":"axis-bank-floating-rate-savings-bond-2020",
    "name":"Axis Bank Floating Rate Savings Bond 2020",
    "type":"Bond",
    "institution":"Axis Bank",
    "reference":"",
    "link":"",
    "currency":"INR",
    "investedValue":10000.00,
    "currentValue":10000.00,
    "quantity":null,
    "interestRate":null,
    "startDate":"2023-07-06",
    "maturityDate":"2030-07-06",
    "valuationDate":"",
    "bondScheme":"Floating Rate Savings Bonds, 2020 (Taxable)",
    "bondInterestPaymentFrequency":"Semi-annual",
    "bondCouponResetDates":"Every 01 January and 01 July",
    "location":"",
    "notes":"The holding certificate reports an investment of INR 10000 on 06 Jul 2023, repayment due 06 Jul 2030, and a balance of INR 10000. Interest is payable semi-annually and the coupon resets every 01 January and 01 July. The certificate date and current coupon rate are not shown; the balance is not a live market value.",
    "tags":["Government of India bond"]
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
  where record ->> 'type' = 'Bond'
    and record ->> 'institution' = 'Axis Bank'
    and record ->> 'name' = v_bond ->> 'name';

  if v_existing_count > 1 then
    raise exception 'More than one Axis Bank bond already uses display name %; resolve duplicates before importing.',
      v_bond ->> 'name';
  elsif v_existing_count = 1 then
    select id into v_existing_id
    from public.assets
    where record ->> 'type' = 'Bond'
      and record ->> 'institution' = 'Axis Bank'
      and record ->> 'name' = v_bond ->> 'name'
    for update;

    update public.assets
    set record = record || (v_bond - 'id') || pg_catalog.jsonb_build_object('id', v_existing_id)
    where id = v_existing_id;
  else
    if exists (select 1 from public.assets where id = v_bond ->> 'id') then
      raise exception 'Asset id % is already in use by a different record; resolve it before importing.',
        v_bond ->> 'id';
    end if;

    select coalesce(max(position), 0) + 1 into v_position
    from public.assets;

    insert into public.assets (id, position, record)
    values (v_bond ->> 'id', v_position, v_bond);
  end if;

  insert into public.daybook_state (id, data_version, revision, updated_at)
  values ('shared', 1, pg_catalog.gen_random_uuid()::text, pg_catalog.now())
  on conflict (id) do update
  set revision = excluded.revision,
      updated_at = excluded.updated_at;
end;
$$;

commit;
