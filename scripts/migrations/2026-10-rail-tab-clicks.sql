-- Internal product metric: home rail tab switches ("Recently added" /
-- "This weekend"). Only real switches are logged — the default tab and
-- re-taps of the selected tab are not. Writes go through the rate-limited
-- SECURITY DEFINER RPC below; clients have no direct INSERT and nobody but
-- service role can read (no policies). Same pattern as
-- 2026-09-discovery-and-social-clicks.sql + 2026-09-rate-limit-analytics-clicks.sql.
--
-- Limit: 30 inserts / 5 minutes per viewer key.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rail_tab_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab text NOT NULL CHECK (tab IN ('recent', 'weekend')),
  viewer_user_id uuid REFERENCES public.users (user_id) ON DELETE SET NULL,
  anon_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rail_tab_clicks_viewer_xor CHECK (
    (viewer_user_id IS NOT NULL AND anon_session_id IS NULL)
    OR (viewer_user_id IS NULL AND anon_session_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS rail_tab_clicks_tab_created_at_idx
  ON public.rail_tab_clicks (tab, created_at DESC);

ALTER TABLE public.rail_tab_clicks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rail_tab_clicks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_rail_tab_click(
  p_tab text,
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
  IF p_tab IS NULL OR p_tab NOT IN ('recent', 'weekend') THEN
    RETURN;
  END IF;

  -- Authenticated viewers ignore any client-supplied anon id.
  IF v_viewer IS NOT NULL THEN
    v_rate_key := 'rail_tab_click:auth:' || v_viewer::text;

    IF NOT public.check_and_increment_rate_limit(
      v_rate_key,
      30,
      interval '5 minutes'
    ) THEN
      RETURN;
    END IF;

    INSERT INTO public.rail_tab_clicks (tab, viewer_user_id, anon_session_id)
    VALUES (p_tab, v_viewer, NULL);

    RETURN;
  END IF;

  -- Anonymous path requires a stable session id.
  IF p_anon_session_id IS NULL THEN
    RETURN;
  END IF;

  v_rate_key := 'rail_tab_click:anon:' || p_anon_session_id::text;

  IF NOT public.check_and_increment_rate_limit(
    v_rate_key,
    30,
    interval '5 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.rail_tab_clicks (tab, viewer_user_id, anon_session_id)
  VALUES (p_tab, NULL, p_anon_session_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_rail_tab_click(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_rail_tab_click(text, uuid)
  TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Example internal queries (SQL editor / service role)
-- ---------------------------------------------------------------------------
-- select tab, count(*)
-- from public.rail_tab_clicks
-- where created_at > now() - interval '7 days'
-- group by tab;
--
-- select date_trunc('day', created_at) as day, tab, count(*)
-- from public.rail_tab_clicks
-- group by 1, 2
-- order by 1 desc, 2;
