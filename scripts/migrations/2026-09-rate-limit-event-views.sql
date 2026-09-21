-- Route event-details page views through a rate-limited SECURITY DEFINER
-- RPC. Phase 1 of a two-step rollout: create the RPC while leaving existing
-- direct INSERT grants/policies intact so authenticated views keep working
-- until the client ships. Phase 2
-- (2026-09-lock-down-event-view-inserts.sql) revokes direct INSERT.
--
-- Reuses public.check_and_increment_rate_limit (service_role / nested
-- definer only). Limit: 30 inserts / 5 minutes per viewer key.

CREATE OR REPLACE FUNCTION public.record_event_view(
  p_event_id uuid,
  p_anon_session_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_viewer uuid := (SELECT auth.uid());
  v_organizer uuid;
  v_rate_key text;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN;
  END IF;

  SELECT e.organizer_id
    INTO v_organizer
  FROM public.events e
  WHERE e.event_id = p_event_id;

  IF v_organizer IS NULL THEN
    RETURN; -- unknown / deleted event
  END IF;

  -- Authenticated viewers ignore any client-supplied anon id.
  IF v_viewer IS NOT NULL THEN
    IF v_viewer = v_organizer THEN
      RETURN; -- organizer self-view
    END IF;

    v_rate_key := 'event_view:auth:' || v_viewer::text;

    IF NOT public.check_and_increment_rate_limit(
      v_rate_key,
      30,
      interval '5 minutes'
    ) THEN
      RETURN;
    END IF;

    INSERT INTO public.event_views (event_id, user_id)
    VALUES (p_event_id, v_viewer);

    RETURN;
  END IF;

  -- Anonymous path requires a stable session id.
  IF p_anon_session_id IS NULL THEN
    RETURN;
  END IF;

  v_rate_key := 'event_view:anon:' || p_anon_session_id::text;

  IF NOT public.check_and_increment_rate_limit(
    v_rate_key,
    30,
    interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.anonymous_event_views (event_id, anon_session_id)
  VALUES (p_event_id, p_anon_session_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_event_view(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_event_view(uuid, uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
