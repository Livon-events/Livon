import "server-only";
import { DEFAULT_CITY_NAME } from "@/modules/location/constants";
import { readLocationPreferenceCookie } from "@/modules/location/cookie";
import type { LocationPickerCity } from "@/modules/location/queries";
import type { OrganizerLocationContext } from "@/modules/users/queries";

export type FeedLocationScope = {
  cityId: string;
  /** null = All areas within `cityId`. */
  areaId: string | null;
};

/**
 * Resolves the City → Area scope for feed/listing queries, matching the
 * header location toggle (docs/FR/location-toggle.md):
 * - Account preference wins when set.
 * - Else device cookie (logged-out / pre-account selection).
 * - Else default city + All areas.
 */
export async function resolveFeedLocationScope({
  cities,
  accountLocation,
}: {
  cities: LocationPickerCity[];
  accountLocation: OrganizerLocationContext | null;
}): Promise<FeedLocationScope> {
  const defaultCity = cities.find((city) => city.name === DEFAULT_CITY_NAME) ?? cities[0];

  if (!defaultCity) {
    throw new Error("resolveFeedLocationScope: no cities found — has the cities table been seeded?");
  }

  if (accountLocation) {
    return { cityId: accountLocation.cityId, areaId: accountLocation.areaId };
  }

  const devicePref = await readLocationPreferenceCookie();
  if (devicePref && cities.some((city) => city.id === devicePref.cityId)) {
    return { cityId: devicePref.cityId, areaId: devicePref.areaId };
  }

  return { cityId: defaultCity.id, areaId: null };
}
