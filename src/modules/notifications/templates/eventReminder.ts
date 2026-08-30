import { getEventDateTimeLabel } from "@/modules/events";

export type ReminderType = "7d" | "1d";

export type EventReminderEmailInput = {
  recipientUsername: string;
  eventTitle: string;
  eventUrl: string;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string;
  areaName: string;
  reminderType: ReminderType;
};

function reminderLead(reminderType: ReminderType): string {
  return reminderType === "7d"
    ? "This is a friendly reminder that an event you're interested in is coming up in one week."
    : "This is a friendly reminder that an event you're interested in is happening tomorrow.";
}

export function buildEventReminderSubject(
  eventTitle: string,
  reminderType: ReminderType
): string {
  const prefix = reminderType === "7d" ? "Coming up in 1 week" : "Happening tomorrow";
  return `${prefix}: ${eventTitle}`;
}

export function buildEventReminderHtml(input: EventReminderEmailInput): string {
  const displayName = input.recipientUsername || "there";
  const when = getEventDateTimeLabel(input.startsAt, input.endsAt);
  const location = `${input.venueName}, ${input.areaName}`;

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Hi ${escapeHtml(displayName)},</p>
  <p>${escapeHtml(reminderLead(input.reminderType))}</p>
  <p><strong>${escapeHtml(input.eventTitle)}</strong><br>
  ${escapeHtml(when)}<br>
  ${escapeHtml(location)}</p>
  <p><a href="${escapeHtml(input.eventUrl)}">View event on Livon</a></p>
  <p>— Livon</p>
</body>
</html>`;
}

export function buildEventReminderText(input: EventReminderEmailInput): string {
  const displayName = input.recipientUsername || "there";
  const when = getEventDateTimeLabel(input.startsAt, input.endsAt);
  const location = `${input.venueName}, ${input.areaName}`;

  return `Hi ${displayName},

${reminderLead(input.reminderType)}

${input.eventTitle}
${when}
${location}

View event: ${input.eventUrl}

— Livon`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
