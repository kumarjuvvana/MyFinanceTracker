begin;

create table if not exists public.gmail_oauth_connections (
  id text primary key check (id = 'daybook'),
  google_email text not null,
  encrypted_refresh_token text not null,
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists public.gmail_email_schedules (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  google_email text not null,
  recipient text not null check (pg_catalog.length(recipient) <= 320),
  subject text not null check (pg_catalog.length(subject) between 1 and 200),
  content text not null check (pg_catalog.length(content) between 1 and 10000),
  scheduled_for timestamptz not null,
  recurrence text not null default 'once' check (recurrence in ('once', 'daily', 'weekly')),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default pg_catalog.now(),
  sending_started_at timestamptz,
  sent_at timestamptz,
  last_error text check (last_error is null or pg_catalog.length(last_error) <= 500)
);

alter table public.gmail_email_schedules
  add column if not exists recurrence text not null default 'once'
  check (recurrence in ('once', 'daily', 'weekly'));

create index if not exists gmail_email_schedules_due_idx
  on public.gmail_email_schedules (scheduled_for)
  where status = 'pending';
create index if not exists gmail_email_schedules_created_idx
  on public.gmail_email_schedules (created_at desc);

alter table public.gmail_oauth_connections enable row level security;
alter table public.gmail_email_schedules enable row level security;
revoke all on table public.gmail_oauth_connections, public.gmail_email_schedules
  from public, anon, authenticated;
grant select, insert, update, delete on table public.gmail_oauth_connections,
  public.gmail_email_schedules to service_role;

create or replace function public.claim_due_gmail_email_schedules(
  p_now timestamptz default pg_catalog.now(),
  p_limit integer default 20
)
returns setof public.gmail_email_schedules
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gmail_email_schedules
  set status = 'failed',
      last_error = 'A previous send attempt did not finish. Check Gmail before creating another schedule.'
  where status = 'sending'
    and sending_started_at < p_now - interval '10 minutes';

  return query
  with due as (
    select schedule.id
    from public.gmail_email_schedules as schedule
    where schedule.status = 'pending'
      and schedule.scheduled_for <= p_now
    order by schedule.scheduled_for, schedule.created_at
    limit least(greatest(p_limit, 1), 20)
    for update skip locked
  )
  update public.gmail_email_schedules as schedule
  set status = 'sending',
      sending_started_at = p_now,
      last_error = null
  from due
  where schedule.id = due.id
  returning schedule.*;
end;
$$;

revoke all on function public.claim_due_gmail_email_schedules(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_gmail_email_schedules(timestamptz, integer)
  to service_role;

create or replace function public.complete_gmail_email_schedule(
  p_id uuid,
  p_status text,
  p_error text default null,
  p_now timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'Invalid scheduled email completion status';
  end if;

  update public.gmail_email_schedules as schedule
  set status = case
        when p_status = 'sent' and schedule.recurrence <> 'once' then 'pending'
        else p_status
      end,
      scheduled_for = case
        when p_status <> 'sent' then schedule.scheduled_for
        when schedule.recurrence = 'daily' then schedule.scheduled_for +
          (pg_catalog.floor(greatest(
            extract(epoch from (p_now - schedule.scheduled_for)), 0
          ) / 86400) + 1) * interval '1 day'
        when schedule.recurrence = 'weekly' then schedule.scheduled_for +
          (pg_catalog.floor(greatest(
            extract(epoch from (p_now - schedule.scheduled_for)), 0
          ) / 604800) + 1) * interval '7 days'
        else schedule.scheduled_for
      end,
      sent_at = case when p_status = 'sent' then p_now else schedule.sent_at end,
      last_error = case when p_status = 'failed' then left(coalesce(p_error, 'Email delivery failed.'), 500) else null end
  where schedule.id = p_id
    and schedule.status = 'sending';

  return case when found then 1 else 0 end;
end;
$$;

revoke all on function public.complete_gmail_email_schedule(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_gmail_email_schedule(uuid, text, text, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
commit;
