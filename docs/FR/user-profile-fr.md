# FR: User Profile

## Overview

The User Profile is the canonical page for a single user, viewable in two contexts:

1. **Own profile** — the signed-in user viewing themselves. Management-oriented: shows Links / Connections / Events with edit controls.
2. **Other user's profile** — viewing someone else. Discovery-oriented: shows a featured hosted-event card, a Connect button, and read-only Links / Connections / Events.

Both contexts render from the same underlying data; UI differences are permission-gated by `viewer_id === profile_user_id`.

---

## 1. Profile Header

Common to both contexts:

- Avatar (400×400 WebP, per existing image processing spec)
- Username
- Connections count (`COUNT()` from Connections table at read time — no stored counter, per the derived-counts principle)

Layout order, top to bottom, on **another user's profile**: header → bio → Connect/Links row → Featured Hosted-Events (§6) → Connections/Events tabs.
Layout order on **own profile**: header → bio → Edit button → Links section → Connections/Events tabs. (No Featured Hosted-Events section on own profile.)

### Connect button
- Shown **only** when `viewer_id !== profile_user_id` **and** no existing connection/pending request exists between the two users (exact button states — e.g. "Requested" — are governed by the Connections FR, not duplicated here).
- **Never shown on own profile.**

---

## 2. Bio

- Free-text field, nullable.
- **Character limit: 150 characters.**
- If unset, the profile displays a placeholder state (e.g. "This is the placeholder for the bio") instead of an empty section.
- Editable only by the profile owner, via the Edit button (see §5).
- No privacy toggle on bio — it is always public to anyone who can view the profile.

---

## 3. Links (Social Platforms)

### Scope
- Exactly **three fixed platform slots**: TikTok, Instagram, Facebook. No user-defined/custom links, no additional platforms in MVP.
- Each slot holds a single URL and is independently optional (a user may set 0–3).

### Schema
- `UserLinks` (or three nullable columns on `Users`: `tiktok_url`, `instagram_url`, `facebook_url`) — **open decision, default to three nullable columns on `Users`** since the set is fixed and small; no need for a child table.

### Display
- **Own profile:** "Links" header with a chevron that expands/collapses the section inline. This chevron is purely a UI expand/collapse — it is not an edit affordance.
- **Other user's profile:** tapping "Links" opens a panel/sheet listing only the platforms that are actually set (with platform icon), each tappable to open the external URL in a new tab. Unset platforms are omitted entirely — not shown as empty/disabled slots.
- No stats, no privacy toggle — links are all-or-nothing public once set.

---

## 4. Edit (Own Profile Only)

- Single "Edit" button (top-right, next to the Links header) opens one edit surface covering:
  - Bio
  - Username
  - Links (TikTok / Instagram / Facebook URLs)
- **Username rules:**
  - 3–20 characters
  - Alphanumeric + underscore only
  - Unique, case-insensitive uniqueness check
  - Username is cosmetic/display-only; any internal references (invite links, foreign keys) use the stable `user_id`, not username, so a rename never breaks existing links or data.
- Validation errors (bio too long, username taken/invalid chars, malformed URL) surface inline; no partial save — the whole edit form submits together.

---

## 5. Events Tab

Two sub-lists under "Events" (both contexts):

### 5a. My Events
- Events hosted by the profile's user.
- **Active events only.** Cancelled events are treated like deleted posts — fully excluded from this list, not shown with a "cancelled" badge or any other indicator. (Consistent with the archival-but-cancellable principle: the row persists in the DB, but it never surfaces in this UI once cancelled.)
- Sorted chronologically, soonest-first.
- **Own profile:** tapping an event in this list shows **View** and **Edit** buttons, allowing the owner to jump into the Event Creation/Edit flow for that event.
- **Other user's profile:** tapping an event navigates straight to the Event Details page (view-only) — no View/Edit buttons.

### 5b. Going
- Events the profile's user has RSVP'd "going" to.
- Respects the existing per-event `EventInterests.visibility` toggle: when viewed by anyone other than the owner, only events where `visibility = visible` are included. Own-profile view always shows all of the owner's own "going" events regardless of the toggle (a user can always see their own full going-list).
- Sorted chronologically, soonest-first.
- Tapping an event always navigates to Event Details (view-only) — this list never has Edit, since RSVP'ing doesn't grant hosting permissions.

### Connections tab
- Sub-structure and behavior (mutual model, remove, request states) are governed by the existing Connections FR — not duplicated here. This FR only fixes that "Connections" and "Events" are the two top-level tabs, with Events further split into My Events / Going as above.

---

## 6. Featured Hosted-Events Section (Other User's Profile Only)

- Appears below the bio and the Connect/Links row, and above the Connections/Events tabs, on another user's profile.
- Shows **all active upcoming events** the profile's user is currently hosting (today or later) — not limited to a single event. Sorted chronologically, soonest-first.
- **Hidden entirely** if the user has no current/upcoming active hosted events.
- This is an inline preview drawing from the same data as "My Events" (§5a), filtered to active + upcoming — not a separate data source.
- Tapping any event card navigates to Event Details (view-only).
- Does not appear on the own-profile view (the owner already sees their own events via the Events tab).

---

## Open Items

None outstanding for this FR — all items resolved in conversation. Flagged assumptions (bio limit, username rules, list ordering, single edit surface) are marked above as defaults; revisit if they conflict with product intent once implemented.

## Schema Additions Implied by This FR

- `Users.bio` (varchar(150), nullable)
- `Users.tiktok_url`, `Users.instagram_url`, `Users.facebook_url` (text, nullable) — pending final decision on column-vs-table, defaulted to columns above
- No new tables required if Links use the column approach
