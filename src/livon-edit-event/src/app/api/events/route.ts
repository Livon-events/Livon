import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getOrganizerLocationContext } from "@/lib/queries/users";
import { processEventCoverImage } from "@/lib/images/eventCover";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { parseAndValidateEventFormData } from "@/lib/events/parseEventForm";
import { IMAGE_MAX_BYTES } from "@/lib/validation/eventCreation";

// This route handles a potentially large multipart upload — force the
// Node.js runtime (not Edge), which is required for `sharp` anyway.
export const runtime = "nodejs";

/**
 * REQUIRED INFRA:
 *
 * 1. A Storage bucket named `event-covers` (not covered by
 *    docs/db/rls-policies.md — that doc only covers the `public` schema,
 *    Storage policies live in the `storage` schema and need to be checked
 *    separately). Provision once:
 *    - Public read (event covers are shown on the public feed).
 *    - INSERT policy restricted to `authenticated`, scoped so a user may
 *      only write under their own folder, e.g.:
 *        (bucket_id = 'event-covers')
 *        and (auth.uid()::text = (storage.foldername(name))[1])
 *      No UPDATE/UPSERT policy is needed — this route always writes a
 *      fresh, randomly-named object, never overwrites.
 *
 * 2. `public.events` RLS — already confirmed in docs/db/rls-policies.md:
 *    "Authenticated users can create events" (INSERT, with check
 *    `organizer_id = (select auth.uid())`), which is exactly what this
 *    route relies on — no further policy work needed here.
 *
 * `events.cover_image_url` is `NOT NULL` (docs/db/schema.md), so this route
 * always has a value to insert: an upload, else the selected category's
 * `default_cover_image_url`, else a static asset shipped in `public/`.
 */
const STORAGE_BUCKET = "event-covers";

// Last-resort fallback when neither an upload nor the category's own
// `default_cover_image_url` is available — `events.cover_image_url` is
// NOT NULL (docs/db/schema.md), so there must always be *something* to
// insert. Ships as a static asset in `public/` (see
// public/images/event-cover-placeholder.jpg) rather than a Storage object,
// so it can never itself be missing/misconfigured.
const STATIC_FALLBACK_COVER_PATH = "/images/event-cover-placeholder.jpg";

// Rough ceiling for the whole multipart request (image + all text fields +
// multipart framing overhead). This is a cheap pre-check on the declared
// Content-Length so an obviously-oversized request can be rejected before
// we spend anything reading the body; the authoritative size check still
// happens on the decoded file itself in processEventCoverImage.
const MAX_REQUEST_BYTES = IMAGE_MAX_BYTES + 64 * 1024;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Best-effort same-origin check as defense-in-depth against CSRF. This is
 * not a full CSRF-token scheme, but combined with Supabase's SameSite auth
 * cookies it meaningfully raises the bar: a form or script hosted on
 * another origin that tries to POST here (using the victim's browser
 * cookies) will send an `Origin` header that fails this check.
 */
function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  // Some legitimate same-origin requests omit Origin (older browsers,
  // certain non-CORS navigations) — only reject when it's present AND
  // mismatched, rather than requiring it outright.
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Request rejected.", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError("Invalid request format.", 400);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return jsonError("Request is too large.", 413);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("You must be signed in to create an event.", 401);
  }

  if (
    !checkRateLimit(`create-event:${user.id}`, {
      maxRequests: 5,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return jsonError("Too many events created recently. Please try again later.", 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the submitted form.", 400);
  }

  const parsed = await parseAndValidateEventFormData(formData);
  if (!parsed.ok) {
    return jsonError(parsed.error, parsed.status);
  }

  const { title, categoryId, venueName, description, admission, price, startsAt } = parsed.data;
  const categories = parsed.categories;

  // city_id/area_id are never accepted from the client — per
  // docs/FR/location-toggle.md they're resolved server-side from the
  // organiser's current preference, read fresh at submission time.
  const location = await getOrganizerLocationContext(user.id);
  if (!location) {
    return jsonError("Set your location before creating an event.", 400);
  }
  if (!location.areaId) {
    return jsonError(
      "Select a specific area in the location toggle before posting an event.",
      400
    );
  }

  // `events.cover_image_url` is NOT NULL (see docs/db/schema.md) — there is
  // always a value, in priority order: the organiser's own upload, then the
  // selected category's `default_cover_image_url`, then a static local
  // placeholder shipped with the app so this can never fail even if a
  // category has no default image configured.
  const selectedCategory = categories.find((c) => c.id === categoryId);
  let coverImageUrl: string =
    selectedCategory?.defaultCoverImageUrl ?? STATIC_FALLBACK_COVER_PATH;
  let uploadedObjectPath: string | null = null;

  const coverEntry = formData.get("cover");
  if (coverEntry instanceof File && coverEntry.size > 0) {
    const processed = await processEventCoverImage(coverEntry);
    if (!processed.ok) {
      return jsonError(processed.error, 400);
    }

    // Random, server-generated path — never derived from the user-supplied
    // filename (avoids path traversal, weird characters, and collisions).
    const objectPath = `${user.id}/${randomUUID()}.${processed.data.extension}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, processed.data.buffer, {
        contentType: processed.data.contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("event cover upload failed:", uploadError.message);
      return jsonError("Could not upload the cover image. Please try again.", 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
    coverImageUrl = publicUrl;
    uploadedObjectPath = objectPath;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert({
      organizer_id: user.id,
      category_id: categoryId,
      city_id: location.cityId,
      area_id: location.areaId,
      title,
      description,
      venue_name: venueName,
      starts_at: startsAt.toISOString(),
      cover_image_url: coverImageUrl,
      status: "active",
      price: admission === "paid" ? price : 0,
    })
    .select("event_id")
    .single();

  if (insertError || !inserted) {
    console.error("event insert failed:", insertError?.message);

    // Best-effort cleanup so a failed insert doesn't leave an orphaned
    // storage object behind — only when we actually uploaded one (not for
    // the category-default/static fallback URLs). Non-fatal if this itself
    // fails.
    if (uploadedObjectPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([uploadedObjectPath]).catch(() => {});
    }

    return jsonError("Could not create the event. Please try again.", 500);
  }

  return NextResponse.json({ id: inserted.event_id }, { status: 201 });
}
