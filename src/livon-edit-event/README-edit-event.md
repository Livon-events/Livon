# Edit event — new route, same form, plus Cancel Event

## What this is

A new route, `/events/[id]/edit`, reusing the exact same `CreateEventForm`
and `CreateEventPage` shell as `/create-event` — no second form was built.
The form now takes a `mode` prop (`"create"` | `"edit"`) that switches:
pre-filled values vs. empty, `updateEvent` vs. `createEvent` on submit,
button copy ("Save Changes" vs. "Publish Event"), and whether the
location-toggle gate applies (only on create — see below). A "Cancel
Event" button also appears, edit-mode only.

The profile's wrench/"manage" button on a Created event now actually does
something — it navigates here instead of being a no-op.

## New files

- `src/app/events/[id]/edit/page.tsx` — the new route. Auth guard, fetches
  the event via `getEventForEdit` (ownership-checked — see below),
  fetches categories, renders the shared shell in edit mode.
- `src/app/api/events/[id]/route.ts` — `PATCH` handler. Same
  auth/CSRF/rate-limit/content-type guards as the existing `POST
  /api/events`, plus an ownership check before anything else (403 if
  you're not the organizer, 404 if the event doesn't exist — same
  treatment for both, so this can't be used to probe which event ids are
  real). Only replaces the cover image if a new file was actually
  submitted; otherwise `cover_image_url` is left completely untouched.
  Deletes the *old* uploaded image from Storage after a successful
  replacement (never before — so a failed update can't leave you with
  neither image).
- `src/lib/events/parseEventForm.ts` — the text-field validation (zod +
  category re-check + date sanity bounds) extracted out of `POST
  /api/events` into a shared function, so create and edit can't quietly
  drift apart on what counts as valid input. `POST /api/events` was
  refactored to use this too — same behavior as before, just no longer
  duplicated.

## Changed

- `src/lib/queries/events.ts` — added `getEventForEdit(eventId, userId)`,
  returns the event pre-shaped for the form (derives `admission`/`price`
  from the stored `price` column — there's no separate admission-type
  column).
- `src/lib/mutations/events.ts` — added `updateEvent` (thin wrapper around
  the new PATCH route, same "sharp needs a server context" reasoning as
  `createEvent`) and `cancelEvent` (a plain client-side RLS-protected
  status update — no image involved, so no Route Handler needed, same
  pattern as `markNotGoing`).
- `src/components/events/create/CreateEventForm.tsx` — `mode`/`eventId`/
  `initialValues` props, pre-fills all fields when editing, calls
  `updateEvent` instead of `createEvent`, adds the Cancel Event button.
- `src/components/events/create/CreateEventPage.tsx` — threads the new
  props through, header reads "Edit Event" in edit mode.
- `src/components/profile/UserProfilePage.tsx` — wrench button now calls
  `router.push('/events/{id}/edit')` instead of doing nothing.

## Decisions worth knowing about

- **City/area are never touched on edit.** They were resolved once at
  creation from the organiser's location preference at that time
  (`docs/FR/location-toggle.md`). Re-resolving them on every edit would
  silently move a past event to a different city/area if the organiser's
  preference happened to change in between — editing "the event details"
  shouldn't do that. So the location-toggle gate/banner only shows on
  create, not edit.
- **Cancel is a soft cancel** (`status = 'cancelled'`, `cancelled_at =
  now()`), never a delete — matches `docs/db/schema.md`'s "archival over
  deletion" note. There's no "un-cancel" in the UI. RLS's
  `events_delete_own_if_no_interest` policy would actually allow a *real*
  delete when nobody's expressed interest yet, but I didn't expose that as
  a separate option — you only asked for cancel, and one clear action
  seemed better than two overlapping ones for now. Say so if you want a
  true "delete" path added for that no-interest-yet case.
- New cover photo on edit: old Storage object is only deleted **after**
  the DB update succeeds — so a failed save can never leave an event with
  neither its old nor new image.

## Testing note

Validated with `tsc --noEmit` (clean), `eslint` (clean, including a
full-project pass — the only hit is the same pre-existing
`EventCardHead.tsx` issue flagged before, untouched by this change), and a
`next dev` smoke test confirming: the edit route redirects to login when
signed out, `PATCH` returns 401 unauthenticated and 403 cross-origin.
Couldn't exercise an actual authenticated edit/cancel against your live
data from this environment — worth confirming end-to-end: edit an event's
title/photo, confirm the change shows on its details page, then try
Cancel Event and confirm its status flips without the row disappearing.
