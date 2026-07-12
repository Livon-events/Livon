# FR: Going (RSVP) & Privacy

## Overview
Marking "Going" on an event records interest via `EventInterests`, same as before — but now every "going" action requires the user to choose whether that interest is visible to their connections or kept private. This directly affects what Peek can show: a private "going" is invisible everywhere connections-attendance is surfaced, treated identically to not going at all for that purpose.

---

## Schema impact (flag for next schema/RLS session)

- `EventInterests.visibility` — enum, values: `private`, `visible`. No default — every "going" action requires an explicit choice at time of creation (see popup below), so there's no meaningful default to fall back on.

---

## User actions

1. **Tap "Going" on an event (first time for that event)** — a short popup appears with two options: **Private** and **Visible**. User must pick one to complete marking themselves as going.
2. **Tap "Going" again after already marked going** — opens a small menu with two options: **Change privacy** and **Not going**.
   - **Change privacy** → re-opens the Private/Visible choice, letting them switch their existing selection.
   - **Not going** → removes their `EventInterests` row for that event entirely (un-marks going).

---

## Rules / constraints

### Privacy popup copy (first-time "Going")
Short, plain, no jargon:

- **Private** — subtext: "Your connections won't see you're going"
- **Visible** — subtext: "Your connections can see you're going"

### Effect of Private
- A `private` "going" is **invisible to the connections-attendance features entirely** — not shown as a number, not shown in a list, nothing. From Peek's perspective, a private connection who's going is treated exactly as if they were not going at all.
- This applies wherever "connections attending" is surfaced — currently just Peek, but the principle holds for any future feature showing which connections are attending.

### Effect of Visible
- Counted and listed normally per the existing Peek FR — included in `attending_connections_count`, appears in the Peek page's Connections attending list, ordered by most-recently-marked-going as already defined.

### What Private does NOT affect
- **Total Interests count** (the "{count}+" shown on the Peek page) — this is an aggregate, non-identifying number. Private and Visible "going" users both count toward it equally; privacy only affects connection-identifying displays, not the anonymous total.
- **Host bonus in Peek's button count** — unaffected by this feature entirely. Whether the viewer is connected to the host is independent of any attendee's privacy choice, and continues to apply exactly as defined in the Peek FR.

---

## Edge cases

- **User selects Private, later a connection views Peek:** that connection sees no trace of this person — not counted, not listed, no indication a private connection exists at all (no "X hidden" placeholder either, per "treat like there is no connection going").
- **User switches from Private to Visible via "Change privacy":** they immediately become visible/countable in Peek going forward. No historical record of the switch is surfaced to connections.
- **User switches from Visible to Private:** they immediately disappear from any connection's Peek view — same as being newly private from the start.
- **User taps "Not going" after being Private:** no visible change to anyone (they were already invisible), but their `EventInterests` row is removed, so they also stop counting toward the anonymous total Interests count.
- **Race between viewing a Peek page and a connection changing their privacy:** Peek page reflects current state at load time, not stale/cached data — consistent with how counts work elsewhere in this app.

---

## Inputs / outputs

**Mark going (first time) — client → server**
- Input: `event_id`, `visibility` ('private' | 'visible') — required, chosen via popup
- Output: new `EventInterests` row with that visibility

**Re-tap "Going" (already going) — client → server**
- Input: `event_id`, action ('change_privacy' | 'not_going')
- `change_privacy` → prompts for new `visibility`, updates the existing row
- `not_going` → deletes the `EventInterests` row

**Peek button / page queries (updated)**
- `attending_connections_count` and the Connections attending list now filter to `visibility = 'visible'` only
- Total Interests count remains unfiltered by visibility (counts all EventInterests rows regardless of privacy)
