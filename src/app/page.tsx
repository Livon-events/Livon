import EventCardGrid from "@/components/events/EventCardGrid";
import CategoryFilterBar from "@/components/events/CategoryFilterBar";
import { getHomeFeed } from "@/lib/queries/home-feed";
import { getCategories } from "@/lib/queries/categories";

type HomeProps = {
  searchParams: Promise<{ category?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { category: activeCategoryName } = await searchParams;

  const categories = await getCategories();
  const activeCategory =
    categories.find((c) => c.name === activeCategoryName) ?? null;

  const { events } = await getHomeFeed({
    categoryId: activeCategory?.id ?? null,
  });

  return (
    <main
      className="min-h-screen bg-black pb-[calc(4rem+env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-0"
    >
      <CategoryFilterBar
        categories={categories.map((c) => c.name)}
        activeCategory={activeCategory?.name ?? null}
      />
      <EventCardGrid events={events} />
    </main>
  );
}