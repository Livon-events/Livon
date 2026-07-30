# Livon — RLS Policies Reference

`docs/db/rls-policies.md`

Derived from `pg_policies` on the `public` schema. Covers every policy definition (roles, command, `USING`/`WITH CHECK`). **Not yet confirmed:** whether RLS is actually *enabled* on each table — a table can have zero policies and still be wide open (RLS off) or fully locked (RLS on, no policies = deny-all). Follow-up query for that is queued next.

Convention note: all `auth.uid()` calls below use `(select auth.uid())` rather than bare `auth.uid()` — this is intentional, per the Supabase Performance Advisor fix (avoids per-row re-evaluation).

---

## Fully locked tables (deny-all)

These all carry a single policy named `no_client_access`, `cmd = ALL`, `qual = false`, for both `anon` and `authenticated` — meaning **zero client access under any circumstance**, reads or writes. Only reachable via `SECURITY DEFINER` functions or the `service_role` key.

- `activity_log`
- `event_tags`
- `invite_link_clicks`
- `tags`
- `user_interests`

---

## Public read-only reference tables

`SELECT` open to `anon` + `authenticated` with `qual = true`; **no INSERT/UPDATE/DELETE policy at all**, so writes are only possible via `service_role` (admin/seed scripts).

- `areas` — "Areas are viewable by everyone"
- `categories` — "Categories are viewable by everyone"
- `cities` — "Cities are viewable by everyone"

---

## events

| Policy | Cmd | Roles | Using / With Check |
|---|---|---|---|
| Events are viewable by everyone | SELECT | anon, authenticated | `true` |
| Authenticated users can create events | INSERT | authenticated | with check: `organizer_id = (select auth.uid())` |
| Organizers can update own events | UPDATE | authenticated | using + check: `organizer_id = (select auth.uid())` |
| events_delete_own_if_no_interest | DELETE | authenticated | using: `organizer_id = (select auth.uid()) AND NOT EXISTS (SELECT 1 FROM event_interests WHERE event_id = events.event_id)` |

Notes: Delete is only allowed if **no one has expressed interest** in the event — this is the enforcement mechanism behind "archival over deletion" in practice: once an event has interest, an organizer can only cancel it (`status = 'cancelled'`), not delete the row.

---

## event_interests

| Policy | Cmd | Roles | Using / With Check |
|---|---|---|---|
| Users can mark own interest | INSERT | authenticated | with check: `user_id = (select auth.uid())` |
| event_interests_select_own_or_connection | SELECT | authenticated | using: own rows, OR (`visibility = 'visible'` AND an accepted `connections` row exists between viewer and the interest's `user_id`, either direction) |
| event_interests_update_own | UPDATE | authenticated | using + check: `user_id = (select auth.uid())` |
| Users can remove own interest | DELETE | authenticated | using: `user_id = (select auth.uid())` |

Notes: The SELECT policy is the most complex one in the schema — it's what makes "going" visible to connections but not strangers, respecting the per-row `visibility` flag. Any feature touching event_interests reads (e.g. "who's going" on an event card) needs to account for this: a viewer only sees interests that are either their own, or `visible` + from a mutually-accepted connection.

Exception: `get_event_management_data` (see `functions.md`) deliberately bypasses this policy for an event's own organizer, returning the full guestlist regardless of any guest's `visibility` choice or connection status. This is intentional — the privacy toggle is meant to hide a guest from other guests/connections, not from the event's own host — but it's worth flagging since it's not yet stated in any FR doc.

---

## connections

| Policy | Cmd | Roles | Using / With Check |
|---|---|---|---|
| Users can send connection requests | INSERT | authenticated | with check: `requester_id = (select auth.uid())` |
| Users can view own connections | SELECT | authenticated | using: `requester_id = (select auth.uid()) OR receiver_id = (select auth.uid())` |
| connections_receiver_respond_to_pending | UPDATE | authenticated | using: `receiver_id = (select auth.uid()) AND status = 'pending'`; check: `receiver_id = (select auth.uid())` |
| Either party can remove connection | DELETE | authenticated | using: `requester_id = (select auth.uid()) OR receiver_id = (select auth.uid())` |

Notes: Only the **receiver** can update a connection (i.e. accept/decline) — the requester cannot flip their own pending request to accepted. Once accepted, the update policy's `status = 'pending'` guard means neither party can UPDATE it further via this policy (e.g. no "un-accept" through this path) — would need a new policy or a function if that's ever needed.

---

## event_views / anonymous_event_views

| Table | Policy | Cmd | Roles | With Check |
|---|---|---|---|---|
| event_views | Users can log own views | INSERT | authenticated | `user_id = (select auth.uid())` |
| anonymous_event_views | Anyone can log anonymous views | INSERT | anon, authenticated | `true` |

Notes: **Neither table has a SELECT policy** — clients can write view-log rows but can never read them back directly. The only read path is the `event_view_stats` view via `get_my_event_view_stats` (organizer-only, `SECURITY DEFINER`). This is intentional: raw view logs aren't for client consumption, only aggregated stats are.

---

## invite_links

| Policy | Cmd | Roles | Using / With Check |
|---|---|---|---|
| Users can create invite links | INSERT | authenticated | with check: `creator_id = (select auth.uid())` |
| invite_links_select_own | SELECT | authenticated | using: `creator_id = (select auth.uid())` |
| Creators can delete own invite links | DELETE | authenticated | using: `creator_id = (select auth.uid())` |

Notes: **No UPDATE policy** — invite links are immutable once created (can only be deleted, not edited). Also no anon SELECT — a creator can only see their *own* invite links, meaning the actual invite redemption flow (someone clicking a shared link) must go through a `SECURITY DEFINER` function like `redeem_invite` rather than a direct table read, since the clicker isn't the creator.

Second exception: `get_event_management_data` (see `functions.md`) also bypasses `invite_links_select_own` — it returns a total invite-link count for an event across *every* creator, not just the caller's own links, scoped to the event's organizer only. This is a distinct metric from `click_count` (still never exposed anywhere, per `docs/FR/invite-links.md`); it only surfaces how many links exist, not their click stats.

---

## users

| Policy | Cmd | Roles | Using / With Check |
|---|---|---|---|
| Users are viewable by authenticated users | SELECT | authenticated | `true` |
| Users can update own profile | UPDATE | authenticated | using + check: `(select auth.uid()) = user_id` |

Notes: **No INSERT policy** — new rows are created via the `auth` trigger/signup flow (`service_role` or a function), not directly by clients. **No DELETE policy** — account deletion isn't currently exposed at the RLS layer; consistent with account deletion not yet being a built feature. **No `anon` SELECT** — logged-out visitors cannot read any user profile data at all (relevant for any public organizer-profile or event-detail page that shows organizer info to anonymous visitors — that data would need to come through a `SECURITY DEFINER` function, not a direct client read).

---

## event_view_stats (view)

No policies found — as a view, it doesn't carry its own RLS policies. Access is entirely gated by the `SECURITY DEFINER` function that queries it (`get_my_event_view_stats`), which internally checks `organizer_id = auth.uid()`. Confirm whether the view itself needs `security_invoker` or relies purely on the wrapping function — worth checking when `functions.md` is built.

---

## RLS enabled/disabled status

Confirmed via `pg_class.relrowsecurity`: **all 15 base tables have RLS enabled**, no gaps.

| Table | RLS Enabled | RLS Forced |
|---|---|---|
| activity_log | ✅ | false |
| anonymous_event_views | ✅ | false |
| areas | ✅ | false |
| categories | ✅ | false |
| cities | ✅ | false |
| connections | ✅ | false |
| event_interests | ✅ | false |
| event_tags | ✅ | false |
| event_views | ✅ | false |
| events | ✅ | false |
| invite_link_clicks | ✅ | false |
| invite_links | ✅ | false |
| tags | ✅ | false |
| user_interests | ✅ | false |
| users | ✅ | false |

`rls_forced = false` everywhere is expected — that flag only matters for table owners/`service_role` bypassing RLS, which isn't in play here.

## Status

This doc is complete and stable as of this session. Future policy changes should be appended to the relevant table section rather than re-derived from scratch.

## Still on the horizon

Once `get_home_feed` is reviewed (mentioned as possibly already built), this doc should note whether it reads `events`/`event_interests` directly (relying on the SELECT policies above) or bypasses RLS as `SECURITY DEFINER` with its own internal filtering — that materially affects how the anonymous-viewer fallback path should behave.
