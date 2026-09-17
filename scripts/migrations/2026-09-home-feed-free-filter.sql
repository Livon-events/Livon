-- Home feed: free price filter + rename Sports → Faith & Worship.
-- Free is NOT a category — filter events.price = 0 in SQL (see docs/FR/home-feed-performance.md).

UPDATE public.categories
SET name = 'Faith & Worship'
WHERE category_id = '11111111-1111-1111-1111-111111111302'
   OR name = 'Sports';

-- Signature change (new p_free_only) requires drop + recreate.
DROP FUNCTION IF EXISTS public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer
);

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

REVOKE ALL ON FUNCTION public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_feed(
  uuid, uuid, uuid, integer, integer, timestamp with time zone, uuid, integer, boolean
) TO anon, authenticated, service_role;
