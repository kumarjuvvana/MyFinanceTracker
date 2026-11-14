begin;

create or replace function public.save_asset_price_updates(p_updates jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry jsonb;
  quote_snapshot jsonb;
  asset_record jsonb;
  nps_schemes jsonb;
  nps_value numeric;
  nps_complete boolean;
  saved_count integer := 0;
  entry_type text;
  entry_id text;
  v_instrument_id text;
  instrument_name text;
  price_date date;
  fetched_at timestamptz;
  price numeric;
begin
  if p_updates is null or pg_catalog.jsonb_typeof(p_updates) <> 'array' then
    raise exception 'Price updates must be an array of at most 5000 records';
  end if;
  if pg_catalog.jsonb_array_length(p_updates) > 5000 then
    raise exception 'Price updates must be an array of at most 5000 records';
  end if;

  for entry in select pg_catalog.jsonb_array_elements(p_updates)
  loop
    if pg_catalog.jsonb_typeof(entry) <> 'object'
      or coalesce(entry ->> 'asset_type', '') not in ('Stocks', 'Mutual fund', 'NPS')
      or coalesce(entry ->> 'asset_id', '') = ''
      or coalesce(entry ->> 'asset_name', '') = ''
      or coalesce(entry ->> 'instrument_id', '') = ''
      or coalesce(entry ->> 'instrument_name', '') = ''
      or coalesce(entry ->> 'currency', '') !~ '^[A-Z]{3}$'
      or coalesce(entry ->> 'provider', '') = ''
      or coalesce(entry ->> 'price', '') !~ '^[0-9]+([.][0-9]+)?$'
      or (entry ->> 'price')::numeric <= 0
      or coalesce(entry ->> 'price_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(entry ->> 'fetched_at', '') = ''
    then
      raise exception 'Invalid asset price update record';
    end if;
    perform (entry ->> 'price_date')::date;
    perform (entry ->> 'fetched_at')::timestamptz;
    if entry ->> 'asset_type' = 'Stocks' and
      (coalesce(entry ->> 'market_state', '') = '' or
       coalesce(entry ->> 'previous_close', 'null') not in ('null', '') and
       (entry ->> 'previous_close') !~ '^[0-9]+([.][0-9]+)?$')
    then
      raise exception 'Invalid stock quote information';
    end if;
  end loop;

  if pg_catalog.jsonb_array_length(p_updates) = 0 then
    return 0;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.daybook_state:shared')::bigint
  );

  for entry in select pg_catalog.jsonb_array_elements(p_updates)
  loop
    entry_type := entry ->> 'asset_type';
    entry_id := entry ->> 'asset_id';
    v_instrument_id := entry ->> 'instrument_id';
    instrument_name := entry ->> 'instrument_name';
    price := (entry ->> 'price')::numeric;
    price_date := (entry ->> 'price_date')::date;
    fetched_at := (entry ->> 'fetched_at')::timestamptz;

    if entry_type = 'Stocks' and not exists (select 1 from public.stocks where id = entry_id) then
      continue;
    elsif entry_type <> 'Stocks' and not exists (select 1 from public.assets where id = entry_id) then
      continue;
    end if;

    insert into public.asset_price_history (
      asset_type, asset_id, asset_name, instrument_id, instrument_name,
      price, price_date, currency, provider, fetched_at
    )
    values (
      entry_type, entry_id, entry ->> 'asset_name', v_instrument_id, instrument_name,
      price, price_date, entry ->> 'currency', entry ->> 'provider', fetched_at
    )
    on conflict (asset_type, asset_id, instrument_id, price_date) do update
    set asset_name = excluded.asset_name,
        instrument_name = excluded.instrument_name,
        price = excluded.price,
        currency = excluded.currency,
        provider = excluded.provider,
        fetched_at = excluded.fetched_at;

    if entry_type = 'Stocks' then
      quote_snapshot := pg_catalog.jsonb_build_object(
        'price', price,
        'currency', entry ->> 'currency',
        'timestamp', coalesce((entry ->> 'quote_timestamp')::timestamptz, fetched_at),
        'marketState', entry ->> 'market_state',
        'previousClose', case
          when coalesce(entry ->> 'previous_close', 'null') in ('null', '') then null
          else (entry ->> 'previous_close')::numeric
        end
      );
      update public.stocks
      set record = pg_catalog.jsonb_set(record, '{latestQuote}', quote_snapshot, true)
      where id = entry_id
        and coalesce(nullif(record #>> '{latestQuote,timestamp}', '')::timestamptz, 'epoch'::timestamptz)
          <= coalesce((entry ->> 'quote_timestamp')::timestamptz, fetched_at);
    elsif entry_type = 'Mutual fund' then
      select record into asset_record from public.assets where id = entry_id for update;
      if found then
        update public.assets
        set record = record || pg_catalog.jsonb_build_object(
          'latestNav', price,
          'latestNavDate', price_date,
          'currency', 'INR'
        ) || case
          when asset_record -> 'quantity' is not null and asset_record -> 'quantity' <> 'null'::jsonb
            then pg_catalog.jsonb_build_object(
              'currentValue', pg_catalog.round((asset_record ->> 'quantity')::numeric * price, 2),
              'valuationDate', price_date
            )
          else '{}'::jsonb
        end
        where id = entry_id
          and coalesce(nullif(record ->> 'latestNavDate', '')::date, '0001-01-01'::date) <= price_date;
      end if;
    else
      select record into asset_record from public.assets where id = entry_id for update;
      if found then
        select coalesce(pg_catalog.jsonb_agg(
          case
            when (scheme ->> 'schemeName' = instrument_name or scheme ->> 'schemeId' = v_instrument_id)
              and coalesce(nullif(scheme ->> 'navDate', '')::date, '0001-01-01'::date) <= price_date then
              scheme || pg_catalog.jsonb_build_object(
                'schemeId', v_instrument_id,
                'nav', price,
                'navDate', price_date
              ) || case
                when scheme -> 'units' is not null and scheme -> 'units' <> 'null'::jsonb
                  then pg_catalog.jsonb_build_object(
                    'currentValue', pg_catalog.round((scheme ->> 'units')::numeric * price, 2)
                  )
                else '{}'::jsonb
              end
            else scheme
          end order by scheme_position
        ), '[]'::jsonb)
        into nps_schemes
        from pg_catalog.jsonb_array_elements(coalesce(asset_record -> 'npsSchemes', '[]'::jsonb))
          with ordinality as schemes(scheme, scheme_position);

        select count(*) > 0 and pg_catalog.bool_and(
          scheme -> 'currentValue' <> 'null'::jsonb and scheme -> 'currentValue' is not null
        ), sum((scheme ->> 'currentValue')::numeric)
        into nps_complete, nps_value
        from pg_catalog.jsonb_array_elements(nps_schemes) as schemes(scheme);

        update public.assets
        set record = (record - 'npsSchemes') || pg_catalog.jsonb_build_object(
          'npsSchemes', nps_schemes,
          'currency', 'INR',
          'valuationDate', greatest(
            coalesce(nullif(record ->> 'valuationDate', '')::date, price_date),
            price_date
          )
        ) || case when nps_complete
          then pg_catalog.jsonb_build_object('currentValue', nps_value)
          else '{}'::jsonb
        end
        where id = entry_id;
      end if;
    end if;
    saved_count := saved_count + 1;
  end loop;

  update public.daybook_state
  set revision = pg_catalog.gen_random_uuid()::text, updated_at = pg_catalog.now()
  where id = 'shared';

  return saved_count;
end;
$$;

revoke all on function public.save_asset_price_updates(jsonb) from public, anon, authenticated;
grant execute on function public.save_asset_price_updates(jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
