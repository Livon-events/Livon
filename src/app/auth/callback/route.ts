import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the redirect back from Supabase Auth after Google OAuth
 * (and would also handle email-link flows like password reset in future
 * tasks). Exchanges the `code` param for a session, then redirects on.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong (missing/invalid code, exchange failed) —
  // send the user back to login with a generic notice.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
