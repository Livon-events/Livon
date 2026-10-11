import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-less anon client for public reference tables (categories, cities,
 * areas — RLS SELECT `true` for anon). Reads no request state, so it is safe
 * inside `unstable_cache`. Never use it for viewer-specific data.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
