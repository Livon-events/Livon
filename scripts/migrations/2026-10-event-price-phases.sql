-- Event price phases: paid events may sell advance tickets in up to three
-- phases (early bird → regular → late), plus an optional gate price.
-- events.price_phases holds the chronological list
--   [{"label": "Early bird", "price": 150, "until": "2026-10-20"},
--    {"label": null,         "price": 200, "until": null}]
-- Each phase ends on its `until` date (inclusive, Maseru calendar day). Only
-- the last phase may have until = null, meaning it runs until the event; a
-- dated last phase requires events.gate_price, which takes over once advance
-- sales end. The last phase's price is mirrored in events.price.
-- Single-price events store '[]'. The app validates the same shape
-- (src/modules/events/pricePhases.ts) — this constraint stops direct Data
-- API writes.
--
-- events.gate_price is the door price: it's what cards show while the event
-- is live, and after a dated last phase has ended.
--
-- The current price is derived at read time by event_current_price, never
-- stored, so cards switch price on their own when a phase ends.
-- get_home_feed, get_weekend_events and get_recent_events return it in
-- their existing `price` column — return types are unchanged, so CREATE OR
-- REPLACE keeps grants. The p_free_only filter keeps reading events.price.
--
-- REQUIRES 2026-10-event-ticket-links.sql and
-- 2026-10-home-feed-viewer-going.sql — function bodies are identical to the
-- versions defined there apart from the `price` expression.
--
-- Deploy: apply this migration BEFORE shipping the app change (the app
-- selects events.price_phases and events.gate_price).

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS price_phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gate_price numeric;

CREATE OR REPLACE FUNCTION public.price_phases_are_valid(
  p_price numeric,
  p_phases jsonb,
  p_gate_price numeric
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
declare
  n int;
  ph jsonb;
  v_price numeric;
  v_label jsonb;
  v_until text;
  v_until_date date;
  prev_until date;
begin
  if p_gate_price is not null
    and (p_price <= 0 or p_gate_price <= 0 or p_gate_price > 100000) then
    return false;
  end if;

  if p_phases is null or jsonb_typeof(p_phases) <> 'array' then
    return false;
  end if;

  n := jsonb_array_length(p_phases);
  if n = 0 then
    return true;
  end if;
  if n > 3 then
    return false;
  end if;

  for i in 0 .. n - 1 loop
    ph := p_phases -> i;
    if jsonb_typeof(ph) <> 'object' then
      return false;
    end if;
    if exists (
      select 1 from jsonb_object_keys(ph) as k where k not in ('label', 'price', 'until')
    ) then
      return false;
    end if;

    if jsonb_typeof(ph -> 'price') is distinct from 'number' then
      return false;
    end if;
    v_price := (ph ->> 'price')::numeric;
    if v_price <= 0 or v_price > 100000 then
      return false;
    end if;

    v_label := ph -> 'label';
    if v_label is not null and jsonb_typeof(v_label) <> 'null' then
      if jsonb_typeof(v_label) <> 'string'
        or length(ph ->> 'label') > 30
        or (ph ->> 'label') ~ '[[:cntrl:]]' then
        return false;
      end if;
    end if;

    v_until := ph ->> 'until';
    if i = n - 1 then
      if v_price <> p_price then
        return false;
      end if;
      -- An undated single phase is just a price — stored as '[]'.
      if v_until is null and n = 1 then
        return false;
      end if;
      if v_until is not null and p_gate_price is null then
        return false;
      end if;
    elsif v_until is null then
      return false;
    end if;

    if v_until is not null then
      if v_until !~ '^\d{4}-\d{2}-\d{2}$' then
        return false;
      end if;
      begin
        v_until_date := v_until::date;
      exception when others then
        return false;
      end;
      if to_char(v_until_date, 'YYYY-MM-DD') <> v_until then
        return false;
      end if;
      if prev_until is not null and v_until_date <= prev_until then
        return false;
      end if;
      prev_until := v_until_date;
    end if;
  end loop;

  return true;
end;
$function$;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_price_phases_valid,
  ADD CONSTRAINT events_price_phases_valid
    CHECK (public.price_phases_are_valid(price, price_phases, gate_price));

-- Price on sale right now. Mirrors getCurrentPrice in pricePhases.ts:
--   1. gate price while the event is live (TEMP PATCH: starts_at/ends_at are
--      Maseru wall-clock digits labelled UTC — same +2h shift as get_home_feed);
--   2. events.price when there are no phases;
--   3. the first phase whose end date hasn't passed in Maseru;
--   4. the gate price once advance sales have ended, else the last phase price.
CREATE OR REPLACE FUNCTION public.event_current_price(
  p_price numeric,
  p_phases jsonb,
  p_gate_price numeric,
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  select case
    when p_gate_price is not null
      and (now() + interval '2 hours') >= p_starts_at
      and (now() + interval '2 hours') < coalesce(p_ends_at, p_starts_at + interval '8 hours')
      then p_gate_price
    when jsonb_array_length(coalesce(p_phases, '[]'::jsonb)) = 0
      then p_price
    else coalesce(
      (
        select (t.ph ->> 'price')::numeric
        from jsonb_array_elements(p_phases) with ordinality as t(ph, ord)
        where t.ph ->> 'until' is null
          or (t.ph ->> 'until')::date >= (now() at time zone 'Africa/Maseru')::date
        order by t.ord
        limit 1
      ),
      p_gate_price,
      p_price
    )
  end;
$function$;

-- ── get_home_feed ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_home_feed(
  p_category_id uuid DEFAULT NULL::uuid,
  p_city_id uuid DEFAULT NULL::uuid,
  p_area_id uuid DEFAULT NULL::uuid,
  p_cursor_rank_score integer DEFAULT NULL::integer,
  p_cursor_total_going integer DEFAULT NULL::integer,
  p_cursor_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_cursor_event_id uuid DEFAULT NULL::uuid,
  p_page_size integer DEFAULT 20,
  p_free_only boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  title text,
  price numeric,
  venue_name text,
  area text,
  host_username text,
  cover_image_url text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  peek_connections_count integer,
  rank_score integer,
  total_going_count integer,
  is_claimable boolean,
  category_name text,
  ticket_links text[],
  my_going boolean,
  my_visibility text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  with viewer as (
    select auth.uid() as viewer_id
  ),
  livon as (
    select user_id
    from public.users
    where lower(username) = 'livon'
    limit 1
  ),
  base as (
    select
      e.event_id,
      e.title,
      public.event_current_price(e.price, e.price_phases, e.gate_price, e.starts_at, e.ends_at) as price,
      e.venue_name,
      a.name as area,
      u.username as host_username,
      e.cover_image_url,
      e.starts_at,
      e.ends_at,
      e.organizer_id,
      cat.name as category_name,
      e.ticket_links,
      (
        e.claimed_at IS NULL
        AND e.organizer_id = (select user_id from livon)
      ) as is_claimable,

      exists (
        select 1
        from public.connections c, viewer v
        where c.status = 'accepted'
          and v.viewer_id is not null
          and (
            (c.requester_id = v.viewer_id and c.receiver_id = e.organizer_id)
            or (c.receiver_id = v.viewer_id and c.requester_id = e.organizer_id)
          )
      ) as is_connection_host,

      (
        select count(*)::int
        from public.event_interests ei, viewer v
        where ei.event_id = e.event_id
          and ei.visibility = 'visible'
          and ei.user_id <> e.organizer_id
          and v.viewer_id is not null
          and exists (
            select 1 from public.connections c
            where c.status = 'accepted'
              and (
                (c.requester_id = v.viewer_id and c.receiver_id = ei.user_id)
                or (c.receiver_id = v.viewer_id and c.requester_id = ei.user_id)
              )
          )
      ) as connections_going_count,

      (
        select count(*)::int
        from public.event_interests ei2
        where ei2.event_id = e.event_id
      ) as total_going_count,

      (
        select ei3.visibility
        from public.event_interests ei3, viewer v
        where ei3.event_id = e.event_id
          and v.viewer_id is not null
          and ei3.user_id = v.viewer_id
        limit 1
      ) as my_visibility

    from public.events e
    join public.areas a on a.area_id = e.area_id
    join public.users u on u.user_id = e.organizer_id
    join public.categories cat on cat.category_id = e.category_id
    where e.status = 'active'
      and (
        (e.ends_at is not null and (now() + interval '2 hours') < e.ends_at)
        or (e.ends_at is null and (now() + interval '2 hours') < e.starts_at + interval '8 hours')
      )
      and (p_category_id is null or e.category_id = p_category_id)
      and (p_city_id is null or e.city_id = p_city_id)
      and (p_area_id is null or e.area_id = p_area_id)
      and (not coalesce(p_free_only, false) or e.price = 0)
  ),
  scored as (
    select
      *,
      (
        case when is_connection_host then 1000 else 0 end
        + connections_going_count
      )::int as rank_score,
      (
        connections_going_count
        + case when is_connection_host then 1 else 0 end
      )::int as peek_connections_count
    from base
  )
  select
    event_id as id,
    title,
    price,
    venue_name,
    area,
    host_username,
    cover_image_url,
    starts_at,
    ends_at,
    peek_connections_count,
    rank_score,
    total_going_count,
    is_claimable,
    category_name,
    ticket_links,
    (my_visibility is not null) as my_going,
    my_visibility
  from scored
  where
    p_cursor_rank_score is null
    or (rank_score < p_cursor_rank_score)
    or (rank_score = p_cursor_rank_score and total_going_count < p_cursor_total_going)
    or (rank_score = p_cursor_rank_score and total_going_count = p_cursor_total_going
        and starts_at > p_cursor_starts_at)
    or (rank_score = p_cursor_rank_score and total_going_count = p_cursor_total_going
        and starts_at = p_cursor_starts_at and event_id > p_cursor_event_id)
  order by rank_score desc, total_going_count desc, starts_at asc, event_id asc
  limit least(greatest(coalesce(p_page_size, 20), 1), 50);
$function$;

-- ── get_weekend_events ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_weekend_events(
  p_city_id uuid DEFAULT NULL::uuid,
  p_area_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  title text,
  price numeric,
  venue_name text,
  area text,
  cover_image_url text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  ticket_links text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  with local_week as (
    select date_trunc('week', (now() at time zone 'UTC') + interval '2 hours') as monday
  ),
  win as (
    select
      (monday + interval '4 days') at time zone 'UTC' as fri,
      (monday + interval '7 days') at time zone 'UTC' as next_monday
    from local_week
  )
  select
    e.event_id as id,
    e.title,
    public.event_current_price(e.price, e.price_phases, e.gate_price, e.starts_at, e.ends_at) as price,
    e.venue_name,
    a.name as area,
    e.cover_image_url,
    e.starts_at,
    e.ends_at,
    e.ticket_links
  from public.events e
  join public.areas a on a.area_id = e.area_id
  cross join win
  where e.status = 'active'
    and e.starts_at >= win.fri
    and e.starts_at < win.next_monday
    and (
      (e.ends_at is not null and (now() + interval '2 hours') < e.ends_at)
      or (e.ends_at is null and (now() + interval '2 hours') < e.starts_at + interval '8 hours')
    )
    and (p_city_id is null or e.city_id = p_city_id)
    and (p_area_id is null or e.area_id = p_area_id)
  order by e.starts_at asc, e.event_id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$function$;

-- ── get_recent_events ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_recent_events(
  p_city_id uuid DEFAULT NULL::uuid,
  p_area_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(
  id uuid,
  title text,
  price numeric,
  venue_name text,
  area text,
  cover_image_url text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  ticket_links text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  select
    e.event_id as id,
    e.title,
    public.event_current_price(e.price, e.price_phases, e.gate_price, e.starts_at, e.ends_at) as price,
    e.venue_name,
    a.name as area,
    e.cover_image_url,
    e.starts_at,
    e.ends_at,
    e.ticket_links
  from public.events e
  join public.areas a on a.area_id = e.area_id
  where e.status = 'active'
    and e.created_at >= now() - interval '7 days'
    and (
      (e.ends_at is not null and (now() + interval '2 hours') < e.ends_at)
      or (e.ends_at is null and (now() + interval '2 hours') < e.starts_at + interval '8 hours')
    )
    and (p_city_id is null or e.city_id = p_city_id)
    and (p_area_id is null or e.area_id = p_area_id)
  order by e.created_at desc, e.event_id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 12);
$function$;

COMMIT;
