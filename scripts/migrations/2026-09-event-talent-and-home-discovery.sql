-- The Talent and The Makers
-- Apply to livon-test first through the Supabase SQL editor, then verify with
-- the checks at the bottom before applying to any other environment.

CREATE TABLE IF NOT EXISTS public.event_talent (
  event_id uuid NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  talent_user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position >= 0 AND position < 10),
  PRIMARY KEY (event_id, talent_user_id),
  UNIQUE (event_id, position)
);

CREATE INDEX IF NOT EXISTS event_talent_talent_user_id_idx
  ON public.event_talent (talent_user_id);

ALTER TABLE public.event_talent ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.event_talent FROM anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.event_talent TO authenticated;

DROP POLICY IF EXISTS event_talent_insert_own_event ON public.event_talent;
CREATE POLICY event_talent_insert_own_event
  ON public.event_talent
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.event_id = event_talent.event_id
        AND e.organizer_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS event_talent_delete_own_event ON public.event_talent;
CREATE POLICY event_talent_delete_own_event
  ON public.event_talent
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.event_id = event_talent.event_id
        AND e.organizer_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.create_event_with_talent(
  p_category_id uuid,
  p_city_id uuid,
  p_area_id uuid,
  p_title text,
  p_description text,
  p_venue_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_cover_image_url text,
  p_price numeric,
  p_talent_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_event_id uuid;
  v_talent_ids uuid[] := COALESCE(p_talent_ids, '{}'::uuid[]);
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF cardinality(v_talent_ids) > 10 THEN
    RAISE EXCEPTION 'too_many_talent';
  END IF;

  IF (SELECT count(DISTINCT talent_id) FROM unnest(v_talent_ids) AS talent_id)
     <> cardinality(v_talent_ids) THEN
    RAISE EXCEPTION 'duplicate_talent';
  END IF;

  IF (SELECT count(*) FROM public.users WHERE user_id = ANY(v_talent_ids))
     <> cardinality(v_talent_ids) THEN
    RAISE EXCEPTION 'invalid_talent';
  END IF;

  INSERT INTO public.events (
    organizer_id, category_id, city_id, area_id, title, description,
    venue_name, starts_at, ends_at, cover_image_url, status, price
  ) VALUES (
    (SELECT auth.uid()), p_category_id, p_city_id, p_area_id, p_title,
    p_description, p_venue_name, p_starts_at, p_ends_at, p_cover_image_url,
    'active', p_price
  )
  RETURNING event_id INTO v_event_id;

  INSERT INTO public.event_talent (event_id, talent_user_id, position)
  SELECT v_event_id, source.talent_user_id, source.ordinality - 1
  FROM unnest(v_talent_ids) WITH ORDINALITY AS source(talent_user_id, ordinality);

  RETURN v_event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_event_with_talent(
  p_event_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_venue_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_cover_image_url text,
  p_price numeric,
  p_talent_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_talent_ids uuid[] := COALESCE(p_talent_ids, '{}'::uuid[]);
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF cardinality(v_talent_ids) > 10 THEN
    RAISE EXCEPTION 'too_many_talent';
  END IF;

  IF (SELECT count(DISTINCT talent_id) FROM unnest(v_talent_ids) AS talent_id)
     <> cardinality(v_talent_ids) THEN
    RAISE EXCEPTION 'duplicate_talent';
  END IF;

  IF (SELECT count(*) FROM public.users WHERE user_id = ANY(v_talent_ids))
     <> cardinality(v_talent_ids) THEN
    RAISE EXCEPTION 'invalid_talent';
  END IF;

  UPDATE public.events
  SET category_id = p_category_id,
      title = p_title,
      description = p_description,
      venue_name = p_venue_name,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      cover_image_url = p_cover_image_url,
      price = p_price
  WHERE event_id = p_event_id
    AND organizer_id = (SELECT auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found_or_not_owned';
  END IF;

  DELETE FROM public.event_talent WHERE event_id = p_event_id;

  INSERT INTO public.event_talent (event_id, talent_user_id, position)
  SELECT p_event_id, source.talent_user_id, source.ordinality - 1
  FROM unnest(v_talent_ids) WITH ORDINALITY AS source(talent_user_id, ordinality);

  RETURN p_event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_event_talent(p_event_id uuid)
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  bio text,
  tiktok_url text,
  instagram_url text,
  facebook_url text,
  youtube_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
  SELECT
    u.user_id,
    u.username,
    u.avatar_url,
    u.bio,
    u.tiktok_url,
    u.instagram_url,
    u.facebook_url,
    u.youtube_url
  FROM public.event_talent et
  JOIN public.users u ON u.user_id = et.talent_user_id
  WHERE et.event_id = p_event_id
    AND u.username IS NOT NULL
  ORDER BY et.position ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_home_people_discovery(
  p_city_id uuid DEFAULT NULL,
  p_area_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(
  section text,
  user_id uuid,
  username text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
  WITH qualifying_events AS MATERIALIZED (
    SELECT e.event_id, e.organizer_id, e.starts_at
    FROM public.events e
    WHERE e.status = 'active'
      AND (p_city_id IS NULL OR e.city_id = p_city_id)
      AND (p_area_id IS NULL OR e.area_id = p_area_id)
      AND COALESCE(e.ends_at, e.starts_at + interval '8 hours') > now()
  ),
  talent_groups AS (
    SELECT
      et.talent_user_id AS user_id,
      u.username,
      u.avatar_url,
      min(q.starts_at) AS next_starts_at
    FROM qualifying_events q
    JOIN public.event_talent et ON et.event_id = q.event_id
    JOIN public.users u ON u.user_id = et.talent_user_id
    WHERE u.username IS NOT NULL
    GROUP BY et.talent_user_id, u.username, u.avatar_url
  ),
  maker_groups AS (
    SELECT
      u.user_id,
      u.username,
      u.avatar_url,
      min(q.starts_at) AS next_starts_at
    FROM qualifying_events q
    JOIN public.users u ON u.user_id = q.organizer_id
    WHERE u.username IS NOT NULL
      AND lower(u.username) <> 'livon'
    GROUP BY u.user_id, u.username, u.avatar_url
  ),
  limits AS (
    SELECT greatest(1, least(COALESCE(p_limit, 12), 12)) AS max_rows
  )
  (
    SELECT 'talent'::text, t.user_id, t.username, t.avatar_url
    FROM talent_groups t, limits
    ORDER BY t.next_starts_at ASC, t.username ASC, t.user_id ASC
    LIMIT (SELECT max_rows FROM limits)
  )

  UNION ALL

  (
    SELECT 'makers'::text, m.user_id, m.username, m.avatar_url
    FROM maker_groups m, limits
    ORDER BY m.next_starts_at ASC, m.username ASC, m.user_id ASC
    LIMIT (SELECT max_rows FROM limits)
  );
$function$;

-- This project has default function privileges for `anon`, so revoke that
-- explicit grant as well as the normal PostgreSQL `PUBLIC` grant.
REVOKE EXECUTE ON FUNCTION public.create_event_with_talent(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz, text, numeric, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_event_with_talent(uuid, uuid, text, text, text, timestamptz, timestamptz, text, numeric, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_event_talent(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_home_people_discovery(uuid, uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_event_with_talent(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz, text, numeric, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_event_with_talent(uuid, uuid, text, text, text, timestamptz, timestamptz, text, numeric, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_talent(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_home_people_discovery(uuid, uuid, integer) TO anon, authenticated, service_role;

-- Make the new RPC signatures visible to the Data API immediately.
NOTIFY pgrst, 'reload schema';

-- Verify on livon-test after applying:
-- SELECT * FROM public.get_home_people_discovery(NULL, NULL, 12);
-- SELECT * FROM public.get_event_talent('<event-id>'::uuid);
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.get_home_people_discovery(NULL, NULL, 12);
