"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, X, Home, User, Plus } from "lucide-react";
import { useLocationPicker, type LocationArea } from "@/modules/location";
import { useHeaderSearch } from "@/modules/search";

type DesktopHeaderProps = {
  userId: string | null;
  cityId: string;
  cityName: string;
  areas: LocationArea[];
  initialAreaId: string;
  hasAccountPreference: boolean;
};

export default function DesktopHeader({
  userId,
  cityId,
  cityName,
  areas,
  initialAreaId,
  hasAccountPreference,
}: DesktopHeaderProps) {
  const pathname = usePathname();
  const { sheetOpen, selectedArea, areas: pickerAreas, openSheet, closeSheet, selectArea } =
    useLocationPicker({ userId, cityId, areas, initialAreaId, hasAccountPreference });

  const {
    active: searchActive,
    query,
    open: openSearch,
    close: closeSearch,
    handleChange: handleSearchChange,
  } = useHeaderSearch();

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchActive) searchInputRef.current?.focus();
  }, [searchActive]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-[100] border-b-[3.5px] border-[#FFEA00] bg-black px-6 py-4">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-8">
          {/* Left: logo + location */}
          <div className="flex shrink-0 items-center gap-4">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg flex items-center justify-center">
              <Image src="/logo.png" alt="Livon" width={44} height={44} className="h-full w-full object-contain" priority />
            </div>

            <button
              type="button"
              onClick={openSheet}
              className="flex select-none flex-col items-start justify-center text-left"
            >
              <span className="text-[21px] font-bold leading-[1.15] tracking-[-0.3px] text-white underline decoration-2 underline-offset-[3px]">
                {cityName}
              </span>
              <span className="mt-0.5 text-[13.5px] font-medium tracking-[-0.1px] text-[#a1a1a6]">
                {selectedArea.name}
              </span>
            </button>
          </div>

          {/* Center: search — single capsule, collapsed trigger or
              expanded input. No second search bar on /search itself. */}
          <div
            className={`flex h-[42px] w-full max-w-[798px] shrink items-center gap-2.5 rounded-full border-2 border-white transition-all ${
              searchActive ? "pl-1 pr-1" : "pl-5 pr-[3px]"
            }`}
          >
            {searchActive ? (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFEA00]">
                  <Search className="h-[15px] w-[15px] text-black" strokeWidth={3} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search events and people"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-white placeholder:text-[#a1a1a6] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  aria-label="Close search"
                  className="shrink-0 px-2 text-white"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={openSearch}
                className="flex w-full items-center justify-between gap-2.5 py-0 pr-0 transition-all hover:bg-white/[0.04] active:scale-[0.995]"
              >
                <span className="text-[15px] font-bold tracking-[-0.1px] text-white">Search</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFEA00]">
                  <Search className="h-[15px] w-[15px] text-black" strokeWidth={3} />
                </span>
              </button>
            )}
          </div>

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
            <h3 className="text-lg font-semibold tracking-[-0.2px] text-white">Select Area in {cityName}</h3>
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
              {pickerAreas.map((area) => {
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
