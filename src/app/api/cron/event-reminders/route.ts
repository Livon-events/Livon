import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/shared/security/rateLimit";
import { sendDueEventReminders } from "@/modules/notifications/reminders";

export const runtime = "nodejs";

// Vercel Cron retries on failure, so the limit has to leave room for a few
// legitimate same-day invocations while still blunting secret brute-forcing.
const MAX_REQUESTS_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  // timingSafeEqual throws unless both buffers are the same length, and an
  // early length check would itself leak the secret's length — hashing both
  // sides first gives fixed-width inputs regardless of what was sent.
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const provided = createHash("sha256").update(authHeader).digest();

  return timingSafeEqual(expected, provided);
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "unknown";
}

export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  if (
    !checkRateLimit(`cron:event-reminders:${ip}`, {
      maxRequests: MAX_REQUESTS_PER_WINDOW,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
  ) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";

  try {
    const result = await sendDueEventReminders({ dryRun });

    // Failure details stay in the server log — the response only carries a
    // count, so event/user ids and raw Postgres messages aren't echoed back.
    if (result.errors.length > 0) {
      console.error("[cron/event-reminders] errors", JSON.stringify(result.errors));
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      sent7d: result.sent7d,
      sent1d: result.sent1d,
      skipped: result.skipped,
      errorCount: result.errors.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/event-reminders]", message);
    return NextResponse.json({ ok: false, error: "Reminder run failed." }, { status: 500 });
  }
}
