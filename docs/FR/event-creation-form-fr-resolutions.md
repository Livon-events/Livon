# FR Addendum: Event Creation Form — Open Items Resolved

This addendum finalizes the two remaining open items from the Event Creation Form FR. Merge into `docs/fr/event-creation-form.md` in place of the "Open Items" section.

## 1. Minimum location character length

**Decision: 3 characters minimum** for the freeform `venue_name` text field (structured City/Area FK lookups are unaffected by this — this applies only to the freeform venue name text input).

## 2. Paid amount persistence across Free ↔ Paid toggles

**Decision: the price value persists in local form state while the toggle is off Paid, and is only discarded on form close or on submission as Free.**

Behavior:
- Host selects "Paid," enters a price, then toggles to "Free" — the price field is hidden but its value is retained in component state (not cleared).
- If the host toggles back to "Paid" within the same form session, the previously entered price reappears exactly as typed.
- If the form is submitted while set to "Free," the price is discarded and `Events.price` is written as `0` (per the existing `price numeric, not null, default 0` schema decision) — the retained local value never reaches the database in that case.
- If the form is closed/abandoned without submitting, the retained value is simply discarded along with the rest of the unsaved form state (no persistence beyond the active session).

Rationale: avoids the minor annoyance of re-typing a price after an accidental or exploratory toggle, with zero correctness risk since nothing touches the database until submit.

## Status

Both open items in the Event Creation Form FR are now resolved. The FR can be marked complete.
