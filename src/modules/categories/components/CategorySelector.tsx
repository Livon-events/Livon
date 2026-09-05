// src/components/categories/CategorySelector.tsx
'use client';

import { useState } from 'react';

interface CategorySelectorProps {
  // No hardcoded default: categories are DB-driven (see lib/queries/categories.ts)
  // and every real caller (CategoryFilterBar, CreateEventForm) already passes
  // them explicitly. A local fallback list here would silently drift from
  // whatever the `categories` table actually contains.
  categories: string[];
  defaultActive?: string | null;
  /** Pass this + onChange for controlled usage. `null` means no filter (all events). */
  activeCategory?: string | null;
  onChange?: (category: string | null) => void;
}

/**
 * Horizontal scrollable category chips.
 *
 * Uses an outer overflow-x-auto container constrained to the same max-width +
 * padding as EventCardGrid, with an inner flex row of `w-max` so chips never
 * force the page wider than the viewport. This prevents the classic "flex
 * nowrap expands the body" overflow that makes the grid feel squished.
 */
export default function CategorySelector({
  categories,
  defaultActive = null,
  activeCategory,
  onChange,
}: CategorySelectorProps) {
  const [internalActive, setInternalActive] = useState<string | null>(
    defaultActive
  );

  const isControlled = activeCategory !== undefined;
  const active = isControlled ? activeCategory : internalActive;

  const handleClick = (category: string) => {
    // Clicking the already-active category clears the filter (shows all events).
    // Clicking a different category switches the filter to it.
    const next = category === active ? null : category;

    if (!isControlled) {
      setInternalActive(next);
    }
    onChange?.(next);
  };

  return (
    <nav className="w-full bg-[#121212]" aria-label="Event categories">
      {/* Constrained wrapper matching EventCardGrid max-width + horizontal padding */}
      <div
        className="
          mx-auto max-w-[1400px]
          overflow-x-auto overscroll-x-contain
          px-3 py-2.5 lg:px-6
          [scrollbar-width:none]
          [-webkit-overflow-scrolling:touch]
          [&::-webkit-scrollbar]:hidden
        "
      >
        <ul className="flex w-max min-w-full list-none flex-nowrap items-center gap-1.5">
          {categories.map((category) => {
            const isActive = category === active;
            return (
              <li key={category} className="shrink-0">
                <button
                  type="button"
                  onClick={() => handleClick(category)}
                  className={`
                    shrink-0 whitespace-nowrap rounded-[7px]
                    px-4 py-2.5 text-[15px] font-bold leading-none
                    transition-colors duration-150 ease-in-out
                    active:scale-[0.97]
                    ${
                      isActive
                        ? 'border-2 border-[#FFF335] bg-[#1f1f1f] text-white'
                        : 'border-2 border-transparent bg-[#1f1f1f] text-white hover:bg-[#2a2a2a]'
                    }
                  `}
                >
                  {category}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}