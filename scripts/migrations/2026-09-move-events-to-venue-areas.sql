-- Move existing events whose venue name clearly matches a known venue into
-- that venue's area. Production-only data fix (event ids are prod rows).
--
-- Previous areas, for rollback:
--   32b30021-bf93-415b-8a9e-fd7471ed89a3  Ba. one (Maseru mall)       Maseru Central
--   25768742-5d35-4721-8cf3-130d27af08c5  Headlines                   Maseru Central
--   d8d7c186-100e-48b5-b04c-82217a50e7d2  Headlines                   Maseru Central
--   8eaad976-ebdf-42c6-aa20-0cc568f3ffcb  Headlines                   Maseru Central
--   c607b727-4923-4177-a71e-8a385712ee66  Monaco lounge and car wash  Maseru Central
--   feb52366-8e11-47b2-9c0a-a9fcfc5a2a7f  Monaco lounge and carwash   Lithabaneng

UPDATE public.events e
SET area_id = a.area_id
FROM (
  VALUES
    ('32b30021-bf93-415b-8a9e-fd7471ed89a3'::uuid, 'Thetsane'),
    ('25768742-5d35-4721-8cf3-130d27af08c5'::uuid, 'Motimposo'),
    ('d8d7c186-100e-48b5-b04c-82217a50e7d2'::uuid, 'Motimposo'),
    ('8eaad976-ebdf-42c6-aa20-0cc568f3ffcb'::uuid, 'Motimposo'),
    ('c607b727-4923-4177-a71e-8a385712ee66'::uuid, 'Khubetsoana'),
    ('feb52366-8e11-47b2-9c0a-a9fcfc5a2a7f'::uuid, 'Khubetsoana')
) AS fix (event_id, area_name)
JOIN public.areas a ON a.name = fix.area_name
JOIN public.cities c ON c.city_id = a.city_id AND c.name = 'Maseru'
WHERE e.event_id = fix.event_id;
