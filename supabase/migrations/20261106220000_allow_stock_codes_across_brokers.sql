alter table public.stocks
  drop constraint if exists stocks_exchange_symbol_key;

notify pgrst, 'reload schema';
