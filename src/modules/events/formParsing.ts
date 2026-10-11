import type { Category } from "@/modules/categories";
import { getCategories } from "@/modules/categories/queries";
import {
  eventTextFieldsSchema,
  combineStartsAt,
  combineDateAndTime,
  MAX_YEARS_IN_FUTURE,
} from "@/modules/events/validation";
import { ticketLinksSchema } from "@/modules/events/ticketLinks";
import {
  gatePriceSchema,
  getPricingError,
  pricePhasesSchema,
  type PricePhase,
} from "@/modules/events/pricePhases";

export type ParsedPricing = { pricePhases: PricePhase[]; gatePrice: number | null };

/**
 * `pricePhases` arrives as a JSON string (the JSON→FormData adapter only
 * carries primitives). Free events always store no phases and no gate price.
 */
export function parsePricingFormData(
  formData: FormData,
  admission: "free" | "paid",
  startDate: string
): { ok: true; data: ParsedPricing } | { ok: false; error: string; status: number } {
  if (admission === "free") {
    return { ok: true, data: { pricePhases: [], gatePrice: null } };
  }

  let gatePrice: number | null = null;
  const rawGate = formData.get("gatePrice");
  if (typeof rawGate === "string" && rawGate.trim() !== "") {
    const parsedGate = gatePriceSchema.safeParse(Number(rawGate));
    if (!parsedGate.success) {
      return { ok: false, error: parsedGate.error.issues[0]?.message ?? "Invalid gate price.", status: 400 };
    }
    gatePrice = parsedGate.data;
  } else if (rawGate !== null && typeof rawGate !== "string") {
    return { ok: false, error: "Invalid gate price.", status: 400 };
  }

  let pricePhases: PricePhase[] = [];
  const rawPhases = formData.get("pricePhases");
  if (rawPhases !== null && rawPhases !== "") {
    if (typeof rawPhases !== "string") {
      return { ok: false, error: "Invalid ticket prices.", status: 400 };
    }
    let value: unknown;
    try {
      value = JSON.parse(rawPhases);
    } catch {
      return { ok: false, error: "Invalid ticket prices.", status: 400 };
    }
    const parsed = pricePhasesSchema.safeParse(value);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ticket prices.", status: 400 };
    }
    pricePhases = parsed.data;
  }

  const pricingError = getPricingError(pricePhases, gatePrice, startDate);
  if (pricingError) {
    return { ok: false, error: `${pricingError}.`, status: 400 };
  }
  return { ok: true, data: { pricePhases, gatePrice } };
}

export function parseTicketLinksFormData(
  formData: FormData
): { ok: true; data: string[] } | { ok: false; error: string; status: number } {
  const raw = formData.getAll("ticketLinks");
  if (raw.some((value) => typeof value !== "string")) {
    return { ok: false, error: "Invalid ticket links.", status: 400 };
  }
  const parsed = ticketLinksSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid ticket links.", status: 400 };
  }
  return { ok: true, data: parsed.data };
}

export type ParsedEventFields = {
  title: string;
  categoryId: string;
  venueName: string;
  description: string | null;
  admission: "free" | "paid";
  price: number | undefined;
  startsAt: Date;
  endsAt: Date | null;
  ticketLinks: string[];
  pricePhases: PricePhase[];
  gatePrice: number | null;
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
    endDate: formData.get("endDate") ?? "",
    endTime: formData.get("endTime") ?? "",
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

  // Combine optional end date/time if provided.
  let endsAt: Date | null = null;
  const hasEndDate = parsed.data.endDate && parsed.data.endDate.length > 0;
  const hasEndTime = parsed.data.endTime && parsed.data.endTime.length > 0;
  if (hasEndDate && hasEndTime) {
    endsAt = combineDateAndTime(parsed.data.endDate!, parsed.data.endTime!);
    if (!endsAt) {
      return { ok: false, error: "Enter a valid end date and time.", status: 400 };
    }
    if (endsAt <= startsAt) {
      return { ok: false, error: "End time must be after the start time.", status: 400 };
    }
  }

  const ticketLinks = parseTicketLinksFormData(formData);
  if (!ticketLinks.ok) {
    return ticketLinks;
  }

  const pricing = parsePricingFormData(formData, parsed.data.admission, parsed.data.startDate);
  if (!pricing.ok) {
    return pricing;
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
      endsAt,
      ticketLinks: ticketLinks.data,
      pricePhases: pricing.data.pricePhases,
      gatePrice: pricing.data.gatePrice,
    },
  };
}
