-- TEST DATA ONLY — run against livon-test, never production.
--
-- Seeds "[TEST]" events for the home "Recently added" rail. Upload times
-- (created_at) are relative to now(); start times are Maseru wall-clock
-- digits stored as UTC (TEMP PATCH, same as the rest of events).
--
--   Shown:  1h ago (today), 20h ago (tomorrow), 30h ago (next week),
--           50h ago (this Saturday — also shows in "This weekend"),
--           Cap check 1-8 (65h-135h ago)
--   Hidden: Cap check 9-10 (145h, 155h ago — inside 7 days but past the
--           12-event cap), 8 days ago (past the 7-day window),
--           5h ago but already ended
--
-- The insert trigger queues connection notification emails, so the
-- queued rows for these events are deleted in the same transaction.
--
-- Ticket links for some of these events are set in the "Ticket links"
-- block after the inserts.
--
-- Cleanup: run the block at the bottom.

BEGIN;

WITH local_day AS (
  SELECT date_trunc('day', (now() AT TIME ZONE 'UTC') + interval '2 hours') AS today,
         date_trunc('week', (now() AT TIME ZONE 'UTC') + interval '2 hours') AS monday
),
seed(title, venue_name, area_id, category_id, cover_image_url, price, starts_local, uploaded_ago) AS (
  SELECT '[TEST] Sunset Rooftop Sessions', 'Rooftop Lounge',
         '11111111-1111-1111-1111-111111111203'::uuid, '11111111-1111-1111-1111-111111111306'::uuid,
         'https://vlfmgceimhduemsslhsg.supabase.co/storage/v1/object/public/event-covers/295bdf22-1fc0-428b-b6ac-0206fa418e88/a2f3bb6a-d596-4db3-8d77-9a48b4bb37b9.webp',
         150, today + interval '21 hours', interval '1 hour'
  FROM local_day
  UNION ALL
  SELECT '[TEST] Open Mic Night', 'The Basement',
         'b6f7e280-03bb-487f-a9b0-4bacbbf4fe0f'::uuid, '11111111-1111-1111-1111-111111111304'::uuid,
         'https://vlfmgceimhduemsslhsg.supabase.co/storage/v1/object/public/event-covers/295bdf22-1fc0-428b-b6ac-0206fa418e88/f057c5c8-1783-4616-a06f-c3b11f4c6a5f.webp',
         0, today + interval '1 day 19 hours', interval '20 hours'
  FROM local_day
  UNION ALL
  SELECT '[TEST] Sunday Jazz Brunch', 'Garden Terrace',
         '1aebd6e3-5289-463b-ba1f-dedd23ddb8ac'::uuid, 'c4f8e3f2-16ba-4b53-8021-99270c7aeb2f'::uuid,
         '/images/event-cover-placeholder.jpg',
         250, monday + interval '13 days 11 hours', interval '30 hours'
  FROM local_day
  UNION ALL
  SELECT '[TEST] Saturday Market Day', 'Lilala Grounds',
         '8ac3bda0-cc58-4e9f-b337-4b612aba1cba'::uuid, '11111111-1111-1111-1111-111111111304'::uuid,
         'https://vlfmgceimhduemsslhsg.supabase.co/storage/v1/object/public/event-covers/295bdf22-1fc0-428b-b6ac-0206fa418e88/a681902f-f4de-4ebb-b571-89b0555a8f4c.webp',
         50, monday + interval '5 days 10 hours', interval '50 hours'
  FROM local_day
  UNION ALL
  SELECT '[TEST] Too Old Upload (hidden)', 'Nowhere Hall',
         '11111111-1111-1111-1111-111111111203'::uuid, '11111111-1111-1111-1111-111111111306'::uuid,
         '/images/event-cover-placeholder.jpg',
         0, today + interval '3 days 18 hours', interval '8 days'
  FROM local_day
  UNION ALL
  SELECT '[TEST] Already Over (hidden)', 'Nowhere Hall',
         '11111111-1111-1111-1111-111111111203'::uuid, '11111111-1111-1111-1111-111111111306'::uuid,
         '/images/event-cover-placeholder.jpg',
         0, today - interval '1 day' + interval '9 hours', interval '5 hours'
  FROM local_day
)
INSERT INTO public.events
  (organizer_id, category_id, city_id, area_id, title, venue_name,
   starts_at, cover_image_url, price, status, created_at)
SELECT '295bdf22-1fc0-428b-b6ac-0206fa418e88'::uuid, category_id,
       '07143b52-e98d-4f24-8c4f-ab2011e85fd1'::uuid, area_id, title, venue_name,
       starts_local AT TIME ZONE 'UTC', cover_image_url, price, 'active',
       now() - uploaded_ago
FROM seed;

-- Cap check: 10 more uploads inside the 7-day window, so 14 qualify and
-- the 12-event cap drops the two oldest (Cap check 9 and 10).
INSERT INTO public.events
  (organizer_id, category_id, city_id, area_id, title, venue_name,
   starts_at, cover_image_url, price, status, created_at)
SELECT '295bdf22-1fc0-428b-b6ac-0206fa418e88'::uuid,
       '11111111-1111-1111-1111-111111111306'::uuid,
       '07143b52-e98d-4f24-8c4f-ab2011e85fd1'::uuid,
       '11111111-1111-1111-1111-111111111203'::uuid,
       '[TEST] Cap check ' || n, 'Test Venue',
       (date_trunc('day', (now() AT TIME ZONE 'UTC') + interval '2 hours')
         + (n + 2) * interval '1 day' + interval '19 hours') AT TIME ZONE 'UTC',
       (ARRAY[
         'https://vlfmgceimhduemsslhsg.supabase.co/storage/v1/object/public/event-covers/295bdf22-1fc0-428b-b6ac-0206fa418e88/a2f3bb6a-d596-4db3-8d77-9a48b4bb37b9.webp',
         'https://vlfmgceimhduemsslhsg.supabase.co/storage/v1/object/public/event-covers/295bdf22-1fc0-428b-b6ac-0206fa418e88/f057c5c8-1783-4616-a06f-c3b11f4c6a5f.webp',
         'https://vlfmgceimhduemsslhsg.supabase.co/storage/v1/object/public/event-covers/295bdf22-1fc0-428b-b6ac-0206fa418e88/a681902f-f4de-4ebb-b571-89b0555a8f4c.webp'
       ])[1 + n % 3],
       n * 10, 'active',
       now() - (interval '55 hours' + n * interval '10 hours')
FROM generate_series(1, 10) AS n;

-- Separate statement: AFTER INSERT trigger rows aren't visible to a
-- data-modifying CTE in the same statement.
DELETE FROM public.connection_event_notification_queue
WHERE event_id IN (SELECT event_id FROM public.events WHERE title LIKE '[TEST] %');

COMMIT;

-- ── Ticket links ────────────────────────────────────────────────────────
-- Requires scripts/migrations/2026-10-event-ticket-links.sql. Safe to run
-- on its own if the [TEST] events above were seeded earlier.
--   Sunset Rooftop Sessions: 1 link  -> $ button opens it directly
--   Saturday Market Day:     2 links -> $ button opens the chooser
--                            (also in the "This weekend" rail)
--   Sunday Jazz Brunch:      4 links -> chooser with every provider
--   Cap check 3:             2 links -> chooser (starts soonest, so it's
--                            usually the one in "This weekend")
--   Cap check 4:             1 link  -> opens directly
--   Open Mic Night, other Cap checks: none -> no $ button

BEGIN;

UPDATE public.events
SET ticket_links = ARRAY['https://ecoticket.co.ls/events/sunset-rooftop-sessions']
WHERE title = '[TEST] Sunset Rooftop Sessions';

UPDATE public.events
SET ticket_links = ARRAY[
  'https://ticketbox.co.ls/e/saturday-market-day',
  'https://www.mytag.co.ls/tickets/saturday-market-day'
]
WHERE title = '[TEST] Saturday Market Day';

UPDATE public.events
SET ticket_links = ARRAY[
  'https://ecoticket.co.ls/events/sunday-jazz-brunch',
  'https://ticketbox.co.ls/e/sunday-jazz-brunch',
  'https://mytag.co.ls/tickets/sunday-jazz-brunch',
  'https://etickets.co.ls/event/sunday-jazz-brunch'
]
WHERE title = '[TEST] Sunday Jazz Brunch';

UPDATE public.events
SET ticket_links = ARRAY[
  'https://ticketbox.co.ls/e/cap-check-3',
  'https://www.mytag.co.ls/tickets/cap-check-3'
]
WHERE title = '[TEST] Cap check 3';

UPDATE public.events
SET ticket_links = ARRAY['https://etickets.co.ls/event/cap-check-4']
WHERE title = '[TEST] Cap check 4';

COMMIT;

-- Negative check — each of these must fail events_ticket_links_allowed:
-- UPDATE public.events SET ticket_links = ARRAY['https://example.com/tickets']
--   WHERE title = '[TEST] Open Mic Night';
-- UPDATE public.events SET ticket_links = ARRAY['http://ecoticket.co.ls/x']
--   WHERE title = '[TEST] Open Mic Night';
-- UPDATE public.events SET ticket_links = ARRAY['https://ecoticket.co.ls.evil.com/x']
--   WHERE title = '[TEST] Open Mic Night';

-- ── Cleanup ─────────────────────────────────────────────────────────────
-- BEGIN;
-- DELETE FROM public.connection_event_notification_queue
--   WHERE event_id IN (SELECT event_id FROM public.events WHERE title LIKE '[TEST] %');
-- DELETE FROM public.events WHERE title LIKE '[TEST] %';
-- COMMIT;
