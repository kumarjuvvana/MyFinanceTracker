-- Run after migration 20261110160000_add_bank_balance_snapshots.sql.
-- Updates matching accounts already in the Bank accounts menu. No transactions or full
-- account/card numbers are stored in this script. Add any missing account in the UI.
begin;

update public.bank_accounts
set account_type = 'Savings',
    routing_code = 'UTIB0000780',
    branch = 'Nungambakkam, Chennai',
    current_balance = 16877.48,
    balance_as_of = date '2026-11-10'
where bank_name ilike '%axis%'
  and right(pg_catalog.regexp_replace(account_number, '[^0-9]', '', 'g'), 4) = '3711';

update public.bank_accounts
set account_type = 'Savings',
    current_balance = 910.91,
    balance_as_of = date '2026-11-10'
where bank_name ilike '%icici%'
  and right(pg_catalog.regexp_replace(account_number, '[^0-9]', '', 'g'), 4) = '1812';

update public.bank_accounts
set account_type = 'Savings',
    routing_code = 'SBIN0000578',
    branch = 'Patamata SME, Vijayawada',
    current_balance = 404.96,
    balance_as_of = date '2026-11-10'
where bank_name ilike '%sbi%'
  and right(pg_catalog.regexp_replace(account_number, '[^0-9]', '', 'g'), 4) = '5420';

update public.bank_accounts
set account_type = 'Savings',
    routing_code = 'SCBL0036088',
    branch = 'Mount Road',
    current_balance = 51551.00
where (bank_name ilike '%standard chartered%' or bank_name ilike '%sc bank%')
  and right(pg_catalog.regexp_replace(account_number, '[^0-9]', '', 'g'), 4) = '8008';

commit;
