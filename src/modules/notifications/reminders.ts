import "server-only";
import { getDaysUntilEventStart } from "@/modules/events";
import { createAdminClient } from "@/shared/supabase/admin";
import { getSiteUrl } from "@/shared/siteUrl";
import { getFromEmail, getResendClient } from "@/modules/notifications/resendClient";
import {
  buildEventReminderHtml,
  buildEventReminderSubject,
  buildEventReminderText,
  type ReminderType,
} from "@/modules/notifications/templates/eventReminder";

export type SendDueEventRemindersOptions = {
  dryRun?: boolean;
  now?: Date;
};

export type SendDueEventRemindersResult = {
  sent30d: number;
  sent7d: number;
  sent1d: number;
  skipped: number;
  errors: string[];
};

type EventRow = {
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string;
  areas: { name: string } | { name: string }[] | null;
};

type InterestRow = {
  user_id: string;
  users:
    | { email: string; username: string | null }
    | { email: string; username: string | null }[]
    | null;
};

function firstOrSelf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const REMINDER_OFFSETS: Record<ReminderType, number> = {
  "30d": 30,
  "7d": 7,
  "1d": 1,
};

const REMINDER_TYPES = ["30d", "7d", "1d"] as const satisfies readonly ReminderType[];

function getStartsAtRangeForOffset(dayOffset: number, now: Date): { start: string; end: string } {
  const targetDay =
    Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000) +
    dayOffset;
  const rangeStart = new Date(targetDay * 86_400_000);
  const rangeEnd = new Date((targetDay + 1) * 86_400_000);
  return { start: rangeStart.toISOString(), end: rangeEnd.toISOString() };
}

function bumpSentCount(result: SendDueEventRemindersResult, reminderType: ReminderType): void {
  if (reminderType === "30d") result.sent30d += 1;
  else if (reminderType === "7d") result.sent7d += 1;
  else result.sent1d += 1;
}

export async function sendDueEventReminders(
  options: SendDueEventRemindersOptions = {}
): Promise<SendDueEventRemindersResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  const supabase = createAdminClient();
  const siteUrl = getSiteUrl();

  const result: SendDueEventRemindersResult = {
    sent30d: 0,
    sent7d: 0,
    sent1d: 0,
    skipped: 0,
    errors: [],
  };

  const resend = dryRun ? null : getResendClient();
  const fromEmail = dryRun ? "" : getFromEmail();

  for (const reminderType of REMINDER_TYPES) {
    const dayOffset = REMINDER_OFFSETS[reminderType];
    const { start, end } = getStartsAtRangeForOffset(dayOffset, now);

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(
        `event_id, title, starts_at, ends_at, venue_name,
         areas ( name )`
      )
      .gte("starts_at", start)
      .lt("starts_at", end);

    if (eventsError) {
      const detail =
        eventsError.message ||
        (eventsError instanceof Error ? eventsError.message : String(eventsError));
      result.errors.push(`events query (${reminderType}): ${detail}`);
      continue;
    }

    for (const event of (events ?? []) as EventRow[]) {
      const startsAt = new Date(event.starts_at);
      const daysUntil = getDaysUntilEventStart(startsAt, now);
      if (daysUntil !== dayOffset) {
        continue;
      }

      const area = firstOrSelf(event.areas);

      const { data: interests, error: interestsError } = await supabase
        .from("event_interests")
        .select("user_id, users ( email, username )")
        .eq("event_id", event.event_id);

      if (interestsError) {
        result.errors.push(
          `interests query (${reminderType}, ${event.event_id}): ${interestsError.message}`
        );
        continue;
      }

      const { data: alreadySent, error: sentError } = await supabase
        .from("event_reminder_sends")
        .select("user_id")
        .eq("event_id", event.event_id)
        .eq("reminder_type", reminderType);

      if (sentError) {
        result.errors.push(
          `dedup query (${reminderType}, ${event.event_id}): ${sentError.message}`
        );
        continue;
      }

      const sentUserIds = new Set((alreadySent ?? []).map((row) => row.user_id));

      for (const interest of (interests ?? []) as InterestRow[]) {
        const user = firstOrSelf(interest.users);
        const email = user?.email?.trim();
        const username = user?.username?.trim() ?? "";

        if (!email) {
          result.skipped += 1;
          continue;
        }

        if (sentUserIds.has(interest.user_id)) {
          result.skipped += 1;
          continue;
        }

        const emailInput = {
          recipientUsername: username,
          eventTitle: event.title,
          eventUrl: `${siteUrl}/events/${event.event_id}`,
          startsAt,
          endsAt: event.ends_at ? new Date(event.ends_at) : null,
          venueName: event.venue_name,
          areaName: area?.name ?? "",
          reminderType,
        };

        if (dryRun) {
          bumpSentCount(result, reminderType);
          continue;
        }

        const { error: sendError } = await resend!.emails.send(
          {
            from: fromEmail,
            to: email,
            subject: buildEventReminderSubject(event.title, reminderType),
            html: buildEventReminderHtml(emailInput),
            text: buildEventReminderText(emailInput),
          },
          {
            idempotencyKey: `event-reminder:${event.event_id}:${interest.user_id}:${reminderType}`,
          }
        );

        if (sendError) {
          result.errors.push(
            `send (${reminderType}, ${event.event_id}, ${interest.user_id}): ${sendError.message}`
          );
          continue;
        }

        const { error: insertError } = await supabase.from("event_reminder_sends").insert({
          event_id: event.event_id,
          user_id: interest.user_id,
          reminder_type: reminderType,
        });

        if (insertError) {
          result.errors.push(
            `dedup insert (${reminderType}, ${event.event_id}, ${interest.user_id}): ${insertError.message}`
          );
          continue;
        }

        bumpSentCount(result, reminderType);
      }
    }
  }

  return result;
}
