-- Show active upcoming events on both organizer and Featured Talent profiles.
-- Apply after 2026-09-event-talent-and-home-discovery.sql.

CREATE OR REPLACE FUNCTION public.get_public_profile_events(p_user_id uuid)
RETURNS TABLE(
  event_id uuid,
  title text,
  starts_at timestamptz,
  cover_image_url text,
  area_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
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

-- Default function privileges in this project include anon, so revoke both
-- routes before granting only the roles used by public profile pages.
REVOKE EXECUTE ON FUNCTION public.get_public_profile_events(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile_events(uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Verify on livon-test after applying:
-- SELECT * FROM public.get_public_profile_events('<talent-user-id>'::uuid);
