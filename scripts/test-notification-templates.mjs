/**
 * Offline checks for notification email template copy.
 * Mirrors the builders in src/modules/notifications/templates/ — no network.
 *
 * Run: node scripts/test-notification-templates.mjs
 */

function getEventDateTimeLabel(startsAt, endsAt) {
  // Minimal stand-in — templates only need a non-empty when string for asserts.
  void endsAt;
  return startsAt.toISOString();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reminderLead(reminderType) {
  if (reminderType === "30d") {
    return "This is a friendly reminder that an event you're interested in is coming up in 30 days.";
  }
  if (reminderType === "7d") {
    return "This is a friendly reminder that an event you're interested in is coming up in one week.";
  }
  return "This is a friendly reminder that an event you're interested in is happening tomorrow.";
}

function buildEventReminderSubject(eventTitle, reminderType) {
  const prefix =
    reminderType === "30d"
      ? "Coming up in 30 days"
      : reminderType === "7d"
        ? "Coming up in 1 week"
        : "Happening tomorrow";
  return `${prefix}: ${eventTitle}`;
}

function buildConnectionEventUploadedSubject(organizerUsername, eventTitle) {
  const host = organizerUsername.trim() || "A connection";
  return `${host} uploaded a new event: ${eventTitle}`;
}

function buildConnectionEventUploadedHtml(input) {
  const displayName = input.recipientUsername || "there";
  const host = input.organizerUsername.trim() || "A connection";
  const when = getEventDateTimeLabel(input.startsAt, input.endsAt);
  const location = `${input.venueName}, ${input.areaName}`;

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi ${escapeHtml(displayName)},</p>
  <p><strong>${escapeHtml(host)}</strong> just uploaded a new event on Livon.</p>
  <p><strong>${escapeHtml(input.eventTitle)}</strong><br>
  ${escapeHtml(when)}<br>
  ${escapeHtml(location)}</p>
  <p><a href="${escapeHtml(input.eventUrl)}">View event on Livon</a></p>
  <p>— Livon</p>
</body>
</html>`;
}

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
  } else {
    console.log("OK:", message);
  }
}

assert(
  buildEventReminderSubject("Jazz Night", "30d") === "Coming up in 30 days: Jazz Night",
  "30d reminder subject"
);
assert(
  buildEventReminderSubject("Jazz Night", "7d") === "Coming up in 1 week: Jazz Night",
  "7d reminder subject"
);
assert(
  buildEventReminderSubject("Jazz Night", "1d") === "Happening tomorrow: Jazz Night",
  "1d reminder subject"
);
assert(reminderLead("30d").includes("30 days"), "30d reminder lead copy");

assert(
  buildConnectionEventUploadedSubject("thabo", "Open Mic") ===
    "thabo uploaded a new event: Open Mic",
  "connection-upload subject with username"
);
assert(
  buildConnectionEventUploadedSubject("  ", "Open Mic") ===
    "A connection uploaded a new event: Open Mic",
  "connection-upload subject falls back without username"
);

const html = buildConnectionEventUploadedHtml({
  recipientUsername: "lero",
  organizerUsername: "thabo",
  eventTitle: "Open Mic <script>",
  eventUrl: "https://livon.live/events/abc",
  startsAt: new Date(Date.UTC(2026, 8, 1, 18, 0, 0)),
  endsAt: null,
  venueName: "The Spot",
  areaName: "Maseru",
});
assert(html.includes("Hi lero,"), "connection-upload greets recipient");
assert(html.includes("thabo"), "connection-upload names organizer");
assert(html.includes("Open Mic &lt;script&gt;"), "connection-upload escapes HTML in title");
assert(!html.includes("<script>"), "connection-upload does not emit raw script tags from title");

if (process.exitCode) {
  console.error("\nSome notification template checks failed.");
  process.exit(1);
}
console.log("\nAll notification template checks passed.");
