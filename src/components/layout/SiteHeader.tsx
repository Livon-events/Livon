import AppHeader from "./AppHeader";
import DesktopHeader from "./DesktopHeader";

/**
 * Responsive header shell — belongs in app/layout.tsx, rendered once for
 * the whole app (not per-page). Mounts both AppHeader (mobile) and
 * DesktopHeader (`md` / 768px and up, so tablets get it too); Tailwind's
 * `md:hidden` / `hidden md:block` decide which is visible, avoiding a
 * JS-based media-query flash on load.
 *
 * Both headers use `position: fixed` so they stay pinned at the top and
 * never scroll with the page. Since `fixed` takes an element out of
 * document flow, each variant here is paired with a spacer div of the
 * same height, so page content isn't hidden underneath. If you change a
 * header's padding/content and its rendered height changes, update the
 * matching spacer height below.
 *
 * Pair with BottomNav the same way in the layout — it also needs
 * `md:hidden` now (matches this breakpoint), since DesktopHeader already
 * contains the nav links inline:
 *
 *   <SiteHeader />
 *   {children}
 *   <div className="md:hidden"><BottomNav /></div>
 *
 * This is a Server Component itself (no "use client") — AppHeader and
 * DesktopHeader each declare their own "use client" where needed, so this
 * wrapper doesn't force anything above it to be client-side.
 */
export default function SiteHeader() {
  return (
    <>
      <div className="md:hidden">
        <AppHeader />
        {/* Spacer matching AppHeader's rendered height (~71.5px: py-3
            (24px) + 44px logo box + 3.5px border), rounded up slightly. */}
        <div className="h-[72px]" aria-hidden="true" />
      </div>
      <div className="hidden md:block">
        <DesktopHeader />
        {/* Spacer matching DesktopHeader's rendered height (~79.5px:
            py-4 (32px) + 44px content row + 3.5px border), rounded up. */}
        <div className="h-20" aria-hidden="true" />
      </div>
    </>
  );
}
