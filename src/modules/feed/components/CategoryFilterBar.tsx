"use client";

import { useOptimistic } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CategorySelector } from "@/modules/categories";
import { useFeedFilterPending } from "./FeedFilterPending";

type CategoryFilterBarProps = {
  categories: string[];
  activeCategory: string | null;
  freeOnly: boolean;
};

type FilterState = {
  activeCategory: string | null;
  freeOnly: boolean;
};

export default function CategoryFilterBar({
  categories,
  activeCategory,
  freeOnly,
}: CategoryFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startTransition } = useFeedFilterPending();
  // Highlights the tapped chip immediately; falls back to the server props
  // once the navigation settles.
  const [optimistic, setOptimistic] = useOptimistic<FilterState>({ activeCategory, freeOnly });

  const navigate = (next: FilterState) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.activeCategory) {
      params.set("category", next.activeCategory);
    } else {
      params.delete("category");
    }
    if (next.freeOnly) {
      params.set("free", "1");
    } else {
      params.delete("free");
    }
    const query = params.toString();

    startTransition(() => {
      setOptimistic(next);
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <CategorySelector
      categories={categories}
      activeCategory={optimistic.activeCategory}
      onChange={(category) => navigate({ ...optimistic, activeCategory: category })}
      freeOnly={optimistic.freeOnly}
      onFreeChange={(nextFree) => navigate({ ...optimistic, freeOnly: nextFree })}
    />
  );
}
