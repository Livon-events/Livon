import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/shared/supabase/server";

// Same cookie used across visits from one anonymous browser, so
// redeem_invite's per-visitor dedup (invite_link_clicks_unique_anon,
// see docs/db/schema.md) actually dedupes rather than double-counting a
// new session on every click.
const ANON_SESSION_COOKIE = "livon_anon_session_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type RedeemInviteResult = {
  event_id: string | null;
  anon_session_id: string | null;
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
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const existingAnonSessionId = cookieStore.get(ANON_SESSION_COOKIE)?.value;

  const { data, error } = await supabase
    .rpc("redeem_invite", {
      p_code: code,
      p_anon_session_id: existingAnonSessionId ?? null,
    })
    .single<RedeemInviteResult>();

  // Unknown code, or the RPC itself failed — nothing sensible to redirect
  // to, so send the visitor home rather than a broken event page.
  if (error || !data?.event_id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(new URL(`/events/${data.event_id}`, request.url));

  // Only set when the RPC issued a new one (first-time anonymous visitor);
  // an authenticated caller, or one whose existing cookie was already
  // valid, gets `anon_session_id: null` back and nothing changes here.
  if (data.anon_session_id) {
    response.cookies.set(ANON_SESSION_COOKIE, data.anon_session_id, {
      maxAge: ONE_YEAR_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return response;
}
