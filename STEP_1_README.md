# Livon — Step 1: Skeleton + Supabase Connection Test

This is the smallest possible working slice: Next.js App Router + Tailwind +
a Supabase client, wired together with **one page that proves the DB
connection works** (or tells you clearly why it doesn't).

## What's in here

- `src/lib/supabase/server.ts` — Supabase client for Server Components /
  Server Actions (per architecture: separate server client instance)
- `src/lib/supabase/client.ts` — Supabase client for Client Components
  (separate browser instance)
- `src/app/page.tsx` — connection test page. Queries one row from `cities`
  and shows one of three states: query error / connected-but-empty /
  connected-with-data.
- `.env.local.example` — template for your Supabase keys
- `docs/fr/` — drop your FR docs and `architecture.md` here
- `raw_html_and_css/` — your static HTML/CSS conversion source material,
  kept separate from `src/` so it's clear what's finished vs. raw

No auth, no other pages, no other tables touched yet. That's step 2
onward.

## Run it locally

```bash
# 1. unzip this folder wherever you keep projects, then:
cd livon
npm install

# 2. set up your env
cp .env.local.example .env.local
# edit .env.local with your real Supabase project URL + anon key

# 3. run it
npm run dev
```

Open http://localhost:3000.

## What "done" looks like for Step 1

- [ ] `npm run dev` starts with no errors
- [ ] Page loads at localhost:3000
- [ ] If your `cities` table exists but is empty → yellow "connected, no
      rows" message
- [ ] If you insert one test row into `cities` → green box showing that
      row's JSON
- [ ] If env vars are wrong/missing → red box with the actual Supabase
      error message (not a generic crash)

If you hit the red error box, that's not a failure — it's the test doing
its job. Read the error message; it'll usually be one of:
- Wrong URL/key in `.env.local`
- `cities` table doesn't exist yet (migrations not run on this project)
- RLS blocking anonymous SELECT on `cities` (check your policy allows
  public read for city/area lookups, per your locked schema)

## Deploying to Vercel (optional, once local works)

1. Push this folder to a GitHub repo (your project-specific account)
2. Import the repo in Vercel
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
   Vercel environment variables (same values as `.env.local`)
4. Deploy — the connection test page should show the same result in
   prod as it does locally

## Next step (Step 2, not yet built)

Auth — email + Google OAuth, session persisted across refresh, one
protected route. Don't start this until Step 1's checklist above is
fully green.
