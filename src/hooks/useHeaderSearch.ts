"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Drives the single search input that now lives in the header itself
 * (AppHeader / DesktopHeader), per the decision to not duplicate a second
 * input on the `/search` results page. `/search` is purely a results
 * view now — see `components/search/SearchResults.tsx` and
 * `app/search/page.tsx`.
 *
 * Since `AppHeader`/`DesktopHeader` are mounted once in the root layout
 * (`SiteHeader`) and never remounted on client-side navigation, this
 * hook's state (the query text, whether the input is expanded) survives
 * across page changes — there's exactly one search "session" for the
 * whole app, not one per page.
 */
export function useHeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();

  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If someone lands directly on `/search?q=...` (a shared link, a
  // refresh, browser back/forward), reflect that back into the header
  // input and expand it — the header is the only input, so it needs to
  // stay in sync with the URL, not just drive it. Reads
  // `window.location.search` directly rather than `useSearchParams()` to
  // avoid forcing a Suspense boundary around the whole header tree.
  useEffect(() => {
    if (pathname !== "/search") return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const nextQuery = params.get("q") ?? "";

    // Deliberate one-time sync from the URL when landing directly on
    // /search (shared link, refresh, back/forward) — guarded above by
    // the pathname check, and by the prev-vs-next comparisons here, so
    // this can't cascade. Same pattern/justification as the
    // localStorage sync in useLocationPicker.ts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery((prev) => (prev === nextQuery ? prev : nextQuery));
    setActive((prev) => (prev ? prev : true));
  }, [pathname]);

  const navigate = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      const onSearchPage = pathname === "/search";

      if (trimmed.length < MIN_QUERY_LENGTH) {
        if (onSearchPage) router.replace("/search", { scroll: false });
        return;
      }

      const href = `/search?q=${encodeURIComponent(trimmed)}`;
      // Replace once already on /search (so typing doesn't pile up a
      // history entry per keystroke); push the first time, so back
      // navigation returns to wherever the person started searching from.
      if (onSearchPage) {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
    },
    [pathname, router]
  );

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(value), DEBOUNCE_MS);
  }

  function open() {
    setActive(true);
    // Go straight to the results page rather than waiting for the person
    // to type something first — /search's own empty state ("Search for
    // events or people...") covers the no-query case.
    if (pathname !== "/search") {
      router.push("/search", { scroll: false });
    }
  }

  function close() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setActive(false);
    setQuery("");
    if (pathname === "/search") {
      router.push("/");
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { active, query, open, close, handleChange };
}
