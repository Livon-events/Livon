"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, X, Home, User, Plus } from "lucide-react";
import { useLocationPicker, type LocationArea } from "@/hooks/useLocationPicker";

/**
 * Sticky desktop/laptop header: logo + location on the left, a wide search
 * capsule in the center, and nav links (Home, Profile, Create) on the
 * right — replacing the separate BottomNav used on mobile. Converted from
 * raw_html_and_css/laptop_header/laptop_header.html + laptop_header.css.
 *
 * Rendered from the `md` breakpoint (768px) up — so tablets get the
 * desktop-style header too, not just laptops/large screens. See
 * SiteHeader.tsx, which pairs this with the mobile AppHeader and toggles
 * between them with Tailwind classes rather than JS media queries. Uses
 * `position: fixed` (not `sticky`) so it never scrolls with the page;
 * SiteHeader renders a matching-height spacer right after it to keep page
 * content from being covered.
 *
 * Shares its location-picker state logic with AppHeader via
 * useLocationPicker; only the overlay chrome differs here (centered modal
 * vs. bottom sheet), matching the two source mockups.
 *
 * NOT WIRED UP YET — same caveats as AppHeader: no persistence/scoping yet
 * (docs/fr/location-toggle.md is a later write-path step), search is a
 * static trigger, and `Outfit` should load via `next/font/google` in the
 * root layout rather than per-component.
 */

type DesktopHeaderProps = {
  city?: string;
  areas?: LocationArea[];
  initialAreaId?: string;
  onAreaChange?: (area: LocationArea) => void;
};

const DEFAULT_AREAS: LocationArea[] = [
  { id: "all", name: "All areas" },
  { id: "maseru-central", name: "Maseru central" },
];

export default function DesktopHeader({
  city = "Maseru",
  areas = DEFAULT_AREAS,
  initialAreaId = "maseru-central",
  onAreaChange,
}: DesktopHeaderProps) {
  const pathname = usePathname();
  const { sheetOpen, selectedArea, openSheet, closeSheet, selectArea } =
    useLocationPicker(initialAreaId, areas, onAreaChange);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-[100] border-b-[3.5px] border-[#FFEA00] bg-black px-6 py-4">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-8">
          {/* Left: logo + location */}
          <div className="flex shrink-0 items-center gap-4">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg">
              <svg viewBox="0 0 100 100" className="block h-full w-full">
                <rect width="100" height="100" rx="12" fill="white" />
                <ellipse cx="40" cy="50" rx="14" ry="24" transform="rotate(-30 40 50)" stroke="black" strokeWidth="5" fill="none" />
                <ellipse cx="60" cy="50" rx="14" ry="24" transform="rotate(-30 60 50)" stroke="black" strokeWidth="5" fill="none" />
                <path d="M 43 27 A 14 24 0 0 1 52 35" stroke="white" strokeWidth="6" fill="none" transform="rotate(-30 40 50)" />
                <ellipse cx="40" cy="50" rx="14" ry="24" transform="rotate(-30 40 50)" stroke="black" strokeWidth="5" fill="none" />
              </svg>
            </div>

            <button
              type="button"
              onClick={openSheet}
              className="flex select-none flex-col items-start justify-center text-left"
            >
              <span className="text-[21px] font-bold leading-[1.15] tracking-[-0.3px] text-white underline decoration-2 underline-offset-[3px]">
                {city}
              </span>
              <span className="mt-0.5 text-[13.5px] font-medium tracking-[-0.1px] text-[#a1a1a6]">
                {selectedArea.name}
              </span>
            </button>
          </div>

          {/* Center: wide search capsule */}
          <button
            type="button"
            className="flex h-[42px] w-full max-w-[798px] shrink items-center justify-between gap-2.5 rounded-full border-2 border-white py-0 pl-5 pr-1 transition-all hover:bg-white/[0.04] active:scale-[0.995] active:bg-white/[0.08]"
          >
            <span className="text-[15px] font-bold tracking-[-0.1px] text-white">Search</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFEA00]">
              <Search className="h-[15px] w-[15px] text-black" strokeWidth={3} />
            </span>
          </button>

          {/* Right: nav links */}
          <nav className="shrink-0">
            <ul className="flex items-center gap-7">
              <li>
                <Link
                  href="/"
                  className={`flex flex-col items-center text-white transition-opacity hover:opacity-80 ${
                    isActive("/") ? "" : "opacity-70"
                  }`}
                >
                  <Home className="h-[26px] w-[26px]" strokeWidth={2.5} />
                  <span className="mt-[5px] text-[11px] font-semibold capitalize tracking-[0.2px]">Home</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/profile"
                  className={`flex flex-col items-center text-white transition-opacity hover:opacity-80 ${
                    isActive("/profile") ? "" : "opacity-70"
                  }`}
                >
                  <User className="h-[26px] w-[26px]" strokeWidth={2.5} />
                  <span className="mt-[5px] text-[11px] font-semibold capitalize tracking-[0.2px]">Profile</span>
                </Link>
              </li>
              <li>
                <Link href="/create-event" className="flex items-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFEA00] shadow-[0_4px_12px_rgba(255,234,0,0.15)] transition-transform hover:scale-105 active:scale-95">
                    <Plus className="h-[22px] w-[22px] text-black" strokeWidth={3.5} />
                  </div>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Centered modal overlay (desktop equivalent of the mobile bottom sheet) */}
      <div
        onClick={closeSheet}
        className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/70 transition-opacity duration-[250ms] ease-out ${
          sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-[440px] rounded-2xl border border-[#222222] bg-[#121212] p-6 transition-transform duration-[250ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
            sheetOpen ? "translate-y-0 scale-100" : "translate-y-2.5 scale-95"
          }`}
        >
          <div className="mb-4 flex items-center justify-between border-b border-[#1f1f1f] pb-4">
            <h3 className="text-lg font-semibold tracking-[-0.2px] text-white">Select Area in {city}</h3>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#1f1f1f] text-[#8e8e93] transition-colors hover:bg-[#2a2a2a] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            <ul className="flex flex-col gap-2">
              {areas.map((area) => {
                const active = area.id === selectedArea.id;
                return (
                  <li key={area.id}>
                    <button
                      type="button"
                      onClick={() => selectArea(area)}
                      className={`flex w-full items-center justify-between rounded-[10px] border-[1.5px] px-4 py-3 text-[15px] font-semibold transition-colors hover:bg-[#222222] active:bg-[#2a2a2a] ${
                        active ? "border-[#FFEA00] bg-[#FFEA00] text-black" : "border-transparent bg-[#1a1a1a] text-white"
                      }`}
                    >
                      <span>{area.name}</span>
                      {active && <span className="text-[15px] font-bold">✓</span>}
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
