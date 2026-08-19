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
 * Cities with their areas, for the header's City → Area picker and the
 * create-event form. `cities`/`areas` are both public read-only reference
 * tables (RLS: SELECT `true` for anon + authenticated — see
 * docs/db/rls-policies.md), so this works for logged-out visitors too.
 *
 * Per docs/FR/location-toggle.md this always fetches the real city list
 * rather than assuming a single city. Ordered by name for deterministic
 * display; the default city is resolved by name (Maseru) in SiteHeader.
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
