begin;

create table if not exists public.student_education_plans (
  id text primary key,
  student_profile_id text not null references public.student_profiles(id) on delete cascade,
  position integer not null,
  record jsonb not null
);

create table if not exists public.student_education_plan_costs (
  id text primary key,
  education_plan_id text not null references public.student_education_plans(id) on delete cascade,
  position integer not null,
  record jsonb not null
);

alter table public.student_education_plans enable row level security;
alter table public.student_education_plan_costs enable row level security;
revoke all on table public.student_education_plans, public.student_education_plan_costs from public, anon, authenticated;
grant select, insert, update, delete on table public.student_education_plans, public.student_education_plan_costs to service_role;

create or replace function public.save_daybook_data_with_plans(
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
  from public.save_daybook_data_with_students(p_data - 'educationPlans', p_expected_revision) as saved;
  if saved_revision is null then
    return;
  end if;

  if p_data ? 'educationPlans' then
    if pg_catalog.jsonb_typeof(p_data -> 'educationPlans') <> 'array' then
      raise exception 'Daybook collection educationPlans must be a JSON array';
    end if;

    delete from public.student_education_plans where id is not null;
    insert into public.student_education_plans (id, student_profile_id, position, record)
    select plan.entry ->> 'id', plan.entry ->> 'studentProfileId',
      plan.entry_position::integer, plan.entry - 'costs'
    from pg_catalog.jsonb_array_elements(p_data -> 'educationPlans')
      with ordinality as plan(entry, entry_position);

    insert into public.student_education_plan_costs (id, education_plan_id, position, record)
    select cost.entry ->> 'id', plan.entry ->> 'id', cost.entry_position::integer, cost.entry
    from pg_catalog.jsonb_array_elements(p_data -> 'educationPlans')
      with ordinality as plan(entry, plan_position)
    cross join lateral pg_catalog.jsonb_array_elements(plan.entry -> 'costs')
      with ordinality as cost(entry, entry_position);
  end if;

  revision := saved_revision;
  return next;
end;
$$;

create or replace function public.load_daybook_data_with_plans()
returns table (data jsonb, revision text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored record;
begin
  select current_data.data, current_data.revision into stored
  from public.load_daybook_data_with_students() as current_data;
  if not found then
    return;
  end if;

  data := stored.data || pg_catalog.jsonb_build_object(
    'educationPlans',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          plan.record || pg_catalog.jsonb_build_object(
            'costs',
            coalesce(
              (select pg_catalog.jsonb_agg(cost.record order by cost.position)
               from public.student_education_plan_costs as cost
               where cost.education_plan_id = plan.id),
              '[]'::jsonb
            )
          )
          order by plan.position
        )
        from public.student_education_plans as plan
      ),
      '[]'::jsonb
    )
  );
  revision := stored.revision;
  return next;
end;
$$;

revoke all on function public.save_daybook_data_with_plans(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_daybook_data_with_plans(jsonb, text) to service_role;
revoke all on function public.load_daybook_data_with_plans() from public, anon, authenticated;
grant execute on function public.load_daybook_data_with_plans() to service_role;

notify pgrst, 'reload schema';
commit;
