import "server-only";
import { createClient } from "@/shared/supabase/server";

/**
 * All reads of the `users` table live here. `getPublicProfile` moved from
 * `lib/queries/public-profile.ts` (that file's connections-related exports
 * moved to `modules/connections/queries.ts` and its events-related export
 * moved to `modules/events/queries.ts` — see docs/FR/architecture.md for
 * the module boundary this follows). `getOrganizerLocationContext` moved
 * from `lib/queries/users.ts` unchanged.
 */

export type PublicProfile = {
  userId: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  tiktokUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
};

type PublicProfileRow = {
  user_id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  tiktok_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
};

/**
 * Basic profile fields for the header/bio/links sections. Null if no such
 * user. Reachable by anonymous callers too, per docs/FR/search.md — goes
 * through `get_public_profile`, a SECURITY DEFINER function, rather than a
 * direct `users` table select, since `users` has no `anon` SELECT policy
 * at all (see docs/db/rls-policies.md). Only public-safe fields are
 * exposed (never email).
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_public_profile", { p_user_id: userId })
    .maybeSingle<PublicProfileRow>();

  if (error || !data) {
    return null;
  }

  return {
    userId: data.user_id,
    username: data.username ?? "User",
    bio: data.bio,
    avatarUrl: data.avatar_url,
    tiktokUrl: data.tiktok_url,
    instagramUrl: data.instagram_url,
    facebookUrl: data.facebook_url,
  };
}

export type OwnProfileBasics = {
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

/**
 * Basic profile fields for the signed-in user's OWN profile page header.
 * Unlike `getPublicProfile`, this doesn't go through the
 * `get_public_profile` SECURITY DEFINER RPC — the `users` SELECT policy
 * ("Users are viewable by authenticated users", `qual = true`) already
 * permits an authenticated caller to read any row including their own, so
 * a plain select is enough here and doesn't need the anon-visitor
 * workaround `getPublicProfile` exists for.
 *
 * Added during the modular-monolith restructuring to replace a direct
 * `supabase.from("users")` call that used to live inline in
 * `app/profile/page.tsx` — that page is `users`-module content, so the
 * query belongs in this file, not embedded in the route.
 */
export async function getOwnProfileBasics(userId: string): Promise<OwnProfileBasics | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("username, bio, avatar_url")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    username: data.username,
    bio: data.bio,
    avatarUrl: data.avatar_url,
  };
}


export type OrganizerLocationContext = {
  cityId: string;
  cityName: string;
  areaId: string | null; // null = "All Areas" — event creation must block on this
  areaName: string | null;
};

type UserLocationRow = {
  preferred_city_id: string | null;
  preferred_area_id: string | null;
  city: { name: string } | null;
  area: { name: string; city_id: string; city: { name: string } | null } | null;
};

/**
 * Resolves the signed-in organiser's current City/Area, per
 * docs/FR/location-toggle.md — the event form itself has no location
 * field; `city_id`/`area_id` are set server-side from this account
 * preference. Called from `modules/events/serverMutations.ts` as a
 * cross-module read (events doesn't own `users`, so it calls this
 * function rather than querying `users` itself).
 *
 * Returns null if there's no signed-in user, or no preference set yet at
 * all. Deliberately re-read fresh on every call (no caching).
 *
 * When an area is selected, `cityId`/`cityName` are derived from the
 * area's own `city_id` FK (not from `users.preferred_city_id` directly) —
 * this guarantees the pair handed back is always internally consistent.
 */
export async function getOrganizerLocationContext(
  userId: string
): Promise<OrganizerLocationContext | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select(
      `preferred_city_id, preferred_area_id,
       city:cities!preferred_city_id ( name ),
       area:areas!preferred_area_id ( name, city_id, city:cities!city_id ( name ) )`
    )
    .eq("user_id", userId)
    .single<UserLocationRow>();

  if (error || !data || !data.preferred_city_id) {
    return null;
  }

  if (data.area) {
    return {
      cityId: data.area.city_id,
      cityName: data.area.city?.name ?? "",
      areaId: data.preferred_area_id,
      areaName: data.area.name,
    };
  }

  return {
    cityId: data.preferred_city_id,
    cityName: data.city?.name ?? "",
    areaId: null,
    areaName: null,
  };
}
