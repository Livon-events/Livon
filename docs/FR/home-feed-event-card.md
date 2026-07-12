# FR: Home Feed Event Card

## Overview
The event card is the primary unit of the home feed. It surfaces just enough info (countdown, time, poster, title, price, location, host) to let a user decide whether to tap in. Interactive sub-elements (Peek, Going, Invite) exist on the card but are governed by their own FR docs — this doc covers the card shell, layout rules, and data display only.

---

## User actions

1. **View feed** — cards render in the home feed, one per event.
2. **Tap anywhere on the card** (outside the three interactive controls) — navigates to that event's full event page.
3. **Tap Peek / Going / Invite** — handled by their own FR docs; not detailed here beyond noting they sit on the card and must not trigger card navigation (see edge cases).

---

## Rules / constraints

### Countdown label (top-left)
Calculated from current time to event `starts_at`:
- **> 30 days remaining:** show months remaining, **floored** (e.g. 45 days → "1 Month", 75 days → "2 Months", 89 days → "2 Months"). Singular/plural label matches the number (1 Month / 2 Months).
- **1–30 days remaining:** show exact day count (e.g. "12 Days"). At exactly 30 days, still shown as days, not months (30 is the day-based boundary, not month-based).
- **Event is tomorrow (calendar day):** show "1 Day" (shorter than "Tomorrow" for the card's limited width)
- **Event is today (calendar day):** show "Today"
- All comparisons use calendar-day boundaries based on the **device's local time** — no server-side timezone conversion or storage of the user's timezone. `starts_at` is compared directly against the device clock's current calendar day.

### Time (top-right)
- 12-hour clock format (e.g. "18:00" → "6:00 PM").
- Displays the exact `starts_at` time as set by the organiser — no timezone conversion applied.
- **Ongoing event exception:** if the event is currently live (current time is between `starts_at` and `ends_at`, or between `starts_at` and the 8-hour auto-expiry window when no `ends_at` is set — see below), display **"Live"** in place of the time. Countdown label (top-left) is unaffected and continues to read "Today" per the existing rule.

### Auto-removal for events with no end time
- If an organiser does not set `ends_at`, the event is automatically treated as over — and removed from the home feed — **8 hours after `starts_at`**.
- While within that 8-hour window (and after `starts_at`), the card shows "Live" per the rule above.
- If `ends_at` **is** set, that value governs both the "Live" window and removal — the 8-hour rule only applies as a fallback when `ends_at` is null.

### Poster image
- Compressed image per the existing pipeline (1200×630 WebP, per image-processing spec).
- If organiser did not upload a cover image: show a **generic placeholder image** for MVP. Category-specific default images are a post-MVP enhancement, not required for this build.

### Event title
- Maximum **2 lines**.
- If content exceeds 2 lines, truncate and end with "…".

### Price
- Schema default is `0` — `price` is never null; a free event simply has `price = 0`.
- If price is 0: display **"Free"**.
- If price > 0: display Loti symbol + amount, e.g. **"M 150"**.

### Location
- Display venue name and area (e.g. "Venue, Area") as freeform text, matching the Venue/Area data already on the event.
- **Single line, truncated with "…"** if it exceeds the card's width — same truncation approach as the title, but capped at 1 line rather than 2.

### Host
- Display the host's **full username** (styled distinctly, e.g. the yellow accent shown in the design).

### Card-wide tap behavior
- Tapping anywhere on the card **except** the Peek button, Going button, or Invite (share) button navigates to the event's page.

---

## Edge cases

- **Title exactly fills 2 lines with no overflow:** no ellipsis needed — ellipsis only appears when truncation actually occurs.
- **Event happening right now (started but not ended):** countdown label still reads "Today"; time slot switches to "Live" per the rule above.
- **"Removed from feed" is a query-time filter, not a deletion:** the event row itself is untouched — only the home feed query excludes it once it's past its `ends_at` (or the 8-hour fallback). The event page, invite links, etc. are unaffected by this FR and may have their own rules for what happens to an ended event.
- **Event has `ends_at` set in the past relative to `starts_at` (bad data):** out of scope here — assumed prevented by event-creation validation, not this card's concern.
- **Tap targets for Peek/Going/Invite:** must have adequate hit-area isolation so a tap intended for one of these doesn't bubble up and also trigger card navigation.
- **No poster and no category assigned (shouldn't happen since category is required on Events, but noting):** falls back to the same generic placeholder.

---

## Inputs / outputs

**Input (per card, from feed query):**
- `starts_at` (TIMESTAMPTZ)
- `title` (text)
- `price` (numeric, not null, default 0)
- `venue_name`, `area` (text/lookup)
- `host_username` (text)
- `cover_image_url` (nullable — compressed WebP)
- `category_id` (for future default-image mapping, not required for MVP display logic)

**Output:**
- Rendered card with computed countdown label, formatted time, image (uploaded or placeholder), truncated title, formatted price, location line, host name
- Tap event → navigation to `/events/{event_id}` (or equivalent route), excluding taps on the three named interactive controls

---

## Open items to confirm later
- Feed query performance for the "Live"/expiry filter — needs `starts_at`/`ends_at` to be indexed if the feed query filters on them at read time for every request.
