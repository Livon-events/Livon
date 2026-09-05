import { EventCardGrid } from "@/modules/events";
// import { CategoryFilterBar } from "@/modules/feed";
import { getHomeFeed } from "@/modules/feed/queries";
import { resolveFeedLocationScope } from "@/modules/location/feedScope";
import { getLocationPickerData } from "@/modules/location/queries";
import { getOrganizerLocationContext } from "@/modules/users/queries";
import { createClient } from "@/shared/supabase/server";
import { Analytics } from "@vercel/analytics/next";
// import { getCategories } from "@/modules/categories/queries";

// type HomeProps = {
//   searchParams: Promise<{ category?: string }>;
// };

export default async function Home() {
  // const { category: activeCategoryName } = await searchParams;

  // const categories = await getCategories();
  // const activeCategory =
  //   categories.find((c) => c.name === activeCategoryName) ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cities = await getLocationPickerData();
  const accountLocation = user ? await getOrganizerLocationContext(user.id) : null;
  const { cityId, areaId } = await resolveFeedLocationScope({
    cities,
    accountLocation,
  });

  const { events } = await getHomeFeed({
    categoryId: null,
    cityId,
    areaId,
  });

  return (
    <main
      className="min-h-screen bg-[#121212] pt-4 md:pt-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-0"
    >
      <Analytics />
      {/* CategoryFilterBar hidden for MVP — uncomment when there are enough events
      <CategoryFilterBar
        categories={categories.map((c) => c.name)}
        activeCategory={activeCategory?.name ?? null}
      />
      */}
      <EventCardGrid events={events} />
    </main>
  );
}
