"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ALL_AREAS_ID } from "@/modules/location/constants";
import { updateLocationPreference } from "@/modules/users";
import {
  readStoredLocationPreference,
  writeStoredLocationPreference,
} from "@/modules/location/storage";

export type LocationArea = {
  id: string;
  name: string;
};

export type LocationCity = {
  id: string;
  name: string;
  areas: LocationArea[];
};

type UseLocationPickerArgs = {
  /** Signed-in user id, or null when logged out. */
  userId: string | null;
  cities: LocationCity[];
  /** Server-resolved initial city. */
  initialCityId: string;
  /** Server-resolved initial selection: a real area id, or ALL_AREAS_ID. */
  initialAreaId: string;
  /**
   * Whether `initialAreaId` came from a real `users.preferred_*` row
   * (true) vs. the client-side fallback default (false). Drives the
   * on-login reconciliation step described in location-toggle.md.
   */
  hasAccountPreference: boolean;
};

/**
 * Shared state/behavior for the header's City→Area location picker. Used
 * by both AppHeader (mobile bottom sheet) and DesktopHeader (modal) so the
 * selection logic lives in one place — the two components only differ in
 * how they present the overlay (sheet vs. centered modal).
 *
 * Persists selections per docs/FR/location-toggle.md:
 * - Logged in: writes to `users.preferred_city_id`/`preferred_area_id`.
 * - Logged out: writes to localStorage + cookie (cookie scopes the SSR feed).
 *
 * On mount, reconciles what the server rendered against localStorage:
 * - Logged in with an account preference already: account wins; local
 *   storage is just kept in sync with it.
 * - Logged in with NO account preference yet, but a local-storage value
 *   exists: that value is adopted and written up to the account (the
 *   "implicit first-write" the FR describes).
 * - Logged out with a local-storage value: adopt it for this session.
 * - Otherwise: keep whatever default the server resolved (All areas).
 *
 * Both AppHeader and DesktopHeader mount at the same time (CSS toggles
 * which is visible, per SiteHeader), each running its own instance of this
 * hook — so switching viewport size without a full reload can show the
 * other instance's stale in-memory state until next navigation. Both read
 * the same persisted source on load and write to the same destinations on
 * change, so this only affects same-session live viewport switching, not
 * correctness across reloads/devices.
 */
export function useLocationPicker({
  userId,
  cities,
  initialCityId,
  initialAreaId,
  hasAccountPreference,
}: UseLocationPickerArgs) {
  const router = useRouter();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState(initialCityId);
  const [selectedAreaId, setSelectedAreaId] = useState(initialAreaId);
  const reconciled = useRef(false);

  useEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;

    const stored = readStoredLocationPreference();
    const knownCityIds = new Set(cities.map((city) => city.id));

    if (userId && hasAccountPreference) {
      // Account preference is the source of truth across devices — just
      // make sure this device's local copy agrees with it.
      const realAreaId = selectedAreaId === ALL_AREAS_ID ? null : selectedAreaId;
      writeStoredLocationPreference({ cityId: selectedCityId, areaId: realAreaId });
      return;
    }

    if (stored && knownCityIds.has(stored.cityId)) {
      const resolvedAreaId = stored.areaId ?? ALL_AREAS_ID;
      // Deliberate one-time post-hydration sync from localStorage
      // (unavailable during SSR, so it can't be a lazy useState initializer
      // without causing a hydration mismatch against the server-rendered
      // default). Guarded by `reconciled.current` above, so this can't
      // cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCityId(stored.cityId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAreaId(resolvedAreaId);
      // Keep cookie in sync so the next SSR pass matches localStorage.
      writeStoredLocationPreference({ cityId: stored.cityId, areaId: stored.areaId });

      if (userId && !hasAccountPreference) {
        // First login on a device that already had a local preference —
        // push it up to the account per location-toggle.md.
        updateLocationPreference({ cityId: stored.cityId, areaId: stored.areaId }).catch(() => {
          // Best-effort — the UI already reflects the selection either way.
        });
      }

      if (stored.cityId !== initialCityId || resolvedAreaId !== initialAreaId) {
        // Cookie/localStorage disagreed with the SSR default — refresh so
        // the feed picks up the device preference.
        router.refresh();
      }
      return;
    }

    // No localStorage entry (or unknown city) — persist the server-resolved
    // default (All areas → areaId null) so cookie/localStorage match the
    // header. Do not force an account write for All areas; only a real
    // area selection (or an explicit All-areas tap via selectArea) should
    // create an account preference.
    const realAreaId = selectedAreaId === ALL_AREAS_ID ? null : selectedAreaId;
    writeStoredLocationPreference({ cityId: selectedCityId, areaId: realAreaId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hasAccountPreference, initialCityId]);

  const selectedCity =
    cities.find((city) => city.id === selectedCityId) ??
    cities[0] ??
    { id: initialCityId, name: "", areas: [] };
  const allAreas: LocationArea[] = [
    { id: ALL_AREAS_ID, name: "All areas" },
    ...selectedCity.areas,
  ];
  const selectedArea = allAreas.find((a) => a.id === selectedAreaId) ?? allAreas[0];

  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);

  function persist(cityId: string, areaId: string | null) {
    writeStoredLocationPreference({ cityId, areaId });

    if (userId) {
      updateLocationPreference({ cityId, areaId }).catch(() => {
        // Fire-and-forget: the picker already reflects the change
        // optimistically. A failed write just means it doesn't survive
        // to the next session/device — not worth blocking the UI over.
      });
    }

    router.refresh();
  }

  const selectCity = (cityId: string) => {
    if (cityId === selectedCityId) return;
    setSelectedCityId(cityId);
    setSelectedAreaId(ALL_AREAS_ID);
    persist(cityId, null);
  };

  const selectArea = (area: LocationArea) => {
    setSelectedAreaId(area.id);
    closeSheet();
    persist(selectedCityId, area.id === ALL_AREAS_ID ? null : area.id);
  };

  return {
    sheetOpen,
    selectedCity,
    selectedArea,
    cities,
    areas: allAreas,
    openSheet,
    closeSheet,
    selectCity,
    selectArea,
  };
}
