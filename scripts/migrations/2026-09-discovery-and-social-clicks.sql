-- Internal product metrics: home discovery person-card clicks and public
-- profile social-chip clicks. Clients INSERT only; read via SQL editor /
-- service role (no SELECT policies for anon/authenticated).

-- ---------------------------------------------------------------------------
-- discovery_person_clicks
-- ---------------------------------------------------------------------------

create table if not exists public.discovery_person_clicks (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.users (user_id) on delete cascade,
  section text not null check (section in ('talent', 'makers')),
  viewer_user_id uuid references public.users (user_id) on delete set null,
  anon_session_id uuid,
  created_at timestamptz not null default now(),
  constraint discovery_person_clicks_viewer_xor check (
    (viewer_user_id is not null and anon_session_id is null)
    or (viewer_user_id is null and anon_session_id is not null)
  )
);

create index if not exists discovery_person_clicks_created_at_idx
  on public.discovery_person_clicks (created_at desc);

create index if not exists discovery_person_clicks_section_created_at_idx
  on public.discovery_person_clicks (section, created_at desc);

alter table public.discovery_person_clicks enable row level security;

create policy "discovery_person_clicks_insert_authenticated"
  on public.discovery_person_clicks
  for insert
  to authenticated
  with check (
    viewer_user_id = (select auth.uid())
    and anon_session_id is null
  );

create policy "discovery_person_clicks_insert_anon"
  on public.discovery_person_clicks
  for insert
  to anon
  with check (
    viewer_user_id is null
    and anon_session_id is not null
  );

grant insert on public.discovery_person_clicks to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profile_social_clicks
-- ---------------------------------------------------------------------------

create table if not exists public.profile_social_clicks (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references public.users (user_id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'tiktok', 'youtube')),
  viewer_user_id uuid references public.users (user_id) on delete set null,
  anon_session_id uuid,
  created_at timestamptz not null default now(),
  constraint profile_social_clicks_viewer_xor check (
    (viewer_user_id is not null and anon_session_id is null)
    or (viewer_user_id is null and anon_session_id is not null)
  )
);

create index if not exists profile_social_clicks_created_at_idx
  on public.profile_social_clicks (created_at desc);

create index if not exists profile_social_clicks_platform_created_at_idx
  on public.profile_social_clicks (platform, created_at desc);

alter table public.profile_social_clicks enable row level security;

create policy "profile_social_clicks_insert_authenticated"
  on public.profile_social_clicks
  for insert
  to authenticated
  with check (
    viewer_user_id = (select auth.uid())
    and anon_session_id is null
  );

create policy "profile_social_clicks_insert_anon"
  on public.profile_social_clicks
  for insert
  to anon
  with check (
    viewer_user_id is null
    and anon_session_id is not null
  );

grant insert on public.profile_social_clicks to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Example internal queries (SQL editor / service role)
-- ---------------------------------------------------------------------------
-- select section, count(*)
-- from public.discovery_person_clicks
-- where created_at > now() - interval '7 days'
-- group by section;
--
-- select platform, count(*)
-- from public.profile_social_clicks
-- where created_at > now() - interval '7 days'
-- group by platform;
--
-- select date_trunc('day', created_at) as day, count(*)
-- from public.discovery_person_clicks
-- group by 1
-- order by 1 desc;
