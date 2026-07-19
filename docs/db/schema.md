# Livon — Database Schema Reference

`docs/db/schema.md`

Auto-derived from `information_schema.columns`, `information_schema.table_constraints`, and `pg_indexes` on the `public` schema. Covers **tables, columns, PK/FK/unique constraints, and indexes**. This doc is now considered stable — future schema changes should be appended here, not re-derived from scratch.

> **Note:** `event_view_stats` is a **view** (aggregates `event_views` + `anonymous_event_views`), not a base table.

---

## users

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_id` | uuid | NO | — |
| `email` | text | NO | — |
| `username` | text | YES | — |
| `bio` | text | YES | — |
| `avatar_url` | text | YES | — |
| `tiktok_url` | text | YES | — |
| `instagram_url` | text | YES | — |
| `facebook_url` | text | YES | — |
| `youtube_url` | text | YES | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |
| `preferred_city_id` | uuid | YES | — |
| `preferred_area_id` | uuid | YES | — |

**Constraints:**
- PK: `user_id`
- FK: `user_id` → `auth.users.id` (cross-schema; confirmed by `users_user_id_fkey` resolving to no `public` table)
- FK: `preferred_city_id` → `cities.city_id`
- FK: `preferred_area_id` → `areas.area_id`
- UNIQUE: `email` (`users_email_key`)
- UNIQUE: `username` (`users_username_key`)

✅ **Resolved:** `pg_indexes` confirms `users_username_key` is a plain `btree (username)` index — **case-sensitive**, not `lower(username)`. There is no functional/case-insensitive index on `username` in the live schema. This contradicts the earlier assumption of case-insensitive uniqueness; treat username uniqueness as case-sensitive unless application code normalizes to lowercase before insert (worth checking `signUpWithEmail` — memory does note usernames are lowercased on input in the signup form, which would make this a non-issue in practice, but the DB itself does not enforce it).

---

## cities

| Column | Type | Nullable | Default |
|---|---|---|---|
| `city_id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO | — |

**Constraints:** PK `city_id` · UNIQUE `name` (`cities_name_key`)

## areas

| Column | Type | Nullable | Default |
|---|---|---|---|
| `area_id` | uuid | NO | `gen_random_uuid()` |
| `city_id` | uuid | NO | — |
| `name` | text | NO | — |

**Constraints:**
- PK: `area_id`
- FK: `city_id` → `cities.city_id`
- UNIQUE (composite): `(city_id, name)` (`areas_city_id_name_key`) — area names unique per city, not globally

## categories

| Column | Type | Nullable | Default |
|---|---|---|---|
| `category_id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO | — |
| `default_cover_image_url` | text | YES | — |

**Constraints:** PK `category_id` · UNIQUE `name` (`categories_name_key`)

## tags

| Column | Type | Nullable | Default |
|---|---|---|---|
| `tag_id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO | — |

**Constraints:** PK `tag_id` · UNIQUE `name` (`tags_name_key`)

Locked for beta — no client access at all (see Key Learnings).

---

## events

| Column | Type | Nullable | Default |
|---|---|---|---|
| `event_id` | uuid | NO | `gen_random_uuid()` |
| `organizer_id` | uuid | NO | — |
| `category_id` | uuid | NO | — |
| `city_id` | uuid | NO | — |
| `area_id` | uuid | NO | — |
| `title` | text | NO | — |
| `description` | text | YES | — |
| `venue_name` | text | NO | — |
| `starts_at` | timestamptz | NO | — |
| `ends_at` | timestamptz | YES | — |
| `cover_image_url` | text | NO | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |
| `status` | text | NO | `'active'` |
| `cancelled_at` | timestamptz | YES | — |
| `price` | numeric | NO | `0` |

**Constraints:**
- PK: `event_id`
- FK: `organizer_id` → `users.user_id`
- FK: `category_id` → `categories.category_id`
- FK: `city_id` → `cities.city_id`
- FK: `area_id` → `areas.area_id`

**Indexes:** `events_organizer_id_idx`, `events_category_id_idx`, `events_city_id_idx`, `events_area_id_idx` — all plain btree, one per FK column. Added to back `get_home_feed`'s filtering/joins (previously the table had only its PK index).

Notes: `status` is a two-value enum (`active` / `cancelled`) — rows are never deleted (archival over deletion). "Past" is a derived state computed from `starts_at`/`ends_at` at read time, not stored. No `CHECK` constraint on `status` values showed up here — likely enforced at application layer only; worth double-checking.

## event_tags

| Column | Type | Nullable | Default |
|---|---|---|---|
| `event_id` | uuid | NO | — |
| `tag_id` | uuid | NO | — |

**Constraints:**
- PK (composite): `(event_id, tag_id)` (`event_tags_pkey`)
- FK: `event_id` → `events.event_id`
- FK: `tag_id` → `tags.tag_id`

Junction table for events ↔ tags. Locked for beta, same as `tags`.

## event_interests

| Column | Type | Nullable | Default |
|---|---|---|---|
| `event_interest_id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | — |
| `event_id` | uuid | NO | — |
| `created_at` | timestamptz | NO | `now()` |
| `visibility` | text | NO | `'visible'` |

**Constraints:**
- PK: `event_interest_id`
- FK: `event_id` → `events.event_id`
- FK: `user_id` → `users.user_id`
- UNIQUE (composite): `(user_id, event_id)` (`event_interests_user_id_event_id_key`) — one interest row per user per event

**Indexes:** `event_interests_event_id_idx`: `btree (event_id)` — added to back `get_home_feed`'s per-event correlated subqueries and any "who's going" lookup.

Notes: "Going" counts are derived via `COUNT()` at read time, not stored. `visibility` controls whether a user's interest is shown to others.

## event_views

| Column | Type | Nullable | Default |
|---|---|---|---|
| `event_view_id` | uuid | NO | `gen_random_uuid()` |
| `event_id` | uuid | NO | — |
| `user_id` | uuid | NO | — |
| `viewed_at` | timestamptz | NO | `now()` |

**Constraints:**
- PK: `event_view_id`
- FK: `event_id` → `events.event_id`
- FK: `user_id` → `users.user_id`

**Indexes:** `event_views_event_id_idx`, `event_views_user_id_idx` — both plain btree.

Authenticated-viewer event views. No unique constraint — append-only, repeat views allowed (matches derived "unique viewers" via `COUNT(DISTINCT ...)` in `event_view_stats`).

## anonymous_event_views

| Column | Type | Nullable | Default |
|---|---|---|---|
| `anon_view_id` | uuid | NO | `gen_random_uuid()` |
| `event_id` | uuid | NO | — |
| `anon_session_id` | uuid | NO | — |
| `viewed_at` | timestamptz | NO | `now()` |

**Constraints:**
- PK: `anon_view_id`
- FK: `event_id` → `events.event_id`

**Indexes:** `anonymous_event_views_event_id_idx`: `btree (event_id)`.

Anonymous-viewer event views, keyed by client-generated session id rather than `user_id`. No FK on `anon_session_id` (not a real user).

## event_view_stats *(view)*

| Column | Type | Nullable |
|---|---|---|
| `event_id` | uuid | YES |
| `total_authenticated_views` | bigint | YES |
| `unique_authenticated_viewers` | bigint | YES |
| `total_anonymous_views` | bigint | YES |
| `unique_anonymous_viewers` | bigint | YES |
| `total_views` | bigint | YES |
| `total_unique_viewers` | bigint | YES |

Aggregates `event_views` + `anonymous_event_views` per event. Consumed by `get_my_event_view_stats` (organizer-only, `SECURITY DEFINER`).

---

## connections

| Column | Type | Nullable | Default |
|---|---|---|---|
| `connection_id` | uuid | NO | `gen_random_uuid()` |
| `requester_id` | uuid | NO | — |
| `receiver_id` | uuid | NO | — |
| `status` | text | NO | `'pending'` |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:**
- PK: `connection_id`
- FK: `requester_id` → `users.user_id`
- FK: `receiver_id` → `users.user_id`

**Indexes:**
- `connections_requester_id_idx`: `btree (requester_id)`
- `connections_receiver_id_idx`: `btree (receiver_id)`
- `unique_pair_either_direction`: `UNIQUE btree (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id))` — prevents a duplicate connection row regardless of who requested vs. received. Not expressible as a table constraint since Postgres disallows expression functions there.

## user_interests

| Column | Type | Nullable | Default |
|---|---|---|---|
| `user_interest_id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | NO | — |
| `category_id` | uuid | NO | — |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:**
- PK: `user_interest_id`
- FK: `user_id` → `users.user_id`
- FK: `category_id` → `categories.category_id`
- UNIQUE (composite): `(user_id, category_id)` (`user_interests_user_id_category_id_key`)

**Fully locked (deny-all RLS)** — internal ranking signal only, never client-readable.

---

## invite_links

| Column | Type | Nullable | Default |
|---|---|---|---|
| `invite_link_id` | uuid | NO | `gen_random_uuid()` |
| `event_id` | uuid | NO | — |
| `creator_id` | uuid | NO | — |
| `code` | text | NO | — |
| `click_count` | integer | NO | `0` |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:**
- PK: `invite_link_id`
- FK: `event_id` → `events.event_id`
- FK: `creator_id` → `users.user_id`
- UNIQUE: `code` (`invite_links_code_key`)

**Indexes:** `invite_links_creator_id_idx`, `invite_links_event_id_idx` — both plain btree.

Notes: `click_count` is a **documented exception** to "derive counts, don't store" — incremented from append-only `invite_link_clicks` rows, can't go stale.

## invite_link_clicks

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `invite_link_id` | uuid | NO | — |
| `user_id` | uuid | YES | — |
| `anon_session_id` | uuid | YES | — |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:**
- PK: `id`
- FK: `invite_link_id` → `invite_links.invite_link_id`
- FK: `user_id` → `users.user_id`

**Indexes:**
- `invite_link_clicks_user_id_idx`: `btree (user_id)`
- `invite_link_clicks_unique_user`: `UNIQUE btree (invite_link_id, user_id) WHERE user_id IS NOT NULL`
- `invite_link_clicks_unique_anon`: `UNIQUE btree (invite_link_id, anon_session_id) WHERE anon_session_id IS NOT NULL`

These two partial indexes are what makes `redeem_invite`'s `ON CONFLICT DO NOTHING` dedup actually work — a plain table constraint can't express "unique when not null" per column pair. No FK on `anon_session_id` (not a real user).

---

## activity_log

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `user_id` | uuid | YES | — |
| `event_type` | text | NO | — |
| `metadata` | jsonb | YES | — |
| `created_at` | timestamptz | NO | `now()` |

**Constraints:**
- PK: `id`
- FK: `user_id` → `users.user_id`

**Indexes:** `activity_log_created_at_idx`, `activity_log_event_type_idx`, `activity_log_user_id_idx` — all plain btree, supporting filtered/sorted reads on this append-only log.

Generic append-only activity/audit log, keyed by free-text `event_type` + `jsonb` payload.

---

## Performance — resolved

Previously flagged: `events` had no secondary indexes beyond its PK, and `connections`/`event_interests` had no indexes usable for plain FK-column lookups — both problems for `get_home_feed`'s per-row correlated subqueries and the RLS "own rows" policies.

**Confirmed fixed** (verified via `pg_indexes` this session): FK-column btree indexes now exist on `connections.requester_id`/`receiver_id`, `event_interests.event_id`, `events.organizer_id`/`category_id`/`city_id`/`area_id`, `invite_links.creator_id`/`event_id`, `invite_link_clicks.user_id`, `event_views.event_id`/`user_id`, and `anonymous_event_views.event_id`. See each table's own **Indexes** entry above for specifics.

`get_home_feed` was independently confirmed fast (mean ~7ms, 100% cache hit) via a Performance Advisor query-stats pull, prior to this indexing work — so no regression to worry about, and the new indexes should keep it fast as real data volume grows.

Remaining, still deliberately deferred: no index on `users.preferred_city_id`/`preferred_area_id` (no location-filtering feature built yet — add when that's built, not before) and no index on the deny-all tables (`event_tags.tag_id`, `user_interests.category_id` — zero client access, not worth it until an internal function actually queries them at volume).

## Status

This doc is complete and stable as of this session (tables, columns, constraints, indexes all captured). Future schema changes should be **appended** to the relevant table section rather than re-running the full derivation from scratch.
