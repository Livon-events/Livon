import { createClient } from "@/lib/supabase/server";

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
 * docs/FR/location-toggle.md — the event form itself has no location field;
 * `city_id`/`area_id` are set server-side from this account preference.
 *
 * Returns null if there's no signed-in user, or no preference set yet at
 * all (no city chosen) — both cases the caller should treat as "can't
 * create an event yet".
 *
 * Deliberately re-read fresh on every call (no caching) — the FR calls out
 * that a stale value from an earlier page load must not be used at submit
 * time, since the header selection can change mid-session or in another tab.
 *
 * When an area is selected, `cityId`/`cityName` are derived from the
 * area's own `city_id` FK (not from `users.preferred_city_id` directly) —
 * schema.md confirms there's no constraint tying the two preference
 * columns together, so this guarantees the pair we hand back is always
 * internally consistent (an event's `area_id` will always actually belong
 * to its `city_id`).
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
