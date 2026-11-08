begin;

create table if not exists public.student_profiles (
  id text primary key,
  position integer not null,
  record jsonb not null
);

alter table public.student_profiles enable row level security;
revoke all on table public.student_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.student_profiles to service_role;

create or replace function public.save_daybook_data_with_students(
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
  from public.save_daybook_data_extended(p_data - 'studentProfiles', p_expected_revision) as saved;
  if saved_revision is null then
    return;
  end if;

  if p_data ? 'studentProfiles' then
    if pg_catalog.jsonb_typeof(p_data -> 'studentProfiles') <> 'array' then
      raise exception 'Daybook collection studentProfiles must be a JSON array';
    end if;

    delete from public.student_profiles where id is not null;
    insert into public.student_profiles (id, position, record)
    select entry ->> 'id', entry_position::integer, entry
    from pg_catalog.jsonb_array_elements(p_data -> 'studentProfiles')
      with ordinality as entries(entry, entry_position);
  end if;

  revision := saved_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data_with_students()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored record;
begin
  select current_data.data, current_data.revision into stored
  from public.load_daybook_data_extended() as current_data;
  if not found then
    return;
  end if;

  data := stored.data || pg_catalog.jsonb_build_object(
    'studentProfiles',
    coalesce(
      (select pg_catalog.jsonb_agg(entry.record order by entry.position)
       from public.student_profiles as entry),
      '[]'::jsonb
    )
  );
  revision := stored.revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_with_students(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_with_students(jsonb, text) to service_role;
revoke all on function public.load_daybook_data_with_students() from public, anon, authenticated;
grant execute on function public.load_daybook_data_with_students() to service_role;

notify pgrst, 'reload schema';
commit;
