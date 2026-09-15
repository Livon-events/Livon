import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/shared/supabase/server";
import { createAdminClient } from "@/shared/supabase/admin";

// Same cookie used across visits from one anonymous browser, so
// redeem_invite's per-visitor dedup (invite_link_clicks_unique_anon,
// see docs/db/schema.md) actually dedupes rather than double-counting a
// new session on every click.
const ANON_SESSION_COOKIE = "livon_anon_session_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Matches the bound inside redeem_invite; a longer code cannot exist
// (invite_links.code is generated, not user-supplied) so it is rejected
// before it reaches the database.
const MAX_CODE_LENGTH = 64;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RedeemInviteResult = {
  event_id: string | null;
};

/**
 * Resolves a shared invite link (docs/FR/invite.md, docs/FR/invite-links.md):
 *   livon.live/i/{code} -> redeem_invite RPC -> redirect to /events/{id}
 *
 * This has to be a redirecting route handler rather than a page — the
 * click needs to be recorded (and, for signed-out visitors, an
 * anon_session_id cookie set) *before* landing on the event page, and
 * `invite_links_select_own` means only `redeem_invite` (SECURITY DEFINER)
 * can resolve someone else's code at all.
 *
 * `redeem_invite` is service_role-only (docs/security-definer-risks.md R5):
 * click dedup keys on the anonymous visitor id, so a browser that could call
 * the RPC directly could inflate one click into unlimited unique visitors by
 * sending a fresh UUID each time. This route is the only caller, and it
 * derives all three identity inputs itself — the session user from the
 * request cookies, the visitor id from an HTTP-only cookie, and the client
 * IP from the proxy headers (PostgREST would otherwise see this server's
 * address, not the visitor's).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const homeRedirect = NextResponse.redirect(new URL("/", request.url));

  if (!code || code.length > MAX_CODE_LENGTH) {
    return homeRedirect;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const existingAnonSessionId = cookieStore.get(ANON_SESSION_COOKIE)?.value;
  const hasValidAnonSession =
    existingAnonSessionId !== undefined && UUID_PATTERN.test(existingAnonSessionId);

  // Signed-in visitors are deduped by user_id, so they never get an anon id.
  // A signed-out visitor without a usable cookie gets one issued here rather
  // than in SQL, so the identifier is always server-derived.
  const anonSessionId = user
    ? null
    : hasValidAnonSession
      ? existingAnonSessionId
      : crypto.randomUUID();
  const issuedAnonSessionId = anonSessionId !== null && !hasValidAnonSession;

  const { data, error } = await createAdminClient()
    .rpc("redeem_invite", {
      p_code: code,
      p_anon_session_id: anonSessionId,
      p_user_id: user?.id ?? null,
      p_client_ip: clientIpFrom(request),
    })
    .single<RedeemInviteResult>();

  // Unknown code, or the RPC itself failed — nothing sensible to redirect
  // to, so send the visitor home rather than a broken event page.
  if (error || !data?.event_id) {
    return homeRedirect;
  }

  const response = NextResponse.redirect(new URL(`/events/${data.event_id}`, request.url));

  if (issuedAnonSessionId && anonSessionId) {
    response.cookies.set(ANON_SESSION_COOKIE, anonSessionId, {
      maxAge: ONE_YEAR_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return response;
}

// x-forwarded-for can be a comma-separated proxy chain; the first entry is
// the original client.
function clientIpFrom(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim();

  return clientIp || "unknown";
}
