import { z } from "zod";

/**
 * Single source of truth for event-creation limits + validation, shared by
 * the client form (fast feedback) and the `/api/events` route handler
 * (authoritative — the client's checks are a UX nicety only, never trusted).
 *
 * Limits below come from docs/FR/event-creation-form.md and
 * docs/FR/event-creation-form-fr-resolutions.md.
 */

export const TITLE_MAX = 60;
export const VENUE_MIN = 3;
export const VENUE_MAX = 60;
export const DESCRIPTION_MAX = 750;

// price is `numeric` on Events, defaults to 0. Upper bound isn't specified by
// the FR — this is a defensive sanity cap, not a business rule, so a typo or
// a hostile client can't push an absurd/overflowing value into the column.
export const PRICE_MAX = 100_000;

// Image constraints. Enforced server-side in the route handler (this file
// only hosts the numbers so client + server can't drift).
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const IMAGE_MAX_DIMENSION = 6000; // px, either side
export const IMAGE_MAX_PIXELS = 30_000_000; // ~30MP decode budget (decompression-bomb guard)
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

// Reject control characters (other than plain space) anywhere in free-text
// fields — these have no legitimate use in a title/venue name and are a
// classic vector for header-injection / log-forging / rendering weirdness.
const NO_CONTROL_CHARS = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/;

export const eventTextFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Event title is required")
    .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`)
    .regex(NO_CONTROL_CHARS, "Title contains invalid characters"),

  // Format is deliberately loose (just "non-empty, reasonably short id
  // string") rather than a strict RFC-4122 UUID regex — this project's
  // seeded category ids (scripts/seed.mjs) don't set the UUID version/
  // variant nibbles, so a strict check would reject legitimate data. The
  // real authorization boundary is the live-membership check against the
  // Categories table in route.ts, not this shape check.
  categoryId: z
    .string()
    .trim()
    .min(1, "Please select a category")
    .max(64, "Please select a category"),

  // Kept as separate date/time strings (not a single datetime-local field)
  // to match the form's chip-based UX; combined + validated as a real
  // calendar date server-side in route.ts.
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time is required"),

  venueName: z
    .string()
    .trim()
    .min(VENUE_MIN, `Location must be at least ${VENUE_MIN} characters`)
    .max(VENUE_MAX, `Location must be ${VENUE_MAX} characters or fewer`)
    .regex(NO_CONTROL_CHARS, "Location contains invalid characters"),

  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, `Description must be ${DESCRIPTION_MAX} characters or fewer`)
    .regex(NO_CONTROL_CHARS, "Description contains invalid characters")
    .optional()
    .or(z.literal("")),

  admission: z.enum(["free", "paid"]),

  // Only meaningful when admission === "paid"; cross-field check happens
  // with .superRefine below since Zod object schemas validate fields
  // independently otherwise.
  price: z
    .number()
    .finite()
    .positive("Enter a valid price")
    .max(PRICE_MAX, "Price is too high")
    .optional(),

  // Optional end date/time — both must be provided together or both omitted.
  // When set, the combined end timestamp must be after the start.
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date is invalid")
    .optional()
    .or(z.literal("")),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time is invalid")
    .optional()
    .or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.admission === "paid" && data.price === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["price"],
      message: "Please enter a valid price",
    });
  }

  // If one of endDate/endTime is set, the other must be too.
  const hasEndDate = data.endDate && data.endDate.length > 0;
  const hasEndTime = data.endTime && data.endTime.length > 0;
  if (hasEndDate && !hasEndTime) {
    ctx.addIssue({
      code: "custom",
      path: ["endTime"],
      message: "Please select an end time",
    });
  }
  if (hasEndTime && !hasEndDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Please select an end date",
    });
  }
});

export type EventTextFields = z.infer<typeof eventTextFieldsSchema>;

/**
 * Combines the validated date + time strings into an ISO timestamp.
 *
 * Per docs/FR/home-feed-event-card.md, the app treats `starts_at` as the
 * organiser's plain wall-clock entry with no timezone conversion (feed
 * comparisons already use UTC getters directly against it) — so this simply
 * builds a UTC-labelled ISO string from the literal digits typed/selected,
 * it does not attempt to interpret the visitor's real timezone.
 *
 * Returns null if the date isn't a real calendar date (e.g. 2025-02-30),
 * which the regex alone can't catch.
 */
export function combineStartsAt(startDate: string, startTime: string): Date | null {
  return combineDateAndTime(startDate, startTime);
}

/**
 * Combines a date string ("YYYY-MM-DD") and a time string ("HH:MM") into a
 * Date, returning null if the result isn't a real calendar date.
 */
export function combineDateAndTime(date: string, time: string): Date | null {
  const iso = `${date}T${time}:00.000Z`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  // Reject dates that JS "helpfully" rolled over (e.g. Feb 30 -> Mar 2).
  const [y, m, d] = date.split("-").map(Number);
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    return null;
  }

  return parsed;
}

// Defensive sanity bound on how far from "now" a start date may be — not a
// product requirement, just a guard against garbage/overflow timestamps
// (e.g. a manipulated date input) reaching the database.
export const MAX_YEARS_IN_FUTURE = 5;
