import "server-only";
import { createAdminClient } from "@/shared/supabase/admin";
import { getSiteUrl } from "@/shared/siteUrl";
import { getFromEmail, getResendClient } from "@/modules/notifications/resendClient";
import {
  buildConnectionEventUploadedHtml,
  buildConnectionEventUploadedSubject,
  buildConnectionEventUploadedText,
} from "@/modules/notifications/templates/connectionEventUploaded";

export type SendConnectionEventNotificationsOptions = {
  dryRun?: boolean;
  /** Cap claimed/previewed rows per run (post-create burst + daily cron). */
  limit?: number;
};

export type SendConnectionEventNotificationsResult = {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

type ClaimedNotificationRow = {
  queue_id: string;
  event_id: string;
  recipient_user_id: string;
  recipient_email: string | null;
  recipient_username: string | null;
  event_title: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string;
  area_name: string | null;
  organizer_username: string | null;
};

const DEFAULT_LIMIT = 50;
const MAX_ATTEMPTS = 5;

export async function sendDueConnectionEventNotifications(
  options: SendConnectionEventNotificationsOptions = {}
): Promise<SendConnectionEventNotificationsResult> {
  const dryRun = options.dryRun ?? false;
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), 200);
  const supabase = createAdminClient();
  const siteUrl = getSiteUrl();

  const result: SendConnectionEventNotificationsResult = {
    claimed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  if (dryRun) {
    const { data: preview, error: previewError } = await supabase.rpc(
      "preview_connection_event_notifications",
      {
        p_limit: limit,
        p_stale_minutes: 15,
        p_max_attempts: MAX_ATTEMPTS,
      }
    );

    if (previewError) {
      result.errors.push(`preview: ${previewError.message}`);
      return result;
    }

    const rows = (preview ?? []) as ClaimedNotificationRow[];
    result.claimed = rows.length;
    result.sent = rows.filter((row) => row.recipient_email?.trim()).length;
    result.skipped = rows.length - result.sent;
    return result;
  }

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_connection_event_notifications",
    {
      p_limit: limit,
      p_stale_minutes: 15,
      p_max_attempts: MAX_ATTEMPTS,
    }
  );

  if (claimError) {
    result.errors.push(`claim: ${claimError.message}`);
    return result;
  }

  const rows = (claimed ?? []) as ClaimedNotificationRow[];
  result.claimed = rows.length;

  if (rows.length === 0) {
    return result;
  }

  const resend = getResendClient();
  const fromEmail = getFromEmail();

  for (const row of rows) {
    const email = row.recipient_email?.trim();
    if (!email) {
      result.skipped += 1;
      const { error: skipError } = await supabase
        .from("connection_event_notification_queue")
        .update({
          status: "failed",
          last_error: "missing_email",
          claimed_at: null,
        })
        .eq("id", row.queue_id);
      if (skipError) {
        result.errors.push(`skip mark (${row.queue_id}): ${skipError.message}`);
      }
      continue;
    }

    const emailInput = {
      recipientUsername: row.recipient_username?.trim() ?? "",
      organizerUsername: row.organizer_username?.trim() ?? "",
      eventTitle: row.event_title,
      eventUrl: `${siteUrl}/events/${row.event_id}`,
      startsAt: new Date(row.starts_at),
      endsAt: row.ends_at ? new Date(row.ends_at) : null,
      venueName: row.venue_name,
      areaName: row.area_name ?? "",
    };

    const { error: sendError } = await resend.emails.send(
      {
        from: fromEmail,
        to: email,
        subject: buildConnectionEventUploadedSubject(
          emailInput.organizerUsername,
          row.event_title
        ),
        html: buildConnectionEventUploadedHtml(emailInput),
        text: buildConnectionEventUploadedText(emailInput),
      },
      {
        idempotencyKey: `connection-event:${row.event_id}:${row.recipient_user_id}`,
      }
    );

    if (sendError) {
      result.failed += 1;
      result.errors.push(
        `send (${row.event_id}, ${row.recipient_user_id}): ${sendError.message}`
      );
      const { error: failError } = await supabase
        .from("connection_event_notification_queue")
        .update({
          status: "failed",
          last_error: sendError.message.slice(0, 500),
          claimed_at: null,
        })
        .eq("id", row.queue_id);
      if (failError) {
        result.errors.push(`fail mark (${row.queue_id}): ${failError.message}`);
      }
      continue;
    }

    const { error: sentError } = await supabase
      .from("connection_event_notification_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        claimed_at: null,
      })
      .eq("id", row.queue_id);

    if (sentError) {
      result.errors.push(`sent mark (${row.queue_id}): ${sentError.message}`);
      continue;
    }

    result.sent += 1;
  }

  return result;
}
