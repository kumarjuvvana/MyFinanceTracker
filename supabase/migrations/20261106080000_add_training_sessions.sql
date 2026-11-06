begin;

create table if not exists public.training_sessions (
  id text primary key,
  position integer not null,
  record jsonb not null
);

alter table public.training_sessions enable row level security;
revoke all on table public.training_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.training_sessions to service_role;

create or replace function public.save_daybook_data_extended(
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
  collection_name text;
  table_name text;
begin
  select saved.revision into saved_revision
  from public.save_daybook_data(p_data, p_expected_revision) as saved;
  if saved_revision is null then
    return;
  end if;

  foreach collection_name in array array[
    'electricityReadings', 'devotionalEntries', 'prayerRequests',
    'cookingRecipes', 'cookingLogs', 'issueRecords',
    'personalEducation', 'professionalQualifications',
    'workExperiences', 'professionalSkills', 'familyMembers',
    'archivedRecords', 'trainingSessions'
  ]
  loop
    if p_data ? collection_name then
      if pg_catalog.jsonb_typeof(p_data -> collection_name) <> 'array' then
        raise exception 'Daybook collection % must be a JSON array', collection_name;
      end if;

      table_name := case collection_name
        when 'electricityReadings' then 'electricity_readings'
        when 'devotionalEntries' then 'devotional_entries'
        when 'prayerRequests' then 'prayer_requests'
        when 'cookingRecipes' then 'cooking_recipes'
        when 'cookingLogs' then 'cooking_logs'
        when 'issueRecords' then 'issue_records'
        when 'personalEducation' then 'personal_education'
        when 'professionalQualifications' then 'professional_qualifications'
        when 'workExperiences' then 'work_experiences'
        when 'professionalSkills' then 'professional_skills'
        when 'familyMembers' then 'family_members'
        when 'archivedRecords' then 'archived_records'
        when 'trainingSessions' then 'training_sessions'
      end;

      execute pg_catalog.format('delete from public.%I where id is not null', table_name);
      execute pg_catalog.format(
        'insert into public.%I (id, position, record)
         select entry ->> ''id'', entry_position::integer, entry
         from pg_catalog.jsonb_array_elements($1)
           with ordinality as entries(entry, entry_position)',
        table_name
      ) using p_data -> collection_name;
    end if;
  end loop;

  revision := saved_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data_extended()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored record;
begin
  select current_data.data, current_data.revision into stored
  from public.load_daybook_data() as current_data;
  if not found then
    return;
  end if;

  data := stored.data || pg_catalog.jsonb_build_object(
    'electricityReadings', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.electricity_readings as entry), '[]'::jsonb),
    'devotionalEntries', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.devotional_entries as entry), '[]'::jsonb),
    'prayerRequests', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.prayer_requests as entry), '[]'::jsonb),
    'cookingRecipes', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.cooking_recipes as entry), '[]'::jsonb),
    'cookingLogs', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.cooking_logs as entry), '[]'::jsonb),
    'issueRecords', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.issue_records as entry), '[]'::jsonb),
    'personalEducation', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.personal_education as entry), '[]'::jsonb),
    'professionalQualifications', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.professional_qualifications as entry), '[]'::jsonb),
    'workExperiences', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.work_experiences as entry), '[]'::jsonb),
    'professionalSkills', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.professional_skills as entry), '[]'::jsonb),
    'familyMembers', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.family_members as entry), '[]'::jsonb),
    'archivedRecords', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.archived_records as entry), '[]'::jsonb),
    'trainingSessions', coalesce((select pg_catalog.jsonb_agg(entry.record order by entry.position) from public.training_sessions as entry), '[]'::jsonb)
  );
  revision := stored.revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_extended(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_extended(jsonb, text) to service_role;
revoke all on function public.load_daybook_data_extended() from public, anon, authenticated;
grant execute on function public.load_daybook_data_extended() to service_role;

notify pgrst, 'reload schema';
commit;
