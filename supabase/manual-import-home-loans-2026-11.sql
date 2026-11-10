-- Run in the Supabase SQL Editor after the normalized storage migration.
-- Re-runs update these loan snapshots by display name; account numbers are intentionally omitted.
begin;

do $$
declare
  v_loans jsonb := '[
    {
      "id":"home-loan-sbi",
      "name":"SBI Home Loan",
      "type":"Home loan",
      "institution":"State Bank of India",
      "sanctionedAmount":1134000.00,
      "disbursedAmount":1083731.00,
      "principalOutstanding":949500.00,
      "interestPaidToDate":null,
      "interestRate":8.30,
      "interestRateType":"Unknown",
      "loanTenureMonths":408,
      "remainingTenureMonths":351,
      "emiAmount":8625.00,
      "startDate":"2022-01-30",
      "firstEmiDate":"2022-02-13",
      "lastStatementDate":"2026-11-10",
      "lenderLoanType":"Home loan",
      "notes":"SBI Account Summary as of 10 Nov 2026. Sanctioned amount INR 1134000.00; disbursed INR 1083731.00; outstanding amount as reported by SBI INR 949500.00. Rate 8.30%; original tenure 408 months; remaining tenure 351 months; EMI INR 8625.00. Loan sanctioned/opened 30 Jan 2022; first EMI 13 Feb 2022. The supplied statement does not provide cumulative interest paid, so it is left blank. No transaction rows imported."
    },
    {
      "id":"home-loan-hdfc",
      "name":"HDFC Home Loan",
      "type":"Home loan",
      "institution":"HDFC Bank",
      "sanctionedAmount":900000.00,
      "disbursedAmount":900000.00,
      "principalOutstanding":null,
      "interestPaidToDate":null,
      "interestRate":7.95,
      "interestRateType":"Floating",
      "loanTenureMonths":null,
      "remainingTenureMonths":null,
      "emiAmount":7578.00,
      "startDate":"",
      "firstEmiDate":"",
      "lastStatementDate":"2026-11-10",
      "lenderLoanType":"Variable rate home loan; monthly rest; rural",
      "notes":"HDFC statement dated 10 Nov 2026 covers 01 Apr 2026 to 10 Nov 2026. It reports loan amount/disbursement INR 900000.00, variable rate 7.95%, and current EMI INR 7578.00. This payment-account statement does not show current principal outstanding or cumulative interest paid; both are left blank. No transaction rows imported."
    }
  ]'::jsonb;
  v_loan jsonb;
  v_existing_count integer;
  v_existing_id text;
  v_position integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_state:shared')::bigint
  );

  for v_loan in
    select value from pg_catalog.jsonb_array_elements(v_loans)
  loop
    select count(*) into v_existing_count
    from public.assets
    where record ->> 'type' = 'Home loan'
      and record ->> 'name' = v_loan ->> 'name';

    if v_existing_count > 1 then
      raise exception 'More than one home-loan asset already uses display name %; resolve duplicates before importing.',
        v_loan ->> 'name';
    elsif v_existing_count = 1 then
      select id into v_existing_id
      from public.assets
      where record ->> 'type' = 'Home loan'
        and record ->> 'name' = v_loan ->> 'name'
      for update;

      update public.assets
      set record = record || pg_catalog.jsonb_build_object(
        'name', v_loan ->> 'name',
        'type', 'Home loan',
        'institution', v_loan ->> 'institution',
        'reference', '',
        'link', '',
        'currency', 'INR',
        'investedValue', (v_loan ->> 'disbursedAmount')::numeric,
        'currentValue', (v_loan ->> 'principalOutstanding')::numeric,
        'quantity', null,
        'interestRate', (v_loan ->> 'interestRate')::numeric,
        'interestRateType', v_loan ->> 'interestRateType',
        'sanctionedAmount', (v_loan ->> 'sanctionedAmount')::numeric,
        'principalOutstanding', (v_loan ->> 'principalOutstanding')::numeric,
        'interestPaidToDate', (v_loan ->> 'interestPaidToDate')::numeric,
        'loanTenureMonths', (v_loan ->> 'loanTenureMonths')::integer,
        'remainingTenureMonths', (v_loan ->> 'remainingTenureMonths')::integer,
        'emiAmount', (v_loan ->> 'emiAmount')::numeric,
        'startDate', v_loan ->> 'startDate',
        'firstEmiDate', v_loan ->> 'firstEmiDate',
        'lastStatementDate', v_loan ->> 'lastStatementDate',
        'lenderLoanType', v_loan ->> 'lenderLoanType',
        'maturityDate', '',
        'valuationDate', '',
        'installmentsPaid', null,
        'notes', v_loan ->> 'notes',
        'tags', '[]'::jsonb
      )
      where id = v_existing_id;
    else
      if exists (select 1 from public.assets where id = v_loan ->> 'id') then
        raise exception 'Asset id % is already in use by a different record; resolve it before importing.',
          v_loan ->> 'id';
      end if;

      select coalesce(max(position), 0) + 1 into v_position
      from public.assets;

      insert into public.assets (id, position, record)
      values (
        v_loan ->> 'id',
        v_position,
        pg_catalog.jsonb_build_object(
          'id', v_loan ->> 'id',
          'name', v_loan ->> 'name',
          'type', 'Home loan',
          'institution', v_loan ->> 'institution',
          'reference', '',
          'link', '',
          'currency', 'INR',
          'investedValue', (v_loan ->> 'disbursedAmount')::numeric,
          'currentValue', (v_loan ->> 'principalOutstanding')::numeric,
          'quantity', null,
          'interestRate', (v_loan ->> 'interestRate')::numeric,
          'interestRateType', v_loan ->> 'interestRateType',
          'sanctionedAmount', (v_loan ->> 'sanctionedAmount')::numeric,
          'principalOutstanding', (v_loan ->> 'principalOutstanding')::numeric,
          'interestPaidToDate', (v_loan ->> 'interestPaidToDate')::numeric,
          'loanTenureMonths', (v_loan ->> 'loanTenureMonths')::integer,
          'remainingTenureMonths', (v_loan ->> 'remainingTenureMonths')::integer,
          'emiAmount', (v_loan ->> 'emiAmount')::numeric,
          'startDate', v_loan ->> 'startDate',
          'firstEmiDate', v_loan ->> 'firstEmiDate',
          'lastStatementDate', v_loan ->> 'lastStatementDate',
          'lenderLoanType', v_loan ->> 'lenderLoanType',
          'maturityDate', '',
          'valuationDate', '',
          'installmentsPaid', null,
          'withdrawnValue', null,
          'chargesValue', null,
          'lastWithdrawalDate', '',
          'npsSchemes', '[]'::jsonb,
          'location', '',
          'notes', v_loan ->> 'notes',
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
