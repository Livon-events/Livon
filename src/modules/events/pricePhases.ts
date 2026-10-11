import { z } from "zod";
import { NO_CONTROL_CHARS, PRICE_MAX } from "@/modules/events/validation";
import { isEventStillLive } from "@/modules/events/format";

/**
 * Advance ticket price phases (early bird → regular → late), stored in
 * events.price_phases, plus an optional door price in events.gate_price.
 * Phases are chronological and each ends on its `until` date (inclusive,
 * Maseru calendar day). Only the last phase may have no end date, meaning it
 * runs until the event; a dated last phase needs a gate price to take over
 * once advance sales end. The last phase's price is also stored in
 * events.price. A single-price event stores no phases.
 *
 * The price_phases_are_valid CHECK constraint and event_current_price
 * (scripts/migrations/2026-10-event-price-phases.sql) mirror this file, so
 * keep them in sync.
 */
export const PRICE_PHASES_MAX = 3;
export const PRICE_PHASE_LABEL_MAX = 30;

export type PricePhase = {
  label: string | null;
  price: number;
  /** "YYYY-MM-DD", last day of the phase; null only on the final phase. */
  until: string | null;
};

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const pricePhaseSchema = z.object({
  label: z
    .string()
    .trim()
    .max(PRICE_PHASE_LABEL_MAX, `Phase names must be ${PRICE_PHASE_LABEL_MAX} characters or fewer`)
    .regex(NO_CONTROL_CHARS, "Phase name contains invalid characters")
    .nullish()
    .transform((value) => (value ? value : null)),
  price: z
    .number("Enter a price for every phase")
    .finite("Enter a price for every phase")
    .positive("Enter a price for every phase")
    .max(PRICE_MAX, "Price is too high"),
  until: z
    .string()
    .nullish()
    .transform((value) => (value ? value : null)),
});

/**
 * Either no phases (single price) or 1–3 chronological phases. A lone phase
 * must have an end date — an undated single price is stored as no phases.
 * Rules involving the gate price or event date live in getPricingError.
 */
export const pricePhasesSchema = z
  .array(pricePhaseSchema)
  .max(PRICE_PHASES_MAX, `At most ${PRICE_PHASES_MAX} price phases are allowed`)
  .superRefine((phases, ctx) => {
    if (phases.length === 1 && phases[0].until === null) {
      ctx.addIssue({ code: "custom", message: "Choose when the phase ends" });
      return;
    }
    let previousUntil: string | null = null;
    for (const [index, phase] of phases.entries()) {
      const isLast = index === phases.length - 1;
      if (phase.until === null) {
        if (!isLast) {
          ctx.addIssue({ code: "custom", message: "Choose when each phase ends" });
        }
        return;
      }
      if (!isCalendarDate(phase.until)) {
        ctx.addIssue({ code: "custom", message: "Choose when each phase ends" });
        return;
      }
      if (previousUntil && phase.until <= previousUntil) {
        ctx.addIssue({ code: "custom", message: "Each phase must end after the one before it" });
        return;
      }
      previousUntil = phase.until;
    }
  });

export const gatePriceSchema = z
  .number("Enter a valid gate price")
  .finite("Enter a valid gate price")
  .positive("Enter a valid gate price")
  .max(PRICE_MAX, "Gate price is too high");

/** Cross-field pricing rules shared by the form and the server. */
export function getPricingError(
  phases: readonly PricePhase[],
  gatePrice: number | null,
  startDate: string
): string | null {
  if (phases.some((phase) => phase.until !== null && phase.until > startDate)) {
    return "Price phases must end on or before the event date";
  }
  const last = phases.at(-1);
  if (last && last.until !== null && gatePrice === null) {
    return "Add a gate price, or leave the last phase's end date empty";
  }
  return null;
}

/** Defensive read of the stored column — anything malformed reads as no phases. */
export function parseStoredPricePhases(value: unknown): PricePhase[] {
  const parsed = pricePhasesSchema.safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

/** Today's date in Maseru (fixed UTC+2, no DST) as "YYYY-MM-DD". */
function maseruToday(now: Date): string {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export type CurrentPrice = {
  price: number;
  /** Index into phases of the phase on sale; -1 when there are no phases or the gate price applies. */
  phaseIndex: number;
  isGate: boolean;
};

/**
 * Price on sale right now: the gate price while the event is live; otherwise
 * the first phase that hasn't ended; once every phase has ended, the gate
 * price (or the last phase's price when there's no gate price).
 */
export function getCurrentPrice({
  price,
  phases,
  gatePrice,
  startsAt,
  endsAt,
  now = new Date(),
}: {
  price: number;
  phases: readonly PricePhase[];
  gatePrice: number | null;
  startsAt: Date;
  endsAt: Date | null;
  now?: Date;
}): CurrentPrice {
  // TEMP PATCH: startsAt holds Maseru wall-clock digits — see isEventStillLive.
  const hasStarted = now.getTime() + 2 * 60 * 60 * 1000 >= startsAt.getTime();
  if (gatePrice !== null && hasStarted && isEventStillLive(startsAt, endsAt, now)) {
    return { price: gatePrice, phaseIndex: -1, isGate: true };
  }
  if (phases.length === 0) {
    return { price, phaseIndex: -1, isGate: false };
  }

  const today = maseruToday(now);
  const index = phases.findIndex((phase) => phase.until === null || phase.until >= today);
  if (index !== -1) {
    return { price: phases[index].price, phaseIndex: index, isGate: false };
  }
  if (gatePrice !== null) {
    return { price: gatePrice, phaseIndex: -1, isGate: true };
  }
  return { price: phases[phases.length - 1].price, phaseIndex: phases.length - 1, isGate: false };
}

/** "20 Oct" for a phase's `until` date. */
export function getPricePhaseEndLabel(until: string): string {
  const date = new Date(`${until}T00:00:00.000Z`);
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${date.getUTCDate()} ${month}`;
}
