-- Add more Maseru areas.

INSERT INTO public.areas (city_id, name)
SELECT c.city_id, v.name
FROM (
  VALUES
    ('Ha Foso'),
    ('Thetsane'),
    ('Ha Matala'),
    ('Likotsi'),
    ('Tsolo'),
    ('Ha Leqele'),
    ('Florida'),
    ('Thaba-Bosiu'),
    ('Matsieng')
) AS v (name)
JOIN public.cities c ON c.name = 'Maseru'
WHERE NOT EXISTS (
  SELECT 1 FROM public.areas a WHERE a.city_id = c.city_id AND a.name = v.name
);
