-- Dedup log for event reminder emails (7-day and 1-day).
-- Apply via Supabase SQL editor or CLI before enabling the cron job.

create table if not exists public.event_reminder_sends (
  event_id uuid not null references public.events (event_id) on delete cascade,
  user_id uuid not null references public.users (user_id) on delete cascade,
  reminder_type text not null check (reminder_type in ('7d', '1d')),
  sent_at timestamptz not null default now(),
  primary key (event_id, user_id, reminder_type)
);

alter table public.event_reminder_sends enable row level security;

-- No client access — cron uses service role only.
create policy "event_reminder_sends_deny_all"
  on public.event_reminder_sends
  for all
  to authenticated, anon
  using (false)
  with check (false);
