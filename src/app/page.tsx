import { Suspense } from "react";
import { EventCardGrid } from "@/modules/events";
import { CategoryFilterBar, HomePeopleDiscovery, type HomeFeedResult, type HomePeopleDiscoveryResult } from "@/modules/feed";
import { getHomeFeed, getHomePeopleDiscovery } from "@/modules/feed/queries";
import { getCategories } from "@/modules/categories/queries";
import { getLocationPickerData, resolveFeedLocationScope } from "@/modules/location/queries";
import { getOrganizerLocationContext } from "@/modules/users/queries";
import { createClient } from "@/shared/supabase/server";
import { Analytics } from "@vercel/analytics/next";

type HomeProps = {
  searchParams: Promise<{ category?: string; free?: string }>;
};

async function FeedContent({ feed }: { feed: Promise<HomeFeedResult> }) {
  const { events } = await feed;
  return <EventCardGrid events={events} />;
}

async function DiscoveryContent({ discovery }: { discovery: Promise<HomePeopleDiscoveryResult> }) {
  return <HomePeopleDiscovery discovery={await discovery} />;
}

function DiscoverySkeleton() {
  return (
    <div className="mx-auto mb-5 w-full max-w-[1400px] px-3 lg:mb-7 lg:px-6" aria-label="Loading Talent">
      <div className="h-8 w-48 animate-pulse rounded bg-[#262626]" />
      <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-[#202020]" />
      <div className="mt-3 flex gap-3 overflow-hidden">
        <div className="aspect-square w-[min(calc(100vw-3rem),22rem)] shrink-0 animate-pulse rounded-xl bg-[#262626]" />
        <div className="aspect-square w-[min(calc(100vw-3rem),22rem)] shrink-0 animate-pulse rounded-xl bg-[#262626]" />
      </div>
    </div>
  );
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [categories, cities, accountLocation] = await Promise.all([
    getCategories(),
    getLocationPickerData(),
    user ? getOrganizerLocationContext(user.id) : Promise.resolve(null),
  ]);

  const activeCategory = categories.find((c) => c.name === activeCategoryName) ?? null;

  const { cityId, areaId } = await resolveFeedLocationScope({
    cities,
    accountLocation,
  });

  // Deliberately start both independent reads together. Each is streamed
  // through its own Suspense boundary below, so a slow discovery calculation
  // cannot hold back the main event feed.
  const feed = getHomeFeed({
    categoryId: activeCategory?.id ?? null,
    freeOnly,
    cityId,
    areaId,
  });
  const discovery = getHomePeopleDiscovery({ cityId, areaId });

  return (
    <main
      className="min-h-screen bg-[#0C0C0C] pt-4 md:pt-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-0"
    >
      <Analytics />
      <Suspense fallback={<DiscoverySkeleton />}>
        <DiscoveryContent discovery={discovery} />
      </Suspense>
      <Suspense fallback={<FilterBarSkeleton />}>
        <CategoryFilterBar
          categories={categories.map((c) => c.name)}
          activeCategory={activeCategory?.name ?? null}
          freeOnly={freeOnly}
        />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <FeedContent feed={feed} />
      </Suspense>
    </main>
  );
}
