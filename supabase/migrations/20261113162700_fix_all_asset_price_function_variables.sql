begin;

create or replace function public.save_asset_price_updates(p_updates jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_quote_snapshot jsonb;
  v_asset_record jsonb;
  v_nps_schemes jsonb;
  v_nps_value numeric;
  v_nps_complete boolean;
  v_saved_count integer := 0;
  v_entry_type text;
  v_entry_id text;
  v_instrument_id text;
  v_instrument_name text;
  v_price_date date;
  v_fetched_at timestamptz;
  v_price numeric;
begin
  if p_updates is null or pg_catalog.jsonb_typeof(p_updates) <> 'array' then
    raise exception 'Price updates must be an array of at most 5000 records';
  end if;
  if pg_catalog.jsonb_array_length(p_updates) > 5000 then
    raise exception 'Price updates must be an array of at most 5000 records';
  end if;

  for v_entry in select pg_catalog.jsonb_array_elements(p_updates)
  loop
    if pg_catalog.jsonb_typeof(v_entry) <> 'object'
      or coalesce(v_entry ->> 'asset_type', '') not in ('Stocks', 'Mutual fund', 'NPS')
      or coalesce(v_entry ->> 'asset_id', '') = ''
      or coalesce(v_entry ->> 'asset_name', '') = ''
      or coalesce(v_entry ->> 'instrument_id', '') = ''
      or coalesce(v_entry ->> 'instrument_name', '') = ''
      or coalesce(v_entry ->> 'currency', '') !~ '^[A-Z]{3}$'
      or coalesce(v_entry ->> 'provider', '') = ''
      or coalesce(v_entry ->> 'price', '') !~ '^[0-9]+([.][0-9]+)?$'
      or (v_entry ->> 'price')::numeric <= 0
      or coalesce(v_entry ->> 'price_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(v_entry ->> 'fetched_at', '') = ''
    then
      raise exception 'Invalid asset price update record';
    end if;
    perform (v_entry ->> 'price_date')::date;
    perform (v_entry ->> 'fetched_at')::timestamptz;
    if v_entry ->> 'asset_type' = 'Stocks' and
      (coalesce(v_entry ->> 'market_state', '') = '' or
       coalesce(v_entry ->> 'previous_close', 'null') not in ('null', '') and
       (v_entry ->> 'previous_close') !~ '^[0-9]+([.][0-9]+)?$')
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

  for v_entry in select pg_catalog.jsonb_array_elements(p_updates)
  loop
    v_entry_type := v_entry ->> 'asset_type';
    v_entry_id := v_entry ->> 'asset_id';
    v_instrument_id := v_entry ->> 'instrument_id';
    v_instrument_name := v_entry ->> 'instrument_name';
    v_price := (v_entry ->> 'price')::numeric;
    v_price_date := (v_entry ->> 'price_date')::date;
    v_fetched_at := (v_entry ->> 'fetched_at')::timestamptz;

    if v_entry_type = 'Stocks' and not exists (select 1 from public.stocks where id = v_entry_id) then
      continue;
    elsif v_entry_type <> 'Stocks' and not exists (select 1 from public.assets where id = v_entry_id) then
      continue;
    end if;

    insert into public.asset_price_history (
      asset_type, asset_id, asset_name, instrument_id, instrument_name,
      price, price_date, currency, provider, fetched_at
    )
    values (
      v_entry_type, v_entry_id, v_entry ->> 'asset_name', v_instrument_id, v_instrument_name,
      v_price, v_price_date, v_entry ->> 'currency', v_entry ->> 'provider', v_fetched_at
    )
    on conflict (asset_type, asset_id, instrument_id, price_date) do update
    set asset_name = excluded.asset_name,
        instrument_name = excluded.instrument_name,
        price = excluded.price,
        currency = excluded.currency,
        provider = excluded.provider,
        fetched_at = excluded.fetched_at;

    if v_entry_type = 'Stocks' then
      v_quote_snapshot := pg_catalog.jsonb_build_object(
        'price', v_price,
        'currency', v_entry ->> 'currency',
        'timestamp', coalesce((v_entry ->> 'quote_timestamp')::timestamptz, v_fetched_at),
        'marketState', v_entry ->> 'market_state',
        'previousClose', case
          when coalesce(v_entry ->> 'previous_close', 'null') in ('null', '') then null
          else (v_entry ->> 'previous_close')::numeric
        end
      );
      update public.stocks
      set record = pg_catalog.jsonb_set(record, '{latestQuote}', v_quote_snapshot, true)
      where id = v_entry_id
        and coalesce(nullif(record #>> '{latestQuote,timestamp}', '')::timestamptz, 'epoch'::timestamptz)
          <= coalesce((v_entry ->> 'quote_timestamp')::timestamptz, v_fetched_at);
    elsif v_entry_type = 'Mutual fund' then
      select record into v_asset_record from public.assets where id = v_entry_id for update;
      if found then
        update public.assets
        set record = record || pg_catalog.jsonb_build_object(
          'latestNav', v_price,
          'latestNavDate', v_price_date,
          'currency', 'INR'
        ) || case
          when v_asset_record -> 'quantity' is not null and v_asset_record -> 'quantity' <> 'null'::jsonb
            then pg_catalog.jsonb_build_object(
              'currentValue', pg_catalog.round((v_asset_record ->> 'quantity')::numeric * v_price, 2),
              'valuationDate', v_price_date
            )
          else '{}'::jsonb
        end
        where id = v_entry_id
          and coalesce(nullif(record ->> 'latestNavDate', '')::date, '0001-01-01'::date) <= v_price_date;
      end if;
    else
      select record into v_asset_record from public.assets where id = v_entry_id for update;
      if found then
        select coalesce(pg_catalog.jsonb_agg(
          case
            when (scheme ->> 'schemeName' = v_instrument_name or scheme ->> 'schemeId' = v_instrument_id)
              and coalesce(nullif(scheme ->> 'navDate', '')::date, '0001-01-01'::date) <= v_price_date then
              scheme || pg_catalog.jsonb_build_object(
                'schemeId', v_instrument_id,
                'nav', v_price,
                'navDate', v_price_date
              ) || case
                when scheme -> 'units' is not null and scheme -> 'units' <> 'null'::jsonb
                  then pg_catalog.jsonb_build_object(
                    'currentValue', pg_catalog.round((scheme ->> 'units')::numeric * v_price, 2)
                  )
                else '{}'::jsonb
              end
            else scheme
          end order by scheme_position
        ), '[]'::jsonb)
        into v_nps_schemes
        from pg_catalog.jsonb_array_elements(coalesce(v_asset_record -> 'npsSchemes', '[]'::jsonb))
          with ordinality as schemes(scheme, scheme_position);

        select count(*) > 0 and pg_catalog.bool_and(
          scheme -> 'currentValue' <> 'null'::jsonb and scheme -> 'currentValue' is not null
        ), sum((scheme ->> 'currentValue')::numeric)
        into v_nps_complete, v_nps_value
        from pg_catalog.jsonb_array_elements(v_nps_schemes) as schemes(scheme);

        update public.assets
        set record = (record - 'npsSchemes') || pg_catalog.jsonb_build_object(
          'npsSchemes', v_nps_schemes,
          'currency', 'INR',
          'valuationDate', greatest(
            coalesce(nullif(record ->> 'valuationDate', '')::date, v_price_date),
            v_price_date
          )
        ) || case when v_nps_complete
          then pg_catalog.jsonb_build_object('currentValue', v_nps_value)
          else '{}'::jsonb
        end
        where id = v_entry_id;
      end if;
    end if;
    v_saved_count := v_saved_count + 1;
  end loop;

  update public.daybook_state
  set revision = pg_catalog.gen_random_uuid()::text, updated_at = pg_catalog.now()
  where id = 'shared';

  return v_saved_count;
end;
$$;

revoke all on function public.save_asset_price_updates(jsonb) from public, anon, authenticated;
grant execute on function public.save_asset_price_updates(jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
