# FR: Feed Ranking Algorithm

## Context

This document defines how events are **ordered** in the home feed. It does not
cover how an individual event card is displayed (see: Home Feed Event Card
FR) or how events are removed/expired (see: Event Lifecycle & Cancellation
FR).

This document also **retires** the earlier "User Interest Categories"
concept. There is no user-facing interest selection, no `UserInterests`
table, and no interest-match scoring in the MVP. A user's relevance signal is
derived entirely from their connections' activity, not from an explicit or
inferred interest profile.

## Ranking Factors

Events in the feed are ordered using the following signals, evaluated in
this order of importance:

### 1. Connections hosting

If the event's host is a connection of the viewing user, this weighs heavily
in the event's ranking. This is **not an override or hard pin to the top of
the feed** — it is one input into the overall ranking, but a strong one.

### 2. Connections going

The count of the viewing user's connections who have marked themselves as
"going" to the event, **excluding any "going" marks flagged private** via the
per-event privacy toggle on the going button.

- Only non-private "going" marks from the viewer's own connections count
  toward this signal.
- A connection's privacy setting is evaluated per event (per `EventInterests`
  row), not per user or per connection — consistent with the existing going
  button privacy toggle.
- This is independent of and additive to the "connections hosting" signal —
  a host who is also a connection satisfies factor 1; connections separately
  marked "going" satisfy factor 2. The two do not merge into a single count.

### 3. Fallback — Popularity

When factors 1 and 2 do not distinguish between two events (e.g., neither
event has a connection hosting or going), events are ordered by **total
"going" count**, counting all `EventInterests` rows regardless of the
private/public toggle. This is a global popularity signal, not scoped to the
viewer's connections.

### 4. Final tie-break — Chronological

If popularity is equal, events are ordered by event start time (soonest
first).

## Explicitly Out of Scope for MVP

- **No interest categories.** Users do not select interests. There is no
  `UserInterests` table and no category-based scoring.
- **No category/attendance history weighting.** Past attendance in a
  category does not factor into ranking.
- **No recency/lead-time visibility boost.** Events do not receive extra
  ranking weight during any "first N days" or "last N days" window relative
  to upload or event start. All active (non-cancelled) events remain visible
  and ranked by the factors above for their full lifetime — they are never
  hidden or removed except via the existing cancellation/8-hour-fallback
  rules defined in the Event Lifecycle FR.
- **No "Because you're into X" feed copy or horizontal sections.** This is
  explicitly deferred post-MVP, pending an actual interest-inference layer
  that does not exist yet.
- **Host popularity is not a factor.** A host's total connection count or
  general popularity has no bearing on ranking. Only whether the *viewer*
  is directly connected to the host matters (factor 1).

## Computation Notes

- Consistent with the "derived counts must be computed, not stored"
  principle already established for the codebase: connections-hosting,
  connections-going, and total-going counts are all computed at query time,
  never stored as stale columns.
- Numeric weights for factors 1–2 are intentionally left unspecified in this
  document. This is a behavior spec, not an implementation spec — Cursor's
  implementation should pick initial relative weights, with the expectation
  that these will be tuned after review.
