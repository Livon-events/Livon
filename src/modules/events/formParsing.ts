import type { Category } from "@/modules/categories";
import { getCategories } from "@/modules/categories/queries";
import {
  eventTextFieldsSchema,
  combineStartsAt,
  MAX_YEARS_IN_FUTURE,
} from "@/modules/events/validation";

export type ParsedEventFields = {
  title: string;
  categoryId: string;
  venueName: string;
  description: string | null;
  admission: "free" | "paid";
  price: number | undefined;
  startsAt: Date;
};

export type ParseEventFormResult =
  | { ok: true; data: ParsedEventFields; categories: Category[] }
  | { ok: false; error: string; status: number };

/**
 * Validates the text-field portion of an event create/edit submission —
 * shared by POST /api/events and PATCH /api/events/[id] so the two can't
 * silently drift out of sync on what counts as valid input. Does NOT
 * touch the cover image or city/area — those are handled separately by
 * each route (edit only re-processes the image if a new one was
 * provided; city/area are never re-resolved on edit, see route.ts).
 */
export async function parseAndValidateEventFormData(
  formData: FormData
): Promise<ParseEventFormResult> {
  const rawPrice = formData.get("price");
  const parsed = eventTextFieldsSchema.safeParse({
    title: formData.get("title"),
    categoryId: formData.get("categoryId"),
    startDate: formData.get("startDate"),
    startTime: formData.get("startTime"),
    venueName: formData.get("venueName"),
    description: formData.get("description") ?? "",
    admission: formData.get("admission"),
    price: typeof rawPrice === "string" && rawPrice.trim() !== "" ? Number(rawPrice) : undefined,
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { ok: false, error: firstIssue?.message ?? "Invalid input.", status: 400 };
  }

  // Re-verify the category against the live table rather than trusting the
  // client's id — the fixed list only ever renders known-good ids, but a
  // request can be crafted by hand regardless of what the UI offers.
  const categories = await getCategories();
  if (!categories.some((c) => c.id === parsed.data.categoryId)) {
    return { ok: false, error: "Invalid category selected.", status: 400 };
  }

  const startsAt = combineStartsAt(parsed.data.startDate, parsed.data.startTime);
  if (!startsAt) {
    return { ok: false, error: "Enter a valid start date and time.", status: 400 };
  }
  const maxFutureDate = new Date();
  maxFutureDate.setUTCFullYear(maxFutureDate.getUTCFullYear() + MAX_YEARS_IN_FUTURE);
  if (startsAt > maxFutureDate) {
    return { ok: false, error: "Start date is too far in the future.", status: 400 };
  }

  return {
    ok: true,
    categories,
    data: {
      title: parsed.data.title,
      categoryId: parsed.data.categoryId,
      venueName: parsed.data.venueName,
      description:
        parsed.data.description && parsed.data.description.length > 0
          ? parsed.data.description
          : null,
      admission: parsed.data.admission,
      price: parsed.data.price,
      startsAt,
    },
  };
}
