import { createClient } from "@/shared/supabase/client";
import { downscaleImageInBrowser } from "@/shared/images/downscaleImageInBrowser";
import {
  errorName,
  fetchWithUploadTimeout,
  messageForUploadFailure,
  reportUploadFailure,
} from "@/shared/uploads";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Matches server OUTPUT_MAX_WIDTH/HEIGHT in modules/events/images.ts. */
const COVER_DOWNSCALE = {
  maxEdge: 1600,
  quality: 0.9,
  skipUnderBytes: 600 * 1024,
} as const;

type JsonCover = { name: string; type: string; data: string };

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function eventJsonBody(
  input: Omit<CreateEventInput, "coverImage" | "areaId"> & {
    areaId?: string;
    coverImage: File | null;
  }
): Promise<{ body: string; uploadedBytes?: number }> {
  let cover: JsonCover | undefined;
  let uploadedBytes: number | undefined;
  if (input.coverImage) {
    const file = await downscaleImageInBrowser(input.coverImage, COVER_DOWNSCALE);
    uploadedBytes = file.size;
    cover = {
      name: file.name,
      type: file.type,
      data: await fileToBase64(file),
    };
  }

  return {
    uploadedBytes,
    body: JSON.stringify({
      title: input.title,
      categoryId: input.categoryId,
      areaId: input.areaId,
      startDate: input.startDate,
      startTime: input.startTime,
      endDate: input.endDate,
      endTime: input.endTime,
      venueName: input.venueName,
      description: input.description,
      admission: input.admission,
      price: input.admission === "paid" ? input.price : undefined,
      cover,
    }),
  };
}

export type CreateEventInput = {
  title: string;
  categoryId: string;
  areaId: string;
  startDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endDate?: string;  // "YYYY-MM-DD" — optional
  endTime?: string;  // "HH:MM"     — optional
  venueName: string;
  description: string;
  admission: "free" | "paid";
  price?: number;
  coverImage: File | null;
};

/**
 * Creates a new event.
 *
 * Unlike the other functions in `lib/mutations/`, this does NOT call the
 * Supabase client directly from here. Cover-image validation/re-encoding
 * requires `sharp`, a server-only native module (see
 * docs/FR/architecture.md), so the real work happens in the
 * `/api/events` Route Handler and this function is a thin wrapper around
 * that request. The cover is sent as JSON (base64), not multipart, because
 * the failing Wi-Fi rejected multipart POSTs to this host while small JSON
 * beacons arrived. Client Components should still only ever call this
 * function — never `fetch("/api/events")` inline — so the endpoint has a
 * single, typed call site.
 */
export async function createEvent(input: CreateEventInput): Promise<Result<{ id: string }>> {
  let payload: { body: string; uploadedBytes?: number };
  try {
    payload = await eventJsonBody(input);
  } catch (error) {
    console.error("createEvent image encode failed", error);
    return { ok: false, error: "Could not read the photo. Please try another image." };
  }

  let response: Response;
  try {
    response = await fetchWithUploadTimeout("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload.body,
    });
  } catch (error) {
    console.error("createEvent upload failed", error);
    reportUploadFailure({
      route: "/api/events",
      errorName: errorName(error),
      originalBytes: input.coverImage?.size,
      uploadedBytes: payload.uploadedBytes,
    });
    return { ok: false, error: messageForUploadFailure(error) };
  }

  let body: { id?: string; error?: string } | null = null;
  try {
    body = await response.json();
  } catch {
    // Fall through — body stays null, generic error below is used.
  }

  if (!response.ok || !body?.id) {
    return { ok: false, error: body?.error ?? "Could not create the event. Please try again." };
  }

  return { ok: true, data: { id: body.id } };
}

export type UpdateEventInput = Omit<CreateEventInput, "areaId"> & {
  /** Only set when the organiser picked a new photo — omitted, the existing cover is left untouched. */
  coverImage: File | null;
};

/**
 * Updates an existing event. Same "thin wrapper around a Route Handler"
 * reasoning as createEvent — a new cover photo still needs server-side
 * sharp processing. If `coverImage` is null, no `cover` field is sent at
 * all, and PATCH /api/events/[id] leaves the existing cover_image_url
 * untouched (see that route's comments).
 *
 * city_id/area_id are deliberately never part of this input — editing
 * never re-resolves the organiser's location, per PATCH /api/events/[id].
 */
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<Result<{ id: string }>> {
  let payload: { body: string; uploadedBytes?: number };
  try {
    payload = await eventJsonBody(input);
  } catch (error) {
    console.error("updateEvent image encode failed", error);
    return { ok: false, error: "Could not read the photo. Please try another image." };
  }

  let response: Response;
  try {
    response = await fetchWithUploadTimeout(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: payload.body,
    });
  } catch (error) {
    console.error("updateEvent upload failed", error);
    reportUploadFailure({
      route: "/api/events/[id]",
      errorName: errorName(error),
      originalBytes: input.coverImage?.size,
      uploadedBytes: payload.uploadedBytes,
    });
    return { ok: false, error: messageForUploadFailure(error) };
  }

  let body: { id?: string; error?: string } | null = null;
  try {
    body = await response.json();
  } catch {
    // Fall through — body stays null, generic error below is used.
  }

  if (!response.ok || !body?.id) {
    return { ok: false, error: body?.error ?? "Could not save changes. Please try again." };
  }

  return { ok: true, data: { id: body.id } };
}

/**
 * Cancels an event the caller organizes by deleting it outright — no
 * "archived" state, no "un-cancel". This deletes regardless of whether
 * anyone has marked interest/going; see
 * scripts/migrations/2026-08-hard-delete-cancelled-events.sql for the
 * cascade behavior (event_tags, event_interests, event_views,
 * anonymous_event_views, invite_links, invite_link_clicks all cascade
 * from the event row) and the RLS change this depends on
 * (events_delete_own — no more "only if no interest" guard).
 *
 * Unlike create/update, this touches no image and needs no validation
 * beyond "is this my event", so it's a plain client-side call — same
 * pattern as lib/mutations/event-interests.ts — rather than routing
 * through a Route Handler.
 *
 * RLS ("events_delete_own": using `organizer_id = auth.uid()`) is what
 * actually enforces ownership here; `.eq("organizer_id", user.id)` below
 * is belt-and-braces, not the real security boundary.
 */
export async function cancelEvent(eventId: string): Promise<Result> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("event_id", eventId)
    .eq("organizer_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
