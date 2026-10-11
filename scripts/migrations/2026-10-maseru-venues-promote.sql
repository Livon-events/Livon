-- Promote venue names typed on Maseru events into saved venues, merge
-- spelling duplicates into one canonical name, and move events/venues to
-- their correct areas.

BEGIN;

UPDATE public.areas a
SET name = 'Roma'
FROM public.cities c
WHERE c.city_id = a.city_id AND c.name = 'Maseru'
  AND a.name = 'Roma (Manonyane)'
  AND NOT EXISTS (SELECT 1 FROM public.areas r WHERE r.city_id = c.city_id AND r.name = 'Roma');

INSERT INTO public.areas (city_id, name)
SELECT c.city_id, n.name
FROM public.cities c
CROSS JOIN (VALUES ('Ha Mabote'), ('Ha Ts''osane'), ('Morija'), ('Thuathe')) AS n (name)
WHERE c.name = 'Maseru'
  AND NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.city_id = c.city_id AND a.name = n.name);

CREATE TEMP TABLE venue_fix (venue_name text, area_name text) ON COMMIT DROP;
INSERT INTO venue_fix VALUES
  ('Bethel', 'Ha Foso'),
  ('Mabote LECSA', 'Ha Mabote'),
  ('Lekhalong Natural Springs', 'Ha Ts''osane'),
  ('Monaco Lounge & Car Wash', 'Khubetsoana'),
  ('GenRations', 'Lithabaneng'),
  ('Shisanyama', 'Lithabaneng'),
  ('St. Vincent Roman Catholic Church', 'Lithabaneng'),
  ('American Corner (State Library)', 'Maseru Central'),
  ('BNP Centre: Lapeng', 'Maseru Central'),
  ('Cafe What?', 'Maseru Central'),
  ('Hotspot Bar', 'Maseru Central'),
  ('Lake Cookhouse', 'Maseru Central'),
  ('Makoanyane Square', 'Maseru Central'),
  ('Manthabiseng Convention Centre', 'Maseru Central'),
  ('Maseru Club', 'Maseru Central'),
  ('Maseru Tourist Information & Crafts Center', 'Maseru Central'),
  ('PURPLE', 'Maseru Central'),
  ('The Caff (Setsoalle Park)', 'Maseru Central'),
  ('Tip Top', 'Maseru Central'),
  ('The Secret Lounge', 'Mazenod'),
  ('Morija Museum Amphitheatre', 'Morija'),
  ('GROOVE BAR', 'Motimposo'),
  ('Headlines', 'Motimposo'),
  ('Lion''s Carwash and Buvette', 'Qiloane'),
  ('Mmelesi Lodge', 'Qiloane'),
  ('Selibeng Conference Centre', 'Qoaling'),
  ('The Wild', 'Roma'),
  ('Lesotho High School Courts', 'Stadium Area'),
  ('Victory Hall', 'Stadium Area'),
  ('Khutsong Lodge', 'Thaba-Bosiu'),
  ('Thaba Bosiu Cultural Village', 'Thaba-Bosiu'),
  ('ba.one', 'Thetsane'),
  ('Baduza Park (Maseru Mall)', 'Thetsane'),
  ('News Cafe', 'Thetsane'),
  ('The Cool Thuathe', 'Thuathe');

-- Typed spellings (lowercased, trimmed) that should become the canonical name.
CREATE TEMP TABLE venue_alias (typed text, venue_name text) ON COMMIT DROP;
INSERT INTO venue_alias VALUES
  ('monaco lounge and car wash', 'Monaco Lounge & Car Wash'),
  ('monaco lounge and carwash', 'Monaco Lounge & Car Wash'),
  ('genrations club', 'GenRations'),
  ('american corner, state library', 'American Corner (State Library)'),
  ('hotspot', 'Hotspot Bar'),
  ('manthabiseng convention center', 'Manthabiseng Convention Centre'),
  ('manthabiseng conventional centre', 'Manthabiseng Convention Centre'),
  ('maseru tourist information and crafts center', 'Maseru Tourist Information & Crafts Center'),
  ('the caff (setsoalle park) arrival centre', 'The Caff (Setsoalle Park)'),
  ('ba. one (maseru mall)', 'ba.one'),
  ('ba.one (maseru mall)', 'ba.one'),
  ('baduza park maseru mall', 'Baduza Park (Maseru Mall)');

INSERT INTO venue_alias
SELECT lower(f.venue_name), f.venue_name FROM venue_fix f
WHERE NOT EXISTS (SELECT 1 FROM venue_alias al WHERE al.typed = lower(f.venue_name));

INSERT INTO public.venues (name, area_id)
SELECT f.venue_name, a.area_id
FROM venue_fix f
JOIN public.areas a ON a.name = f.area_name
JOIN public.cities c ON c.city_id = a.city_id AND c.name = 'Maseru'
ON CONFLICT (name) DO UPDATE SET area_id = EXCLUDED.area_id;

UPDATE public.events e
SET venue_name = f.venue_name, area_id = a.area_id
FROM venue_alias al
JOIN venue_fix f ON f.venue_name = al.venue_name
JOIN public.areas a ON a.name = f.area_name
JOIN public.cities c ON c.city_id = a.city_id AND c.name = 'Maseru'
WHERE lower(trim(e.venue_name)) = al.typed
  AND e.area_id IN (
    SELECT ma.area_id FROM public.areas ma
    JOIN public.cities mc ON mc.city_id = ma.city_id AND mc.name = 'Maseru'
  );

COMMIT;
