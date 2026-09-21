-- 30-day interested-event reminders + connection-uploaded-event notification queue.
-- Apply to livon-test first; verify enqueue/claim/deny-all before production.

-- ---------------------------------------------------------------------------
-- 1. Expand reminder_type to include 30d
-- ---------------------------------------------------------------------------
alter table public.event_reminder_sends
  drop constraint if exists event_reminder_sends_reminder_type_check;

alter table public.event_reminder_sends
  add constraint event_reminder_sends_reminder_type_check
  check (reminder_type in ('30d', '7d', '1d'));

-- ---------------------------------------------------------------------------
-- 2. Private delivery queue for connection event-upload emails
-- ---------------------------------------------------------------------------
create table if not exists public.connection_event_notification_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (event_id) on delete cascade,
  recipient_user_id uuid not null references public.users (user_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (event_id, recipient_user_id)
);

create index if not exists connection_event_notification_queue_due_idx
  on public.connection_event_notification_queue (status, created_at)
  where status in ('pending', 'failed', 'processing');

create index if not exists connection_event_notification_queue_recipient_user_id_idx
  on public.connection_event_notification_queue (recipient_user_id);

alter table public.connection_event_notification_queue enable row level security;

revoke all on table public.connection_event_notification_queue from anon, authenticated;

drop policy if exists connection_event_notification_queue_deny_all
  on public.connection_event_notification_queue;
create policy connection_event_notification_queue_deny_all
  on public.connection_event_notification_queue
  for all
  to authenticated, anon
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- 3. Enqueue accepted connections when an event is inserted
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_connection_event_notifications()
returns trigger
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
begin
  insert into public.connection_event_notification_queue (event_id, recipient_user_id)
  select
    new.event_id,
    case
      when c.requester_id = new.organizer_id then c.receiver_id
      else c.requester_id
    end as recipient_user_id
  from public.connections c
  where c.status = 'accepted'
    and (c.requester_id = new.organizer_id or c.receiver_id = new.organizer_id)
  on conflict (event_id, recipient_user_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists events_enqueue_connection_notifications on public.events;
create trigger events_enqueue_connection_notifications
  after insert on public.events
  for each row
  execute function public.enqueue_connection_event_notifications();

revoke all on function public.enqueue_connection_event_notifications() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Claim / preview helpers (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.claim_connection_event_notifications(
  p_limit integer default 50,
  p_stale_minutes integer default 15,
  p_max_attempts integer default 5
)
returns table (
  queue_id uuid,
  event_id uuid,
  recipient_user_id uuid,
  recipient_email text,
  recipient_username text,
  event_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_name text,
  area_name text,
  organizer_username text
)
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_stale interval := make_interval(mins => greatest(1, coalesce(p_stale_minutes, 15)));
  v_max_attempts integer := greatest(1, coalesce(p_max_attempts, 5));
begin
  return query
  with due as (
    select q.id
    from public.connection_event_notification_queue q
    where
      (
        q.status = 'pending'
        or (
          q.status = 'failed'
          and q.attempt_count < v_max_attempts
        )
        or (
          q.status = 'processing'
          and q.claimed_at is not null
          and q.claimed_at < now() - v_stale
          and q.attempt_count < v_max_attempts
        )
      )
    order by q.created_at asc
    limit v_limit
    for update of q skip locked
  ),
  claimed as (
    update public.connection_event_notification_queue q
    set
      status = 'processing',
      claimed_at = now(),
      attempt_count = q.attempt_count + 1,
      last_error = null
    from due
    where q.id = due.id
    returning q.id, q.event_id, q.recipient_user_id
  )
  select
    c.id as queue_id,
    c.event_id,
    c.recipient_user_id,
    u.email as recipient_email,
    u.username as recipient_username,
    e.title as event_title,
    e.starts_at,
    e.ends_at,
    e.venue_name,
    a.name as area_name,
    organizer.username as organizer_username
  from claimed c
  join public.events e on e.event_id = c.event_id
  join public.users u on u.user_id = c.recipient_user_id
  join public.users organizer on organizer.user_id = e.organizer_id
  left join public.areas a on a.area_id = e.area_id;
end;
$function$;

create or replace function public.preview_connection_event_notifications(
  p_limit integer default 50,
  p_stale_minutes integer default 15,
  p_max_attempts integer default 5
)
returns table (
  queue_id uuid,
  event_id uuid,
  recipient_user_id uuid,
  recipient_email text,
  recipient_username text,
  event_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_name text,
  area_name text,
  organizer_username text
)
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_stale interval := make_interval(mins => greatest(1, coalesce(p_stale_minutes, 15)));
  v_max_attempts integer := greatest(1, coalesce(p_max_attempts, 5));
begin
  return query
  select
    q.id as queue_id,
    q.event_id,
    q.recipient_user_id,
    u.email as recipient_email,
    u.username as recipient_username,
    e.title as event_title,
    e.starts_at,
    e.ends_at,
    e.venue_name,
    a.name as area_name,
    organizer.username as organizer_username
  from public.connection_event_notification_queue q
  join public.events e on e.event_id = q.event_id
  join public.users u on u.user_id = q.recipient_user_id
  join public.users organizer on organizer.user_id = e.organizer_id
  left join public.areas a on a.area_id = e.area_id
  where
    (
      q.status = 'pending'
      or (
        q.status = 'failed'
        and q.attempt_count < v_max_attempts
      )
      or (
        q.status = 'processing'
        and q.claimed_at is not null
        and q.claimed_at < now() - v_stale
        and q.attempt_count < v_max_attempts
      )
    )
  order by q.created_at asc
  limit v_limit;
end;
$function$;

revoke all on function public.claim_connection_event_notifications(integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.preview_connection_event_notifications(integer, integer, integer)
  from public, anon, authenticated;

grant execute on function public.claim_connection_event_notifications(integer, integer, integer)
  to service_role;
grant execute on function public.preview_connection_event_notifications(integer, integer, integer)
  to service_role;

notify pgrst, 'reload schema';
