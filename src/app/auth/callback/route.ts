import { NextResponse } from "next/server";
import { exchangeOAuthCode } from "@/modules/auth/serverMutations";
import { safeInternalPath } from "@/shared/security/urls";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"), "/profile");

  if (code) {
    const { ok } = await exchangeOAuthCode(code);
    if (ok) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
