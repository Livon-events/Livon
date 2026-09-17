"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CategorySelector } from "@/modules/categories";

type CategoryFilterBarProps = {
  categories: string[];
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

  const pushParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleCategoryChange = (category: string | null) => {
    pushParams((params) => {
      if (category) {
        params.set("category", category);
      } else {
        params.delete("category");
      }
    });
  };

  const handleFreeChange = (nextFree: boolean) => {
    pushParams((params) => {
      if (nextFree) {
        params.set("free", "1");
      } else {
        params.delete("free");
      }
    });
  };

  return (
    <CategorySelector
      categories={categories}
      activeCategory={activeCategory}
      onChange={handleCategoryChange}
      freeOnly={freeOnly}
      onFreeChange={handleFreeChange}
    />
  );
}
