# FR: Authentication

## Overview
Handles account creation, login, session management, email verification, and password reset. Two signup/login paths: email + password, and Google OAuth (via Supabase Auth). Reference UI: `index.html` (signup), `login.html` (login).

## Locked Decisions

- **Email domain:** open — any email address is accepted. City/Area is selected separately (not derived from email domain).
- **Username assignment (Google OAuth):** auto-generated from the Google profile display name at first login (slugified, deduped with a numeric suffix if taken, e.g. `thabo_m`, `thabo_m2`). Editable afterward in profile settings.
- **Email verification:** not required to browse. Required before a user can create an event, RSVP ("going"), or use Connections. Browsing the public feed requires no account at all.
- **Auth emails:** verification and password-reset emails use Supabase Auth's built-in flows, routed through Resend via custom SMTP configuration in Supabase (not custom Edge Functions).
- **Gated-action redirect:** any unauthenticated visitor attempting a gated action (Profile, RSVP, create event, Connections) is routed to the **signup** page, not login. A "Sign in" link is available from there for returning users.
- **Google/email account collision:** if a Google sign-in is attempted with an email that already has an existing email+password account, **auto-link by email** rather than erroring out or creating a duplicate account. Rationale: Google-supplied emails are already verified by Google, so linking on email match carries negligible impersonation risk, and campus-community MVP scale doesn't justify the added friction of a manual "confirm it's you" linking step. Concretely: Supabase Auth's identity linking treats the matched `auth.users` row as the same user and attaches the Google identity to it; the existing `public.Users` row (username, connections, etc.) is untouched and simply gains a second login method. If the existing account is unverified email+password, verify it automatically as part of the link (Google's verification satisfies the requirement).
- **Resend verification action location:** embedded directly in the blocking prompt/modal shown at the moment a user hits a gated action while unverified (not a separate settings-page action). Rationale: the user's intent to act (create event / RSVP / connect) is highest right there, so the resend option should be one tap away in that same moment rather than requiring them to navigate elsewhere and lose their place. A secondary "resend" link may also exist in account settings for completeness, but the primary surface is the in-context prompt.

## Signup — Email + Password

**Fields:** username, email, password, confirm password (per `index.html`).

- Username: 3–20 characters, lowercase alphanumeric + underscore only, unique case-insensitively across `Users`. Mutable later.
- Email: standard format validation, unique across `Users`/`auth.users`. No domain restriction.
- Password: minimum 8 characters. No additional complexity rules for MVP.
- Confirm password: must match password; client-side check before submit, not persisted.
- On submit: Supabase Auth creates the `auth.users` row; a corresponding `public.Users` row is created with the chosen username, `preferred_city_id`/`preferred_area_id` left null until set (see User Profile FR).
- A verification email is sent immediately (via Supabase Auth + Resend SMTP). Account exists and can log in / browse immediately; gated actions remain blocked until verified.

## Signup — Google OAuth

- Supabase Auth Google provider handles the OAuth handshake.
- On first login via Google, a `public.Users` row is created:
  - Email is taken from the Google profile (already verified by Google — treated as verified in `auth.users.email_confirmed_at` automatically).
  - Username is auto-generated from the Google display name (slugified, deduped as above).
- If the Google email matches an existing email+password account, the accounts are auto-linked (see Locked Decisions) rather than creating a second `public.Users` row.
- No password is set on a Google-only account; the account is Google-only unless the user later adds a password (out of scope for MVP unless requested).

## Login

**Fields:** identifier (username or email), password (per `login.html`).

- Identifier is checked against both username (case-insensitive) and email.
- On success: Supabase Auth issues a session (JWT + refresh token), persisted normally for the PWA. No separate "remember me" toggle — persistent session is the default.
- On failure: generic "incorrect username/email or password" message — do not reveal which field was wrong.

## Email Verification

- Verification state is **derived**, not stored separately: read from `auth.users.email_confirmed_at` at query/RLS time. No `email_verified` column on `public.Users`.
- Verification email sent via Supabase Auth + Resend SMTP at signup (email+password path only; Google accounts are pre-verified).
- Unverified users can browse freely but are blocked (with a prompt to verify) when attempting to:
  - Create an event
  - RSVP ("going") to an event
  - Use Connections (send/accept requests)
- A "resend verification email" action is available directly in the blocking prompt at the point of the gated action (see Locked Decisions), with a secondary copy in account settings.

## Password Reset

- Triggered from the "Forgot password?" link on the login page.
- Uses Supabase Auth's built-in `resetPasswordForEmail` flow, emailed via Resend SMTP.
- Reset link expiry follows Supabase Auth's configured default.
- No custom Edge Function required for this flow.

## Unauthenticated Access

- Public event feed and event details are viewable with no account (per locked decision).
- Any attempt at a gated action (Profile, RSVP, create event, Connections) while unauthenticated redirects to the **signup** page, with a visible "Sign in" link for users who already have an account.

## Data Model Notes

- `auth.users` (Supabase-managed): email, password hash, `email_confirmed_at`, OAuth identity linkage. No custom `password_hash` column anywhere in `public` schema.
- `public.Users`: `user_id` (FK → `auth.users.id`), `username` (unique, case-insensitive), `preferred_city_id`, `preferred_area_id` (nullable FKs, set post-signup — see User Profile FR).
- Username uniqueness should be enforced via a case-insensitive unique index (e.g. `create unique index on users (lower(username))`), not a plain `unique` constraint.

## Open Items

- None currently blocking. Whether Google-only accounts can later add a password is deferred — flag if needed before MVP ships.

## Non-Goals (MVP)

- Two-factor authentication
- Social providers other than Google
- "Remember me" as a user-facing toggle (session is always persistent)
- Account deletion / deactivation flows
