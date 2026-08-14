"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { useLocationPicker, type LocationArea } from "@/modules/location";
import { useHeaderSearch } from "@/modules/search";


type AppHeaderProps = {
  userId: string | null;
  cityId: string;
  cityName: string;
  areas: LocationArea[];
  initialAreaId: string;
  hasAccountPreference: boolean;
};

export default function AppHeader({
  userId,
  cityId,
  cityName,
  areas,
  initialAreaId,
  hasAccountPreference,
}: AppHeaderProps) {
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

  // Focus the input the moment it mounts (i.e. the instant search opens),
  // rather than requiring a second tap.
  useEffect(() => {
    if (searchActive) searchInputRef.current?.focus();
  }, [searchActive]);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-[100] border-b-[3.5px] border-[#FFEA00] bg-black px-2.5 py-3">
        <div className="flex w-full items-center justify-between gap-3">
          {!searchActive && (
            <>
              {/* Logo */}
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg flex items-center justify-center">
                <Image src="/logo.png" alt="Livon" width={44} height={44} className="h-full w-full object-contain" priority />
              </div>

              {/* Location filter trigger */}
              <button
                type="button"
                onClick={openSheet}
                className="flex flex-grow select-none flex-col items-start justify-center text-left"
              >
                <span className="text-[21px] font-bold leading-[1.15] tracking-[-0.3px] text-white underline decoration-2 underline-offset-[3px]">
                  {cityName}
                </span>
                <span className="mt-0.5 text-[13.5px] font-medium tracking-[-0.1px] text-[#a1a1a6]">
                  {selectedArea.name}
                </span>
              </button>
            </>
          )}

          {/* Search — a single capsule that's either the "Search" trigger
              button (collapsed) or the actual text input (expanded).
              There is no second search bar anywhere else; /search itself
              is a pure results view now. */}
          <div
            className={`flex h-10 shrink-0 select-none items-center gap-2.5 rounded-full border-2 border-white transition-all ${
              searchActive ? "w-full pl-1 pr-1" : "pl-4 pr-[3px]"
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
                className="flex w-full items-center justify-between gap-2.5 py-0 pr-0 transition-transform active:scale-95"
              >
                <span className="text-[15px] font-bold tracking-[-0.1px] text-white">Search</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFEA00]">
                  <Search className="h-[15px] w-[15px] text-black" strokeWidth={3} />
                </span>
              </button>
            )}
          </div>
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
          className={`flex w-full max-h-[85dvh] flex-col origin-bottom rounded-t-3xl border-t border-[#222222] bg-[#121212] px-5 pt-4 transition-transform duration-[350ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
            sheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 16px))" }}
        >
          <div className="relative mb-4 flex shrink-0 items-center justify-between border-b border-[#1f1f1f] pb-4">
            <div className="absolute -top-1.5 left-1/2 h-1 w-[38px] -translate-x-1/2 rounded-full bg-[#333333]" />
            <h3 className="text-lg font-semibold tracking-[-0.2px] text-white">Select Area in {cityName}</h3>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#1f1f1f] text-[#8e8e93] transition-colors active:bg-[#2a2a2a] active:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul className="flex flex-col gap-2 pb-1">
              {pickerAreas.map((area) => {
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