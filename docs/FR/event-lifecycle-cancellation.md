# FR: Event Lifecycle & Cancellation

## Overview

Defines what happens to an event over time: how it moves from upcoming → live → ended, and how an organiser can cancel an event before it starts or end one early once it's live. Complements the Home Feed Event Card FR, which already derives "Today/Live" display from timestamps — this doc adds the one piece timestamps can't express: manual cancellation.

---

## Schema impact (flag for Events DDL — not yet built, so bake in from the start)

- `Events.status` — enum, values: `active` (default), `cancelled`. No other stored values.
- `Events.cancelled_at` — nullable TIMESTAMPTZ, set when an organiser cancels.

**Deliberately not stored:** upcoming / live / ended. These remain derived at read time from `starts_at`/`ends_at` (or the 8-hour fallback), consistent with the existing "derived data must not be cached" principle. Storing and cron-syncing those would reintroduce the staleness problem that principle exists to avoid.

---

## User actions

1. **Organiser cancels an upcoming event** (only available before `starts_at`) — event is marked `cancelled`, immediately removed from the feed, and users who had marked "going" see a cancelled indication.
2. **Organiser ends a live event early** (available while event is in its "Live" window) — organiser sets `ends_at` to now (or triggers an equivalent "end now" action); event proceeds to "ended" naturally once that time passes. No `status` change, no cancelled badge — the event did happen.
3. **System-derived transitions** — upcoming → live → ended happen automatically based on timestamps; no user action, no stored state change.

---

## Rules / constraints

### Cancel vs. End Now — mutual exclusivity

- **Cancel** and **End Now** are never both available or interactive at the same time. Exactly one applies, based on the event's current derived state:
  - **Upcoming** → only **Cancel** is shown/enabled.
  - **Live** → only **End Now** is shown/enabled.
  - **Ended or already cancelled** → neither is shown/enabled.
- This is enforced both in the UI (only the relevant control renders) and server-side (each action's validation rejects the request if the event isn't in the matching state — see Inputs/Outputs), so a stale client can't trigger the wrong one.

### Cancellation

- Only permitted while event is **upcoming** (current time < `starts_at`). Cannot cancel a live or already-ended event — that's "end early" instead (see below).
- On cancel: `status = 'cancelled'`, `cancelled_at = now()`.
- Cancelled events are **immediately excluded from the feed** (same query-time filtering approach as the card FR's expiry logic).
- Cancelled events remain visible on their own event page, showing a clear cancelled state, rather than 404ing — organisers/attendees may still want to see event details for reference.
- **Cancellation indication for "going" users:** shown only when cancellation happens before the event's `starts_at` (i.e. always true, since cancel is only possible pre-start). Two channels required:
  - **Email notification** — every user who marked "going" on the event must receive an email when it's cancelled. This is a hard requirement, not optional-for-MVP.
  - **In-app indication** — the event page (and any place "going" events are listed for that user) shows a cancelled state/badge, so the email isn't the only signal.

### Cancellation email notification (mechanics)

- **Recipients:** every user with an `EventInterests` row for this event (i.e. everyone who marked "going"), using their account email at time of cancellation.
- **Trigger:** part of the cancel action itself — once `status` is set to `cancelled`, email dispatch fires in the same flow (e.g. the cancel Edge Function enqueues/sends after the DB write succeeds).
- **Content (minimum):** event title, that it's cancelled, organiser name, original date/time. Exact copy/design not locked here.
- **Delivery mechanism:** **Resend** — chosen for its Next.js/React Email fit (templates as JSX, matching the existing frontend stack) and a free tier (3,000 emails/month) that comfortably covers MVP volume.
- **Failure handling:** an individual email failing to send must not block or roll back the cancellation — the event stays cancelled regardless of delivery success. Retries/logging follow whatever the chosen provider offers natively.

### Cancellation email — copy/template (locked)

**Subject:** Cancelled: {event_title}

**Body:**

```
Hi {recipient_first_name},

{event_title}, hosted by {organiser_name}, has been cancelled.

It was originally scheduled for {original_date} at {original_time}
at {venue_name}, {area}.

We're sorry for the inconvenience. Keep an eye on Livon for other
events happening around you.

— Livon
```

- Plain, factual tone — no marketing language, no apology-heavy copy beyond the one line shown.
- `{recipient_first_name}` falls back to the user's full username if no first name is stored separately.
- `{original_date}` / `{original_time}` reflect the event's `starts_at` as it was before cancellation — not affected by the cancellation timestamp.
- No CTA/button needed for MVP (e.g. no "browse other events" link) — keep it a simple notice. Can be revisited later if engagement data suggests a CTA helps.

### Ending early

- While an event is live, the organiser can set `ends_at` to the current time (or a UI-level "End Now" action that does this under the hood).
- This does **not** set `status = 'cancelled'`. The event simply transitions to "ended" once that new `ends_at` passes, same as natural expiry.
- No cancellation badge or "going" user notification applies here — the event happened, it just wrapped up sooner than originally listed.

### Derived display state (unchanged from Card FR, restated here for clarity)

- **Upcoming:** now < `starts_at`
- **Live:** `starts_at` ≤ now < `ends_at` (or now < `starts_at` + 8h if `ends_at` is null)
- **Ended:** now ≥ `ends_at` (or the 8h fallback)
- **Cancelled:** `status = 'cancelled'`, regardless of timestamps — this overrides the above at any point before its natural start.

---

## Edge cases

- **Organiser tries to cancel a live or ended event:** blocked — action only available pre-start. UI should not even present "cancel" as an option once the event has started; "End Now" is the live-event equivalent.
- **Un-cancelling:** not supported, period. Cancellation is permanent and final — there is no path to reverse it, in MVP or beyond as currently scoped. If an organiser wants the event to happen after all, they must create a new event.
- **Cancelling an event with zero "going" users:** no indication needed to show anyone, but the event still updates to cancelled state for anyone who views the page directly.
- **InviteLinks pointing to a cancelled event:** should still resolve to the event page (which shows the cancelled state) rather than breaking — not hidden or invalidated by this FR.
- **EventInterests / EventViews on a cancelled event:** untouched by this FR — historical "going" and view data is preserved regardless of cancellation, consistent with treating Events as archival, not disposable, per our earlier discussion.
- **Race condition — organiser cancels right as event is starting:** if `starts_at` passes before the cancel request is processed, the action should be rejected server-side (re-check "is this still upcoming" at write time, not just at UI-render time).

---

## Inputs / outputs

**Cancel action (organiser → server)**

- Input: `event_id`
- Validation: requester is the organiser; event `status = 'active'`; now < `starts_at`
- Output: `status = 'cancelled'`, `cancelled_at = now()`; event removed from feed immediately; event page reflects cancelled state

**End early action (organiser → server)**

- Input: `event_id`
- Validation: requester is the organiser; event is currently live
- Output: `ends_at = now()`; event follows normal expiry/removal behavior from that point forward; `status` unchanged

**Feed / listing query**

- Additional filter beyond existing timestamp logic: exclude any event where `status = 'cancelled'`

---

## Open items to confirm later

None — all prior open questions for this FR are resolved.
