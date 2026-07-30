# Livon — Database Functions Reference

`docs/db/functions.md`

Derived from `pg_proc` on the `public` schema. Covers every function: signature, security mode, and what it actually does (not just the name). This doc is now considered stable — future functions should be **appended**, not re-derived from scratch.

---

## get_home_feed

```
get_home_feed(
  p_category_id uuid DEFAULT NULL,
  p_cursor_rank_score integer DEFAULT NULL,
  p_cursor_total_going integer DEFAULT NULL,
  p_cursor_starts_at timestamptz DEFAULT NULL,
  p_cursor_event_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 20
)
RETURNS TABLE(
  id uuid, title text, price numeric, venue_name text, area text,
  host_username text, cover_image_url text, starts_at timestamptz,
  ends_at timestamptz, peek_connections_count integer,
  rank_score integer, total_going_count integer
)
```
`SQL`, `STABLE`, `SECURITY DEFINER`, `search_path = public`

**Status: already built and appears complete** — this is not a "to-do," it exists in the live database.

**What it does:**
- Pulls active events (`status = 'active'`) that haven't ended yet. "Ended" is derived: if `ends_at` is set, event is live until then; if `ends_at` is null, event is treated as live until `starts_at + 8 hours` (a fallback window for events with no explicit end time).
- Optional `p_category_id` filter.
- **Ranking (`rank_score`)** — two factors combined:
  1. `is_connection_host` (bool): is the viewer connected — `accepted` status, either direction — to this event's organizer? If yes, contributes **1000** to the score.
  2. `connections_going_count` (int): how many of the viewer's accepted connections have a `visible` `event_interests` row on this event (excluding the organizer themselves, even if they somehow have their own interest row).
  - `rank_score = (is_connection_host ? 1000 : 0) + connections_going_count`. The 1000-point gap is a deliberate design choice (per an internal "peek.md" ranking doc referenced in code comments) — a connection hosting an event always outranks any number of connections merely attending; it's a strong signal, not an absolute pin.
- **`peek_connections_count`** — the number shown on the card badge: `connections_going_count + (1 if is_connection_host else 0)`. Distinct from `rank_score`, which is used for ordering only.
- **`total_going_count`** — unfiltered count of all `event_interests` rows for the event, regardless of visibility. This is the public "N going" number, separate from the connections-based badge above.
- **Anonymous viewers:** `viewer as (select auth.uid() as viewer_id)` — when there's no session, `viewer_id` is null, and both connection-based factors (`is_connection_host`, `connections_going_count`) short-circuit to `false`/`0` via the `v.viewer_id is not null` guards. So an anonymous viewer sees every active event with `rank_score = 0` for all of them, ordered purely by `total_going_count desc, starts_at asc` as tiebreakers — no crash, no special-cased anon branch needed, it falls out of the same query naturally.
- **Pagination:** keyset/cursor-based on the composite `(rank_score desc, total_going_count desc, starts_at asc, event_id asc)` ordering. The `where` clause reproducing that tuple comparison (`rank_score < cursor OR (rank_score = cursor AND total_going < cursor) OR ...`) is the strict "next page" condition matching the sort order exactly — this is the standard keyset pagination pattern, not offset-based, so it stays performant and stable even as new events are inserted between page loads.

**Open questions to verify against the frontend card components before wiring this in:**
- Confirm returned field names (`area`, `host_username`, `peek_connections_count`, etc.) match what the existing event card components expect, or whether a mapping layer is needed.
- Confirm the 8-hour fallback window for events with no `ends_at` matches product expectations (e.g. is 8 hours the right default, should it be configurable per category?).
- No `city_id`/location filter param currently — only `category_id`. If the read path needs city-scoping (likely, given `users.preferred_city_id` exists), that's not yet in this function's signature.
- Performance: per the schema doc's note, `events` has no secondary indexes on `city_id`/`category_id`/`starts_at`/`organizer_id` — this function's filtering and joins may benefit from indexes once real data volume shows up, but don't add them pre-emptively.

---

## get_my_event_view_stats

```
get_my_event_view_stats(p_event_id uuid)
RETURNS TABLE(
  total_views bigint, total_unique_viewers bigint,
  total_authenticated_views bigint, unique_authenticated_viewers bigint,
  total_anonymous_views bigint, unique_anonymous_viewers bigint
)
```
`plpgsql`, `SECURITY DEFINER`, `search_path = public`

Organizer-only stats lookup. Internally checks `events.organizer_id = (select auth.uid())` for the given `p_event_id` and raises an exception if the caller isn't the organizer, before querying the `event_view_stats` view. This is the sole read path for that view (which itself carries no RLS policies, being a view over two deny-read tables — see `rls-policies.md`).

---

## event_going_count

```
event_going_count(p_event_id uuid) RETURNS integer
```
`SQL`, `STABLE`, `SECURITY DEFINER`, `search_path = public`

Trivial wrapper: `count(*)` over `event_interests` for a given event, unfiltered by visibility. Simple public-facing "N going" helper — same underlying count as `total_going_count` inside `get_home_feed`, just exposed standalone (e.g. for an event-detail page that doesn't need the whole feed query).

---

## redeem_invite

```
redeem_invite(p_code text, p_anon_session_id uuid DEFAULT NULL) RETURNS jsonb
```
`plpgsql`, `SECURITY DEFINER`, `search_path = public`

Handles invite-link clicks for both authenticated and anonymous visitors:
- Looks up the invite by `code`. Unknown code → returns `{"event_id": null}`.
- **Self-click guard:** if the caller is the invite's own creator, just resolves the event id without logging a click (avoids a creator inflating their own click count by testing their link).
- **Anonymous session handling:** if there's no authenticated caller and no `p_anon_session_id` passed in, generates a fresh `gen_random_uuid()` for this visitor and returns it in the response — the frontend is expected to persist this and pass it back on future calls so repeat visits from the same anon session dedupe correctly.
- Inserts into `invite_link_clicks` with `ON CONFLICT DO NOTHING`, relying on the two partial unique indexes documented in `schema.md` (`invite_link_clicks_unique_user`, `invite_link_clicks_unique_anon`) for dedup.
- Only increments `invite_links.click_count` if the insert actually happened (`GET DIAGNOSTICS v_row_count = row_count`) — a duplicate click (conflict) does not double-count.
- Returns `{"event_id": ..., "anon_session_id": ...}` — `anon_session_id` is only populated for anonymous callers, `null` for authenticated ones.

---

## resolve_login_email

```
resolve_login_email(p_identifier text) RETURNS text
```
`plpgsql`, `SECURITY DEFINER`, `search_path = public`

Login helper used by `signInWithEmail`. If the identifier looks like an email (`contains @`), normalizes and returns it as-is (lowercased, trimmed). Otherwise treats it as a username and looks up the matching account's email via `lower(username) = lower(trim(p_identifier))`.

⚠️ Note: this function does a **case-insensitive** username lookup (`lower(username) = lower(...)`) purely in its query logic — it does not rely on a case-insensitive index (confirmed in `schema.md` there isn't one). This means a username lookup here does a full case-normalizing comparison rather than an index-backed exact match; fine at current scale, worth revisiting if `users` grows large enough for this to show up in query performance.

Returns `null` if no match is found (both for unknown usernames and, by extension, upstream `signInWithEmail` turns that into the generic "no such account" error — no enumeration, consistent with the auth design noted in memory).

---

## handle_new_user

```
handle_new_user() RETURNS trigger
```
`plpgsql`, `SECURITY DEFINER`, `search_path = public` — trigger function (fires on `auth.users` insert, presumably `AFTER INSERT`; trigger definition itself isn't in `pg_proc`, only the function body — confirm trigger attachment separately if needed)

Creates the corresponding `public.users` row after Supabase Auth creates the `auth.users` row:
- **Username derivation:** email+password signup passes an explicit `username` in `raw_user_meta_data`; Google OAuth doesn't, so for OAuth signups it falls back to `full_name` → `name` → the local part of the email, lowercased and stripped of non-alphanumerics (runs of non-alphanumeric chars collapsed to a single underscore, leading/trailing underscores trimmed).
- **Case-insensitive dedup loop:** checks `lower(username) = lower(candidate)` against existing users and appends an incrementing numeric suffix (`base2`, `base3`, ...) until it finds one that's free. This is where the "case-insensitive uniqueness" behavior actually lives — not in a DB index (there isn't one), but in this trigger's own dedup check before insert. Combined with `resolve_login_email`'s similarly manual case-insensitive comparison, the *practical* effect is close to case-insensitive uniqueness even without a `lower(username)` index — but nothing stops a direct `service_role` insert or a future code path from bypassing this trigger and creating a case-colliding username.
- Inserts `user_id` (= `auth.users.id`), `email`, the deduped `username`, and `avatar_url` (from OAuth metadata if present).

---

## set_updated_at

```
set_updated_at() RETURNS trigger
```
`plpgsql` — **not** `SECURITY DEFINER`, no explicit role restriction needed since it's a simple trigger.

Generic `updated_at = now()` trigger, presumably attached to `events` and/or `users` (both have an `updated_at` column). Trigger attachment isn't visible in this function list — only the function body. Worth confirming which tables actually have this trigger attached if it becomes relevant.

---

## get_event_management_data

```
get_event_management_data(p_event_id uuid)
RETURNS TABLE(
  event_id uuid, organizer_id uuid, venue_name text, starts_at timestamptz,
  area_name text, attending_count integer, shares_count integer,
  attendees jsonb
)
```
`SQL`, `STABLE`, `SECURITY DEFINER`, `search_path = public`

Backs the Event Management page (`/events/[id]/manage`) in a single round trip. Added to replace what had been fully mocked frontend data (hardcoded attendee list, hardcoded shares count) with real, organizer-scoped queries.

- **Organizer scoping:** filters on `e.organizer_id = (select auth.uid())` in the `WHERE` clause rather than raising an exception (unlike `get_my_event_view_stats`) — a non-organizer caller, or a nonexistent `p_event_id`, simply gets zero rows back. The frontend treats "no row" as not-found (404), so this doesn't distinguish "event doesn't exist" from "you're not the organizer" — consistent with the non-enumerating pattern used elsewhere (e.g. `resolve_login_email`).
- **`attending_count`:** `count(*)` over `event_interests` for the event, unfiltered by visibility — same semantics as `event_going_count`, just computed here as a correlated subquery instead of calling that function separately, to keep the whole page load to one request.
- **`shares_count`:** `count(*)` over `invite_links` for the event, across *every* creator, not just the organizer's own. This is a genuine, intentional RLS bypass: `invite_links_select_own` (see `rls-policies.md`) only lets a creator see their own invite links, so no direct client query could ever produce a total across other users' links. This function is the only path that exposes a cross-creator share count, and only to the event's own organizer.
  - Note this counts *links*, not *clicks* — `invite_links.click_count` is intentionally left untouched and unexposed here, consistent with `docs/FR/invite-links.md`'s rule that per-link click stats stay hidden from everyone, including the creator. Counting how many links exist is a different metric from surfacing click counts, so it doesn't run into that rule.
- **`attendees`:** a `jsonb` array (via `jsonb_agg`, most-recent-first) of every user with an `event_interests` row on the event — `user_id`, `username`, `avatar_url`, `instagram_url`, `facebook_url`, `tiktok_url` — built by joining to `users`. This deliberately bypasses `event_interests_select_own_or_connection` (see `rls-policies.md`): the organizer needs the complete guestlist regardless of any individual guest's connections-visibility choice, since that privacy setting is meant to hide someone from other guests/connections, not from the event's own host. (No FR doc currently states this exception explicitly — flagged as a product assumption worth confirming.)
- **No row-multiplication:** `attending_count`, `shares_count`, and `attendees` are each independent correlated subqueries, not one combined join. A single join across `events` × `event_interests` × `invite_links` would produce a cross product (one row per guest × per invite link), corrupting both counts unless de-duplicated after the fact. Keeping them separate means each aggregate computes once per call, regardless of guestlist or invite-link volume.
- **Supersedes** two short-lived standalone functions, `get_event_guestlist` and `get_event_share_count`, which existed only mid-development and were folded into this one function before ever being recorded in this doc — no separate deprecation entry needed.

---

## Status

This doc is complete and stable as of this session (every function in `public` captured with signature + behavior). Future functions should be **appended** here rather than re-derived from scratch.

## Important correction to prior planning

**`get_home_feed` is not "the next thing to build" — it already exists, fully implemented**, including cursor pagination, connection-aware ranking, and anonymous-viewer fallback. The remaining "Step 4 (Read path)" work is likely just **wiring it into a page/component**, not building the function itself. Worth confirming with a look at whether it's already called anywhere in the codebase before assuming it's unused.
