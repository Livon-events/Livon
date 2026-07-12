# FR: Peek

## Overview
"Peek" is the quick social-proof glance on the event card — it shows whether people the viewer knows are connected to this event, without leaving the feed. Tapping it opens a dedicated Peek page with the fuller picture: total interest in the event, and (if any) the specific connections attending.

---

## User actions

1. **View the Peek button on an event card** — shows a count representing "people you know" tied to this event.
2. **Tap the Peek button** — navigates to the Peek page for that event.
3. **View the Peek page** — shows total Interests (going count) for the event, and — only if the viewer has connections actually attending — a list of those connections with avatar + username.
4. **Tap "View Event" on the Peek page** — navigates to the full event details page. Always present, regardless of any other content on the page.

---

## Rules / constraints

### Peek button count (on the card)
- `attending_connections_count` = number of the viewer's connections who marked "going" on this event **with `visibility = 'visible'`** (see Going/RSVP FR) — connections who marked "going" as `private` are excluded entirely, as if they weren't going.
- `host_bonus` = 1 if the viewer is connected to the event's host, else 0.
- Button count = `attending_connections_count + host_bonus`.
- **If button count is 0:** don't show a number on the button at all — just the Peek icon/label, no badge.
- **If button count is 1 purely from `host_bonus`** (i.e. viewer is connected to host, but no other connections are attending): still show "1". Being connected to the host is enough to justify a non-zero badge.

### Peek page — Interests
- Always shown, regardless of connection counts.
- Displayed as **"{count}+"** — the "+" is always appended, not a threshold-based cap. This is intentional: it signals there may be interest beyond what the platform can account for (people interested off-platform), so the number never reads as a hard ceiling.
- **Exception at zero:** if the Interests count is 0, show **"Be the first to go"** instead of "0+" — a genuine zero shouldn't be dressed up as an open-ended number.
- This count reflects total "going" (EventInterests) for the event — computed the same way as everywhere else (derived via `COUNT()`, not cached).

### Peek page — Connections attending
- Shown **only if `attending_connections_count` ≥ 1**. If it's 0, this entire section is omitted — no count, no list, no empty state. The page shows Interests only.
- **Note:** `host_bonus` does **not** apply here. The host isn't necessarily "going" to their own event (they're hosting, not attending as a guest), so they are never counted or listed in this section — even if the button showed "1" purely from the host connection.
- **Privacy filter (see Going/RSVP FR):** `attending_connections_count` and this list only include connections whose `EventInterests.visibility = 'visible'`. A connection who marked "going" as `private` is excluded entirely here and from the button count — treated identically to not going.
- When shown: displays the **exact** count (no "+" — unlike Interests, this number is fully known and platform-internal, so there's no reason to soften it).
- **Full list, no cap or pagination** — every connection attending is shown, ordered by **most recently marked "going" first**. The page scrolls naturally for longer lists.

### "View Event" button
- Always present on the Peek page, regardless of Interests count or whether the Connections section is shown.
- Navigates to the event's full details page.

---

## Edge cases

- **Interests count is 0 (no one going yet):** shows "Be the first to go" per the rule above.
- **Viewer is not connected to the host and has zero attending connections:** button shows no number; Peek page shows Interests only, no Connections section.
- **Host is also, technically, a connection who happens to also mark "going" on their own event:** if that's even possible at the DB level, they'd still be excluded from the Connections section per the host exclusion rule above — this section is about attendees who aren't the organiser.
- **Connections attending count changes between button render and page load (someone un-marks "going"):** page reflects live/current data at load time, not the count shown on the button when tapped — no caching of the button's number into the page.

---

## Inputs / outputs

**Peek button (card render)**
- Input: viewer's connections, this event's EventInterests, event's host_id
- Output: `attending_connections_count + host_bonus`, or no badge if 0

**Peek page (on tap)**
- Input: `event_id`, viewer's connections
- Output:
  - Interests: total going count for event, displayed as "{count}+"
  - Connections attending (conditional): exact count + ordered list of {avatar, username} for viewer's connections marked "going", most-recent-first
  - "View Event" button → event details page route

---

## Open items to confirm later
None — all prior open questions for this FR are resolved.
