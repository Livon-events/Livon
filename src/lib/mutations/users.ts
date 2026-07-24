import { createClient } from "@/lib/supabase/client";
import { LOCATION_STORAGE_KEY, type StoredLocationPreference } from "@/lib/location/constants";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Persists the header's City/Area selection to the signed-in user's
 * account (`users.preferred_city_id` / `preferred_area_id`), per
 * docs/FR/location-toggle.md — this is the "write path" the header picker
 * needs to call on every change; without it, the selection only ever lived
 * in local component state and never reached the database (which is why
 * event creation kept reporting "no area selected" regardless of what was
 * clicked).
 *
 * `areaId: null` means "All Areas" for that city — a legitimate value, not
 * an error.
 *
 * RLS ("Users can update own profile": `auth.uid() = user_id`) already
 * scopes this to the caller's own row; `.eq("user_id", ...)` below is just
 * an explicit, defensive match rather than relying on RLS alone.
 */
export async function updateLocationPreference(input: {
  cityId: string;
  areaId: string | null;
}): Promise<Result> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("users")
    .update({ preferred_city_id: input.cityId, preferred_area_id: input.areaId })
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}

/** Reads the logged-out/device-level location preference (see constants.ts). */
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

/** Writes the logged-out/device-level location preference (see constants.ts). */
export function writeStoredLocationPreference(pref: StoredLocationPreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // Storage can throw (private-browsing quota, disabled storage, etc.) —
    // the header still works via in-memory state either way, this is only
    // the "remember it for next time" layer.
  }
}
