import { getEventDateTimeLabel } from "@/modules/events";

export type ConnectionEventUploadedEmailInput = {
  recipientUsername: string;
  organizerUsername: string;
  eventTitle: string;
  eventUrl: string;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string;
  areaName: string;
};

export function buildConnectionEventUploadedSubject(
  organizerUsername: string,
  eventTitle: string
): string {
  const host = organizerUsername.trim() || "A connection";
  return `${host} uploaded a new event: ${eventTitle}`;
}

export function buildConnectionEventUploadedHtml(
  input: ConnectionEventUploadedEmailInput
): string {
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

export function buildConnectionEventUploadedText(
  input: ConnectionEventUploadedEmailInput
): string {
  const displayName = input.recipientUsername || "there";
  const host = input.organizerUsername.trim() || "A connection";
  const when = getEventDateTimeLabel(input.startsAt, input.endsAt);
  const location = `${input.venueName}, ${input.areaName}`;

  return `Hi ${displayName},

${host} just uploaded a new event on Livon.

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
