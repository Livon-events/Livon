/**
 * Offline checks for event-reminder calendar-day windows.
 * Mirrors getDaysUntilEventStart / getStartsAtRangeForOffset logic used by
 * src/modules/notifications/reminders.ts — no network, no Resend.
 *
 * Run: node scripts/test-reminder-windows.mjs
 */

function utcDayNumber(d) {
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000
  );
}

function localDayNumber(d) {
  return Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  );
}

function getDaysUntilEventStart(startsAt, now) {
  return utcDayNumber(startsAt) - localDayNumber(now);
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("OK:", message);
  }
}

// Fixed "now": Saturday 2026-08-29 15:00 local (use explicit local components)
const now = new Date(2026, 7, 29, 15, 0, 0);

// starts_at stores Maseru wall-clock as UTC-labelled digits
const in7Days = new Date(Date.UTC(2026, 7, 29 + 7, 18, 0, 0)); // Sep 5 18:00
const tomorrow = new Date(Date.UTC(2026, 7, 30, 18, 0, 0)); // Aug 30 18:00
const in20Hours = new Date(Date.UTC(2026, 7, 30, 11, 0, 0)); // Aug 30 11:00 — ~20h from Aug 29 15:00
// Wait: Aug 30 11:00 from Aug 29 15:00 is 20 hours, but calendar day offset is 1 (tomorrow).
// True "late RSVP same-day / missed 1d window" case: event later TODAY.
const laterToday = new Date(Date.UTC(2026, 7, 29, 23, 0, 0)); // same calendar day, ~8h left
const in3Days = new Date(Date.UTC(2026, 8, 1, 18, 0, 0)); // Sep 1

assert(getDaysUntilEventStart(in7Days, now) === 7, "7-day event → offset 7 (receives 7d reminder)");
assert(getDaysUntilEventStart(tomorrow, now) === 1, "tomorrow event → offset 1 (receives 1d reminder)");
assert(getDaysUntilEventStart(laterToday, now) === 0, "same-day event → offset 0 (no 7d or 1d reminder)");
assert(getDaysUntilEventStart(in3Days, now) === 3, "3-day event → offset 3 (missed 7d; not yet 1d)");

// Late RSVP with ~20h left that falls on tomorrow's calendar day still gets 1d
// if cron runs THAT morning — but if they RSVP after the morning cron on the
// day before the event, they already missed it. Simulate cron after RSVP on
// event day (offset 0):
assert(
  getDaysUntilEventStart(in20Hours, now) === 1,
  "~20h-away event on next calendar day → still offset 1 if cron hasn't run yet that morning"
);
assert(
  getDaysUntilEventStart(in20Hours, new Date(2026, 7, 30, 10, 0, 0)) === 0,
  "same event after 1d cron morning passes → offset 0 (late RSVP gets nothing)"
);

if (process.exitCode) {
  console.error("\nSome reminder window checks failed.");
  process.exit(1);
}
console.log("\nAll reminder window checks passed.");
