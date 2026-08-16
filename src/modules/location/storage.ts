import {
  LOCATION_COOKIE_KEY,
  LOCATION_STORAGE_KEY,
  type StoredLocationPreference,
} from "@/modules/location/constants";

/**
 * Logged-out / pre-hydration device-level location preference, per
 * docs/FR/location-toggle.md. Extracted during the restructuring from
 * `lib/mutations/users.ts` — these two functions never touched the
 * `users` table (they're pure localStorage), so they belong with the
 * rest of `location`'s constants/state, not with `users`'s account-level
 * `updateLocationPreference` (which does write to `users` and stays there).
 */

/** Reads the logged-out/device-level location preference. */
export function readStoredLocationPreference(): StoredLocationPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.cityId !== "string") return null;
    if (typeof parsed.areaId !== "string" && parsed.areaId !== null) return null;
    return { cityId: parsed.cityId, areaId: parsed.areaId };
  } catch {
    return null;
  }
}

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/** Writes the logged-out/device-level location preference. */
export function writeStoredLocationPreference(pref: StoredLocationPreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // Storage can throw (private-browsing quota, disabled storage, etc.) —
    // the header still works via in-memory state either way, this is only
    // the "remember it for next time" layer.
  }

  // Mirror into a cookie so SSR (home feed, header) can read the same
  // preference — localStorage alone is invisible to the server.
  try {
    const encoded = encodeURIComponent(JSON.stringify(pref));
    document.cookie = `${LOCATION_COOKIE_KEY}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  } catch {
    // Same best-effort stance as localStorage — feed falls back to defaults.
  }
}
