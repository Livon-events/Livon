# FR: Invite Links

## Context

This document covers creation, sharing, and tracking of per-event invite
links. Scope is intentionally limited to what the `InviteLinks` table
actually records — no click-log, no per-visitor attribution, and no
linkage to `EventViews`/`AnonymousEventViews`. Those are separate,
independent systems.

## Schema (existing)

```sql
create table public.invite_links (
  invite_link_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(event_id) on delete cascade,
  creator_id uuid not null references public.users(user_id) on delete cascade,
  code text not null unique,
  click_count integer not null default 0,
  created_at timestamptz not null default now()
);
```

## Creating a Link

- Any user can generate an invite link for a given event via `creator_id`.
- A single user **can create multiple invite links for the same event.**
  This is intentional — there is no uniqueness constraint on
  `(event_id, creator_id)`, and none should be added. Each link gets its own
  unique `code`.
- `code` is globally unique across all invite links (not just scoped to one
  event), enforced by the existing `unique` constraint.
- No cap on number of links a user can generate for an event in MVP.

## Sharing

- The link is shared externally (outside the app) using its `code` — e.g.,
  `livon.live/i/{code}` or similar — resolving to the event details page.
- No in-app UI is required to distinguish between multiple links a creator
  has generated for the same event; each simply has its own `click_count`.

## Click Tracking

- Visiting an invite link increments that link's `click_count`.
- `click_count` self-clicks (the creator clicking their own link) are
  excluded from the count, per existing locked principle.
- `click_count` is a **stored, incrementing counter** — an explicit,
  accepted exception to the "derived counts must be computed, not stored"
  principle. There is no click-event log table in MVP; the count is the
  only record kept. This means individual clicks are not queryable after
  the fact — only the running total.

## Relationship to EventViews / AnonymousEventViews

- **Independent of invite link tracking.** `EventViews` and
  `AnonymousEventViews` are populated whenever the event details page is
  visited — regardless of how the visitor arrived (invite link, feed,
  direct URL, search, etc.).
- Clicking an invite link causes two separate, unlinked effects:
  1. The invite link's `click_count` increments.
  2. The visitor lands on the event details page, which independently
     triggers normal view-tracking (`EventViews` if authenticated,
     `AnonymousEventViews` if not), exactly as it would for any other entry
     point.
- There is no attribution linking a specific view back to a specific invite
  link or its creator. A click and a subsequent view are not joined in any
  way in MVP.

## Visibility

- Consistent with the existing locked principle: **invite stats are hidden
  in MVP.** `click_count` is retained in the database but not surfaced to
  the creator or anyone else, to avoid social tension in small campus
  circles.

## Explicitly Out of Scope for MVP

- Per-click logging (who clicked, when, from where)
- Attribution of a specific event view or "going" mark back to a specific
  invite link
- Referral attribution through the signup flow (a user signing up *because*
  of an invite link) — flagged separately as an undecided post-MVP design
  question
- Surfacing `click_count` or any invite stats in the UI
- Any cap or uniqueness constraint on links per (event, creator)
