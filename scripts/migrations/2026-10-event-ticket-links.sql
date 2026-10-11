-- Event ticket links: organizers may point to up to four external ticket
-- sites. Only ecoticket.co.ls, ticketbox.co.ls, mytag.co.ls and
-- etickets.co.ls (optionally www.) over https are accepted — the app
-- validates the same allowlist (src/modules/events/ticketLinks.ts) on write
-- and again at render time; this constraint stops direct Data API writes.
--
-- get_home_feed, get_weekend_events and get_recent_events gain a
-- ticket_links column. Return-type changes require drop + recreate; bodies
-- are otherwise identical to 2026-09-home-feed-category-name.sql,
-- 2026-09-weekend-events.sql and 2026-10-recent-events.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_allowed_ticket_url(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  select p_url is not null
    and length(p_url) <= 2048
    and p_url !~ '[[:space:][:cntrl:]]'
    and position('@' in p_url) = 0
    and p_url ~ '^https://(www\.)?(ecoticket|ticketbox|mytag|etickets)\.co\.ls([/?#].*)?$';
$function$;

CREATE OR REPLACE FUNCTION public.ticket_links_are_allowed(p_links text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  select coalesce(cardinality(p_links), 0) <= 4
    and coalesce(
      (select bool_and(public.is_allowed_ticket_url(u)) from unnest(p_links) as u),
      true
    );
$function$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_links text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_ticket_links_allowed,
  ADD CONSTRAINT events_ticket_links_allowed CHECK (public.ticket_links_are_allowed(ticket_links));

-- ── get_home_feed ───────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer, boolean
);

CREATE FUNCTION public.get_home_feed(
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
  is_claimable boolean,
  category_name text,
  ticket_links text[]
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
      cat.name as category_name,
      e.ticket_links,
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
    join public.categories cat on cat.category_id = e.category_id
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
    is_claimable,
    category_name,
    ticket_links
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

REVOKE ALL ON FUNCTION public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer, boolean
) TO anon, authenticated, service_role;

-- ── get_weekend_events ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_weekend_events(uuid, uuid, integer);

CREATE FUNCTION public.get_weekend_events(
  p_city_id uuid DEFAULT NULL::uuid,
  p_area_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  title text,
  price numeric,
  venue_name text,
  area text,
  cover_image_url text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  ticket_links text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  with local_week as (
    select date_trunc('week', (now() at time zone 'UTC') + interval '2 hours') as monday
  ),
  win as (
    select
      (monday + interval '4 days') at time zone 'UTC' as fri,
      (monday + interval '7 days') at time zone 'UTC' as next_monday
    from local_week
  )
  select
    e.event_id as id,
    e.title,
    e.price,
    e.venue_name,
    a.name as area,
    e.cover_image_url,
    e.starts_at,
    e.ends_at,
    e.ticket_links
  from public.events e
  join public.areas a on a.area_id = e.area_id
  cross join win
  where e.status = 'active'
    and e.starts_at >= win.fri
    and e.starts_at < win.next_monday
    and (
      (e.ends_at is not null and (now() + interval '2 hours') < e.ends_at)
      or (e.ends_at is null and (now() + interval '2 hours') < e.starts_at + interval '8 hours')
    )
    and (p_city_id is null or e.city_id = p_city_id)
    and (p_area_id is null or e.area_id = p_area_id)
  order by e.starts_at asc, e.event_id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$function$;

REVOKE ALL ON FUNCTION public.get_weekend_events(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekend_events(uuid, uuid, integer)
  TO anon, authenticated, service_role;

-- ── get_recent_events ───────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_recent_events(uuid, uuid, integer);

CREATE FUNCTION public.get_recent_events(
  p_city_id uuid DEFAULT NULL::uuid,
  p_area_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  title text,
  price numeric,
  venue_name text,
  area text,
  cover_image_url text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  ticket_links text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select
    e.event_id as id,
    e.title,
    e.price,
    e.venue_name,
    a.name as area,
    e.cover_image_url,
    e.starts_at,
    e.ends_at,
    e.ticket_links
  from public.events e
  join public.areas a on a.area_id = e.area_id
  where e.status = 'active'
    and e.created_at >= now() - interval '7 days'
    and (
      (e.ends_at is not null and (now() + interval '2 hours') < e.ends_at)
      or (e.ends_at is null and (now() + interval '2 hours') < e.starts_at + interval '8 hours')
    )
    and (p_city_id is null or e.city_id = p_city_id)
    and (p_area_id is null or e.area_id = p_area_id)
  order by e.created_at desc, e.event_id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 12);
$function$;

REVOKE ALL ON FUNCTION public.get_recent_events(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_events(uuid, uuid, integer)
  TO anon, authenticated, service_role;

COMMIT;
