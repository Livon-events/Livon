# FR: Event Details Page

## Overview
The full event details page a user lands on from the feed card, Peek page's "View Event" button, or an invite link. This FR is being built out incrementally — currently covers Peek placement only.

---

## Page Structure (top to bottom)

1. **Event Card** — the hero image, title, date/time, venue, hosted-by, category tag, and price. This block is visually and structurally separate from everything below it (bordered off).
2. **Ad slot** — sits between the Event Card and the About section. Not specced yet (network/format/targeting all open) — just its position in the layout is confirmed here.
3. **About section** — its own block, separated from the Event Card above by a border. The section header row contains "About" and the Peek button side by side, on the same axis — Peek is grouped with About, not with the Event Card.
4. About body content (description text).

---

## Peek (button + behavior)

- Already fully specced in the Peek FR — not redefined here.
- Peek lives in the About section's header row, not in the Event Card block above it.
- Same component/logic as the feed card and elsewhere: `attending_connections_count + host_bonus`, no badge shown if the count is 0.
- Tapping it navigates to the same Peek page used everywhere else — no page-specific variant.

## Going button
- Already specced elsewhere — not redefined here. Referenced only for its position/presence on this page (see Page Structure).

## About section content
- Displays the event's **description** in full.
- Displays the event's **title in full — no truncation**, regardless of length.
- This is distinct from the Event Card block above it: the Event Card truncates the title (same cutoff behavior as the feed card, per the Home Feed Event Card FR) if it's too long to fit. The About section is where the untruncated title lives on this page.

---

## Event Card block (top of page)

Contains everything shown inside the yellow-bordered card in the reference screenshot, **excluding end time** (no end-time input/display exists per the Event Creation Form FR, so the date/time line shows start time only — not a start–end range):

- Hero/cover image
- Title (truncated if too long — see About section note above for the full, untruncated version)
- Date + start time
- Venue / Area (location)
- "Hosted by {name}"
- Category tag
- Price (or Free)

---

## Open items to confirm later
- Ad slot — deferred for now, not being specced yet
