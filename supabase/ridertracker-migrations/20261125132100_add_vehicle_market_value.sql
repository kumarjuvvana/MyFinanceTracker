begin;

alter table public.vehicles
  add column if not exists market_value numeric(14, 2);

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.vehicles'::regclass
      and conname = 'vehicles_market_value_nonnegative'
  ) then
    alter table public.vehicles
      add constraint vehicles_market_value_nonnegative
      check (market_value is null or market_value >= 0);
  end if;
end
$migration$;

commit;
