-- Known clubs/venues for the create-event form. Picking one pre-fills the
-- event's area; events.venue_name stays free text so unlisted venues still work.

CREATE TABLE IF NOT EXISTS public.venues (
  venue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  area_id uuid NOT NULL REFERENCES public.areas (area_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venues_area_id_idx ON public.venues (area_id);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venues are viewable by everyone" ON public.venues;
CREATE POLICY "Venues are viewable by everyone"
  ON public.venues FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.venues FROM anon, authenticated;
GRANT SELECT ON public.venues TO anon, authenticated;

INSERT INTO public.venues (name, area_id)
SELECT v.venue_name, a.area_id
FROM (
  VALUES
    ('Manthabiseng Convention Center', 'Stadium Area'),
    ('Kasi Kota', 'Lithabaneng'),
    ('Hotspot Bar', 'Maseru Central'),
    ('Panda Club', 'Maseru Central'),
    ('The Wild', 'Maseru Central'),
    ('Phethy', 'Lithabaneng'),
    ('1174 Legacy', 'Ratau'),
    ('Maseru Club', 'Maseru Central'),
    ('GenRations', 'Lithabaneng'),
    ('Monaco', 'Maseru Central')
) AS v (venue_name, area_name)
JOIN public.areas a ON a.name = v.area_name
JOIN public.cities c ON c.city_id = a.city_id AND c.name = 'Maseru'
ON CONFLICT (name) DO UPDATE
SET area_id = EXCLUDED.area_id;
