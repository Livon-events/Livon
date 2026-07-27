"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, User } from "lucide-react";

/**
 * Sticky bottom navigation bar (mobile / small tablet only — hidden from
 * md (768px) up, where DesktopHeader's inline nav takes over).
 * Converted from raw_html_and_css/phone_navbar/navbar.html + navbar.css.
 *
 * Client Component: needs usePathname() to highlight the active tab.
 * Route paths below assume `/` (home feed), `/create-event`, and `/profile`
 * exist under the App Router — adjust if your route segments differ.
 */
export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[1000] flex h-16 items-center justify-around border-t-[3.5px] border-[#FFEA00] bg-black px-6 pt-1.5"
      style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* Left: Home */}
      <Link
        href="/"
        className={`flex flex-col items-center text-white transition-opacity active:scale-95 hover:opacity-80 ${
          isActive("/") ? "" : "opacity-70"
        }`}
      >
        <Home className="h-[26px] w-[26px]" strokeWidth={2.5} />
        <span className="mt-1 text-[11px] font-semibold tracking-wide">Home</span>
      </Link>

      {/* Center: Create Event */}
      <Link href="/create-event" className="flex items-center justify-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFEA00] shadow-[0_4px_12px_rgba(255,234,0,0.18)] transition-transform hover:scale-105 active:scale-90">
          <Plus className="h-[22px] w-[22px] text-black" strokeWidth={3.5} />
        </div>
      </Link>

      {/* Right: Profile */}
      <Link
        href="/profile"
        className={`flex flex-col items-center text-white transition-opacity active:scale-95 hover:opacity-80 ${
          isActive("/profile") ? "" : "opacity-70"
        }`}
      >
        <User className="h-[26px] w-[26px]" strokeWidth={2.5} />
        <span className="mt-1 text-[11px] font-semibold tracking-wide">Profile</span>
      </Link>
    </nav>
  );
}
