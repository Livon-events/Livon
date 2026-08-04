"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CategorySelector } from "@/modules/categories";

type CategoryFilterBarProps = {
  categories: string[];
  activeCategory: string | null;
};

export default function CategoryFilterBar({
  categories,
  activeCategory,
}: CategoryFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (category: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <CategorySelector
      categories={categories}
      activeCategory={activeCategory}
      onChange={handleChange}
    />
  );
}
