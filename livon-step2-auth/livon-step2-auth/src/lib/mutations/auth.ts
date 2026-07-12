import { createClient } from "@/lib/supabase/client";

type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const GENERIC_LOGIN_ERROR = "Incorrect username/email or password.";

/**
 * Sign up with username + email + password.
 * `public.users` is populated by the `handle_new_user` DB trigger —
 * this never inserts into `public.users` directly.
 */
export async function signUpWithEmail(input: {
  username: string;
  email: string;
  password: string;
}): Promise<Result<{ needsEmailConfirmation: boolean }>> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { username: input.username },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // If email confirmations are on, Supabase returns a user with no session yet.
  const needsEmailConfirmation = !!data.user && !data.session;

  return { ok: true, data: { needsEmailConfirmation } };
}

/**
 * Sign in with a username OR email + password.
 * Resolves the identifier to an email via the `resolve_login_email` RPC
 * (SECURITY DEFINER, anon-callable) first, since Supabase Auth itself
 * only signs in by email.
 *
 * Always returns the same generic error regardless of whether the
 * identifier resolved to a real account — no enumeration branching.
 */
export async function signInWithEmail(input: {
  identifier: string;
  password: string;
}): Promise<Result> {
  const supabase = createClient();

  const { data: resolvedEmail, error: resolveError } = await supabase.rpc(
    "resolve_login_email",
    { p_identifier: input.identifier },
  );

  // Treat an RPC failure the same as "not found" — never reveal which case it was.
  const email = !resolveError && resolvedEmail ? (resolvedEmail as string) : null;

  if (!email) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (signInError) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  return { ok: true, data: undefined };
}

/**
 * Kicks off the Google OAuth handshake. Supabase redirects the browser
 * to Google, then back to /auth/callback to exchange the code for a session.
 */
export async function signInWithGoogle(): Promise<Result> {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
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
