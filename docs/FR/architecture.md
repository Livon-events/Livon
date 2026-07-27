# Architecture Reference

This is a standing reference for how the Livon Next.js app is structured. Every task file assumes this architecture — read this once before starting any task, and follow these conventions rather than inventing new patterns per feature.

**Status:** the module structure below has been applied to the codebase (see the delta zip / restructuring pass delivered alongside this doc update). `src/lib/`, `src/components/`, `src/hooks/`, and the duplicate `src/auth/` no longer exist — everything lives under `src/modules/` or `src/shared/` per the shape below. Any new feature work should follow this structure directly rather than the old flat layout.

---

## Stack
- **Framework:** Next.js, App Router (not Pages Router).
- **Backend:** Supabase (Postgres + Auth + Storage), accessed via `@supabase/supabase-js` and `@supabase/ssr` for App Router-compatible server/client splitting.
- **Styling:** Tailwind CSS.
- **Icons:** Lucide React.
- **Email:** Resend (server-side only, e.g. inside Edge Functions or Route Handlers — never call Resend from client code).
- **Image processing:** `sharp`, server-side only (event covers, avatars).

---

## Modular Monolith Structure

**One deployable, one database — organized as independent modules with enforced boundaries.** The goal isn't microservices; it's making sure a feature added six months from now doesn't require understanding (or accidentally touching) five unrelated domains. Each module owns a slice of the schema and exposes a small public API. Nothing else in the app reaches past that public API.

### Module list

**Core domain modules** (each owns one or more tables, has real business logic):

| Module | Owns (tables) | Responsibility |
|---|---|---|
| `auth` | — (fronts `auth.users`) | Sign up, sign in, sign out, Google OAuth, session handling |
| `users` | `users` | Profile fields, profile editing, avatar, public profile view |
| `events` | `events` | Create/edit/cancel events, event details, event cover image |
| `rsvp` | `event_interests` | Going/not-going, visibility (privacy) toggle, going counts |
| `connections` | `connections` | Connection requests, accept/decline, connection state, connection counts |
| `invites` | `invite_links`, `invite_link_clicks` | Invite link creation, redemption, click dedup |

**Reference-data modules** (read-only to clients — no mutation path exists or is planned):

| Module | Owns (tables) | Responsibility |
|---|---|---|
| `location` | `cities`, `areas` | City/area picker data |
| `categories` | `categories` | Category list, category filter |

**Composition modules** (read across other modules' tables, but only via one dedicated, reviewed SQL function per read — never via ad hoc cross-table app-code queries):

| Module | Composes | Backed by |
|---|---|---|
| `feed` | `events` + `rsvp` + `connections` | `get_home_feed` (SECURITY DEFINER, ranking logic lives in SQL) |
| `search` | `events` + `users` | `search_events`, `search_people` (SECURITY DEFINER) |

**Dormant** (schema exists, deny-all RLS, no client-facing module yet): `tags`, `event_tags`, `user_interests`. **Service-role only, not a client-facing module**: `activity_log`.

**Planned future modules** (not built yet — named here so the shape is anticipated, not invented under pressure later):
- `payments` — would own its own tables (e.g. `payments`, `transactions`), the M-Pesa integration and webhook handling, and expose functions like `chargeForEvent(...)` / `getPaymentStatus(...)`. `rsvp` (and possibly `events`) would call into `payments`'s public API rather than knowing anything about M-Pesa directly.
- `notifications` — if/when built, would likely sit downstream of most modules (connections accepted, event cancelled, etc.) rather than being depended on by them.

### Folder shape

```
src/modules/
  auth/
    index.ts            -- public API barrel; the ONLY file other modules may import from
    mutations.ts
    components/
  users/
    index.ts
    queries.ts
    mutations.ts
    validation.ts
    components/
    types.ts
  events/
    index.ts
    queries.ts
    mutations.ts
    validation.ts
    components/
    types.ts
  rsvp/
    index.ts
    queries.ts
    mutations.ts
    components/
  connections/
    index.ts
    queries.ts
    mutations.ts
    components/
  invites/
    index.ts
    queries.ts
    mutations.ts
  location/
    index.ts
    queries.ts
    components/
  categories/
    index.ts
    queries.ts
    components/
  feed/
    index.ts
    queries.ts
    components/
  search/
    index.ts
    queries.ts
    components/
```

Not every module needs every file — `location`/`categories` have no `mutations.ts` because no client mutation path exists.

### Shared / core layer (not a module)

```
src/shared/
  supabase/
    server.ts        -- server-side Supabase client
    client.ts         -- browser Supabase client
    middleware.ts
  images/             -- generic Sharp primitives only (buffer handling,
                         decompression-bomb guard). Domain-specific processing
                         (avatar 400x400 vs event cover 1200x630) lives in the
                         owning module (users/, events/), not here.
  security/
    rateLimit.ts
  anonSession.ts       -- localStorage-backed anonymous session id, used by
                          invites (click dedup) and feed (anonymous view logging)
  format/              -- only truly generic formatters; domain-specific
                          formatting (e.g. event date labels) lives in the
                          owning module
```

Shared/core has zero dependencies on any module. Any module (or `src/app`) may depend on shared/core.

### The boundary rule

**A module may only import from another module's `index.ts`.** Never `modules/connections/queries.ts` from inside `modules/feed/`, never `modules/events/components/EventCard` reached by deep path from another module — only what that module's `index.ts` explicitly re-exports.

- **Data ownership follows the table, not the page.** If a screen in one module needs data whose table belongs to another module, it calls a function exported from that module's `index.ts` — it does not run its own query against that table. Example: the profile page (owned conceptually by `users`) showing "events I'm hosting" calls `events.getEventsOrganizedBy(userId)` — it does not `supabase.from("events")` itself.
- **Components are more flexible than queries.** A component may live in the module building the page it appears on, even if it displays another module's data — as long as the data was fetched through that module's public function and typed against that module's exported type. The boundary that matters is the data fetch, not the JSX.
- **Composition modules (`feed`, `search`) are the one place cross-table reads happen at the app-code level** — but only through the one dedicated SQL function each already has. If a composition module ever needs a field its RPC doesn't return, the fix is extending that RPC (or calling another module's function), never adding a new direct table query.
- **`src/app` (the App Router tree) is not a module.** Pages and route handlers compose module `index.ts` exports and shared/core — no `supabase.from(...)`/`supabase.rpc(...)` calls, no business logic, no reaching into a module's internals.

### Correction: `queries.ts` is a server-only exception in every module

Every module's `queries.ts` uses the server Supabase client
(`shared/supabase/server.ts`), which depends on `next/headers` — an API
Next.js hard-fails on if it ends up anywhere in a Client Component's
module graph, **even via an unused named export inside a barrel's
`export *`.** Re-exporting `queries` from a module's `index.ts` alongside
that module's client-safe hooks/components was tried initially and broke
the build the moment any Client Component imported anything else from the
same barrel — the whole barrel file has to be evaluated to extract one
export, and that evaluation includes `next/headers` even if nothing calls
it.

So `queries.ts` gets the same treatment as `serverMutations.ts` below: **not
re-exported through any barrel.** Server Components, Route Handlers, and
other modules' own server-only files import a module's queries directly:

```ts
import * as eventsQueries from "@/modules/events/queries";
```

This means the boundary rule has two flavors depending on what's being
imported:
- Components, hooks, client-safe mutations, types, format helpers,
  validation, constants → through the module's `index.ts`, as normal.
- Query functions, and anything else that's genuinely server-only
  (`serverMutations.ts`) → direct file path, bypassing the barrel, always.

Any new module (including the upcoming peek work) should assume its
`queries.ts` is server-only from the start and never add it to that
module's barrel.

### Enforcement: ESLint-enforced

Boundaries are enforced by lint, not convention alone, so a bad import fails `npm run lint` before it's a problem. `eslint.config.mjs` now includes an `eslint-plugin-boundaries` configuration implementing this:

- Element type `moduleInternal`, pattern `src/modules/*/**`
- Element type `moduleIndex`, pattern `src/modules/*/index.ts`
- Element type `sharedLayer`, pattern `src/shared/**`
- Element type `appLayer`, pattern `src/app/**`
- Rule: `moduleInternal` may only import `sharedLayer`, its own module's other internals, or another module's `moduleIndex` (not its internal paths)
- Rule: `appLayer` may only import `sharedLayer` or a module's `moduleIndex`
- Rule: `sharedLayer` may not import `moduleInternal`, `moduleIndex`, or `appLayer`

**Not yet run against the live toolchain in the session that wrote it** — install with `npm install --save-dev eslint-plugin-boundaries`, then run `npm run lint`. Small syntax adjustments may be needed if the plugin's exact API has moved since this was written; treat it the same way as the reliable-but-unverified function entries in `docs/db/functions.md` until confirmed.

### Cleanup item resolved by this pass

`src/auth/` (the duplicate of `src/components/auth/`) no longer exists — it was deleted as part of the restructuring, keeping the `modules/auth/components/` versions.

---

## Component Model: Server-first

**Default to Server Components.** Only use Client Components (`"use client"`) when the component genuinely needs:
- Interactivity requiring `onClick` / `onChange` / other browser event handlers
- React state (`useState`, `useReducer`) or effects (`useEffect`)
- Browser-only APIs (`localStorage` for anon session IDs, `window`, etc.)
- Supabase auth state subscriptions (`onAuthStateChange`)

**Practical pattern:** most pages and cards render as Server Components that fetch data server-side and pass it as props into small Client "island" components for the interactive bits. Example: `EventCard` itself can be a Server Component; the "Going" button inside it is a separate small Client Component (owned by the `rsvp` module) that receives `eventId` and initial RSVP state as props.

**Do not** make an entire page or component client-side just because one button inside it needs interactivity — isolate the interactive part. This applies within a module the same way it applied before the module split.

---

## Data Access: Centralized query/mutation layer, per module

**Do not call `supabase.from(...)` or `supabase.rpc(...)` directly inside page or component files, and do not call it from a module other than the one that owns the table.** All Supabase access for a given table goes through that table's owning module, so:
- RPC call shapes are defined once and reused
- Supabase client instantiation (server vs. browser) is centralized in `shared/supabase/`
- Future changes to a query (e.g. retuning `get_home_feed` params, adding a field) touch one file, in one module
- It's always obvious which module to look in when a table's data looks wrong

### Conventions
- Every function in a module's `queries.ts`/`mutations.ts` takes plain parameters (ids, strings, etc.) and returns plain data — no Supabase-specific types leaking into components, and no Supabase-specific types leaking across module boundaries either.
- Every function handles its own error case and either returns a typed result or throws — pick one pattern and use it consistently (recommend: return `{ data, error }` shape, matching Supabase's own convention, so callers handle errors explicitly rather than needing try/catch everywhere).
- RPC-backed functions (e.g. `feed.getHomeFeed` calling `get_home_feed`) live alongside plain-table-query functions in the same module — the caller shouldn't need to know or care whether something is implemented as an RPC or a direct query.
- Client Components that need to mutate data (RSVP button, connect button) import from their owning module's `mutations.ts` (via `index.ts`) and call the function inside their event handler — they do not construct Supabase calls inline.
- Name query/mutation functions for what they do, not for which page calls them (`getEventsOrganizedBy`, not `getProfileCreatedEvents`) — a function's name shouldn't imply it belongs to a consuming page rather than its owning module.
- **Client-safe vs. server-only mutations are separate files within a module.** Any mutation that needs `sharp` (image processing) or other server-only work lives in that module's `serverMutations.ts`, imported only by that module's Route Handler(s) — never re-exported through the module's `index.ts` barrel, to avoid it being pulled into a Client Component's bundle. The module's `mutations.ts` holds the client-callable counterpart (a `fetch()` wrapper calling the Route Handler, or a direct Supabase call for mutations that need no server-only work, e.g. `cancelEvent`). See `modules/events/mutations.ts` + `modules/events/serverMutations.ts`, and `modules/users/mutations.ts` + `modules/users/serverMutations.ts`, for the pattern.
- **`queries.ts` is never barrel-exported, in any module** — see the "Correction" note under Modular Monolith Structure below for why (`next/headers` and Client Component bundles don't mix, even indirectly). Always import a module's queries by direct path: `import * as eventsQueries from "@/modules/events/queries"`.

---

## Supabase Client Setup

Two separate client instances are required under App Router — do not reuse one for both contexts:
- `shared/supabase/server.ts` — used only in Server Components, Route Handlers, and Server Actions. Reads cookies for session context.
- `shared/supabase/client.ts` — used only in Client Components. Standard browser client.

If a task requires a Route Handler (e.g. an OAuth callback, or a webhook), it goes under `app/api/.../route.ts`, uses the server client, and calls into the relevant module's `mutations.ts`/`queries.ts` rather than embedding logic in the route handler itself.

---

## Anonymous Session Handling (Invite Links / Anonymous Feed Viewers)

Anonymous session IDs (used for invite-link click dedup and anonymous event view tracking) are stored in `localStorage`, generated client-side on first visit if none exists. Since `localStorage` requires a Client Component, this logic lives in `shared/anonSession.ts` (generic — not owned by `invites` or `feed` specifically, since both depend on it) called from Client Components in those modules — not from Server Components, which cannot access `localStorage`.

---

## What NOT to do
- Don't scatter `createClient()` calls throughout the codebase — always import the shared instance from `shared/supabase/server.ts` or `shared/supabase/client.ts`.
- Don't put business logic (ranking, privacy filtering, dedup logic) in components — that belongs in the database function (already written server-side, e.g. `get_home_feed`) or in a module's `queries`/`mutations` layer, not in JSX.
- Don't create new Supabase RPC functions or Edge Functions without checking whether one already exists for that purpose first (see `docs/db/functions.md`).
- Don't use the Supabase service role key in any client-side or Client Component code, ever — service role usage is restricted to Edge Functions and trusted server-side contexts only (e.g. `activity_log` writes).
- Don't import another module's `queries.ts`, `mutations.ts`, or `components/` by deep path — only that module's `index.ts`.
- Don't add a direct cross-table query inside `feed` or `search` because the existing RPC doesn't return a field you need — extend the RPC, or call the owning module's function, instead.
- Don't name a query/mutation function after the page that happens to call it — name it after what it does, so it's obvious which module it belongs in regardless of caller.
