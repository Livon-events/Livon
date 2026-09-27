-- Add Business & Tech event category.

INSERT INTO public.categories (category_id, name)
VALUES ('11111111-1111-1111-1111-111111111307', 'Business & Tech')
ON CONFLICT (category_id) DO UPDATE
SET name = EXCLUDED.name;
