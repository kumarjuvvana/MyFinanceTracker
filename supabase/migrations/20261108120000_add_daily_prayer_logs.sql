begin;

create table if not exists public.daily_prayer_logs (
  id text primary key,
  position integer not null,
  record jsonb not null
);

alter table public.daily_prayer_logs enable row level security;
revoke all on table public.daily_prayer_logs from public, anon, authenticated;
grant select, insert, update, delete on table public.daily_prayer_logs to service_role;

create or replace function public.save_daybook_data_with_daily_prayer_logs(
  p_data jsonb,
  p_expected_revision text
)
returns table (revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_revision text;
begin
  select saved.revision into saved_revision
  from public.save_daybook_data_with_daily_bible_readings(p_data - 'dailyPrayerLogs', p_expected_revision) as saved;
  if saved_revision is null then
    return;
  end if;

  if p_data ? 'dailyPrayerLogs' then
    if pg_catalog.jsonb_typeof(p_data -> 'dailyPrayerLogs') <> 'array' then
      raise exception 'Daybook collection dailyPrayerLogs must be a JSON array';
    end if;

    delete from public.daily_prayer_logs where id is not null;
    insert into public.daily_prayer_logs (id, position, record)
    select prayer.entry ->> 'id', prayer.entry_position::integer, prayer.entry
    from pg_catalog.jsonb_array_elements(p_data -> 'dailyPrayerLogs')
      with ordinality as prayer(entry, entry_position);
  end if;

  revision := saved_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data_with_daily_prayer_logs()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored record;
begin
  select current_data.data, current_data.revision into stored
  from public.load_daybook_data_with_daily_bible_readings() as current_data;
  if not found then
    return;
  end if;

  data := stored.data || pg_catalog.jsonb_build_object(
    'dailyPrayerLogs',
    coalesce(
      (
        select pg_catalog.jsonb_agg(prayer.record order by prayer.position)
        from public.daily_prayer_logs as prayer
      ),
      '[]'::jsonb
    )
  );
  revision := stored.revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_with_daily_prayer_logs(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_with_daily_prayer_logs(jsonb, text) to service_role;
revoke all on function public.load_daybook_data_with_daily_prayer_logs() from public, anon, authenticated;
grant execute on function public.load_daybook_data_with_daily_prayer_logs() to service_role;

notify pgrst, 'reload schema';
commit;
