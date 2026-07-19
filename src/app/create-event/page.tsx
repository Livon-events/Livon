import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries/categories";
import { getOrganizerLocationContext } from "@/lib/queries/users";
import CreateEventPage from "@/components/events/create/CreateEventPage";

export default async function CreateEventRoute() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/create-event");
  }

  const [categories, location] = await Promise.all([
    getCategories(),
    getOrganizerLocationContext(user.id),
  ]);

  // Informational only — the /api/events route re-checks this fresh at
  // submit time regardless, per docs/FR/location-toggle.md. Showing it here
  // too just avoids someone filling out the whole form before finding out.
  const locationReady = Boolean(location?.areaId);
  const locationLabel =
    location?.areaName && location.cityName ? `${location.areaName}, ${location.cityName}` : null;

  return (
    <CreateEventPage
      categories={categories}
      locationReady={locationReady}
      locationLabel={locationLabel}
    />
  );
}
