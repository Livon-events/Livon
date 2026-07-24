import { createClient } from "@/lib/supabase/server";

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
