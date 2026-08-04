import { NextResponse } from "next/server";
import { exchangeOAuthCode } from "@/modules/auth/serverMutations";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/profile";

  // Security: Only allow relative paths
  if (!next.startsWith("/")) {
    next = "/profile";
  }

  if (code) {
    const { ok } = await exchangeOAuthCode(code);
    if (ok) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
