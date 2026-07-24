export function getPriceLabel(price: number): string {
  if (price === 0) return "Free";
  const amount = Number.isInteger(price) ? price.toString() : price.toFixed(2);
  return `M ${amount}`;
}

function utcDayNumber(d: Date): number {
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000
  );
}

function localDayNumber(d: Date): number {
  return Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  );
}

/**
 * Top-left countdown chip.
 * >30 days: "N Month(s)" (floored). 1–30 days: "N Days". Tomorrow: "1 Day".
 * Today (or already started/live): "Today".
 */
export function getCountdownLabel(startsAt: Date, now: Date): string {
  const diffDays = utcDayNumber(startsAt) - localDayNumber(now);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 Day";
  if (diffDays <= 30) return `${diffDays} Days`;

  const months = Math.floor(diffDays / 30);
  return `${months} Month${months === 1 ? "" : "s"}`;
}

function to12Hour(hours: number, minutes: number): string {
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHour}:${displayMinutes} ${period}`;
}

/**
 * Top-right time chip. Shows "Live" while the event is ongoing (between
 * starts_at and ends_at, or the 8-hour fallback when ends_at is null).
 * Otherwise shows the organiser-authored start time, unconverted.
 */
export function getTimeOrLiveLabel(
  startsAt: Date,
  endsAt: Date | null,
  now: Date
): string {
  const effectiveEnd = endsAt ?? new Date(startsAt.getTime() + 8 * 60 * 60 * 1000);

  if (now.getTime() >= startsAt.getTime() && now.getTime() < effectiveEnd.getTime()) {
    return "Live";
  }

  return to12Hour(startsAt.getUTCHours(), startsAt.getUTCMinutes());
}

/**
 * Event details page date/time line: "25 Dec 2026 · 6:00 AM".
 * Per docs/FR/event-details-page.md, this is start date + start time only —
 * there is no end-time input on the creation form, so no range is shown
 * here (unlike the raw HTML mockup, which predates that FR resolution).
 */
export function getEventDateTimeLabel(startsAt: Date): string {
  const day = startsAt.getUTCDate();
  const month = startsAt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = startsAt.getUTCFullYear();
  const time = to12Hour(startsAt.getUTCHours(), startsAt.getUTCMinutes());
  return `${day} ${month} ${year} \u00B7 ${time}`;
}

/**
 * Profile page events list date label: "Fri, 18 Jul" — short weekday +
 * day + short month. Distinct from getEventDateTimeLabel (which is for the
 * details page and includes year + time) since the profile list mockup
 * this replaces used this shorter, no-year, no-time format.
 */
export function getProfileEventDateLabel(startsAt: Date): string {
  const weekday = startsAt.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" });
  const day = startsAt.getUTCDate();
  const month = startsAt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekday}, ${day} ${month}`;
}