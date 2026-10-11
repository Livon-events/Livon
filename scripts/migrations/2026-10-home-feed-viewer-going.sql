-- get_home_feed returns the viewer's own Going state (my_going,
-- my_visibility) so the app no longer needs a follow-up event_interests
-- query per feed page.
--
-- REQUIRES 2026-10-event-ticket-links.sql to be applied first — the body is
-- identical to the get_home_feed defined there, plus the my_visibility
-- subquery in `base` and the two new output columns.
--
-- Viewer state is scoped to auth.uid() only (SECURITY DEFINER bypasses RLS,
-- so the user_id filter is what keeps other users' rows out). Signed-out
-- viewers get my_going = false, my_visibility = null.
--
-- Deploy: apply this migration BEFORE shipping the app change. The old app
-- ignores the extra columns, so it keeps working in between.

BEGIN;

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
  ticket_links text[],
  my_going boolean,
  my_visibility text
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
      ) as total_going_count,

      (
        select ei3.visibility
        from public.event_interests ei3, viewer v
        where ei3.event_id = e.event_id
          and v.viewer_id is not null
          and ei3.user_id = v.viewer_id
        limit 1
      ) as my_visibility

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
    ticket_links,
    (my_visibility is not null) as my_going,
    my_visibility
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

COMMIT;
