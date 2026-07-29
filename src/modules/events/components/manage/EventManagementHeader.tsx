"use client";

import { Search } from "lucide-react";
import Link from "next/link";

interface EventManagementHeaderProps {
  locationName?: string;
  locationSub?: string;
  onSearchChange?: (val: string) => void;
}

export default function EventManagementHeader({
  locationName = "Maseru",
  locationSub = "Maseru central",
  onSearchChange,
}: EventManagementHeaderProps) {
  return (
    <header className="w-full bg-black text-white pt-3 pb-3 px-4">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Logo & Location */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo Card */}
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
            <svg
              className="w-7 h-7 text-black"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Double ring / infinity emblem icon */}
              <path d="M7 12c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5m0 0c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5" />
              <path d="M7 2c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5m0 0c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5" />
            </svg>
          </div>

          {/* Location Title & Subtitle */}
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl font-bold text-white tracking-tight leading-snug underline underline-offset-4 decoration-white/70">
              {locationName}
            </h1>
            <span className="text-xs text-[#AEAEB2] truncate font-medium">
              {locationSub}
            </span>
          </div>
        </div>

        {/* Right: Search Pill */}
        <div className="relative flex items-center min-w-[130px] sm:min-w-[180px] max-w-[220px]">
          <input
            type="text"
            placeholder="Search"
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full bg-black text-white text-sm pl-4 pr-9 py-1.5 rounded-full border border-gray-400 focus:outline-none focus:border-[#FFE600] placeholder:text-gray-500 font-medium"
          />
          <Search className="w-4 h-4 text-white absolute right-3 pointer-events-none stroke-[2.5]" />
        </div>
      </div>

      {/* Yellow accent divider line below header */}
      <div className="w-full h-[3px] bg-[#FFE600] mt-3" />
    </header>
  );
}
