# FR Addendum: Invite Links — Open Items Resolved

This addendum finalizes the three open items from the original Invite Links FR session. Merge these into `docs/fr/invite-links.md` (or equivalent) in place of the "Open Items" section.

## 1. `InviteLinks.click_count` — stored counter (exception to derived-counts principle)

**Decision: `click_count` remains a stored, incrementally-updated column — an explicit, documented exception to the "derived counts must be computed, not stored" principle.**

Rationale:
- The general principle exists to prevent stale cached state on data that can change underneath it (cancellations, RLS-filtered visibility, deletions). Click events don't have that problem — they are append-only, immutable log entries with no edit/delete path, so a stored counter can't drift out of sync with reality.
- Computing this live would require either a full `InviteLinkClicks` row-per-click table or reconstructing counts from raw event logs, with no correctness benefit since clicks are hidden from users in MVP (per the "invite stats hidden in MVP" principle) and only used internally/in aggregate.
- Implementation: increment via `click_count = click_count + 1` on each valid, non-self click (self-clicks are already excluded per the existing "click_count excludes self-clicks" principle).

## 2. Multiple invite links per (event, creator) pair — intentional, allowed

**Decision: a single host may create multiple invite links for the same event.**

Rationale:
- Supports distinct distribution contexts (e.g. one link shared in a group chat, another given 1:1) even though per-link stats aren't surfaced to users in MVP.
- Keeps the door open for the deferred post-MVP referral-attribution work without a schema change later — disallowing multiples now would be a one-way door.
- No uniqueness constraint on `(event_id, creator_id)`. Uniqueness is enforced only on the link token itself: `create unique index on invitelinks (link_token)`.

## 3. Relationship between invite link clicks and EventViews/AnonymousEventViews — none (parallel, not linked)

**Decision: invite clicks and event views remain separate, unrelated tables. No FK between them.**

Rationale:
- They answer different questions: `EventViews`/`AnonymousEventViews` answer "how many people saw this event," while `InviteLinks.click_count` answers "which link drove traffic." Merging them would conflate concerns and couple the view-counting logic to invite-link existence, which it shouldn't need to know about.
- Behaviorally: a valid invite click still creates/increments the normal `EventViews`/`AnonymousEventViews` row for the resulting page load, exactly as any other view would — the invite click just *additionally* increments `InviteLinks.click_count` as a side effect of the same request. No shared foreign key; the two systems are wired together only by "this request happened to include an invite token," not by schema relationship.
- This leaves room to later add a nullable `source_invite_link_id` FK on `EventViews`/`AnonymousEventViews` if/when referral attribution is built post-MVP, without needing to touch `InviteLinks` itself.

## Schema Impact Summary

- `InviteLinks.click_count` (int, not null, default 0) — confirmed as-is, stored counter.
- No new uniqueness constraint on `(event_id, creator_id)` — multiples are allowed.
- `create unique index on invitelinks (link_token)` — confirms token-level uniqueness only.
- No FK added between `InviteLinks` and `EventViews`/`AnonymousEventViews` for MVP. Revisit if/when referral attribution ships post-MVP.

## Status

All three open items from the Invite Links FR are now resolved. The Invite Links FR can be marked complete.
