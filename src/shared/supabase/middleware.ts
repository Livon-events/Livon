import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and keeps the
 * request/response cookies in sync. This is what makes sessions survive
 * a full page refresh — without it, Server Components can read a stale
 * or expired access token from the cookie.
 *
 * Route protection itself (redirecting unauthenticated users away from
 * gated pages) is intentionally NOT done here for this task's scope —
 * `/profile` checks the user itself and redirects. This keeps middleware
 * focused on the one job it must do (session refresh) rather than also
 * owning a route-matching allow/deny list, which later tasks (Connections,
 * RSVP, create event) will each need their own gating for anyway.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this refreshes the auth token. Reading the user here
  // (not just the session) forces a round-trip validation against Supabase
  // Auth rather than trusting a possibly-stale cookie.
  await supabase.auth.getUser();

  return supabaseResponse;
}
