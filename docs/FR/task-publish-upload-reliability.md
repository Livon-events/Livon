# Task: Publish/upload reliability on weak networks

**Status:** Phase 1 and Phase 3 (JSON-to-origin) implemented 2026-08-14;
production network verification still required. Phase 2 and section 6
were not done — both remain optional.

Organizers on Wi-Fi hit `Network error — please check your connection and
try again.` when publishing an event. The cause has been isolated to the
upload transport, not to any application logic. This doc records the
evidence, the diagnosis, the plan, and the open question — read all of
section 1 before changing code, because several "obvious" fixes are wrong
here.

---

## 1. What the investigation established

### The error can only come from one place

`modules/events/mutations.ts` produces that exact string in a single
`catch` around `fetch` (line 61). It is returned **only when `fetch`
itself throws** — i.e. no HTTP response was ever received. Every
server-side failure path produces a different message:

| Failure | Message the organizer sees |
|---|---|
| 413 declared body too large | "Request is too large." |
| 401 not signed in | "You must be signed in to create an event." |
| 429 rate limited | "Too many events created recently…" |
| 400 validation / bad image | the specific field or image message |
| 500 storage or insert failure | "Could not upload the cover image…" |
| any non-JSON error response | "Could not create the event. Please try again." |

So the reported error rules out auth, validation, `sharp`, Supabase
Storage, RLS, the rate limiter, and the Vercel body-size limit.

### Vercel logs confirm the requests never arrived

- Filtering `route:/api/events` over a full week returns **8 POSTs, all
  201**. There is not one 4xx or 5xx in the window.
- An organizer's error screenshot is timestamped 12:39 on Aug 11. There
  is **no log entry at 12:39** — the request never reached the edge.
- Her successful publish is the `POST 201` at **12:47:30**, which
  happened only after she was moved onto a phone hotspot. The surviving
  `public.events` row has `created_at = 2026-08-11 10:47:33 UTC`
  (= 12:47:33 local, UTC+2), confirming it is the same event and that the
  **entire server pipeline — sharp decode, resize, WebP encode, storage
  upload, insert — takes about 3 seconds.**
- `/api/profile` (only ever reached by a multipart `PATCH`) does appear in
  the same log view, so the absence of the failed POSTs is real and not a
  filtering artifact.
- There are **no POSTs to `/api/events` on Aug 12, 13 or 14 at all.** The
  organizer from the second screenshot ("Lehipi chillout", 21:39 Aug 13)
  never published. Worth contacting her directly — a plain retry may
  simply work.

### Diagnosis

Publishing depends on a single uninterrupted `multipart/form-data` POST
carrying the **raw, unmodified** image the organizer picked — up to 5 MB,
with no client-side downscaling, no timeout, no retry, and no progress
feedback. On the affected Wi-Fi that upload never completes; on mobile
data it completes in about three seconds. Pattern is all-or-nothing per
network, which fits any of:

1. an uplink too slow or lossy to push several megabytes before something
   in the path resets the connection (most likely);
2. a captive portal or filtering proxy refusing or breaking the large
   POST;
3. QUIC / UDP 443 being blocked or mangled so the upload can't complete.

All three are mitigated by making the payload roughly ten times smaller.
Only (2) and (3) would additionally require moving the transfer off our
own function.

### Open question — resolved after Phase 1

Someone on the failing Wi-Fi published after Phase 1 (downscaled cover,
still multipart to `/api/events`). It failed immediately. Multiple tiny
`/api/client-errors` JSON beacons reached Vercel within seconds while no
`/api/events` request arrived. That is the conditional case in the
original write-up: this network rejects the **multipart** transfer to the
Vercel host, not merely a large body.

That does **not** by itself prove the file must leave our origin. The
beacons already showed that JSON to Vercel gets through. Phase 3
therefore sends the downscaled cover as JSON to `/api/events`. Direct
upload to Supabase Storage remains the fallback if that JSON POST also
dies on the same Wi-Fi.

---

## 2. Scope

### Do not change

These are working and are load-bearing for security. Nothing in the
investigation implicates any of them.

- `modules/events/images.ts` — byte-sniffing format detection, the 30 MP
  decompression-bomb budget, the 6000 px dimension cap, EXIF stripping,
  WebP re-encode. **This remains the authoritative validation boundary.**
  Client-side resizing is a bandwidth optimization only; it must never be
  treated as a reason to trust the uploaded bytes or to skip the server
  pipeline.
- `IMAGE_MAX_BYTES` enforcement in `app/api/events/route.ts` and
  `modules/events/images.ts`.
- `createEventOnServer` validation order, storage rollback on insert
  failure, the rate limiter, RLS.
- The `mutations.ts` / `serverMutations.ts` split and the module boundary
  rules in `docs/FR/architecture.md`.

### Change

Client-side, plus the existing event routes:

1. Downscale and re-encode the cover in the browser before uploading.
2. Add a request timeout and honest, actionable failure messages.
3. Give the organizer an explicit "Try again" that doesn't lose the form.
4. (Optional, recommended) report client-side upload failures so they
   stop being invisible in the logs.
5. Phase 3: send the downscaled cover as JSON to `/api/events`, not as
   `multipart/form-data`. Keep `sharp` as the validation boundary.

---

## 3. Phase 1 — shrink the payload and fail honestly

### 3.1 New shared helper: browser image downscaling

**File:** `src/shared/images/downscaleImageInBrowser.ts` (new).

`src/shared/images/` does not exist yet. `docs/FR/architecture.md` already
reserves that path, but describes it as "generic Sharp primitives only",
which is server-side — either widen that sentence or give this a
clearly distinct filename. It belongs in `shared` rather than in a module
because both `events` (cover) and `users` (avatar) need it, and the
boundary lint allows any module to import `src/shared/**` while
forbidding `shared` from importing modules — which this helper doesn't
need to do.

Shape:

```ts
export type DownscaleOptions = {
  maxEdge: number;        // events: 1600 (matches server OUTPUT_MAX_*)
  quality: number;        // 0.9 — leaves headroom for the server re-encode
  skipUnderBytes: number; // e.g. 600 * 1024
};

export async function downscaleImageInBrowser(
  file: File,
  options: DownscaleOptions
): Promise<File>;
```

Behaviour requirements, in order of importance:

- **Never block publishing.** Any failure — unsupported API, decode
  error, canvas returning null — must fall back to returning the original
  `file` unchanged. A failed optimization must not become a failed
  publish.
- **Skip when pointless.** If `file.size <= skipUnderBytes` and the
  longest edge is already `<= maxEdge`, return the original. Avoids a
  needless re-encode of already-small images.
- **Preserve EXIF orientation.** This is the main regression risk. Today
  the server calls `.rotate()` to bake in EXIF orientation, and phone
  photos rely on it. Canvas re-encoding strips EXIF, so if the client
  draws without applying orientation, the server has nothing left to
  correct and portrait photos will publish sideways. Use
  `createImageBitmap(file, { imageOrientation: "from-image" })` where
  available, and **verify on a real EXIF-rotated phone photo** — do not
  assume.
- **Fall back across encoders.** Request `image/webp`; if the returned
  blob's `type` is not `image/webp` (some older Safari/Android builds
  silently produce PNG, which would be *larger* than the original),
  re-encode as `image/jpeg` at ~0.85. Both are already in
  `ALLOWED_IMAGE_MIME`, so the server accepts either.
- **Fall back across decoders.** `createImageBitmap` then plain
  `<img>` + `img.decode()`; plain `<canvas>` + `toBlob` rather than
  `OffscreenCanvas`, since broad old-Android support is the entire point.
- **Never enlarge.** Mirror `withoutEnlargement: true`.
- Return a `File` (not a bare `Blob`) with a sane name and correct type,
  so the existing `formData.set("cover", file)` call sites are unchanged.

Expected effect: a 4 MB poster screenshot becomes roughly 250–400 KB.

### 3.2 Call sites

Downscale at submit time, not at pick time, so the preview stays instant
and a slow phone doesn't stall the picker:

- `modules/events/mutations.ts` → `createEvent` (line 51) and
  `updateEvent` (line 115), just before `formData.set("cover", …)`.
- `modules/users/mutations.ts` → `updateProfile` (line 41) for avatars.
  Same fragility, same fix, smaller payoff (avatars are already small);
  use the `users` module's own target dimensions, not the event cover's.

Putting it in `mutations.ts` rather than in `CreateEventForm` means every
current and future caller gets it, and matches the existing convention
that the form never shapes the request itself.

### 3.3 Timeout and honest error messages

In both `createEvent` and `updateEvent`:

- Wrap the `fetch` in an `AbortController` with a generous timeout —
  60 s is very forgiving for a ~300 KB body when the successful
  server round trip is about 3 s.
- Replace the bare `catch {` (which currently swallows the underlying
  error entirely, so even a developer with devtools open sees nothing)
  with `catch (error)`, and log it.
- Distinguish the cases instead of calling everything a network error:
  - `!navigator.onLine` → "You appear to be offline. Reconnect and try
    again."
  - `AbortError` → "The upload took too long and was stopped. Try again,
    or switch to mobile data."
  - anything else → "The upload was interrupted before it finished. This
    can happen on slow Wi-Fi — try again, or switch to mobile data."

That last message is the one these organizers should have seen. It is
both accurate and points at the workaround that actually worked.

### 3.4 "Try again" in the form

`CreateEventForm.tsx` already keeps all state on failure (`handleSubmit`
sets `errors.form` and returns, line 303), so nothing is lost — but the
error block at line 364 is static text. Add a "Try again" button inside
that block that re-runs the submit. Cheap, and it converts a dead end
into a retry, which is exactly what unblocked the 12:47 publish.

**Do not add automatic retry in this phase.** A transport failure means
no response was received, which does not strictly prove the server didn't
process the request — so blind retrying a create risks duplicate events.
See Phase 2 for how to do it safely.

### 3.5 Optional but recommended: make client failures visible

The entire diagnosis above had to be inferred from *absent* log lines.
A tiny `POST /api/client-errors` route accepting a few hundred bytes of
JSON (route, error name, `navigator.onLine`, `connection.effectiveType`,
original and uploaded byte sizes — no PII), called with
`keepalive: true`, would make these failures appear in Vercel logs
directly. Reuse `shared/security/rateLimit.ts`. Note that such a beacon
is small enough to survive the same uplink that kills the upload.

### 3.6 Not worth attempting

A real upload progress bar needs `XMLHttpRequest` —
`fetch` cannot report request-body progress. Don't burn time trying.
Once the payload is ~300 KB it matters much less; an indeterminate
"Uploading…" state on the submit button is enough.

---

## 4. Phase 2 (optional) — safe automatic retry

Only worth doing if Phase 1 leaves residual failures. Automatic retry of
a create is only safe with an idempotency guard. Two options:

- **Natural key, no schema change (recommended):** in
  `createEventOnServer`, before inserting, look for an existing event by
  the same organizer with the same `title` and `starts_at` created in the
  last ~10 minutes; if found, return that `event_id` as success. Makes a
  duplicate submission idempotent from the organizer's point of view.
- **Client-supplied idempotency key (more rigorous):** client generates a
  UUID per submit attempt, sends it as a form field, server stores it
  with a unique constraint. Costs a migration; see `docs/db/schema.md`.

With one of those in place, a single automatic retry on transport failure
becomes safe.

## 5. Phase 3 (conditional) — stop sending multipart to our host

Do this **only** if the small-image test in section 1 shows the POST
failing regardless of size, which would mean a middlebox is refusing it.

The original write-up's next step was a signed upload URL to Supabase
Storage, then a small JSON POST of the object path to `/api/events`. That
is still the fallback if JSON to our own host also fails. It is a
significant change: the server would no longer see the bytes before they
land in storage, so the `sharp` validation boundary must be preserved
some other way, and it adds a staging bucket, a second host, and orphaned
objects. Do not start that without re-reading section 2's "do not change"
list.

### Implemented outcome

After Phase 1, the affected phone still produced immediate transport
failures on multipart `/api/events`, while tiny JSON beacons arrived.
The client now downscales the cover, encodes it as base64, and POSTs
small JSON to `/api/events` (PATCH for edits). The route reconstructs a
`File` and hands it to the unchanged `createEventOnServer` /
`updateEventOnServer` pipeline, so `sharp` still sees the bytes before
anything is stored publicly. Legacy multipart is still accepted so a
cached client is not stranded.

If a publish on the failing Wi-Fi still never appears under
`route:/api/events`, the signed-URL path above is the next step.

## 6. Optional follow-up: accept bigger source images

Once the client downscales, the 5 MB *source* limit is no longer needed
to protect the upload — the server would only ever receive the ~300 KB
result. Raising it would help organizers whose camera photos currently
get rejected outright, and would sidestep the 6000 px server dimension
cap too. Deliberate decision, not a silent one: it changes the helper
text at `CreateEventForm.tsx` line 402 ("up to 5MB") and the meaning of
`IMAGE_MAX_BYTES`, which is currently shared by client and server. If it
changes, the two limits must become two clearly named constants (source
limit vs uploaded-payload limit), not one reused number.

---

## 7. Verification checklist

- [ ] EXIF-rotated portrait phone photo publishes with correct
      orientation (the main regression risk — see 3.1).
- [ ] Cover quality on the feed card and details page is still acceptable
      after client WebP → server WebP double encode. If visibly soft,
      raise the client quality rather than lowering the server's.
- [ ] Already-small image (< 600 KB) is uploaded untouched.
- [ ] Simulated downscale failure still publishes, using the original
      file.
- [ ] Publish succeeds under devtools "Slow 3G" throttling with a 4 MB
      source image; compare against `main`, where it should fail.
- [ ] Offline, timeout, and interrupted-upload paths each produce their
      own message.
- [ ] "Try again" resubmits without losing any typed field or the picked
      photo.
- [ ] Edit-event cover replacement and avatar upload both still work.
- [x] `npm run lint` passes, including the `boundaries` rules.
- [ ] After deploy, a real publish from the failing Wi-Fi appears as
      `POST 201` under `route:/api/events` in Vercel logs. If it still
      never arrives, JSON-to-origin was not enough — do the signed-URL
      fallback in section 5.

---

## 8. Context for the next agent

**Read first:**

- `AGENTS.md` — **this repo is on Next.js 16 (`^16.2.12`), which differs
  from most training data.** Read the relevant guide in
  `node_modules/next/dist/docs/` before writing any Next-specific code.
  Note this app uses `src/proxy.ts` (not `middleware.ts`).
- `docs/FR/architecture.md` — modular monolith, the boundary rule, and
  the client-safe `mutations.ts` vs server-only `serverMutations.ts`
  split. Boundaries are lint-enforced via `eslint.config.mjs`
  (`eslint-plugin-boundaries`): a module may import `src/shared/**`, its
  own internals, or another module's `index.ts` / `queries.ts` /
  `serverMutations.ts` — nothing else.
- `docs/FR/event-creation-form.md` and
  `docs/FR/event-creation-form-fr-resolutions.md` for the form's product
  requirements. Neither specifies an image size limit, so the 5 MB number
  is a code-level decision, not an FR constraint.

**File map for this task:**

| Path | Role |
|---|---|
| `src/modules/events/components/create/CreateEventForm.tsx` | The form. Client component, used for both create and edit. `handleImageChange` line 180, `handleSubmit` line 208, error block line 364, helper text line 402. |
| `src/modules/events/mutations.ts` | Client-safe `fetch` wrappers. `createEvent` and `updateEvent` send JSON, not multipart. **All Phase 1 transport work and the Phase 3 body shape happen here.** |
| `src/app/api/events/route.ts` | POST adapter: same-origin, JSON or legacy multipart, declared-size, auth checks, then delegates. |
| `src/app/api/events/[id]/route.ts` | PATCH equivalent. |
| `src/modules/events/serverMutations.ts` | `createEventOnServer` — validation, storage upload, insert, rollback. |
| `src/modules/events/images.ts` | `sharp` pipeline. The security boundary. Do not weaken. |
| `src/modules/events/validation.ts` | Shared limits + Zod schema. `IMAGE_MAX_BYTES` line 24. |
| `src/modules/users/mutations.ts` | `updateProfile` line 37 — same avatar upload fragility. |
| `src/shared/http.ts` | `isSameOriginRequest`, `exceedsDeclaredContentLength`, `isMultipartFormRequest`, `readJsonOrMultipartFormData`. |
| `src/shared/security/rateLimit.ts` | In-process rate limiter, reusable by a client-error endpoint. |

**Environment notes:**

- Deployed on Vercel (Pro), project `livon`, host `livon-phi.vercel.app`.
  Runtime logs are the fastest diagnostic: filter `route:/api/events`.
- Supabase project `zzgnkqpkmumpwjpsbbil`. Cover bucket `event-covers`,
  path shape `{userId}/{uuid}.webp`. Supabase dashboard shows
  `timestamptz` in UTC; local time is UTC+2, which matters when
  correlating with Vercel log timestamps.
- Organizers are in Lesotho on mobile devices, frequently on shared or
  metered Wi-Fi. Treat a slow, lossy uplink as the normal case rather
  than the edge case — that assumption is the whole point of this task.

**One known-unresolved item:** whether a ~300 KB **JSON** POST to
`/api/events` publishes on the failing Wi-Fi. Tiny JSON beacons did;
multipart did not. That test decides whether this Phase 3 is enough.
