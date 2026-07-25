import { createClient } from "@/lib/supabase/client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type CreateEventInput = {
  title: string;
  categoryId: string;
  startDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
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
 * that request. Client Components should still only ever call this
 * function — never `fetch("/api/events")` inline — so the endpoint has a
 * single, typed call site.
 */
export async function createEvent(input: CreateEventInput): Promise<Result<{ id: string }>> {
  const formData = new FormData();
  formData.set("title", input.title);
  formData.set("categoryId", input.categoryId);
  formData.set("startDate", input.startDate);
  formData.set("startTime", input.startTime);
  formData.set("venueName", input.venueName);
  formData.set("description", input.description);
  formData.set("admission", input.admission);
  if (input.admission === "paid" && input.price !== undefined) {
    formData.set("price", String(input.price));
  }
  if (input.coverImage) {
    formData.set("cover", input.coverImage);
  }

  let response: Response;
  try {
    response = await fetch("/api/events", {
      method: "POST",
      body: formData,
    });
  } catch {
    return { ok: false, error: "Network error — please check your connection and try again." };
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

export type UpdateEventInput = CreateEventInput & {
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
  const formData = new FormData();
  formData.set("title", input.title);
  formData.set("categoryId", input.categoryId);
  formData.set("startDate", input.startDate);
  formData.set("startTime", input.startTime);
  formData.set("venueName", input.venueName);
  formData.set("description", input.description);
  formData.set("admission", input.admission);
  if (input.admission === "paid" && input.price !== undefined) {
    formData.set("price", String(input.price));
  }
  if (input.coverImage) {
    formData.set("cover", input.coverImage);
  }

  let response: Response;
  try {
    response = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      body: formData,
    });
  } catch {
    return { ok: false, error: "Network error — please check your connection and try again." };
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
 * Cancels (soft — sets status = 'cancelled', never deletes) an event the
 * caller organizes. Unlike create/update, this touches no image and needs
 * no validation beyond "is this my event", so it's a plain client-side
 * call — same pattern as lib/mutations/event-interests.ts — rather than
 * routing through a Route Handler.
 *
 * RLS ("Organizers can update own events": using + check
 * `organizer_id = auth.uid()`) is what actually enforces ownership here;
 * `.eq("organizer_id", user.id)` below is belt-and-braces, not the real
 * security boundary.
 *
 * Per docs/db/schema.md, events are archived, not deleted — this can't be
 * undone through the UI once cancelled (no "un-cancel" action exists).
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
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("organizer_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
