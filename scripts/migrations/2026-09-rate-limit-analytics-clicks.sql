-- Route discovery / social click metrics through rate-limited SECURITY DEFINER
-- RPCs. Direct client INSERT is revoked so mash-clicking cannot freely grow
-- these tables. Reuses public.check_and_increment_rate_limit (service_role /
-- nested definer only).
--
-- Limits: 30 inserts / 5 minutes per viewer key, separate for each surface.

-- ---------------------------------------------------------------------------
-- record_discovery_person_click
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_discovery_person_click(
  p_target_user_id uuid,
  p_section text,
  p_anon_session_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_viewer uuid := (SELECT auth.uid());
  v_rate_key text;
BEGIN
  IF p_target_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_section IS NULL OR p_section NOT IN ('talent', 'makers') THEN
    RETURN;
  END IF;

  -- Authenticated viewers ignore any client-supplied anon id.
  IF v_viewer IS NOT NULL THEN
    IF v_viewer = p_target_user_id THEN
      RETURN; -- self-click
    END IF;
    v_rate_key := 'discovery_person_click:auth:' || v_viewer::text;

    IF NOT public.check_and_increment_rate_limit(
      v_rate_key,
      30,
      interval '5 minutes'
    ) THEN
      RETURN;
    END IF;

    INSERT INTO public.discovery_person_clicks (
      target_user_id,
      section,
      viewer_user_id,
      anon_session_id
    )
    VALUES (p_target_user_id, p_section, v_viewer, NULL);

    RETURN;
  END IF;

  -- Anonymous path requires a stable session id.
  IF p_anon_session_id IS NULL THEN
    RETURN;
  END IF;

  v_rate_key := 'discovery_person_click:anon:' || p_anon_session_id::text;

  IF NOT public.check_and_increment_rate_limit(
    v_rate_key,
    30,
    interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.discovery_person_clicks (
    target_user_id,
    section,
    viewer_user_id,
    anon_session_id
  )
  VALUES (p_target_user_id, p_section, NULL, p_anon_session_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- record_profile_social_click
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_profile_social_click(
  p_profile_user_id uuid,
  p_platform text,
  p_anon_session_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_viewer uuid := (SELECT auth.uid());
  v_rate_key text;
BEGIN
  IF p_profile_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_platform IS NULL
     OR p_platform NOT IN ('facebook', 'instagram', 'tiktok', 'youtube') THEN
    RETURN;
  END IF;

  IF v_viewer IS NOT NULL THEN
    IF v_viewer = p_profile_user_id THEN
      RETURN; -- self-click
    END IF;
    v_rate_key := 'profile_social_click:auth:' || v_viewer::text;

    IF NOT public.check_and_increment_rate_limit(
      v_rate_key,
      30,
      interval '5 minutes'
    ) THEN
      RETURN;
    END IF;

    INSERT INTO public.profile_social_clicks (
      profile_user_id,
      platform,
      viewer_user_id,
      anon_session_id
    )
    VALUES (p_profile_user_id, p_platform, v_viewer, NULL);

    RETURN;
  END IF;

  IF p_anon_session_id IS NULL THEN
    RETURN;
  END IF;

  v_rate_key := 'profile_social_click:anon:' || p_anon_session_id::text;

  IF NOT public.check_and_increment_rate_limit(
    v_rate_key,
    30,
    interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.profile_social_clicks (
    profile_user_id,
    platform,
    viewer_user_id,
    anon_session_id
  )
  VALUES (p_profile_user_id, p_platform, NULL, p_anon_session_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Grants / lock down direct client INSERT
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.record_discovery_person_click(uuid, text, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_profile_social_click(uuid, text, uuid)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_discovery_person_click(uuid, text, uuid)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_profile_social_click(uuid, text, uuid)
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "discovery_person_clicks_insert_authenticated"
  ON public.discovery_person_clicks;
DROP POLICY IF EXISTS "discovery_person_clicks_insert_anon"
  ON public.discovery_person_clicks;
DROP POLICY IF EXISTS "profile_social_clicks_insert_authenticated"
  ON public.profile_social_clicks;
DROP POLICY IF EXISTS "profile_social_clicks_insert_anon"
  ON public.profile_social_clicks;

REVOKE INSERT ON public.discovery_person_clicks FROM anon, authenticated;
REVOKE INSERT ON public.profile_social_clicks FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
