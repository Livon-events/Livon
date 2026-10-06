-- Home "Recently added" rail: up to 12 events uploaded in the last 7 days
-- that haven't ended yet, newest upload first. Ignores category / free
-- filters and connection counts, so the result is the same for every viewer.
--
-- created_at is a real UTC timestamp (default now()), so the 7-day window
-- compares against plain now(). starts_at/ends_at still carry the TEMP
-- PATCH Maseru wall-clock shift, so the "not ended" check uses
-- `now() + 2h` — same as get_weekend_events and isEventStillLive.

BEGIN;

-- Leads on created_at, not city_id: the function body is planned without
-- parameter values, so `(p_city_id is null or ...)` can't be an index
-- condition. Walking newest-first and filtering city lets the scan stop
-- after 12 matches with no sort.
DROP INDEX IF EXISTS public.events_active_city_created_at_idx;

CREATE INDEX IF NOT EXISTS events_active_created_at_idx
  ON public.events (created_at DESC)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.get_recent_events(
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
  ends_at timestamp with time zone
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
    e.ends_at
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
