import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { processEventCoverImage } from "@/lib/images/eventCover";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { parseAndValidateEventFormData } from "@/lib/events/parseEventForm";
import { IMAGE_MAX_BYTES } from "@/lib/validation/eventCreation";

// Same reasoning as POST /api/events — a multipart upload needs the
// Node.js runtime for `sharp`.
export const runtime = "nodejs";

const STORAGE_BUCKET = "event-covers";
const MAX_REQUEST_BYTES = IMAGE_MAX_BYTES + 64 * 1024;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Same defense-in-depth CSRF check as POST /api/events.
function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * If `url` points at one of our own uploaded objects in the event-covers
 * bucket, returns its storage path; otherwise null (it's a category
 * default or the static placeholder — never something to delete).
 */
function ownedStorageObjectPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  return path.length > 0 ? path : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await context.params;

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
    return jsonError("You must be signed in to edit an event.", 401);
  }

  if (
    !checkRateLimit(`edit-event:${user.id}`, {
      maxRequests: 10,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return jsonError("Too many changes made recently. Please try again later.", 429);
  }

  // Ownership check up front. RLS ("Organizers can update own events")
  // would block a mismatched update anyway, but checking explicitly here
  // gives a clean 403/404 instead of a confusing generic DB error, and
  // means we don't do any (potentially expensive) image processing before
  // confirming the caller is even allowed to touch this event.
  const { data: existing, error: fetchError } = await supabase
    .from("events")
    .select("event_id, organizer_id, cover_image_url")
    .eq("event_id", eventId)
    .maybeSingle();

  if (fetchError || !existing) {
    return jsonError("Event not found.", 404);
  }
  if (existing.organizer_id !== user.id) {
    return jsonError("You can only edit events you organize.", 403);
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

  // city_id/area_id are intentionally left untouched on edit — they were
  // resolved once at creation time from the organiser's then-current
  // location preference (docs/FR/location-toggle.md). Re-resolving them
  // here would silently move a past event if the organiser's location
  // preference has since changed, which isn't what "editing the event
  // details" should do.

  const updatePayload: Record<string, unknown> = {
    title,
    category_id: categoryId,
    venue_name: venueName,
    description,
    starts_at: startsAt.toISOString(),
    price: admission === "paid" ? price : 0,
  };

  let oldObjectPathToDelete: string | null = null;
  let newUploadedObjectPath: string | null = null;

  const coverEntry = formData.get("cover");
  if (coverEntry instanceof File && coverEntry.size > 0) {
    const processed = await processEventCoverImage(coverEntry);
    if (!processed.ok) {
      return jsonError(processed.error, 400);
    }

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

    updatePayload.cover_image_url = publicUrl;
    newUploadedObjectPath = objectPath;
    oldObjectPathToDelete = ownedStorageObjectPath(existing.cover_image_url);
  }
  // No `cover` field at all -> cover_image_url is simply omitted from
  // updatePayload, leaving the existing value untouched.

  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update(updatePayload)
    .eq("event_id", eventId)
    .eq("organizer_id", user.id)
    .select("event_id")
    .single();

  if (updateError || !updated) {
    console.error("event update failed:", updateError?.message);

    // Best-effort cleanup of the just-uploaded replacement image if the
    // update itself failed, so it doesn't become an orphan.
    if (newUploadedObjectPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([newUploadedObjectPath]).catch(() => {});
    }

    return jsonError("Could not save changes. Please try again.", 500);
  }

  // Only delete the old image once the update actually succeeded — never
  // remove it speculatively before we know the new one is safely in place.
  if (oldObjectPathToDelete) {
    await supabase.storage.from(STORAGE_BUCKET).remove([oldObjectPathToDelete]).catch(() => {});
  }

  return NextResponse.json({ id: updated.event_id }, { status: 200 });
}
