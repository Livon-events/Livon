import AppHeader from "./AppHeader";
import DesktopHeader from "./DesktopHeader";
import { createClient } from "@/shared/supabase/server";
import { getLocationPickerData } from "@/modules/location/queries";
import { readLocationPreferenceCookie } from "@/modules/location/cookie";
import { getOrganizerLocationContext } from "@/modules/users/queries";
import { ALL_AREAS_ID, DEFAULT_CITY_NAME } from "@/modules/location";

export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cities = await getLocationPickerData();
  const defaultCity = cities.find((city) => city.name === DEFAULT_CITY_NAME) ?? cities[0];

  const location = user ? await getOrganizerLocationContext(user.id) : null;
  const hasAccountPreference = Boolean(location);
  const devicePref = !hasAccountPreference ? await readLocationPreferenceCookie() : null;

  const activeCity =
    (location && cities.find((c) => c.id === location.cityId)) ??
    (devicePref && cities.find((c) => c.id === devicePref.cityId)) ??
    defaultCity;

  if (!activeCity) {
    // No cities seeded at all — nothing sensible to render. Shouldn't
    // happen past initial setup, but fail loudly rather than crash on
    // `activeCity.id` below.
    throw new Error("SiteHeader: no cities found — has the cities table been seeded?");
  }

  // Default is All areas unless the user (account or device) picked a
  // specific area — see docs/FR/location-toggle.md feed scoping.
  const initialAreaId = location
    ? (location.areaId ?? ALL_AREAS_ID)
    : devicePref && devicePref.cityId === activeCity.id
      ? (devicePref.areaId ?? ALL_AREAS_ID)
      : ALL_AREAS_ID;

  return (
    <>
      <div className="md:hidden">
        <AppHeader
          userId={user?.id ?? null}
          cityId={activeCity.id}
          cityName={activeCity.name}
          areas={activeCity.areas}
          initialAreaId={initialAreaId}
          hasAccountPreference={hasAccountPreference}
        />
        {/* Spacer matching AppHeader's rendered height (~71.5px: py-3
            (24px) + 44px logo box + 3.5px border), rounded up slightly. */}
        <div className="h-[72px]" aria-hidden="true" />
      </div>
      <div className="hidden md:block">
        <DesktopHeader
          userId={user?.id ?? null}
          cityId={activeCity.id}
          cityName={activeCity.name}
          areas={activeCity.areas}
          initialAreaId={initialAreaId}
          hasAccountPreference={hasAccountPreference}
        />
        {/* Spacer matching DesktopHeader's rendered height (~79.5px:
            py-4 (32px) + 44px content row + 3.5px border), rounded up. */}
        <div className="h-20" aria-hidden="true" />
      </div>
    </>
  );
}
