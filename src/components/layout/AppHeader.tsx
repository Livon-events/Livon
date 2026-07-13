"use client";

import { Search, X } from "lucide-react";
import { useLocationPicker, type LocationArea } from "@/hooks/useLocationPicker";

/**
 * Sticky mobile header: logo, search trigger, and a City → Area location
 * picker presented as a bottom sheet. Converted from
 * raw_html_and_css/phone_header/phone_header.html + phone_header.css.
 *
 * Rendered only below the `md` breakpoint (768px) — see SiteHeader.tsx,
 * which pairs this with DesktopHeader and toggles between them with
 * Tailwind classes rather than JS media queries. Uses `position: fixed`
 * (not `sticky`) so it never scrolls with the page; SiteHeader renders a
 * matching-height spacer right after it to keep page content from being
 * covered.
 *
 * NOT WIRED UP YET (intentional for this conversion pass):
 * - Persistence/scoping per docs/fr/location-toggle.md is a later "write
 *   path" step — see useLocationPicker's NOT WIRED UP comment.
 * - Only one city (Maseru) exists at launch per the FR, so this only
 *   renders the Area-picker step, matching the original HTML.
 * - The search bar is a static trigger for now; wire its onClick to your
 *   search route/page when that's built.
 * - `font-family: 'Outfit'` should load once via `next/font/google` in
 *   your root layout, not repeated per-component.
 *
 * Props let a parent (Server Component) supply the real areas list and
 * initial selection once that data comes from Supabase.
 */

type AppHeaderProps = {
  city?: string;
  areas?: LocationArea[];
  initialAreaId?: string;
  onAreaChange?: (area: LocationArea) => void;
};

const DEFAULT_AREAS: LocationArea[] = [
  { id: "all", name: "All areas" },
  { id: "maseru-central", name: "Maseru central" },
];

export default function AppHeader({
  city = "Maseru",
  areas = DEFAULT_AREAS,
  initialAreaId = "maseru-central",
  onAreaChange,
}: AppHeaderProps) {
  const { sheetOpen, selectedArea, openSheet, closeSheet, selectArea } =
    useLocationPicker(initialAreaId, areas, onAreaChange);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-[100] border-b-[3.5px] border-[#FFEA00] bg-black px-2.5 py-3">
        <div className="flex w-full items-center justify-between gap-3">
          {/* Logo */}
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
            <svg viewBox="0 0 100 100" className="block h-full w-full">
              <rect width="100" height="100" rx="12" fill="white" />
              <ellipse cx="40" cy="50" rx="14" ry="24" transform="rotate(-30 40 50)" stroke="black" strokeWidth="5" fill="none" />
              <ellipse cx="60" cy="50" rx="14" ry="24" transform="rotate(-30 60 50)" stroke="black" strokeWidth="5" fill="none" />
              <path d="M 43 27 A 14 24 0 0 1 52 35" stroke="white" strokeWidth="6" fill="none" transform="rotate(-30 40 50)" />
              <ellipse cx="40" cy="50" rx="14" ry="24" transform="rotate(-30 40 50)" stroke="black" strokeWidth="5" fill="none" />
            </svg>
          </div>

          {/* Location filter trigger */}
          <button
            type="button"
            onClick={openSheet}
            className="flex flex-grow select-none flex-col items-start justify-center text-left"
          >
            <span className="text-[21px] font-bold leading-[1.15] tracking-[-0.3px] text-white underline decoration-2 underline-offset-[3px]">
              {city}
            </span>
            <span className="mt-0.5 text-[13.5px] font-medium tracking-[-0.1px] text-[#a1a1a6]">
              {selectedArea.name}
            </span>
          </button>

          {/* Search capsule */}
          <button
            type="button"
            className="flex h-10 shrink-0 select-none items-center justify-between gap-2.5 rounded-full border-2 border-white py-0 pl-4 pr-1 transition-transform active:scale-95 active:bg-white/10"
          >
            <span className="text-[15px] font-bold tracking-[-0.1px] text-white">Search</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFEA00]">
              <Search className="h-[15px] w-[15px] text-black" strokeWidth={3} />
            </span>
          </button>
        </div>
      </header>

      {/* Bottom sheet overlay */}
      <div
        onClick={closeSheet}
        className={`fixed inset-0 z-[200] flex items-end bg-black/65 transition-opacity duration-[250ms] ease-out ${
          sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`w-full origin-bottom rounded-t-3xl border-t border-[#222222] bg-[#121212] px-5 pt-4 transition-transform duration-[350ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
            sheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 16px))" }}
        >
          <div className="relative mb-4 flex items-center justify-between border-b border-[#1f1f1f] pb-4">
            <div className="absolute -top-1.5 left-1/2 h-1 w-[38px] -translate-x-1/2 rounded-full bg-[#333333]" />
            <h3 className="text-lg font-semibold tracking-[-0.2px] text-white">Select Area in {city}</h3>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#1f1f1f] text-[#8e8e93] transition-colors active:bg-[#2a2a2a] active:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative min-h-[280px] overflow-y-auto">
            <ul className="flex flex-col gap-2">
              {areas.map((area) => {
                const isActive = area.id === selectedArea.id;
                return (
                  <li key={area.id}>
                    <button
                      type="button"
                      onClick={() => selectArea(area)}
                      className={`flex w-full items-center justify-between rounded-xl border-[1.5px] px-4 py-3.5 text-[15px] font-semibold transition-colors active:bg-[#242424] ${
                        isActive ? "border-[#FFEA00] bg-[#FFEA00] text-black" : "border-transparent bg-[#1a1a1a] text-white"
                      }`}
                    >
                      <span>{area.name}</span>
                      {isActive && <span className="text-base font-bold">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
