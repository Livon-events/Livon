-- Organizer-facing views_count = opens (row count), not unique viewers.
-- Same-tab refresh is suppressed client-side via sessionStorage in recordEventView.

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

REVOKE ALL ON FUNCTION public.get_event_management_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_management_data(uuid) TO authenticated, service_role;
