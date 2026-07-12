# FR: Header Location Toggle

## Overview
A persistent location selector in the app header lets users scope their event feed to either a specific Area or all Areas within a City. The same selection also determines which City/Area gets assigned to a new event when an organiser posts one — organisers do not choose location in the event form.

---

## Schema impact (flag for schema chat)

This feature requires two new nullable columns on `Users`, since the Users table is already finalized:

- `preferred_city_id` → FK to Cities, nullable
- `preferred_area_id` → FK to Areas, nullable (null = "All Areas" for that city)

These are the account-level persisted values. Logged-out/device-level persistence (see below) does not touch this table.

---

## User actions

1. **Open location toggle** — tapping the header control opens a City → Area picker (City list, then Areas within the selected City, plus an "All Areas" option per city).
2. **Select a specific Area** — feed and event listings scope to that Area only.
3. **Select City + "All Areas"** — feed and event listings scope to all Areas within that City.
4. **Return to the app later** — the previously selected location is restored automatically (no re-selection needed).
5. **Create an event** — the organiser does not see a location field in the event form. The event's `city_id`/`area_id` are silently set from the header's current selection at time of submission.

---

## Rules / constraints

### Persistence
- **Logged-in users:** selection is written to `Users.preferred_city_id` / `Users.preferred_area_id` on change. This is the source of truth across devices.
- **Logged-out users:** selection is stored in browser storage (localStorage) only. Not synced anywhere.
- **On login:** if the account has a stored preference, it overrides whatever was in local device storage. If the account has no stored preference yet (first login), the current device-storage value (if any) is written up to the account; otherwise default applies.

### Default (no preference set anywhere)
- Defaults to **Maseru → Maseru Central** (the only seeded area at launch).
- This default is applied client-side when there is no account preference and no device storage value — not written to the DB until the user actively changes it or an implicit first-write occurs per above.

### Feed / listing scoping
- Area selected → only events with matching `area_id` are shown.
- City + "All Areas" selected → only events with matching `city_id` are shown, regardless of `area_id`.
- This scoping applies wherever events are listed (main feed, search/browse), not just the primary feed.

### Event creation — location assignment
- The event form has **no city/area input**.
- On submit, the backend sets the event's `city_id` (and `area_id`, see below) from the organiser's **current header selection at time of submission** — not at time of form load, in case the header changes mid-session.
- **If the header is scoped to "All Areas" at submission time: block event creation.** The organiser must switch to a specific Area in the header before they can post. Show a clear inline message (e.g. "Select a specific area in the location toggle before posting an event") rather than a generic form error.

---

## Edge cases

- **Organiser wants to post for a different area than their current header selection:** not supported directly — they must switch the header location first, then create the event. This is a deliberate constraint, not a bug; worth confirming this is acceptable UX before build.
- **Header changed in another tab while form is open:** submission uses whatever the header state is at submit time (read fresh, not cached from form load), so a stale open tab could submit to an unexpected area. Acceptable for MVP; no cross-tab sync required.
- **First-time login on a new device where account already has a preference:** account preference wins immediately, overwriting whatever default/local value was showing pre-login.
- **User has account preference for a City/Area that gets removed or renamed later (admin-managed):** out of scope for MVP since Cities/Areas are admin-only and not expected to be deleted post-seed; if this becomes possible later, preference should fall back to default.
- **Multiple cities in future:** toggle UI should support a City list even though only Maseru exists at launch — don't hardcode to a single city in implementation.

---

## Inputs / outputs

**Location toggle change (client → server, logged-in only)**
- Input: `city_id` (required), `area_id` (nullable — null means "All Areas")
- Action: upsert onto `Users.preferred_city_id` / `Users.preferred_area_id`
- Output: confirmation; client also updates local device storage to match

**Event creation (client → server)**
- Input: standard event fields — **no city_id/area_id from the client**
- Server reads organiser's current header selection (from session/request context, sourced from account preference or device storage as applicable)
- Validation: reject if resolved `area_id` is null (i.e. header is at "All Areas") — return an error the client maps to the inline message above
- Output: created event with `city_id`/`area_id` set server-side from resolved header state

**Feed / listing query**
- Input: current resolved location (Area id, or City id with no Area)
- Output: events filtered accordingly
