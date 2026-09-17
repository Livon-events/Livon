-- Remediates docs/security-definer-risks.md (R1-R8).
--
-- Every SECURITY DEFINER function in `public` is an API endpoint: it runs as
-- its owner and bypasses RLS. This migration gives each one an explicit role
-- allowlist, bounds every caller-controlled input, and pins search_path to ''
-- so no object is ever resolved through a schema a caller could influence.
--
-- Apply order: this must run AFTER the pending talent/discovery migrations
-- (2026-09-event-talent-and-home-discovery.sql,
-- 2026-09-get-public-profile-youtube.sql,
-- 2026-09-public-profile-talent-events.sql), which create event_talent,
-- users.youtube_url, and the three public-read functions referenced below.
--
-- It also replaces redeem_invite's 2-argument signature with a 4-argument
-- server-only one, so it must be applied together with the matching deploy of
-- src/app/i/[code]/route.ts. Applying it to a project whose deployed code
-- still calls the old signature breaks every /i/{code} invite link.

BEGIN;

-- ---------------------------------------------------------------------------
-- R2: resolve_login_email returned a private email address for any username,
-- to anonymous callers. Sign-in is Google OAuth only (src/modules/auth/
-- mutations.ts) and nothing in the tree calls it, so it is removed rather
-- than restricted. If username sign-in returns, it must be a server-only
-- operation that returns one generic auth result, never the email.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.resolve_login_email(text);

-- ---------------------------------------------------------------------------
-- Internal helpers (R1, R7)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_interval interval
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_row public.rpc_rate_limits;
begin
  insert into public.rpc_rate_limits (rate_key, window_start, request_count)
  values (p_key, now(), 1)
  on conflict (rate_key) do update
    set request_count = case
          when public.rpc_rate_limits.window_start < now() - p_window_interval
            then 1
          else public.rpc_rate_limits.request_count + 1
        end,
        window_start = case
          when public.rpc_rate_limits.window_start < now() - p_window_interval
            then now()
          else public.rpc_rate_limits.window_start
        end
  returning * into v_row;

  return v_row.request_count <= p_max_requests;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  base_username text;
  candidate text;
  suffix int := 1;
begin
  -- Email+password signup passes an explicit username; Google does not.
  base_username := new.raw_user_meta_data->>'username';

  if base_username is null then
    base_username := lower(regexp_replace(
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      '[^a-zA-Z0-9]+', '_', 'g'
    ));
    base_username := trim(both '_' from base_username);
  end if;

  candidate := base_username;

  -- Dedup: append a numeric suffix if the username is taken (case-insensitive).
  while exists (select 1 from public.users where lower(username) = lower(candidate)) loop
    suffix := suffix + 1;
    candidate := base_username || suffix;
  end loop;

  insert into public.users (user_id, email, username, avatar_url)
  values (
    new.id,
    new.email,
    candidate,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Organizer-only reads and writes (R3, R7)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := (select auth.uid());
  v_email text;
  v_email_confirmed_at timestamptz;
  v_livon uuid;
  v_organizer_id uuid;
  v_claimed_at timestamptz;
  v_intended_user uuid;
  v_intended_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT u.user_id INTO v_livon
  FROM public.users u
  WHERE lower(u.username) = 'livon'
  LIMIT 1;

  IF v_livon IS NULL THEN
    RAISE EXCEPTION 'not_claimable' USING ERRCODE = 'P0001';
  END IF;

  SELECT e.organizer_id, e.claimed_at, e.intended_claim_user_id, e.intended_claim_email
  INTO v_organizer_id, v_claimed_at, v_intended_user, v_intended_email
  FROM public.events e
  WHERE e.event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_organizer_id IS DISTINCT FROM v_livon OR v_claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'not_claimable' USING ERRCODE = 'P0001';
  END IF;

  IF v_intended_user IS NOT NULL THEN
    IF v_intended_user IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'not_invited' USING ERRCODE = '42501';
    END IF;
  ELSIF v_intended_email IS NOT NULL AND length(trim(v_intended_email)) > 0 THEN
    SELECT u.email, u.email_confirmed_at
    INTO v_email, v_email_confirmed_at
    FROM auth.users u
    WHERE u.id = v_uid;

    IF v_email_confirmed_at IS NULL THEN
      RAISE EXCEPTION 'email_not_verified' USING ERRCODE = '42501';
    END IF;

    IF v_email IS NULL OR lower(v_email) <> lower(trim(v_intended_email)) THEN
      RAISE EXCEPTION 'not_invited' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'not_invited' USING ERRCODE = '42501';
  END IF;

  UPDATE public.events
  SET
    organizer_id = v_uid,
    claimed_by = v_uid,
    claimed_at = now(),
    updated_at = now()
  WHERE event_id = p_event_id;
END;
$function$;

-- Returns the full guestlist and attendee social links to the organizer,
-- deliberately ignoring per-attendee RSVP visibility (accepted exception,
-- docs/security-definer-risks.md R8). Never add email or view identifiers here.
CREATE OR REPLACE FUNCTION public.get_event_management_data(p_event_id uuid)
RETURNS TABLE(
  event_id uuid,
  organizer_id uuid,
  venue_name text,
  starts_at timestamp with time zone,
  area_name text,
  attending_count integer,
  shares_count integer,
  views_count integer,
  attendees jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select
    e.event_id,
    e.organizer_id,
    e.venue_name,
    e.starts_at,
    a.name as area_name,
    (
      select count(*)::integer
      from public.event_interests ei
      where ei.event_id = e.event_id
    ) as attending_count,
    (
      select count(*)::integer
      from public.invite_links il
      where il.event_id = e.event_id
    ) as shares_count,
    (
      (
        select count(*)::integer
        from public.event_views ev
        where ev.event_id = e.event_id
      ) + (
        select count(*)::integer
        from public.anonymous_event_views aev
        where aev.event_id = e.event_id
      )
    )::integer as views_count,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'user_id', u.user_id,
            'username', u.username,
            'avatar_url', u.avatar_url,
            'instagram_url', u.instagram_url,
            'facebook_url', u.facebook_url,
            'tiktok_url', u.tiktok_url
          )
          order by ei.created_at desc
        ),
        '[]'::jsonb
      )
      from public.event_interests ei
      join public.users u on u.user_id = ei.user_id
      where ei.event_id = e.event_id
    ) as attendees
  from public.events e
  left join public.areas a on a.area_id = e.area_id
  where e.event_id = p_event_id
    and e.organizer_id = (select auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.get_my_event_view_stats(p_event_id uuid)
RETURNS TABLE(
  total_views bigint,
  total_unique_viewers bigint,
  total_authenticated_views bigint,
  unique_authenticated_viewers bigint,
  total_anonymous_views bigint,
  unique_anonymous_viewers bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  if not exists (
    select 1 from public.events
    where events.event_id = p_event_id
    and events.organizer_id = (select auth.uid())
  ) then
    raise exception 'Not authorized to view stats for this event';
  end if;

  return query
  select
    s.total_views, s.total_unique_viewers,
    s.total_authenticated_views, s.unique_authenticated_viewers,
    s.total_anonymous_views, s.unique_anonymous_viewers
  from public.event_view_stats s
  where s.event_id = p_event_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Public reads (R4, R7)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.event_going_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select count(*)::integer
  from public.event_interests
  where event_id = p_event_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_connections_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select count(*)::integer
  from public.connections
  where status = 'accepted'
    and (requester_id = p_user_id or receiver_id = p_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  bio text,
  avatar_url text,
  tiktok_url text,
  instagram_url text,
  facebook_url text,
  youtube_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select
    u.user_id,
    u.username,
    u.bio,
    u.avatar_url,
    u.tiktok_url,
    u.instagram_url,
    u.facebook_url,
    u.youtube_url
  from public.users u
  where u.user_id = p_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_username_to_user_id(p_username text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select user_id
  from public.users
  where username = p_username
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_event_talent(p_event_id uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  bio text,
  tiktok_url text,
  instagram_url text,
  facebook_url text,
  youtube_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    u.user_id,
    u.username,
    u.avatar_url,
    u.bio,
    u.tiktok_url,
    u.instagram_url,
    u.facebook_url,
    u.youtube_url
  FROM public.event_talent et
  JOIN public.users u ON u.user_id = et.talent_user_id
  WHERE et.event_id = p_event_id
    AND u.username IS NOT NULL
  ORDER BY et.position ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile_events(p_user_id uuid)
RETURNS TABLE(
  event_id uuid,
  title text,
  starts_at timestamp with time zone,
  cover_image_url text,
  area_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH profile_event_ids AS MATERIALIZED (
    SELECT e.event_id
    FROM public.events e
    WHERE e.organizer_id = p_user_id

    UNION

    SELECT et.event_id
    FROM public.event_talent et
    WHERE et.talent_user_id = p_user_id
  )
  SELECT
    e.event_id,
    e.title::text,
    e.starts_at,
    e.cover_image_url,
    a.name::text AS area_name
  FROM profile_event_ids pe
  JOIN public.events e ON e.event_id = pe.event_id
  LEFT JOIN public.areas a ON a.area_id = e.area_id
  WHERE e.status = 'active'
    AND COALESCE(e.ends_at, e.starts_at + interval '8 hours') > now()
  ORDER BY e.starts_at ASC, e.event_id ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_home_people_discovery(
  p_city_id uuid DEFAULT NULL::uuid,
  p_area_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(
  section text,
  user_id uuid,
  username text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH qualifying_events AS MATERIALIZED (
    SELECT e.event_id, e.organizer_id, e.starts_at
    FROM public.events e
    WHERE e.status = 'active'
      AND (p_city_id IS NULL OR e.city_id = p_city_id)
      AND (p_area_id IS NULL OR e.area_id = p_area_id)
      AND COALESCE(e.ends_at, e.starts_at + interval '8 hours') > now()
  ),
  talent_groups AS (
    SELECT
      et.talent_user_id AS user_id,
      u.username,
      u.avatar_url,
      min(q.starts_at) AS next_starts_at
    FROM qualifying_events q
    JOIN public.event_talent et ON et.event_id = q.event_id
    JOIN public.users u ON u.user_id = et.talent_user_id
    WHERE u.username IS NOT NULL
    GROUP BY et.talent_user_id, u.username, u.avatar_url
  ),
  maker_groups AS (
    SELECT
      u.user_id,
      u.username,
      u.avatar_url,
      min(q.starts_at) AS next_starts_at
    FROM qualifying_events q
    JOIN public.users u ON u.user_id = q.organizer_id
    WHERE u.username IS NOT NULL
      AND lower(u.username) <> 'livon'
    GROUP BY u.user_id, u.username, u.avatar_url
  ),
  limits AS (
    SELECT greatest(1, least(COALESCE(p_limit, 12), 12)) AS max_rows
  )
  (
    SELECT 'talent'::text, t.user_id, t.username, t.avatar_url
    FROM talent_groups t, limits
    ORDER BY t.next_starts_at ASC, t.username ASC, t.user_id ASC
    LIMIT (SELECT max_rows FROM limits)
  )

  UNION ALL

  (
    SELECT 'makers'::text, m.user_id, m.username, m.avatar_url
    FROM maker_groups m, limits
    ORDER BY m.next_starts_at ASC, m.username ASC, m.user_id ASC
    LIMIT (SELECT max_rows FROM limits)
  );
$function$;

-- p_page_size is clamped in SQL: the browser sends 20, but this RPC is
-- anonymously callable and `limit p_page_size` would otherwise let a direct
-- caller scrape the whole active event set in one request.
CREATE OR REPLACE FUNCTION public.get_home_feed(
  p_category_id uuid DEFAULT NULL::uuid,
  p_city_id uuid DEFAULT NULL::uuid,
  p_area_id uuid DEFAULT NULL::uuid,
  p_cursor_rank_score integer DEFAULT NULL::integer,
  p_cursor_total_going integer DEFAULT NULL::integer,
  p_cursor_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_event_id uuid DEFAULT NULL::uuid,
  p_page_size integer DEFAULT 20,
  p_free_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  title text,
  price numeric,
  venue_name text,
  area text,
  host_username text,
  cover_image_url text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  peek_connections_count integer,
  rank_score integer,
  total_going_count integer,
  is_claimable boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  with viewer as (
    select auth.uid() as viewer_id
  ),
  livon as (
    select user_id
    from public.users
    where lower(username) = 'livon'
    limit 1
  ),
  base as (
    select
      e.event_id,
      e.title,
      e.price,
      e.venue_name,
      a.name as area,
      u.username as host_username,
      e.cover_image_url,
      e.starts_at,
      e.ends_at,
      e.organizer_id,
      (
        e.claimed_at IS NULL
        AND e.organizer_id = (select user_id from livon)
      ) as is_claimable,

      exists (
        select 1
        from public.connections c, viewer v
        where c.status = 'accepted'
          and v.viewer_id is not null
          and (
            (c.requester_id = v.viewer_id and c.receiver_id = e.organizer_id)
            or (c.receiver_id = v.viewer_id and c.requester_id = e.organizer_id)
          )
      ) as is_connection_host,

      (
        select count(*)::int
        from public.event_interests ei, viewer v
        where ei.event_id = e.event_id
          and ei.visibility = 'visible'
          and ei.user_id <> e.organizer_id
          and v.viewer_id is not null
          and exists (
            select 1 from public.connections c
            where c.status = 'accepted'
              and (
                (c.requester_id = v.viewer_id and c.receiver_id = ei.user_id)
                or (c.receiver_id = v.viewer_id and c.requester_id = ei.user_id)
              )
          )
      ) as connections_going_count,

      (
        select count(*)::int
        from public.event_interests ei2
        where ei2.event_id = e.event_id
      ) as total_going_count

    from public.events e
    join public.areas a on a.area_id = e.area_id
    join public.users u on u.user_id = e.organizer_id
    where e.status = 'active'
      and (
        (e.ends_at is not null and (now() + interval '2 hours') < e.ends_at)
        or (e.ends_at is null and (now() + interval '2 hours') < e.starts_at + interval '8 hours')
      )
      and (p_category_id is null or e.category_id = p_category_id)
      and (p_city_id is null or e.city_id = p_city_id)
      and (p_area_id is null or e.area_id = p_area_id)
      and (not coalesce(p_free_only, false) or e.price = 0)
  ),
  scored as (
    select
      *,
      (
        case when is_connection_host then 1000 else 0 end
        + connections_going_count
      )::int as rank_score,
      (
        connections_going_count
        + case when is_connection_host then 1 else 0 end
      )::int as peek_connections_count
    from base
  )
  select
    event_id as id,
    title,
    price,
    venue_name,
    area,
    host_username,
    cover_image_url,
    starts_at,
    ends_at,
    peek_connections_count,
    rank_score,
    total_going_count,
    is_claimable
  from scored
  where
    p_cursor_rank_score is null
    or (rank_score < p_cursor_rank_score)
    or (rank_score = p_cursor_rank_score and total_going_count < p_cursor_total_going)
    or (rank_score = p_cursor_rank_score and total_going_count = p_cursor_total_going
        and starts_at > p_cursor_starts_at)
    or (rank_score = p_cursor_rank_score and total_going_count = p_cursor_total_going
        and starts_at = p_cursor_starts_at and event_id > p_cursor_event_id)
  order by rank_score desc, total_going_count desc, starts_at asc, event_id asc
  limit least(greatest(coalesce(p_page_size, 20), 1), 50);
$function$;

-- Search RPCs are anonymous scraping surfaces, so all three caller inputs are
-- bounded in SQL rather than trusted from the browser:
--   * page size clamped to 1..50;
--   * query length capped (a 2-char floor already existed);
--   * `%`/`_`/`\` escaped so the argument is a substring, not a LIKE pattern
--     ('%%' previously matched every row).
CREATE OR REPLACE FUNCTION public.search_events(p_query text, p_page_size integer DEFAULT 10)
RETURNS TABLE(
  event_id uuid,
  title text,
  venue_name text,
  area_name text,
  city_name text,
  cover_image_url text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  with input as (
    select
      length(btrim(coalesce(p_query, ''))) as query_length,
      '%' || replace(replace(replace(
        btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      least(greatest(coalesce(p_page_size, 10), 1), 50) as page_size
  )
  select
    e.event_id,
    e.title,
    e.venue_name,
    a.name as area_name,
    c.name as city_name,
    e.cover_image_url,
    e.starts_at,
    e.ends_at
  from public.events e
  join public.areas a on a.area_id = e.area_id
  join public.cities c on c.city_id = e.city_id
  cross join input i
  where e.status = 'active'
    and (
      (e.ends_at is not null and e.ends_at > now())
      or (e.ends_at is null and e.starts_at + interval '8 hours' > now())
    )
    and i.query_length between 2 and 100
    and (
      e.title ilike i.pattern
      or e.venue_name ilike i.pattern
      or e.description ilike i.pattern
    )
  order by e.starts_at asc
  limit (select page_size from input);
$function$;

CREATE OR REPLACE FUNCTION public.search_people(p_query text, p_page_size integer DEFAULT 10)
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  with input as (
    select
      length(btrim(coalesce(p_query, ''))) as query_length,
      '%' || replace(replace(replace(
        btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      least(greatest(coalesce(p_page_size, 10), 1), 50) as page_size
  )
  select
    u.user_id,
    u.username,
    u.avatar_url,
    u.bio
  from public.users u
  cross join input i
  where i.query_length between 2 and 100
    and (
      u.username ilike i.pattern
      or u.bio ilike i.pattern
    )
  order by u.username asc
  limit (select page_size from input);
$function$;

-- ---------------------------------------------------------------------------
-- R5: redeem_invite becomes server-only.
--
-- Click dedup keys on a caller-supplied UUID, so a direct client caller could
-- turn one click into unlimited "unique visitors" by sending a fresh UUID each
-- time. The visitor identity and the client IP now come from trusted server
-- code (src/app/i/[code]/route.ts, service_role) instead of the argument list:
--   * p_user_id is the session user the route already verified;
--   * p_anon_session_id is the route's HTTP-only cookie value;
--   * p_client_ip is the visitor address, not the Vercel egress address that
--     PostgREST's request.headers reports for a server-side call.
-- The dropped 2-argument signature is what made this reachable from a browser.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.redeem_invite(text, uuid);

CREATE OR REPLACE FUNCTION public.redeem_invite(
  p_code text,
  p_anon_session_id uuid,
  p_user_id uuid,
  p_client_ip text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_invite_link_id uuid;
  v_event_id uuid;
  v_creator_id uuid;
  v_row_count int;
begin
  if p_user_id is not null and p_anon_session_id is not null then
    raise exception 'redeem_invite: pass p_user_id or p_anon_session_id, never both'
      using errcode = '22023';
  end if;

  -- Unknown-code shape: a malformed code leaks nothing about what exists.
  if p_code is null or length(p_code) < 1 or length(p_code) > 64 then
    return jsonb_build_object('event_id', null);
  end if;

  -- 60 requests / 5 min per visitor IP. Higher ceiling than a login-style
  -- limiter because a shared invite link legitimately gets many redemptions
  -- from behind one NAT (several guests on the same office/campus wifi).
  if not public.check_and_increment_rate_limit(
    'redeem_invite:' || coalesce(nullif(btrim(p_client_ip), ''), 'unknown'),
    60,
    interval '5 minutes'
  ) then
    -- Same shape as "unknown code" — a throttled caller gets no signal
    -- distinguishing rate-limiting from a bad/expired code.
    return jsonb_build_object('event_id', null);
  end if;

  select invite_link_id, event_id, creator_id
    into v_invite_link_id, v_event_id, v_creator_id
  from public.invite_links
  where code = p_code;

  if v_invite_link_id is null then
    return jsonb_build_object('event_id', null); -- invalid/unknown code
  end if;

  if p_user_id is not null and p_user_id = v_creator_id then
    return jsonb_build_object('event_id', v_event_id); -- self-click, resolve only
  end if;

  if p_user_id is null and p_anon_session_id is null then
    -- No visitor identity to dedupe on, so resolve the link without counting
    -- rather than recording a click that can never be deduped.
    return jsonb_build_object('event_id', v_event_id);
  end if;

  insert into public.invite_link_clicks (invite_link_id, user_id, anon_session_id)
  values (v_invite_link_id, p_user_id, p_anon_session_id)
  on conflict do nothing;

  get diagnostics v_row_count = row_count;

  if v_row_count > 0 then
    update public.invite_links
    set click_count = click_count + 1
    where invite_link_id = v_invite_link_id;
  end if;

  return jsonb_build_object('event_id', v_event_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Execute grants (R1, R3, R5, R6)
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and PUBLIC means
-- every current and future role — not just anon/authenticated. Each function
-- below is revoked from PUBLIC and granted back to its named roles only.
-- ---------------------------------------------------------------------------

-- Internal: callable only by the owner and by trusted server jobs. Other
-- definer functions can still call these; nested calls run as the definer.
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(text, integer, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, interval)
  TO service_role;

-- Trigger function: EXECUTE is checked when the trigger is created, not when
-- it fires, so the auth.users signup trigger keeps working without grants.
REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Authenticated only; each body also enforces ownership.
REVOKE ALL ON FUNCTION public.claim_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_event(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_event_management_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_management_data(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_event_view_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_event_view_stats(uuid) TO authenticated, service_role;

-- Server-only mutation (R5): reachable only through /i/[code].
REVOKE ALL ON FUNCTION public.redeem_invite(text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text, uuid, uuid, text) TO service_role;

-- Intentional public reads: signed-out visitors must keep working, so anon is
-- granted explicitly instead of inherited from PUBLIC.
REVOKE ALL ON FUNCTION public.event_going_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_going_count(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_public_connections_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_connections_count(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.resolve_username_to_user_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_user_id(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_event_talent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_talent(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_public_profile_events(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_events(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_home_people_discovery(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_people_discovery(uuid, uuid, integer)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer, boolean
) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_events(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_events(text, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_people(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_people(text, integer) TO anon, authenticated, service_role;

-- Convention enforcement (R6), and the root cause of the test/production
-- privilege drift in R1/R3: test's default privileges hand EXECUTE to anon and
-- authenticated on every function `postgres` creates in `public`, so a new
-- definer function became an anonymous endpoint with no GRANT anywhere in the
-- migration. Production already defaults to `{postgres, service_role}`; this
-- matches it, so new functions start closed and must opt in explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Reload the Data API schema cache so the dropped signatures stop resolving.
NOTIFY pgrst, 'reload schema';

COMMIT;
