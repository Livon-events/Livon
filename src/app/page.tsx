import { EventCardGrid } from "@/modules/events";
// import { CategoryFilterBar } from "@/modules/feed";
import { getHomeFeed } from "@/modules/feed/queries";
import { Analytics } from "@vercel/analytics/next"
// import { getCategories } from "@/modules/categories/queries";

// type HomeProps = {
//   searchParams: Promise<{ category?: string }>;
// };

export default async function Home() {
  // const { category: activeCategoryName } = await searchParams;

  // const categories = await getCategories();
  // const activeCategory =
  //   categories.find((c) => c.name === activeCategoryName) ?? null;

  const { events } = await getHomeFeed({
    categoryId: null,
  });

  return (
    <main
      className="min-h-screen bg-black pt-4 md:pt-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-0"
    >
      <Analytics/>
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