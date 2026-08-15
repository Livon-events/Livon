export type { LocationPickerArea, LocationPickerCity } from "./queries";
export {
  ALL_AREAS_ID,
  DEFAULT_AREA_NAME,
  DEFAULT_CITY_NAME,
  LOCATION_STORAGE_KEY,
  type StoredLocationPreference,
} from "./constants";
export { readStoredLocationPreference, writeStoredLocationPreference } from "./storage";
export { useLocationPicker, type LocationArea } from "./hooks/useLocationPicker";

// getLocationPickerData is never barrel-exported — queries.ts is
// server-only (uses next/headers). Import it directly:
//   import { getLocationPickerData } from "@/modules/location/queries";
