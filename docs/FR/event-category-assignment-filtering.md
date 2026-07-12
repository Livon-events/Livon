# FR: Event Category Assignment & Filtering

## Context

This document covers two tightly coupled behaviors: how an organizer assigns
a category to an event at creation, and how a viewer filters the feed by
category. It supersedes the earlier "2–3 categories per event" principle,
which was justified by interest-match scoring that has since been retired
(see: Feed Ranking Algorithm FR). Category is now a single, required,
filterable attribute — not a multi-value interest signal.

`Categories` and `EventTags` are distinct concepts in this schema:

- **Category** — a single, required, structured classification per event,
  drawn from the fixed `Categories` list. Governed by this document.
- **Tags** (`EventTags`) — a separate, free-form, many-to-many concept.
  **Not used in MVP.** The `EventTags` table remains in the schema
  unpopulated, reserved for post-MVP use (e.g., hashtag extraction from
  descriptions, per existing post-MVP notes). This document does not cover
  tags.

## Category Assignment (Event Creation)

- Every event **must** have exactly one category assigned at creation.
- Category is selected from the fixed `Categories` list (single-select).
- An event **cannot be submitted/created without a category selected.**
  There is no "uncategorized" or default fallback state — the create flow
  blocks submission until one is chosen.
- Category can be **changed after creation**, at any point in the event's
  lifecycle (active or cancelled), the same way other editable event fields
  work. Changing category does not affect event status or trigger any
  notification.

## Category Filtering (Feed)

- The feed supports filtering by category via **single-select**: the viewer
  filters to one category at a time, not several simultaneously.
- Category filtering operates **within** the current location scope (City →
  Area), narrowing the already location-scoped feed rather than replacing
  it. Location scope and category filter are independent, stacked
  constraints — changing one does not reset the other.
- Since category is required and single-valued on every event, every event
  is guaranteed to appear under exactly one filter value — there is no
  "uncategorized" bucket to account for.

## Schema Implication

Category assignment as a single required value implies a direct foreign key
on `Events` (e.g., `category_id`, not null, references `Categories`), rather
than a many-to-many join. This replaces any assumption of an `EventTags`-style
relationship for category specifically.

**Pending schema addition** (to be added alongside the other queued items —
`preferred_city_id`/`preferred_area_id` on Users, `status`/`cancelled_at` and
`price` on Events):

- `category_id` (FK, not null, references `Categories`) on `Events`

## Explicitly Out of Scope for MVP

- **Tags / `EventTags`.** Table exists in schema but is not populated or
  used by any MVP feature.
- **Multi-category events.** One category per event only.
- **Interest-match scoring using category.** Retired — see Feed Ranking
  Algorithm FR. Category here is purely a classification/filter attribute,
  not a ranking signal.
- **Multi-select category filtering.** Single-select only for MVP.
