import "server-only";
import { createClient } from "@/shared/supabase/server";

/**
 * Server-only — uses the server Supabase client (reads/writes cookies for
 * the current request), so this can't be called from a Client Component.
 * Extracted from `app/auth/callback/route.ts` during the restructuring so
 * the route itself stays a thin adapter.
 */
export async function exchangeOAuthCode(code: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return { ok: !error };
}
