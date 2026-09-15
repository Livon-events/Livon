-- Deploy-independent subset of 2026-09-security-definer-hardening.sql, applied
-- to production ahead of the code deploy.
--
-- The full migration cannot run in production yet: it needs the pending
-- Talent/Makers objects, and its `redeem_invite` signature change would break
-- every live /i/{code} link until src/app/i/[code]/route.ts ships. Everything
-- here is safe against the currently deployed code.
--
-- Still outstanding in production after this file (all covered by the full
-- migration, to be applied together with the deploy):
--   * redeem_invite stays client-callable with its 2-argument signature, so
--     invite click counts remain inflatable (R5, analytics integrity only);
--   * the three Talent/Makers public reads do not exist here yet;
--   * default privileges already match the intended model, so nothing to fix.

BEGIN;

-- R2: returned a private email address for any username, to anonymous
-- callers. Dead code — sign-in is Google OAuth only.
DROP FUNCTION IF EXISTS public.resolve_login_email(text);

-- R7: these bodies already fully qualify every table and function they touch
-- (verified against pg_proc.prosrc), so pinning the search path needs no SQL
-- changes and cannot alter behaviour.
ALTER FUNCTION public.check_and_increment_rate_limit(text, integer, interval) SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.claim_event(uuid) SET search_path = '';
ALTER FUNCTION public.get_event_management_data(uuid) SET search_path = '';
ALTER FUNCTION public.get_my_event_view_stats(uuid) SET search_path = '';
ALTER FUNCTION public.event_going_count(uuid) SET search_path = '';
ALTER FUNCTION public.get_public_profile(uuid) SET search_path = '';
ALTER FUNCTION public.resolve_username_to_user_id(text) SET search_path = '';
ALTER FUNCTION public.redeem_invite(text, uuid) SET search_path = '';

-- R7: the only definer function body in production with unqualified table
-- references besides get_home_feed.
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

-- R4 + R7: qualify every object, and clamp the page size the browser normally
-- sets to 20 — a direct caller could otherwise scrape the whole active event
-- set in one anonymous request.
CREATE OR REPLACE FUNCTION public.get_home_feed(
  p_category_id uuid DEFAULT NULL::uuid,
  p_city_id uuid DEFAULT NULL::uuid,
  p_area_id uuid DEFAULT NULL::uuid,
  p_cursor_rank_score integer DEFAULT NULL::integer,
  p_cursor_total_going integer DEFAULT NULL::integer,
  p_cursor_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_event_id uuid DEFAULT NULL::uuid,
  p_page_size integer DEFAULT 20
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

-- R4: bound page size and query length, and escape `%`/`_`/`\` so the argument
-- is a substring rather than a caller-supplied LIKE pattern ('%%' previously
-- matched every row).
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

-- R6: PUBLIC is every current and future role. Replace the inherited grant
-- with a named allowlist on every definer function.
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(text, integer, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, interval)
  TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.claim_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_event(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_event_management_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_management_data(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_event_view_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_event_view_stats(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.event_going_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_going_count(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_public_connections_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_connections_count(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.resolve_username_to_user_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_user_id(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer
) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_events(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_events(text, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_people(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_people(text, integer) TO anon, authenticated, service_role;

-- anon and authenticated keep EXECUTE here until the route deploy makes
-- redeem_invite server-only; only the open-ended PUBLIC grant goes now.
REVOKE ALL ON FUNCTION public.redeem_invite(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text, uuid) TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
