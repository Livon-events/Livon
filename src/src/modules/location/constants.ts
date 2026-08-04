/**
 * Shared between the header location picker and anywhere that needs to
 * read/write it (create-event's location context, the picker itself).
 */

// Areas.area_id is a real uuid FK; "All Areas" isn't a row in that table —
// it's `area_id = null` in the data model (see docs/FR/location-toggle.md).
// The picker UI needs a real, stable id to select/highlight that option by,
// so this sentinel stands in for "null" in the UI layer only. It must
// never be sent to the database directly — always translate it to `null`
// at the point of persistence (see useLocationPicker's selectArea).
export const ALL_AREAS_ID = "all";

// Logged-out (and pre-hydration) persistence, per location-toggle.md:
// "Logged-out users: selection is stored in browser storage (localStorage)
// only." Bump the key if the stored shape ever changes.
export const LOCATION_STORAGE_KEY = "livon:location-preference:v1";

export type StoredLocationPreference = {
  cityId: string;
  areaId: string | null;
};
