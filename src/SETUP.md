# Step 2 — Auth: setup & handoff notes

## What's in this zip

Only new/changed files, matching your existing `src/` layout — safe to drop
straight into `C:\Livon` without touching your Step 1 skeleton.

```
src/lib/supabase/client.ts       browser Supabase client
src/lib/supabase/server.ts       server Supabase client (Server Components / Route Handlers)
src/lib/supabase/middleware.ts   session-refresh helper
src/middleware.ts                Next.js middleware entry — refreshes the auth cookie on every request
src/lib/mutations/auth.ts        signUpWithEmail, signInWithEmail, signInWithGoogle, signOut
src/app/(auth)/layout.tsx        loads Space Grotesk + Inter as CSS vars for the auth pages
src/app/(auth)/auth.css          ported 1:1 from raw_html_and_css/login/styles.css
src/app/(auth)/login/page.tsx    /login — matches login.html structure exactly
src/app/(auth)/signup/page.tsx   /signup — matches index.html structure exactly
src/app/auth/callback/route.ts   OAuth/PKCE code-exchange redirect handler
src/app/profile/page.tsx         the one protected route for this task
src/components/auth/*.tsx        client components: LoginForm, SignupForm, GoogleSignInButton, SignOutButton
.env.local.example               copy to .env.local and fill in
```

If your project already has `src/lib/supabase/client.ts` / `server.ts` from
Step 1, these versions are drop-in replacements (same shape, nothing exotic
added) — diff them if you want to confirm before overwriting.

## 1. Install dependencies

```
npm install @supabase/ssr @supabase/supabase-js
```

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase project's
URL and anon key (Supabase dashboard → Settings → API).

## 3. Enable Google OAuth

In the **Supabase dashboard** → Authentication → Providers → Google:

- Enable the provider, paste in your Google OAuth Client ID and secret.
- Note the callback URL Supabase shows you (something like
  `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).

In the **Google Cloud Console** → APIs & Services → Credentials → your OAuth
client:

- Add the Supabase callback URL above to **Authorized redirect URIs**.
- Add `http://localhost:3000` to **Authorized JavaScript origins** for local dev.

You do NOT need to add `http://localhost:3000/auth/callback` to Google's
console — that redirect happens between your app and Supabase, not Google
directly. Google only ever redirects back to Supabase's URL.

## 4. Run it

```
npm run dev
```

- `/signup` — create an account with email+password.
- `/login` — sign in with username-or-email+password, or Google.
- `/profile` — protected route; redirects to `/login` if not signed in.

## What I verified in the sandbox

- `tsc --noEmit`: clean.
- `eslint`: clean.
- `next build`: compiles and generates all 5 routes correctly. The one build
  error I saw was Google Fonts being unreachable from my sandbox's restricted
  network (not from your machine) — I confirmed this by temporarily stripping
  the `next/font` calls and rebuilding, which succeeded structurally. This
  will build fine for you with normal internet access.
- I could not test an actual Google OAuth round-trip or a real Supabase
  project (only placeholder env vars in the sandbox) — please run through
  the checkpoint below once you've filled in real credentials.

## Decisions made / things to know

- **Login/signup are two separate routes** (`/login`, `/signup`), matching
  `login.html`/`index.html` being two separate files — not a tab toggle.
- **`resolve_login_email` RPC**: `signInWithEmail` calls this first to turn
  a username-or-email identifier into an email, then calls
  `signInWithPassword`. Any failure (RPC error, or identifier not found)
  returns the same generic "Incorrect username/email or password" message —
  no branching that could leak whether an identifier exists.
- **`handle_new_user` trigger**: `signUpWithEmail` only calls
  `supabase.auth.signUp()` — it never inserts into `public.users` directly,
  per your task notes. The username is passed in `options.data` so the
  trigger has it available if it reads `raw_user_meta_data`. Worth
  double-checking your trigger actually reads it from there.
- **"Forgot password?" link**: present in the markup (matching the design)
  but not wired to anything — password reset is explicitly out of scope for
  this task, per `task-auth.md`.
- **Navbar, seed script**: intentionally not included — you scoped this
  round to core auth only.
- Small additions beyond the original CSS: `.field-error`, `.form-error`,
  `.form-notice` classes for validation/error states, styled to match the
  existing design language (yellow accent, dark card) since the source
  markup didn't include error states.

## Checkpoint to run once your Supabase project is wired up

1. Sign up with a test email+password at `/signup` → should land on `/profile`
   (or show the "check your inbox" notice if email confirmation is on).
2. Refresh `/profile` → should stay logged in (this is the middleware doing
   its job).
3. Click "Continue with Google" → complete Google's consent screen → should
   land back on `/profile`.
4. Sign out from `/profile` → should redirect to `/login`.
5. Visit `/profile` directly while logged out → should redirect to `/login`.
