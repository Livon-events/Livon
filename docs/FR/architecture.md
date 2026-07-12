# Architecture Reference

This is a standing reference for how the Livon Next.js app is structured. Every task file assumes this architecture — read this once before starting any task, and follow these conventions rather than inventing new patterns per feature.

---

## Stack
- **Framework:** Next.js, App Router (not Pages Router).
- **Backend:** Supabase (Postgres + Auth + Storage), accessed via `@supabase/supabase-js` and `@supabase/ssr` for App Router-compatible server/client splitting.
- **Styling:** Tailwind CSS.
- **Icons:** Lucide React.
- **Email:** Resend (server-side only, e.g. inside Edge Functions or Route Handlers — never call Resend from client code).
- **Image processing:** `sharp`, server-side only (event covers, avatars).

---

## Component Model: Server-first

**Default to Server Components.** Only use Client Components (`"use client"`) when the component genuinely needs:
- Interactivity requiring `onClick` / `onChange` / other browser event handlers
- React state (`useState`, `useReducer`) or effects (`useEffect`)
- Browser-only APIs (`localStorage` for anon session IDs, `window`, etc.)
- Supabase auth state subscriptions (`onAuthStateChange`)

**Practical pattern:** most pages and cards render as Server Components that fetch data server-side and pass it as props into small Client "island" components for the interactive bits. Example: `EventCard` itself can be a Server Component; the "Going" button inside it is a separate small Client Component that receives `eventId` and initial RSVP state as props.

**Do not** make an entire page or component client-side just because one button inside it needs interactivity — isolate the interactive part.

---

## Data Access: Centralized query/mutation layer

**Do not call `supabase.from(...)` or `supabase.rpc(...)` directly inside page or component files.** All Supabase access goes through a thin wrapper layer in `lib/`, so:
- RPC call shapes are defined once and reused
- Supabase client instantiation (server vs. browser — these require different setup in App Router) is centralized
- Future changes to a query (e.g. retuning `get_home_feed` params, adding a field) touch one file, not every caller

### Folder structure
```
lib/
  supabase/
    server.ts        -- server-side Supabase client (for Server Components, Route Handlers)
    client.ts         -- browser Supabase client (for Client Components)
  queries/
    events.ts         -- read operations: getHomeFeed, searchEvents, getEventDetails, getEventGoingCount
    users.ts          -- read operations: searchUsers, getUserProfile
    connections.ts     -- read operations: getConnectionStatus, getConnectionsList
  mutations/
    rsvp.ts           -- setGoing, setRsvpVisibility, removeGoing
    connections.ts     -- sendConnectionRequest, acceptConnectionRequest
    events.ts          -- createEvent, cancelEvent, deleteEvent
    invites.ts          -- createInviteLink, redeemInvite
```

### Conventions
- Every function in `queries/` and `mutations/` takes plain parameters (ids, strings, etc.) and returns plain data — no Supabase-specific types leaking into components.
- Every function handles its own error case and either returns a typed result or throws — pick one pattern and use it consistently (recommend: return `{ data, error }` shape, matching Supabase's own convention, so callers handle errors explicitly rather than needing try/catch everywhere).
- RPC-backed functions (e.g. `getHomeFeed` calling `get_home_feed`) live in `queries/events.ts` alongside plain-table-query functions — the caller shouldn't need to know or care whether something is implemented as an RPC or a direct query.
- Client Components that need to mutate data (RSVP button, connect button) import from `mutations/` and call the function inside their event handler — they do not construct Supabase calls inline.

---

## Supabase Client Setup

Two separate client instances are required under App Router — do not reuse one for both contexts:
- `lib/supabase/server.ts` — used only in Server Components, Route Handlers, and Server Actions. Reads cookies for session context.
- `lib/supabase/client.ts` — used only in Client Components. Standard browser client.

If a task requires a Route Handler (e.g. an OAuth callback, or a webhook), it goes under `app/api/.../route.ts` and uses the server client.

---

## Anonymous Session Handling (Invite Links / Anonymous Feed Viewers)

Anonymous session IDs (used for invite-link click dedup and anonymous event view tracking) are stored in `localStorage`, generated client-side on first visit if none exists. Since `localStorage` requires a Client Component, this logic lives in a small client-side utility (e.g. `lib/anonSession.ts`) called from Client Components — not from Server Components, which cannot access `localStorage`.

---

## What NOT to do
- Don't scatter `createClient()` calls throughout the codebase — always import the shared instance from `lib/supabase/server.ts` or `lib/supabase/client.ts`.
- Don't put business logic (ranking, privacy filtering, dedup logic) in components — that belongs in the database function (already written server-side, e.g. `get_home_feed`) or in the `queries`/`mutations` layer, not in JSX.
- Don't create new Supabase RPC functions or Edge Functions without checking whether one already exists for that purpose first (see existing docs: `feed_ranking_function.sql`, `auth_and_seed_data.md` reference existing functions like `redeem_invite`, `event_going_count`).
- Don't use the Supabase service role key in any client-side or Client Component code, ever — service role usage is restricted to Edge Functions and trusted server-side contexts only (e.g. `activity_log` writes).
