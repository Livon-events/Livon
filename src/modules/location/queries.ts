import "server-only";
import { createClient } from "@/shared/supabase/server";

export type LocationPickerArea = {
  id: string;
  name: string;
};

export type LocationPickerCity = {
  id: string;
  name: string;
  areas: LocationPickerArea[];
};

type CityRow = {
  city_id: string;
  name: string;
  areas: { area_id: string; name: string }[] | null;
};

/**
 * All cities with their areas, for the header's City → Area picker.
 * `cities`/`areas` are both public read-only reference tables (RLS: SELECT
 * `true` for anon + authenticated — see docs/db/rls-policies.md), so this
 * works for logged-out visitors too.
 *
 * Only one city exists at launch (Maseru), but per
 * docs/FR/location-toggle.md ("toggle UI should support a City list even
 * though only Maseru exists at launch — don't hardcode to a single city")
 * this always fetches the real list rather than assuming one row.
 *
 * Ordered by name for determinism — there's no `is_default`/`sort_order`
 * column on either table (per docs/db/schema.md), so "first city, first
 * area" (alphabetical) is what currently resolves to the intended
 * Maseru → Maseru Central default. If a real ordering/default flag gets
 * added later, switch to that instead of relying on name sort.
 */
export async function getLocationPickerData(): Promise<LocationPickerCity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cities")
    .select("city_id, name, areas ( area_id, name )")
    .order("name", { ascending: true })
    .returns<CityRow[]>();

  if (error) {
    throw new Error(`getLocationPickerData failed: ${error.message}`);
  }

  return (data ?? []).map((city) => ({
    id: city.city_id,
    name: city.name,
    areas: [...(city.areas ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((area) => ({ id: area.area_id, name: area.name })),
  }));
}

export type LocationAreaWithCity = {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
};

type AreaRow = {
  area_id: string;
  name: string;
  city_id: string;
  city: { name: string } | null;
};

/**
 * Resolves a single area id to its name + parent city. Used by
 * `modules/events/serverMutations.ts` to re-verify the area an organiser
 * picked on the create-event form (per docs/FR/event-creation-form.md) —
 * the client's copy of the areas list is never trusted directly, same
 * pattern as the categoryId re-check in that file. `cityId`/`cityName`
 * are derived from the area's own `city_id` FK, not supplied by the
 * caller, so the pair returned is always internally consistent.
 *
 * Returns null if `areaId` doesn't match a real row.
 */
export async function getAreaById(areaId: string): Promise<LocationAreaWithCity | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("areas")
    .select("area_id, name, city_id, city:cities!city_id ( name )")
    .eq("area_id", areaId)
    .maybeSingle<AreaRow>();

  if (error || !data || !data.city) {
    return null;
  }

  return { id: data.area_id, name: data.name, cityId: data.city_id, cityName: data.city.name };
}
