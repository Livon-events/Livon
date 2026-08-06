# FR: Event Creation Form

## Purpose
Defines the behavior, constraints, and validation rules for the event creation form. Goal is a fast, low-friction creation flow — most fields default to sensible values or quick-select options, with manual override available everywhere.

## Fields

### Cover Image
- Optional. Host may upload an image or skip it.
- If no image is provided, the system assigns a default placeholder cover (same placeholder used in the Home Feed Event Card FR).
- No image is ever *required* to submit the form.

### Title
- Required.
- Max length: 60 characters.
- Rationale: keeps titles legible on feed cards without truncation logic doing the work.

### Category
- Required. No default — all category options render unselected on load.
- Single-select from a fixed list (chips, matching the screenshot's Sports / Arts & Culture / Nightlife pattern).
- Form cannot be submitted until exactly one category is chosen.
- Per existing feed-ranking principle, hosts are not offered multi-select here (2–3 category cap applies at the tagging level, not this single required field).

### Start Date
- Required. Defaults to the day of event creation (today), pre-filled and pre-selected on load.
- Quick-select chips: Today, Tomorrow, Friday, Saturday (rolling — always the next occurrence of that weekday). "Today" reflects the default state.
- Manual date picker available as an alternative to chips.
- Selecting a chip populates the manual field; editing the manual field deselects any active chip.

### Start Time
- Required. Same interaction pattern as Start Date.
- Quick-select chips: 12 PM, 2 PM, 6 PM, 8 PM.
- Manual time picker available as an alternative.

### Area
- Required. Single-select from the Areas within a City (City → Area, same data as the header's location picker — see docs/FR/location-toggle.md — but a fully separate field with its own state).
- Defaults to the organiser's current header location selection if one is resolved (pre-filled, changeable). Starts unselected if the header has no resolved area (e.g. scoped to "All areas", or no preference set yet).
- Determines which feed(s) the event appears in (`events.city_id`/`area_id`). Resolved once at creation; not editable afterward.
- Re-verified server-side against the live Areas table on submit — the client's selection is never trusted directly.

### Location
- Free-text venue name field.
- Max length: 60 characters — kept short intentionally; this is a venue label, not an address.
- Location-suggestion chips (e.g. "Limkokwing MP", "Limkokwing MC") may populate the field, sourced from previously used venues within the host's current City/Area scope. Selecting a chip fills the text field; the host can still edit it manually.

### Description
- Optional.
- Max length: 500 characters.

### Admission (Free / Paid toggle)
- Defaults to **Free**.
- Toggling to **Paid** reveals a numeric amount field (maps to the existing `price` column on Events; LSL, no currency selector).
- Toggling back to Free clears/ignores any entered amount; `price` defaults to 0 per existing schema decision.

## Duration / End Time — explicitly out of scope for creation, but flagged

This form does **not** collect an end time. All events end 8 hours after `start_datetime` by default, consistent with the existing feed auto-removal fallback.

**Note for schema/lifecycle planning:** an "End Now" action (ending an event early) cannot be expressed with `status` alone, since `status` is limited to `active`/`cancelled` and ending early isn't a cancellation. Supporting "End Now" will require a nullable override column on Events (e.g. `ended_at`) — null means "use computed start + 8h", a timestamp means "ended early at this time." This is a schema addition, not a creation-form field, and doesn't need to block this FR — flagging it now so it's not a surprise when the lifecycle/"End Now" FR gets written.

Recommendation: don't treat "no end time" as permanently closed. If organizer feedback shows fixed 8-hour windows are wrong for some event types (all-night events running past 8h, or short 1-hour events staying "live" too long), a lightweight duration control (chips: 2h / 4h / 8h / All Day) is a low-friction addition that wouldn't compromise the fast-creation goal.

## Validation Summary (blocks submission if missing)
- Title
- Category
- Start Date
- Start Time
- Location

## Not required
- Cover image (falls back to placeholder)
- Description
- Paid amount (only required if Admission is toggled to Paid)
