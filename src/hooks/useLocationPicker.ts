"use client";

import { useState } from "react";

export type LocationArea = {
  id: string;
  name: string;
};

/**
 * Shared state/behavior for the header's City→Area location picker.
 * Used by both AppHeader (mobile bottom sheet) and DesktopHeader (modal) so
 * the selection logic lives in one place — the two components only differ
 * in how they present the overlay (sheet vs. centered modal).
 *
 * NOT WIRED UP YET: per docs/fr/location-toggle.md, a real implementation
 * persists the choice to `Users.preferred_city_id`/`preferred_area_id` (or
 * localStorage when logged out) via a mutation from `lib/mutations/`, and
 * feed queries scope from it. This hook only manages local UI state for the
 * conversion pass — `onAreaChange` is the seam where that wiring plugs in
 * later.
 */
export function useLocationPicker(
  initialAreaId: string,
  areas: LocationArea[],
  onAreaChange?: (area: LocationArea) => void
) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState(initialAreaId);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? areas[0];

  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);

  const selectArea = (area: LocationArea) => {
    setSelectedAreaId(area.id);
    onAreaChange?.(area);
    closeSheet();
  };

  return { sheetOpen, selectedArea, openSheet, closeSheet, selectArea };
}
