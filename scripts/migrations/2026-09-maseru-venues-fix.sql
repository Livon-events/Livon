-- Correct Maseru venue areas/names and add missing venues.

BEGIN;

-- Khubetsoana venues list themselves under Maseru.
UPDATE public.areas a
SET city_id = m.city_id
FROM public.cities m, public.cities b
WHERE m.name = 'Maseru' AND b.name = 'Berea'
  AND a.city_id = b.city_id AND a.name = 'Khubetsoana';

INSERT INTO public.areas (city_id, name)
SELECT c.city_id, 'Ha Pita' FROM public.cities c
WHERE c.name = 'Maseru'
  AND NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.city_id = c.city_id AND a.name = 'Ha Pita');

UPDATE public.venues SET name = 'Manthabiseng Convention Centre' WHERE name = 'Manthabiseng Convention Center';
UPDATE public.venues SET name = 'Phethy Club' WHERE name = 'Phethy';
UPDATE public.venues SET name = 'Monaco Lounge & Car Wash' WHERE name = 'Monaco';

INSERT INTO public.venues (name, area_id)
SELECT v.venue_name, a.area_id
FROM (
  VALUES
    ('ba.one', 'Thetsane'),
    ('Manthabiseng Convention Centre', 'Maseru Central'),
    ('Panda Club', 'Maseru Central'),
    ('Hotspot Bar', 'Maseru Central'),
    ('1174 Legacy', 'Matsieng'),
    ('GenRations', 'Lithabaneng'),
    ('The Wild', 'Roma (Manonyane)'),
    ('Phethy Club', 'Ha Leqele'),
    ('Monaco Lounge & Car Wash', 'Khubetsoana'),
    ('Tesfa Lounge', 'Khubetsoana'),
    ('Kasi Kota', 'Ha Pita'),
    ('Headlines', 'Motimposo')
) AS v (venue_name, area_name)
JOIN public.areas a ON a.name = v.area_name
JOIN public.cities c ON c.city_id = a.city_id AND c.name = 'Maseru'
ON CONFLICT (name) DO UPDATE SET area_id = EXCLUDED.area_id;

-- Existing events posted under the old, wrong areas.
UPDATE public.events e
SET area_id = a.area_id
FROM (
  VALUES ('1174 legacy', 'Matsieng'), ('kasi kota', 'Ha Pita'), ('phethy', 'Ha Leqele')
) AS fix (venue_name, area_name)
JOIN public.areas a ON a.name = fix.area_name
JOIN public.cities c ON c.city_id = a.city_id AND c.name = 'Maseru'
WHERE lower(e.venue_name) = fix.venue_name;

COMMIT;
