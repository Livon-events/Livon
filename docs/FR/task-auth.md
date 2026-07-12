# Task: Auth (Signup, Login, Google OAuth)

## Before you start
Read `architecture.md` first — this task follows those conventions (Server Components by default, Client Components only for interactive pieces, all Supabase access through `lib/queries/` and `lib/mutations/`, separate server/browser Supabase clients).

## Scope
Build working authentication end to end: email/password signup, email/password login, Google OAuth, and session-aware Navbar state. This task also includes seeding minimal test data so later tasks (Home Feed, EventCard, etc.) have something real to work against.

Out of scope for this task: password reset flow, email verification UI polish, "remember me" options — build the minimal working path only, note anything skipped in your summary.

## Design source
- Page: `raw_html_and_css/login/` — convert this HTML/CSS directly into the Next.js login/signup page. This is the visual and structural source of truth; don't redesign it.
- No mockup image was provided separately for this page — the HTML/CSS folder is the only reference. If anything in the markup is ambiguous (e.g. is signup a separate page or a toggle on the same page?), make the simplest reasonable choice and note it in your summary rather than guessing silently.

## What already exists (do not recreate)
- `public.users` table with `user_id` as a foreign key to `auth.users(id)`.
- A `handle_new_user` trigger already in the database that should auto-populate `public.users` on signup. **Do not manually insert into `public.users` from client code** — verify the trigger does this.
- RLS policies are already in place on all tables. Do not modify RLS. If something seems incorrectly blocked, report it in your summary — do not bypass with the service role key from client code.

## Build steps

1. **Supabase client setup** (per `architecture.md`):
   - `lib/supabase/server.ts` — server-side client for Server Components / Route Handlers.
   - `lib/supabase/client.ts` — browser client for Client Components.

2. **Login/Signup page** — convert `raw_html_and_css/login/` into `app/login/page.tsx` (or `app/(auth)/login/page.tsx` if you're using route groups — your call, but be consistent with the rest of the app).
   - Email/password signup and login. These can be two forms/tabs on one page, or two routes — follow whatever the HTML/CSS source suggests; if it only shows one form, add the other with matching visual style.
   - Google OAuth button, wired to Supabase's Google provider.
   - Form submission logic belongs in a Client Component (needs `onSubmit`/state); the page shell around it can remain a Server Component if practical.

3. **Session-aware Navbar.**
   - Convert whichever of `header` / `phone_header` / `laptop_header` / `phone_navbar` is appropriate (there may be separate mobile/desktop variants — use both if the codebase needs responsive handling, or pick the mobile-first one if you're building mobile-first per the PWA target).
   - Navbar should reflect logged-in vs. logged-out state (e.g. profile icon + logout vs. login/signup link). Use `onAuthStateChange` in a Client Component for this — per `architecture.md`, this is one of the explicit reasons a component needs to be client-side.

4. **Auth data-access functions** — add to `lib/mutations/auth.ts` (new file): `signUpWithEmail`, `signInWithEmail`, `signInWithGoogle`, `signOut`. Components call these, not raw `supabase.auth.*` calls directly.

## Seed Test Data
(Needed so later tasks — Home Feed, EventCard, RSVP — have real data to work against.)

Create the following, using the real signup flow you just built (not direct table inserts, so `handle_new_user` actually fires):

- **4 test users:** `test.alice@livon.live`, `test.bob@livon.live`, `test.carla@livon.live`, `test.dave@livon.live` (any password, dev-only data).
- **Cities/Areas/Categories** — check first if any rows already exist (`select * from cities;` etc). If empty, create 1 city (e.g. "Johannesburg"), 2 areas within it (e.g. "Braamfontein", "Rosebank"), and at least 2 categories (e.g. "Night life", "Sport" — match the category selector pills shown in the header mockup if helpful).
- **5-6 events:** at least 2 organized by Alice, at least 1 by Bob, rest by Carla/Dave. Spread across both areas and both categories. Mix of past and future `starts_at` (at least 1 past, at least 3 future). All `status = 'active'`. Realistic-ish titles/venue names; placeholder cover images (e.g. `picsum.photos` URLs) are fine.
- **2 accepted connections:** Alice ↔ Bob (`status = 'accepted'`), Carla ↔ Dave (`status = 'accepted'`). Leave other pairs unconnected — this asymmetry is intentional for later ranking tests.
- **event_interests (RSVPs):** Bob marks going on one of Alice's events, `visibility = 'visible'`. Carla and Dave both mark going on one of Bob's events — one `visible`, one `private`. A few more arbitrary RSVPs elsewhere so counts vary across events.

All seed data should go through real insert paths that respect RLS (i.e. as a logged-in test user via the client, not a service-role bypass) wherever RLS allows it. If a step is genuinely impossible without service-role access, use the SQL editor for just that step and note which step needed this in your summary.

## Checkpoint — verify before considering this task done
1. Query `select * from public.users;` — confirm 4 rows exist matching the seeded signups.
2. Query `select * from events;`, `select * from connections;`, `select * from event_interests;` — confirm the seed data matches what's described above.
3. Log in as one seeded user through the actual UI you built and confirm the Navbar correctly reflects the logged-in state.
4. Log out and confirm the Navbar reverts to logged-out state.

## Report back
1. Confirm the 4 users exist in `public.users` (paste the query result).
2. Paste the actual `user_id`, `event_id`, `city_id`, `area_id` values created — later tasks will need these for testing.
3. Any RLS policy that blocked expected behavior, and what you did about it.
4. Any part of the `login` HTML/CSS source that was ambiguous and how you resolved it.
5. Anything you were unable to complete and why.
