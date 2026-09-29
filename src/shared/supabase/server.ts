import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server Actions.
 * Must be created fresh per-request (reads cookies for the current request).
 *
 * Usage in a Server Component:
 *   const supabase = await createClient();
 *   const { data, error } = await supabase.from("cities").select("*").limit(1);
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * The signed-in user for the current request, validated against Supabase
 * Auth. Memoized per request so the layout, page, and queries share one
 * Auth round-trip. Outside a React server render (Route Handlers, Server
 * Actions) `cache` does not memoize, so each call still validates.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
