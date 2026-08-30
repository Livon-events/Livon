import { createClient } from "@/shared/supabase/client";

type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Kicks off the Google OAuth handshake. Supabase redirects the browser
 * to Google, then back to /auth/callback to exchange the code for a session.
 *
 * New accounts are created on first Google sign-in (`handle_new_user`
 * populates `public.users`). Existing accounts with the same email are
 * auto-linked — this never deletes or replaces a user row.
 *
 * `next` is forwarded as a query param on the callback URL so the callback
 * route (app/auth/callback/route.ts) knows where to send the user after
 * exchanging the code — otherwise it falls back to /profile, dropping
 * whatever protected page originally redirected them to login/signup.
 */
export async function signInWithGoogle(next?: string): Promise<Result> {
  const supabase = createClient();

  const callbackUrl = new URL("/auth/callback", window.location.origin);
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    callbackUrl.searchParams.set("next", next);
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Browser is being redirected to Google; nothing more to do here.
  return { ok: true, data: undefined };
}

export async function signOut(): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}
