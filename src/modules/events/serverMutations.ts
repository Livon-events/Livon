import "server-only";
import { randomUUID } from "crypto";
import type { ServerMutationResult } from "@/shared/http";
import { createClient } from "@/shared/supabase/server";
import { checkRateLimit } from "@/shared/security/rateLimit";
import { getCategories } from "@/modules/categories/queries";
import { getAreaById } from "@/modules/location/queries";
import { processEventCoverImage } from "@/modules/events/images";
import { parseAndValidateEventFormData } from "@/modules/events/formParsing";
import {
  eventTextFieldsSchema,
  combineStartsAt,
  MAX_YEARS_IN_FUTURE,
} from "@/modules/events/validation";

/**
 * Server-only. Pulls in `sharp` (via processEventCoverImage) — never
 * import this from a Client Component or from any client-safe module file
 * (see modules/events/mutations.ts, which is the client-callable
 * counterpart that `fetch()`s the route handlers backed by these
 * functions).
 *
 * This is the real logic that used to live directly inside
 * `src/app/api/events/route.ts` (POST) and `src/app/api/events/[id]/route.ts`
 * (PATCH) — moved here during the modular-monolith restructuring so the
 * route handlers themselves can become thin adapters (parse the request,
 * call this, map the result to an HTTP response) instead of owning
 * business logic directly.
 */

const STORAGE_BUCKET = "event-covers";
const STATIC_FALLBACK_COVER_PATH = "/images/event-cover-placeholder.jpg";


/**
 * Creates a new event. See src/app/api/events/route.ts's original comments
 * (now trimmed down there) for the required Storage bucket setup.
 */
export async function createEventOnServer(
  userId: string,
  formData: FormData
): Promise<ServerMutationResult<{ id: string }>> {
  const supabase = await createClient();

  if (
    !checkRateLimit(`create-event:${userId}`, {
      maxRequests: 5,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return { ok: false, error: "Too many events created recently. Please try again later.", status: 429 };
  }

  const rawPrice = formData.get("price");
  const parsed = eventTextFieldsSchema.safeParse({
    title: formData.get("title"),
    categoryId: formData.get("categoryId"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    venueName: formData.get("venueName"),
    description: formData.get("description") ?? "",
    admission: formData.get("admission"),
    price:
      typeof rawPrice === "string" && rawPrice.trim() !== "" ? Number(rawPrice) : undefined,
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { ok: false, error: firstIssue?.message ?? "Invalid input.", status: 400 };
  }

  const { title, categoryId, startDate, startTime, venueName, description, admission, price } =
    parsed.data;

  // Re-verify the category against the live table rather than trusting the
  // client's id.
  const categories = await getCategories();
  if (!categories.some((c) => c.id === categoryId)) {
    return { ok: false, error: "Invalid category selected.", status: 400 };
  }

  // Area is chosen directly on the create-event form (see
  // docs/FR/event-creation-form.md) — the header toggle only scopes the
  // feed now, per docs/FR/location-toggle.md. Never trust the client's
  // area name/city pairing: re-verify the submitted id against the live
  // `areas` table and derive city_id from that row, same pattern as the
  // categoryId re-check just above.
  const rawAreaId = formData.get("areaId");
  if (typeof rawAreaId !== "string" || rawAreaId.trim() === "") {
    return { ok: false, error: "Please select an area for your event.", status: 400 };
  }
  const area = await getAreaById(rawAreaId.trim());
  if (!area) {
    return { ok: false, error: "Invalid area selected.", status: 400 };
  }

  const startsAt = combineStartsAt(startDate, startTime);
  if (!startsAt) {
    return { ok: false, error: "Enter a valid start date and time.", status: 400 };
  }
  const maxFutureDate = new Date();
  maxFutureDate.setUTCFullYear(maxFutureDate.getUTCFullYear() + MAX_YEARS_IN_FUTURE);
  if (startsAt > maxFutureDate) {
    return { ok: false, error: "Start date is too far in the future.", status: 400 };
  }

  // events.cover_image_url is NOT NULL — priority order: organiser's own
  // upload, then the category's default_cover_image_url, then a static
  // local placeholder.
  const selectedCategory = categories.find((c) => c.id === categoryId);
  let coverImageUrl: string = selectedCategory?.defaultCoverImageUrl ?? STATIC_FALLBACK_COVER_PATH;
  let uploadedObjectPath: string | null = null;

  const coverEntry = formData.get("cover");
  if (coverEntry instanceof File && coverEntry.size > 0) {
    const processed = await processEventCoverImage(coverEntry);
    if (!processed.ok) {
      return { ok: false, error: processed.error, status: 400 };
    }

    const objectPath = `${userId}/${randomUUID()}.${processed.data.extension}`;

    // Uint8Array, not a raw Node Buffer — same fix as
    // modules/users/serverMutations.ts's avatar upload. Passing a plain
    // Buffer to supabase-js's storage upload let it get coerced through a
    // lossy string/UTF-8 path, corrupting the binary image bytes.
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, new Uint8Array(processed.data.buffer), {
        contentType: processed.data.contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("event cover upload failed:", uploadError.message);
      return { ok: false, error: "Could not upload the cover image. Please try again.", status: 500 };
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
      organizer_id: userId,
      category_id: categoryId,
      city_id: area.cityId,
      area_id: area.id,
      title,
      description: description && description.length > 0 ? description : null,
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

    if (uploadedObjectPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([uploadedObjectPath]).catch(() => {});
    }

    return { ok: false, error: "Could not create the event. Please try again.", status: 500 };
  }

  return { ok: true, data: { id: inserted.event_id } };
}

function ownedStorageObjectPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  return path.length > 0 ? path : null;
}

/** Updates an existing event the caller organizes. */
export async function updateEventOnServer(
  userId: string,
  eventId: string,
  formData: FormData
): Promise<ServerMutationResult<{ id: string }>> {
  const supabase = await createClient();

  if (
    !checkRateLimit(`edit-event:${userId}`, {
      maxRequests: 10,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return { ok: false, error: "Too many changes made recently. Please try again later.", status: 429 };
  }

  // Ownership check up front — RLS would block a mismatched update anyway,
  // but this gives a clean 403/404 instead of a confusing DB error, and
  // avoids doing image processing before confirming the caller can touch
  // this event at all.
  const { data: existing, error: fetchError } = await supabase
    .from("events")
    .select("event_id, organizer_id, cover_image_url")
    .eq("event_id", eventId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false, error: "Event not found.", status: 404 };
  }
  if (existing.organizer_id !== userId) {
    return { ok: false, error: "You can only edit events you organize.", status: 403 };
  }

  const parsed = await parseAndValidateEventFormData(formData);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, status: parsed.status };
  }

  const { title, categoryId, venueName, description, admission, price, startsAt } = parsed.data;

  // city_id/area_id are intentionally left untouched on edit — see
  // docs/FR/location-toggle.md.
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
      return { ok: false, error: processed.error, status: 400 };
    }

    const objectPath = `${userId}/${randomUUID()}.${processed.data.extension}`;

    // Uint8Array, not a raw Node Buffer — see the comment on the same call
    // in createEventOnServer above.
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, new Uint8Array(processed.data.buffer), {
        contentType: processed.data.contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("event cover upload failed:", uploadError.message);
      return { ok: false, error: "Could not upload the cover image. Please try again.", status: 500 };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);

    updatePayload.cover_image_url = publicUrl;
    newUploadedObjectPath = objectPath;
    oldObjectPathToDelete = ownedStorageObjectPath(existing.cover_image_url);
  }

  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update(updatePayload)
    .eq("event_id", eventId)
    .eq("organizer_id", userId)
    .select("event_id")
    .single();

  if (updateError || !updated) {
    console.error("event update failed:", updateError?.message);

    if (newUploadedObjectPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([newUploadedObjectPath]).catch(() => {});
    }

    return { ok: false, error: "Could not save changes. Please try again.", status: 500 };
  }

  if (oldObjectPathToDelete) {
    await supabase.storage.from(STORAGE_BUCKET).remove([oldObjectPathToDelete]).catch(() => {});
  }

  return { ok: true, data: { id: updated.event_id } };
}
