import { redirect } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { getCategories } from "@/modules/categories/queries";
import { getLocationPickerData } from "@/modules/location/queries";
import { DEFAULT_CITY_NAME } from "@/modules/location";
import { getOrganizerLocationContext } from "@/modules/users/queries";
import { CreateEventPage } from "@/modules/events";

export default async function CreateEventRoute() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/create-event");
  }

  const [categories, cities, location] = await Promise.all([
    getCategories(),
    getLocationPickerData(),
    getOrganizerLocationContext(user.id),
  ]);

  // Pre-fill only — the host's current header selection is a sensible
  // default for the form's own Area field, but it's just that: a default,
  // freely changeable, and never re-read from the header at submission
  // time (see modules/events/serverMutations.ts). A header with no
  // resolved area (e.g. scoped to "All areas", or no preference set yet)
  // simply leaves the picker unselected.
  const defaultCity = cities.find((city) => city.name === DEFAULT_CITY_NAME) ?? cities[0];
  const initialCityId = location?.cityId ?? defaultCity?.id ?? null;
  const initialAreaId = location?.areaId ?? null;

  return (
    <CreateEventPage
      categories={categories}
      cities={cities}
      initialCityId={initialCityId}
      initialAreaId={initialAreaId}
    />
  );
}
