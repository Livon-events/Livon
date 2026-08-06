# FR: Header Location Toggle

## Overview
A persistent location selector in the app header lets users scope their event feed to either a specific Area or all Areas within a City. This selector is **feed-scoping only**: it has no effect on event creation. Organisers choose the Area their event is posted to directly on the create-event form — see docs/FR/event-creation-form.md.

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
5. **Create an event** — unaffected by this toggle. The create-event form has its own Area field (see docs/FR/event-creation-form.md); the header's current selection is used only to pre-fill that field with a sensible default.

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
- Out of scope for this toggle. The create-event form owns its own Area field and validation — see docs/FR/event-creation-form.md. The header's resolved selection (account preference, or device storage when logged out) is read once, server-side, to pre-fill that field's default when the form loads; it is not read again at submission time, and the header can be changed freely afterward without affecting an in-progress or already-submitted form.

---

## Edge cases

- **Header changed in another tab while a create-event form is open:** no effect — the form's Area field holds its own state once loaded, independent of the header from that point on.
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
- Out of scope for this toggle — see docs/FR/event-creation-form.md for the Area field's inputs/outputs and validation.

**Feed / listing query**
- Input: current resolved location (Area id, or City id with no Area)
- Output: events filtered accordingly
