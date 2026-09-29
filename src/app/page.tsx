import { Suspense } from "react";
import { CategoryFilterBar, HomeFeed, type HomeFeedResult } from "@/modules/feed";
import { getHomeFeed } from "@/modules/feed/queries";
import { getCategories } from "@/modules/categories/queries";
import { getLocationPickerData, resolveFeedLocationScope } from "@/modules/location/queries";
import { getOrganizerLocationContext } from "@/modules/users/queries";
import { getCurrentUser } from "@/shared/supabase/server";

type HomeProps = {
  searchParams: Promise<{ category?: string; free?: string }>;
};

type Categories = Awaited<ReturnType<typeof getCategories>>;
type Category = Categories[number];

type HomeFeedData = {
  initial: HomeFeedResult;
  remountKey: string;
};

async function loadHomeFeed(
  activeCategory: Promise<Category | null>,
  freeOnly: boolean
): Promise<HomeFeedData> {
  const [category, user, cities] = await Promise.all([
    activeCategory,
    getCurrentUser(),
    getLocationPickerData(),
  ]);
  const accountLocation = user ? await getOrganizerLocationContext(user.id) : null;

  const { cityId, areaId } = await resolveFeedLocationScope({
    cities,
    accountLocation,
  });

  const initial = await getHomeFeed({
    categoryId: category?.id ?? null,
    freeOnly,
    cityId,
    areaId,
  });

  return {
    initial,
    remountKey: `${category?.name ?? ""}:${freeOnly}:${cityId}:${areaId ?? ""}`,
  };
}

async function FilterBarContent({
  categories,
  activeCategory,
  freeOnly,
}: {
  categories: Promise<Categories>;
  activeCategory: Promise<Category | null>;
  freeOnly: boolean;
}) {
  const [allCategories, active] = await Promise.all([categories, activeCategory]);
  return (
    <CategoryFilterBar
      categories={allCategories.map((c) => c.name)}
      activeCategory={active?.name ?? null}
      freeOnly={freeOnly}
    />
  );
}

async function FeedContent({ feed }: { feed: Promise<HomeFeedData> }) {
  const { initial, remountKey } = await feed;
  return <HomeFeed key={remountKey} initial={initial} />;
}

function FeedSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-[13px] px-3 lg:grid-cols-3 lg:px-6" aria-label="Loading events">
      {[0, 1, 2].map((index) => (
        <div key={index} className="aspect-[4/5] animate-pulse rounded-xl bg-[#262626]" />
      ))}
    </div>
  );
}

function FilterBarSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1400px] gap-1.5 overflow-hidden px-3 py-2.5 lg:px-6" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="h-10 w-24 shrink-0 animate-pulse rounded-[7px] bg-[#1f1f1f]" />
      ))}
    </div>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const { category: activeCategoryName, free: freeParam } = await searchParams;
  const freeOnly = freeParam === "1" || freeParam === "true";

  // Started here but awaited inside the Suspense boundaries below, so the
  // shell and skeletons stream before any Supabase work finishes.
  const categories = getCategories();
  const activeCategory = categories.then(
    (all) => all.find((c) => c.name === activeCategoryName) ?? null
  );
  const feed = loadHomeFeed(activeCategory, freeOnly);

  return (
    <main
      className="min-h-screen bg-[#0C0C0C] pt-4 md:pt-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-0"
    >
      <Suspense fallback={<FilterBarSkeleton />}>
        <FilterBarContent categories={categories} activeCategory={activeCategory} freeOnly={freeOnly} />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <FeedContent feed={feed} />
      </Suspense>
    </main>
  );
}
