import { Suspense } from "react";
import { CategoryFilterBar, HomeFeed, WeekendRail, type HomeFeedResult, type WeekendEvent } from "@/modules/feed";
import { getHomeFeed, getWeekendEvents } from "@/modules/feed/queries";
import { getCategories } from "@/modules/categories/queries";
import { getLocationPickerData, resolveFeedLocationScope } from "@/modules/location/queries";
import { getOrganizerLocationContext } from "@/modules/users/queries";
import { createClient } from "@/shared/supabase/server";
import { Analytics } from "@vercel/analytics/next";

type HomeProps = {
  searchParams: Promise<{ category?: string; free?: string }>;
};

async function FeedContent({
  feed,
  remountKey,
}: {
  feed: Promise<HomeFeedResult>;
  remountKey: string;
}) {
  const initial = await feed;
  return <HomeFeed key={remountKey} initial={initial} />;
}

async function WeekendContent({ weekend }: { weekend: Promise<WeekendEvent[]> }) {
  const events = await weekend;
  return <WeekendRail events={events} />;
}

function WeekendSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-2 lg:px-6" aria-hidden="true">
      <div className="mb-2 h-7 w-40 animate-pulse rounded-[7px] bg-[#1f1f1f]" />
      <div className="flex gap-[13px] overflow-hidden">
        {[0, 1].map((index) => (
          <div key={index} className="h-[300px] w-[85vw] max-w-[340px] shrink-0 animate-pulse rounded-xl bg-[#262626]" />
        ))}
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

  const feed = getHomeFeed({
    categoryId: activeCategory?.id ?? null,
    freeOnly,
    cityId,
    areaId,
  });
  // The rail is supplementary — a failure here must not take down the feed.
  const weekend = getWeekendEvents({ cityId, areaId }).catch((error: unknown) => {
    console.error(error);
    return [];
  });

  return (
    <main
      className="min-h-screen bg-[#0C0C0C] pt-4 md:pt-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px)+1.5rem)] md:pb-0"
    >
      <Analytics />
      <Suspense fallback={<WeekendSkeleton />}>
        <WeekendContent weekend={weekend} />
      </Suspense>
      <Suspense fallback={<FilterBarSkeleton />}>
        <CategoryFilterBar
          categories={categories.map((c) => c.name)}
          activeCategory={activeCategory?.name ?? null}
          freeOnly={freeOnly}
        />
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <FeedContent
          feed={feed}
          remountKey={`${activeCategory?.name ?? ""}:${freeOnly}:${cityId}:${areaId ?? ""}`}
        />
      </Suspense>
    </main>
  );
}
