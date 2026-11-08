begin;

create table if not exists public.morning_exercise_activities (
  activity text primary key,
  position integer not null
);

alter table public.morning_exercise_activities enable row level security;
revoke all on table public.morning_exercise_activities from public, anon, authenticated;
grant select, insert, update, delete on table public.morning_exercise_activities to service_role;

insert into public.morning_exercise_activities (activity, position)
values
  ('Walking', 1),
  ('Brisk walking', 2),
  ('Jogging', 3),
  ('Running', 4),
  ('Yoga', 5),
  ('Stretching', 6),
  ('Strength training', 7),
  ('Bodyweight exercise', 8),
  ('Cycling', 9),
  ('Skipping rope', 10),
  ('Dance', 11),
  ('Breathing exercises', 12),
  ('Other', 13)
on conflict (activity) do nothing;

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
  from public.save_daybook_data_with_daily_bible_readings(
    p_data - 'dailyPrayerLogs' - 'morningExerciseLogs' - 'morningExerciseActivities',
    p_expected_revision
  ) as saved;
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

  if p_data ? 'morningExerciseLogs' then
    if pg_catalog.jsonb_typeof(p_data -> 'morningExerciseLogs') <> 'array' then
      raise exception 'Daybook collection morningExerciseLogs must be a JSON array';
    end if;

    delete from public.morning_exercise_logs where id is not null;
    insert into public.morning_exercise_logs (id, position, record)
    select exercise.entry ->> 'id', exercise.entry_position::integer, exercise.entry
    from pg_catalog.jsonb_array_elements(p_data -> 'morningExerciseLogs')
      with ordinality as exercise(entry, entry_position);
  end if;

  if p_data ? 'morningExerciseActivities' then
    if pg_catalog.jsonb_typeof(p_data -> 'morningExerciseActivities') <> 'array' then
      raise exception 'Daybook collection morningExerciseActivities must be a JSON array';
    end if;

    delete from public.morning_exercise_activities where activity is not null;
    insert into public.morning_exercise_activities (activity, position)
    select activity.value, activity.ordinality::integer
    from pg_catalog.jsonb_array_elements_text(p_data -> 'morningExerciseActivities')
      with ordinality as activity(value, ordinality);
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
    ),
    'morningExerciseLogs',
    coalesce(
      (
        select pg_catalog.jsonb_agg(exercise.record order by exercise.position)
        from public.morning_exercise_logs as exercise
      ),
      '[]'::jsonb
    ),
    'morningExerciseActivities',
    coalesce(
      (
        select pg_catalog.jsonb_agg(activity.activity order by activity.position)
        from public.morning_exercise_activities as activity
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
