# Plan: Livon-Published Events & Host Claiming

**Status:** Planning only — no implementation yet  
**Author:** Draft for review  
**Last updated:** 2026-08-14 (accounts first; connections independent of claim)

**Operator runbook (for you, not engineering):** [`docs/ops/publish-and-transfer.md`](../ops/publish-and-transfer.md) — WhatsApp → publish → transfer / undo.

---

## 0. Strategic context (confirmed)

**Problem:** Livon has found product-market fit on the **demand** side (attendees show up, engage, RSVP) but **supply** is the bottleneck — not enough events listed for the audience you can already reach.

**Strategy:** Livon manually curates and publishes events to fill the feed, then uses **host claiming** as the handoff mechanism so real organizers take ownership without you being the long-term operator of every listing.

**Ops constraint (confirmed):** You are fine doing publishing work directly in **Supabase** (Table Editor, SQL, Storage) for now. A **dashboard or admin UI** is deferred until manual publishing itself becomes the bottleneck — not before.

**MVP recruitment model (confirmed):** You will **talk to every organizer before posting** and collect their details. This makes identification tractable at low volume — the product claim flow should support that ops reality, not assume anonymous open claiming.

**Accounts first, connections anytime (confirmed):** Organizers should **create a Livon account** so they can claim while signed in. Connections are **not** a prerequisite for claiming or for listing an event. People can search each other and connect whether or not they have published or claimed an event. Existing search + connections already cover that — do not add a "connect first" step to claim.

**Livon publishing account (confirmed):** Sign in with `livonevents2026@gmail.com`. That account is the platform user (`organizer_id` for unclaimed events). Prefer Google sign-in with that Gmail so the email is verified automatically, then set username to something like `livon` in profile (do not leave a random Google slug as the public name).

**Day-to-day channel (confirmed):** Organizer conversations happen on **WhatsApp**. Posters usually arrive as WhatsApp images. Publishing uses the existing **Create Event** form while signed in as this account — not the Supabase Storage UI for posters.

**Self-publish (confirmed):** Keep `/create-event` for hosts you did not recruit. Two supply paths coexist:
- **Curated path:** Organizer creates account → Livon publishes → organizer signs in and claims.
- **Organic path:** User creates event → they are host immediately (no claim).

**Implication for build order:** Invest engineering effort in **claim flow + host-line display states** (the product loop), not in **Livon publishing tooling** (the ops loop). Publishing stays manual in Supabase until volume forces otherwise.

---

## 1. Objective

Enable Livon to publish events on behalf of venues/hosts, while allowing the real host to **claim** ownership after they already have a Livon account. Until claimed, the event is live and discoverable, but managed by Livon. After claim, the host gets full organizer capabilities (edit, manage guestlist, cancel).

Organizers are asked to **create an account** so they can claim when signed in. Connections can happen before, after, or without any event — via search. Logged-out users cannot complete a claim.

**User-facing signal:** Unclaimed Livon listings show **"Published by Livon"** on event cards. After claim, display reverts to current behavior: **"Hosted by @username"**. The **Claim this event** button lives on the **event details page** only (not the feed card).

**Success metric for Phase 1:** More events in feed → same or better attendee engagement → pre-recruited hosts claiming listings → reduced manual ops per event over time.

---

## 2. Why this is a significant change

Today the app is built around **self-service publishing**: whoever creates an event *is* the host.

| Concept today | How it works |
|---|---|
| Host | UI label for the user in `events.organizer_id` |
| Publish | Any signed-in user creates an event; they become organizer immediately |
| Ownership | Single non-null `organizer_id`; RLS requires `organizer_id = auth.uid()` for edit/delete |
| Display | Always "Hosted by @username" — assumes a real user organizer |

There is **no** unclaimed state, **no** platform/admin role, and **no** ownership transfer anywhere in schema, RLS, API, or UI.

This feature introduces a **new ownership lifecycle**, not a small tweak. It will touch database schema, RLS policies, server mutations, feed SQL, profile queries, and multiple UI surfaces.

### 2.1 Confirmed display states (MVP)

| Event type | Feed card + details card host line | Claim button |
|---|---|---|
| **Livon-published, unclaimed** | **Published by Livon** (plain text; not a profile link) | On event details: **Claim** if signed in; **Sign in to claim** if logged out |
| **Livon-published, claimed** | **Hosted by @username** (link to profile — current behavior) | Hidden |
| **Self-published** | **Hosted by @username** (current behavior) | Hidden |

**Copy distinction matters:** "Published by" signals curation/listing; "Hosted by" signals the account running the event. Do not use "Hosted by Livon" for unclaimed events.

---

## 3. Recommended direction (draft — needs your confirmation)

### 3.1 Phased approach

**Phase 1 — MVP (confirmed scope)**  
- **Publishing (ops):** You talk to organizer first; they create a Livon account (so you can bind the listing to their user); you insert the event in Supabase. No dashboard. No requirement that they connect with anyone first.  
- **Publishing (product):** Unclaimed events use **Livon platform user** as `organizer_id`; cards show **"Published by Livon"**.  
- **Claim (product):** Claim on **event details page**, **signed-in only**; ownership transfer on success; cards switch to **"Hosted by @username"**.  
- **Claim authorization:** Prefer **account identity** (`intended_claim_user_id` / username) now that they sign up first; email match as fallback if they don't have an account yet when you publish (see §3.7).  
- **Self-publish:** Unchanged — recruited or not, anyone with an account can still use `/create-event`.  
- **Monitoring (ops):** Watch claims in Supabase; manual reversal via SQL if needed.

**Phase 2 — When claim volume or trust issues appear**  
- Tighter claim verification (invite link, venue email, manual approval).  
- Audit log entries for publish + claim events.  
- Notifications ("Your event was claimed", outreach to hosts who haven't claimed).  
- Optional: thin publish script (`scripts/publish-event.mjs`) if Supabase UI gets tedious before a full dashboard.

**Phase 3 — When manual publishing becomes the bottleneck**  
- Admin dashboard or internal `/admin` publish flow (cover upload, validation, preview).  
- Bulk ingestion (CSV, Airtable, partner API).  
- Co-hosts / delegated managers.

**Phase 4 — Optional future**  
- Host onboarding funnel from claim → profile setup → recurring self-publish.

### 3.2 Suggested data model (Phase 1)

Keep changes minimal. Two viable options:

| Option | Schema change | Pros | Cons |
|---|---|---|---|
| **A — Platform user (recommended for MVP)** | No schema change. Create a `livon` system user. Livon-published events set `organizer_id = livon_user_id`. Add `claimed_at` + `claimed_by` columns (optional but useful for audit/display). | Smallest RLS delta; works with existing NOT NULL FK; feed/profile queries mostly work | Need a reliable way to detect "unclaimed" (flag or `claimed_at IS NULL`); Livon user profile must not look like a normal host long-term |
| **B — Nullable organizer** | `organizer_id` nullable until claim; add `published_by` (platform user or enum) | Clear semantic separation | Bigger migration; every query/RLS policy assuming non-null organizer breaks; more refactor risk |

**Recommendation:** Option A for Phase 1. Add:

```sql
-- illustrative, not final migration
ALTER TABLE events
  ADD COLUMN claimed_at timestamptz NULL,
  ADD COLUMN claimed_by uuid NULL REFERENCES users(user_id),
  ADD COLUMN intended_claim_user_id uuid NULL REFERENCES users(user_id), -- preferred: they already signed up
  ADD COLUMN intended_claim_email text NULL;  -- fallback if you publish before they have an account
```

Unclaimed = `organizer_id = :livon_platform_user_id AND claimed_at IS NULL`.  
Claimed = `claimed_at IS NOT NULL AND organizer_id = claimed_by`.  
Self-published = `organizer_id != :livon_platform_user_id` (never claimable; intended-claim fields stay NULL).

**Claim match rule (MVP):** succeed if `auth.uid() = intended_claim_user_id`, OR (if `intended_claim_user_id` is null) verified email matches `intended_claim_email`. If both are null, nobody can self-claim — you transfer manually in Supabase.

Alternatively, a boolean `is_claimable` set only on Livon-published rows avoids magic user-id checks in app code — but still requires the platform user for RLS on unclaimed events.

### 3.3 Claim flow (confirmed UX)

Claim is **not** how organizers join Livon. They create an account (so claim can run while signed in). Connections are optional and independent — search already lets people find each other with or without an event.

```
[You talk to organizer]
         ↓
[They create a Livon account] → username exists; connections optional, anytime
         ↓
[You look up their username in Supabase users table]
         ↓
[Livon inserts event] → organizer_id = livon, claimed_at = NULL, intended_claim_user_id = their user_id
         ↓
[Event live in feed + details]
  → cards: "Published by Livon"
  → details page: claim section (below About / near action bar)
         ↓
[Organizer opens event while signed in] → [Claim this event] → confirm → transfer
[Anyone logged out] → "Sign in to claim this event" (no claim API call)
         ↓
[Claim succeeds]
  → organizer_id = user, claimed_at = now(), claimed_by = user
  → cards: "Hosted by @username"
  → redirect to /events/[id]/manage
```

**Clarification — the claim button still works.**  
What does *not* work is claiming while logged out. That is intentional:

| State | What they see | What happens |
|---|---|---|
| Signed in, invited organizer | **Claim this event** | Confirm → ownership transfers |
| Signed in, someone else | No working claim (mismatch copy) | Blocked |
| Logged out | **Sign in to claim this event** | Goes to sign in, then back to the event — claim still requires a second tap while signed in |

Do not auto-claim on return from login. They must be signed in *and* explicitly tap Claim. That keeps claim a deliberate ownership action, separate from signup.

**RLS implication:** Claim must run through a **SECURITY DEFINER** RPC (e.g. `claim_event(p_event_id)`) that:
1. Verifies caller is authenticated (`auth.uid()` present). Logged-out = fail.
2. Verifies event is claimable (`organizer_id = livon` and `claimed_at IS NULL`).
3. Verifies caller matches `intended_claim_user_id`, or (fallback) verified email matches `intended_claim_email`.
4. Atomically updates `organizer_id`, `claimed_at`, `claimed_by`.
5. Optionally writes to `activity_log` via service role.

Regular users must **not** be able to UPDATE `organizer_id` directly.

### 3.7 Transfer flow — signed-in claim, connections independent

Because organizers create accounts first, you can bind the listing to a **real user**, not just an email. That is stronger than email-gating. Connections stay a separate product surface (search + profiles) and are **not** part of the claim flow.

| Option | How it works | Fit now | Engineering |
|---|---|---|---|
| **F — User-id gated (recommended)** | After they sign up, you look up `users.username` in Supabase and set `intended_claim_user_id`. Claim succeeds only if `auth.uid()` matches. | Best fit: they already have an account before you publish | Small schema + RPC check |
| **E — Email-gated + manual fallback** | Store `intended_claim_email` if you must publish before they sign up | Fallback only | Same as before |
| **B — Open claim** | Anyone signed in can claim | Avoid — an account does not prove they are the organizer | Smallest, highest risk |
| **D — Manual transfer only** | You UPDATE `organizer_id` in Supabase; no claim button | Last resort if they never tap Claim | No product loop |

**Recommendation: F first, E as fallback, D as ops escape hatch.**

**Preferred ops sequence:**

1. Talk to organizer — confirm they're OK being listed.  
2. Ask them to **create a Livon account** (or send the signup link) so they can claim while signed in.  
3. They pick a username (profile/connections optional — they can search people anytime).  
4. You look up their username in `users` and copy `user_id`.  
5. Insert the event with `intended_claim_user_id`.  
6. Message them: *"Your event is live. Sign in, open this link, tap Claim this event."*  
7. They claim while signed in → cards switch to **Hosted by @username**.

**What to tell organizers (script):**

> "Create a Livon account so the listing can sit under your name. I'll publish it as Published by Livon. When you're signed in, open the event and tap **Claim this event**. You can search and connect with people anytime — that doesn't have to happen before you claim."

**If they don't have an account yet and you still need to publish today:**  
Set `intended_claim_email` instead. They can sign up later and claim once signed in with that email. Prefer waiting for the account when you can — user-id is cleaner.

**Edge cases:**

| Situation | Handling |
|---|---|
| Organizer already has an account when you talk | Look up username → `intended_claim_user_id` → they sign in and claim |
| Organizer creates account after you published with email | Claim via email match, or you paste their new `user_id` into `intended_claim_user_id` |
| Organizer never claims | Stays "Published by Livon"; you edit in Supabase; nudge them |
| Logged-out visitor taps the host CTA | Sign in / sign up, return to event, then claim (second tap) |
| Wrong person signed in | RPC rejects; they see they are not the invited organizer |
| You want to skip the button for one event | Leave both intended fields null; transfer `organizer_id` yourself in SQL |

**Why keep the claim button at all?**  
Because you still publish as Livon. Until they tap Claim while signed in, the card must say **Published by Livon**. The button is the state change — it is not broken; it is authenticated. Connections do not gate it.

### 3.4 Publishing path for Livon — WhatsApp → Create Event (confirmed)

**Account:** `livonevents2026@gmail.com`  
**Where posters go:** the **cover image** field on `/create-event`. That field is the poster. The app resizes it and stores it in the `event-covers` bucket. You do **not** upload posters in the Supabase dashboard.

**Do not** paste poster files into Table Editor or Storage by hand. The form already:
- lets you pick an image from your phone (including WhatsApp’s gallery)
- downscales it in the browser
- re-encodes it on the server (WebP)
- writes `cover_image_url` on the event row

If you skip the photo, the category default (or a placeholder) is used. For curated listings, always attach the organizer’s poster when they sent one.

Full click-by-click flow: **§11**.

### 3.5 UI changes (Phase 1 — confirmed)

#### Host line (`EventCard`, `EventDetailsCard`, search cards)

Introduce a shared display helper (e.g. `EventHostLine`) driven by query fields:

| Field from API | Rendering |
|---|---|
| `isClaimable === true` | `Published by Livon` — plain text, **no** profile link |
| `isClaimable === false` | `Hosted by` + linked `@username` (current `HostLink` behavior) |

**Files to touch:**
- `src/modules/events/components/card/EventCard.tsx` — line 72–74 today says "Hosted by"
- `src/modules/events/components/details/EventDetailsCard.tsx` — line 45–52
- `src/modules/search/components/EventResultCard.tsx` — if it shows host line
- `src/modules/feed/queries.ts` + `get_home_feed` SQL — return `is_claimable` (or derive from `claimed_at` + platform user id)
- `src/modules/events/queries.ts` — extend `EventDetails` type

**Feed RPC note:** `get_home_feed` currently returns `host_username` from the organizer join. For unclaimed events that would return `livon`. App layer should prefer `is_claimable` flag over username for display — don't show `@livon` as host.

#### Event details page (`EventDetailsPage`)

Claim UI is **details-only** (not on feed card). Suggested layout:

```
[Event details heading]
[EventDetailsCard]          ← host line follows rules above
[EventAboutSection]
[ClaimEventSection]         ← NEW: only when isClaimable
[EventActionBar]            ← Going + Share (unchanged)
```

**`ClaimEventSection` behavior:**

| Viewer state | UI |
|---|---|
| Logged out | "Are you the host?" + **Sign in to claim this event** (no claim API) |
| Signed in, matches `intended_claim_user_id` (or email fallback) | **Claim this event** → confirm modal → claim API |
| Signed in, does not match | "This event can only be claimed by the invited organizer." |
| Signed in, unverified email (email-fallback path only) | Same gate as RSVP — prompt to verify first |
| Already claimed / self-published | Section not rendered |

Do **not** auto-claim after login. Return to the event; they tap Claim while signed in.

**Confirm modal copy:**  
*"By claiming, you confirm you are authorized to manage this event. You will be able to edit details, view the guestlist, and cancel the listing."*

**Post-claim:** Redirect to `/events/[id]/manage` with a one-time success message.

#### Profile + manage routes

| Surface | Change |
|---|---|
| Profile Created tab | Claimed events appear under claimer's profile; Livon `@livon` profile shows only unclaimed (or hide Created tab for platform user) |
| Edit / Manage routes | Remain organizer-only; unclaimed events editable only by Livon via Supabase/service role |

### 3.6 What stays the same (confirmed)

- **Self-publish** via `/create-event` for organic hosts — no claim flow, always "Hosted by @username" from creation.  
- **Search + connections** — unchanged. Anyone with an account can find and connect with anyone else, whether or not they have an event.  
- RSVP, Peek, invite links, feed ranking — work unchanged for claimed and self-published events.  
- For unclaimed events, `is_connection_host` in feed will be false for everyone (acceptable for MVP).

---

## 4. Open questions — remaining

Most MVP decisions are now confirmed (§2.1, §3.5, §3.7). Only edge-case items remain:

### 4.1 Who is allowed to claim?

- [x] **Signed-in invited organizer** — prefer `intended_claim_user_id` after they create an account  
- [x] **Email fallback** (`intended_claim_email`) if you publish before they sign up  
- [x] **Logged-out users cannot claim** — they see "Sign in to claim"  

**Confirmed direction:** User-id gated claim (Option F), email fallback (E), manual SQL transfer as escape hatch.

### 4.2 What should the host line show before claim?

- [x] **"Published by Livon"** on feed card + event details card  
- [x] After claim → **"Hosted by @username"** (current behavior)  

### 4.3 Can one host claim multiple events?

- [x] **Yes** — same organizer can claim multiple listings if each row's `intended_claim_user_id` (or email) matches  

### 4.4 What happens if the wrong person claims?

- [x] **Manual reversal** via Supabase SQL / service role (email gate should make this rare)  

### 4.5 Does Livon keep any control after claim?

- [x] **Full handoff** — host owns edit, manage, cancel  

### 4.6 Self-publish vs curated

- [x] **Both paths coexist** — curated (Livon publish + claim) + organic self-publish  

### 4.7 Publishing workflow

- [x] **Supabase manual now; dashboard when publishing volume is the bottleneck**  

### 4.8 Claim button placement

- [x] **Event details page only** — new `ClaimEventSection` between About and action bar  

### 4.9 Email verification gate

- [x] Claim requires **signed-in** user (confirmed).  
- [ ] Confirm: on the **email-fallback** path, also require verified email (recommended **yes**). User-id path already implies they completed signup.  

### 4.10 Feed and discovery

- [x] **No feed ranking changes** in Phase 1 — only host-line copy change on cards  

### 4.11 Still open — optional

- Should `@livon` profile be hidden or show a static "Livon curates events" bio instead of a normal user profile?  
- After claim, send a manual WhatsApp, or leave it silent?

**Resolved:** No "connect before claim" nudge. Connections are independent; people search each other anyway.

---

## 5. Pushback & risks

### 5.1 This is not a refactor — it is a new domain concept

Avoid framing this as "small refactor to add a button." The claim button is the visible tip of:
- ownership transfer semantics  
- platform publishing authorization  
- host trust / verification policy  
- display logic across feed, search, profiles, peek  

### 5.2 Do not start with admin UI — Supabase is enough for now

Your supply bottleneck is solved by **listing events**, not by **building publishing software**. Supabase manual inserts are the right Phase 1 ops tool. A dashboard is justified only when publishing frequency makes Supabase painful — not when engineering capacity is available.

**Build priority:** claim button + ownership transfer > publish script > admin dashboard.

### 5.3 Avoid nullable `organizer_id` in MVP

Making `organizer_id` nullable ripples through `get_home_feed`, profile queries, RLS, and TypeScript types. A platform user is less elegant but far safer for a first ship.

### 5.4 Do not couple claim to connections

Claim is ownership transfer. Connections are a separate loop (search → profile → connect) and work with or without an event.

Do **not** require, nudge, or sequence "build connections first." An organizer with zero connections can still claim. Peek and feed ranking will improve if they connect later — that is optional, not a gate.

### 5.5 Legal / trust

If Livon lists events without host consent, clarify terms: hosts opt in by claiming (or requesting takedown). Worth a one-line note in claim modal: "By claiming, you confirm you are authorized to manage this event."

---

## 6. Proposed implementation checklist (after decisions)

When you approve direction, implementation would likely proceed in this order:

### Database
- [ ] Create Livon platform user (seed / migration)  
- [ ] Add `claimed_at`, `claimed_by`, `intended_claim_user_id`, `intended_claim_email` to `events`  
- [ ] Add `claim_event(event_id)` SECURITY DEFINER function (must be authenticated; match user_id then email fallback)  
- [ ] Update RLS: prevent direct `organizer_id` updates by clients  
- [ ] Update `get_home_feed` / `search_events` to return `is_claimable` (or equivalent)

### Backend
- [ ] `POST /api/events/[id]/claim` route (or Supabase RPC wrapper)  
- [ ] Extend `EventDetails` type with `isClaimable`, `claimedAt`  
- [ ] Activity log entry on claim (service role, optional in Phase 1)

### Ops (no app code — document in runbook)
- [ ] One-time: create Livon platform user; record `user_id` in env or internal doc  
- [ ] Runbook: Supabase steps to publish an event (cover upload, insert row, verify)  
- [ ] Runbook: reverse a bad claim via SQL (`organizer_id`, `claimed_at`, `claimed_by`)  
- [ ] Optional later: `scripts/publish-event.mjs` if batch volume grows

### Frontend
- [ ] Shared `EventHostLine` — "Published by Livon" vs "Hosted by @user"  
- [ ] Update `EventCard`, `EventDetailsCard`, search result cards  
- [ ] `ClaimEventSection` on event details (signed-in claim; logged-out "Sign in to claim"; mismatch state; confirm modal)  
- [ ] `POST /api/events/[id]/claim` wired to claim RPC  
- [ ] Post-claim redirect to `/events/[id]/manage`  

### Docs & ops
- [ ] Update `docs/db/schema.md`  
- [ ] Update `docs/db/rls-policies.md` and `docs/db/functions.md`  
- [ ] Runbook: how Livon publishes an event; how to reverse a bad claim  

### Out of scope for Phase 1
- Admin dashboard (deferred until publishing ops is the bottleneck)  
- Publish script (optional; Supabase manual is sufficient initially)  
- Claim approval queue  
- Co-hosts  
- Venue entity table  
- Notifications  

---

## 7. Decisions log

Record answers here as you decide:

| # | Question | Decision | Date |
|---|---|---|---|
| 4.1 | Who can claim? | **Signed-in only. Prefer `intended_claim_user_id`; email fallback; manual SQL escape hatch** | 2026-08-14 |
| 4.2 | Pre-claim host display | **"Published by Livon"** | 2026-08-14 |
| 4.2b | Post-claim host display | **"Hosted by @username"** (current) | 2026-08-14 |
| 4.3 | Multiple claims per user | **Yes** | 2026-08-14 |
| 4.4 | Wrong claim reversal | **Manual via Supabase SQL** | 2026-08-14 |
| 4.5 | Post-claim Livon control | **Full handoff** | 2026-08-14 |
| 4.6 | Self-publish vs curated | **Both paths coexist** | 2026-08-14 |
| 4.7 | Publishing workflow | **WhatsApp → save poster → Create Event while signed in as livonevents2026@gmail.com. Not Storage UI.** | 2026-08-14 |
| 4.8 | Claim CTA placement | **Event details page only** (`ClaimEventSection`) | 2026-08-14 |
| 4.9 | Auth for claim | **Must be signed in. Do not auto-claim after login.** | 2026-08-14 |
| 4.10 | Feed treatment | **Host-line copy only; no ranking changes** | 2026-08-14 |
| — | Accounts vs connections | **Create account so they can claim signed-in. Connections are independent (search). No connect-first gate.** | 2026-08-14 |

---

## 8. Confirmed MVP bundle

1. **Platform user** owns unclaimed events (`organizer_id = livon`).  
2. **Organizers create accounts** so they can claim while signed in. Connections are optional and independent (search).  
3. **You publish in Supabase** after talking to them; set `intended_claim_user_id` (preferred) or `intended_claim_email` (fallback).  
4. **Claim is signed-in only** — logged out sees "Sign in to claim"; no auto-claim after login.  
5. **Display:** unclaimed → **"Published by Livon"**; claimed / self-published → **"Hosted by @username"**.  
6. **Claim CTA** on event details only.  
7. **Full handoff** on claim.  
8. **Self-publish kept** for organic hosts.  
9. **No dashboard, no feed ranking changes** in v1.

**Build order:** platform user + schema + claim RPC → host-line UI → signed-in claim section on details → ops runbook.

---

## 9. Next step

The plan is complete enough to implement. Connections stay out of the claim flow. Next: schema + claim RPC + host-line display + signed-in claim section on event details.

---

## 10. What would actually slow you down a lot

Obstacles you should expect vs flaws that stall **supply** or **handoff**. Ranked by how much they would delay Livon, not by how interesting they are to build.

### 10.1 Do not wait for their account before you list (high)

The preferred sequence today is: talk → they sign up → you look up `user_id` → you publish.

That puts **their signup speed on the critical path of your feed**. Organizers will delay, forget, or sign up with Google under a different email. Every wait is a missing event for attendees you already have.

**Fix:** Publish as soon as you have event details and consent. Bind identity later:
- Have an account already → set `intended_claim_user_id`
- No account yet → set `intended_claim_email` **or leave both null** and paste `user_id` when they exist
- Listing must not depend on them finishing signup

Account-first is still good for *claiming*. It is a bad gate for *publishing*.

### 10.2 You stay the operator until they claim (high)

Claim does not reduce your work unless they tap it. Many will not. Unclaimed events still need:
- date/venue/cover corrections
- “is this still on?” checks
- guestlist questions from attendees
- cancellation / no-show handling

Full handoff after claim also means: once they claim and go silent, **you cannot edit in the app** (RLS is organizer-only). You are in SQL for every fix.

**Expect:** curated listings remain Livon-operated by default. Claim is a bonus, not the ops plan.

**Mitigation:** Keep a simple SQL snippet to transfer *or reverse* ownership. Do not treat claim rate as the success metric for Phase 1 — **events live in the feed** is.

### 10.3 Talking to every organizer is the real throughput cap (high)

This is the correct trust model at your volume. It is also a hard ceiling. Each listing needs a conversation, details, cover, and a follow-up to claim. That does not get faster when claim ships.

**When it hurts:** you cannot fill a weekend because you ran out of hours, not because the app is missing a button.

**Mitigation:** Keep self-publish. A recruited host who already has an account should be told “just use Create Event” — skip Livon-publish + claim entirely. Claim is for hosts who will not self-serve *yet*. Do not run both loops on the same person.

### 10.4 Manual Supabase inserts will burn time on silent mistakes (high)

The create form exists because inserts are easy to get wrong:
- `starts_at` timezone (UTC vs local) → event missing from the feed or showing on the wrong day
- `city_id` / `area_id` / `category_id` UUIDs copied wrong
- cover uploaded to Storage with a URL the app cannot render
- inserting as a normal user hits RLS (`organizer_id` must equal `auth.uid()`)

That debugging loop is slower than talking to organizers.

**Mitigation (revisit earlier advice):** At 5–15 events, **log in as the Livon platform user and use `/create-event`**. It already validates, resizes covers, and writes timestamps correctly. `@livon`’s Created tab filling up is cosmetic at this volume. Switch to Table Editor / script only if you outgrow the form.

Use Table Editor for `intended_claim_user_id` / `intended_claim_email` *after* the form creates the row — two minutes, not a full SQL insert.

### 10.5 Identity mismatch on claim (medium–high)

This will happen: they gave you `venue@gmail.com`, then signed up with Google `name@gmail.com`. Or you pasted the wrong `user_id`. Claim fails, they message you, listing stays “Published by Livon.”

**Mitigation:** Prefer username lookup after they exist. Keep the SQL fallback: set `intended_claim_user_id` to whoever actually signed up. Do not over-build mismatch UX — a one-line “contact Livon” plus your WhatsApp is enough.

**Do not** implement both a polished email path and a polished user-id path before you have seen three real claims. One match rule + SQL override is enough.

### 10.6 Building the full claim stack before listing more events (high — self-inflicted)

Claim touches schema, RLS, `get_home_feed`, search cards, details page, and a SECURITY DEFINER RPC. That is real engineering time. **None of it adds events to the feed.**

If you pause sourcing to finish claim, attendees wait. Supply is already the bottleneck.

**Order that protects speed:**
1. Livon platform user + you listing events this week (form-as-Livon is fine)
2. Cards: “Published by Livon” vs “Hosted by @username” (can even hardcode platform user id)
3. Thin claim: signed-in + `intended_claim_user_id` match + SQL override
4. Email fallback, mismatch states, runbooks — after you have listed a batch

### 10.7 Platform user side effects (medium)

While `organizer_id = livon`:
- `@livon` profile Created tab is every unclaimed event
- Anyone connected to the Livon account gets `is_connection_host` on **all** unclaimed listings (feed ranking distortion)
- Livon can accidentally **hard-delete** an event (cascade wipes RSVPs)

**Mitigation:** Do not use the Livon account as a social profile. Do not accept connection requests on it. Be careful with Cancel. Optionally hide or freeze the Livon public profile later — not a Phase 1 blocker.

### 10.8 Dual identity columns add complexity you may not need yet (medium)

`intended_claim_user_id` **and** `intended_claim_email` means two match paths, two failure modes, more RPC logic. At your volume you will usually know the person.

**Leaner MVP:** only `intended_claim_user_id` (nullable). If they have no account, leave it null and set it when they sign up — or transfer `organizer_id` yourself. Add email matching only after null-user-id listings become common.

### 10.9 What will *not* slow you much

| Concern | Why it’s smaller |
|---|---|
| Connections before claim | Already out of the flow; search exists |
| Admin dashboard | Correctly deferred |
| Open impersonation | You are talking to organizers; user-id gate + SQL reverse is enough |
| Feed ranking for unclaimed | Fine if Livon isn’t in anyone’s connection graph |
| Self-publish coexistence | Already built; keep pointing capable hosts there |

### 10.10 Summary — protect these two clocks

| Clock | What kills it | What to do |
|---|---|---|
| **Time-to-live listing** | Waiting on signup; SQL insert errors; building claim instead of listing | Publish as soon as you have details; use `/create-event` as Livon; bind claim identity after |
| **Time-to-handoff** | They never claim; identity mismatch; you lose edit after full handoff | Treat unclaimed as normal; SQL transfer/reverse; keep self-publish as the faster path when they will use it |

The claim button is not the bottleneck. **Human wait + you remaining operator + over-building claim before supply** are.

---

## 11. Day-to-day flow (WhatsApp → live listing)

This is the loop you run for each curated event. No dashboard. No Storage UI.

### One-time setup (do this once)

1. Open Livon → Sign in with **Google** using `livonevents2026@gmail.com` (or email/password on that same address).  
2. Confirm the email is verified (Google sign-in does this automatically).  
3. Edit profile: set username to **`livon`** (or whatever public handle you want). Bio can stay short (“Events listed by Livon”).  
4. **Do not** send or accept connection requests on this account.  
5. Note the `users.user_id` in Supabase for this row — that is the platform organizer id for claim logic later.

### Every event (the real loop)

```
WhatsApp chat with organizer
        ↓
You collect: poster image, title, date/time, venue, area, price, short description
        ↓
Save the poster to your phone (tap the image → save)
        ↓
On your phone, signed in as livonevents2026@gmail.com
        ↓
Open Livon → Create Event
        ↓
Tap the photo area → pick the saved poster from gallery
        ↓
Fill the rest of the form → Publish Event
        ↓
Event is live in the feed
        ↓
Copy the event link → send it back on WhatsApp
        ↓
(After claim ships) They sign in and tap Claim on the details page
```

### What to collect on WhatsApp (checklist)

| Ask for | Goes into | Notes |
|---|---|---|
| Poster / flyer photo | Cover image on the form | Save to camera roll; see poster notes below |
| Event name | Title (max 60 chars) | Shorten if their flyer title is long |
| When | Start date + start time | Use their local time as they said it |
| Where (venue) | Location / venue name (max 60 chars) | e.g. “Maseru Club” |
| Area | Area picker on the form | Must match a Livon area (city → area) |
| Ticket price | Free / Paid + amount | LSL; 0 if free |
| Blurb (optional) | Description (max 500 chars) | You can write this from the chat if they don’t send one |
| Their Livon username, if they have an account | `intended_claim_user_id` later | Not needed to publish today |

You do **not** need them to have an account before you publish.

### How posters actually get in

1. Organizer sends the flyer in WhatsApp (photo or file).  
2. You **save it to the phone** (long-press → Save image).  
3. On Create Event, tap the **cover / photo** block at the top.  
4. Pick that image from the gallery (same as any other photo).  
5. You should see a preview on the form.  
6. On Publish, Livon:
   - downscales it in the browser
   - converts it to WebP on the server
   - stores it in Storage bucket `event-covers`
   - sets `events.cover_image_url` to the public URL

That URL is what the feed card and the details poster viewer use. There is no separate “poster upload” screen.

**If they send a PDF or Instagram screenshot:** take a crop of the poster area and save that as an image. The form only accepts image files (JPEG / PNG / WebP), not PDF.

**WhatsApp compression:** chat photos are often smaller/softer than the original. If the flyer looks muddy, ask them to send it as a **document/file** instead of a photo, then save that file and pick it in the form.

**If you forget the poster:** you can still publish (placeholder/category cover). Open **Edit** on that event later (still signed in as Livon) and add the photo there — same cover field.

### After Publish — what you send on WhatsApp

> Your event is live: `https://…/events/{id}`  
> It currently shows as Published by Livon (once that copy ships; until then it will show Hosted by livon).  
> When you have a Livon account, open that link while signed in and tap Claim this event.

Until claim is built, skip the Claim sentence. The link still helps them share it.

### After claim exists — extra 30 seconds in Supabase (optional)

Only if you already know their Livon username:

1. Supabase → Table Editor → `users` → find username → copy `user_id`  
2. `events` row you just created → paste into `intended_claim_user_id`

If you don’t know it yet, leave it blank. Publish is already done.

### What you will see in the app (today vs after claim ships)

| Moment | Feed card host line | Details page |
|---|---|---|
| **Today (no claim feature yet)** | Hosted by **livon** (your username) | Same; no Claim button |
| **After host-line change, unclaimed** | **Published by Livon** | Claim section (signed-in only) |
| **After they claim** | **Hosted by @their_username** | No claim button; they get Edit / Manage |

### Edits and cancellations (while still unclaimed)

Stay signed in as `livonevents2026@gmail.com`. Open the event → you are the organizer, so **Edit** and **Manage** work. Change the poster the same way: Edit → tap photo → pick a new image.

After they claim, those buttons move to **their** account. You fix mistakes in Supabase SQL, or ask them to edit.

### Rate limits to know about

The create form allows **5 events per 10 minutes** per account. If you batch a night of listings, pause if you hit “Too many events created recently.”
