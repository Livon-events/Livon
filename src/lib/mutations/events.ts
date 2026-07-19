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
