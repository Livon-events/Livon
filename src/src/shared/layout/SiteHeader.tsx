import AppHeader from "./AppHeader";
import DesktopHeader from "./DesktopHeader";
import { createClient } from "@/shared/supabase/server";
import { getLocationPickerData } from "@/modules/location/queries";
import { getOrganizerLocationContext } from "@/modules/users/queries";
import { ALL_AREAS_ID } from "@/modules/location";

export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cities = await getLocationPickerData();
  const defaultCity = cities[0];

  const location = user ? await getOrganizerLocationContext(user.id) : null;
  const hasAccountPreference = Boolean(location);

  const activeCity =
    (location && cities.find((c) => c.id === location.cityId)) ?? defaultCity;

  if (!activeCity) {
    // No cities seeded at all — nothing sensible to render. Shouldn't
    // happen past initial setup, but fail loudly rather than crash on
    // `activeCity.id` below.
    throw new Error("SiteHeader: no cities found — has the cities table been seeded?");
  }

  const initialAreaId = location
    ? (location.areaId ?? ALL_AREAS_ID)
    : (activeCity.areas[0]?.id ?? ALL_AREAS_ID);

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
