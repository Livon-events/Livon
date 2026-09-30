-- Home "This weekend" rail: time-ordered events starting Friday 00:00 to
-- Monday 00:00 (Maseru wall-clock) of the current week. Ignores category /
-- free filters and connection counts — ordering is by start time only, so
-- the result is the same for every viewer.
--
-- TEMP PATCH: starts_at/ends_at store Maseru wall-clock digits mislabeled as
-- UTC, so the window is computed on `now() + 2h` read as UTC — same shift as
-- get_home_feed and isEventStillLive.

BEGIN;

CREATE INDEX IF NOT EXISTS events_active_city_starts_at_idx
  ON public.events (city_id, starts_at)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.get_weekend_events(
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
  ends_at timestamp with time zone
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
    e.ends_at
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

COMMIT;
