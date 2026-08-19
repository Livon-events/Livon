export type { LocationPickerArea, LocationPickerCity } from "./queries";
export {
  ALL_AREAS_ID,
  DEFAULT_AREA_NAME,
  DEFAULT_CITY_NAME,
  LOCATION_COOKIE_KEY,
  LOCATION_STORAGE_KEY,
  compareCityNames,
  type StoredLocationPreference,
} from "./constants";
export { readStoredLocationPreference, writeStoredLocationPreference } from "./storage";
export { useLocationPicker, type LocationArea, type LocationCity } from "./hooks/useLocationPicker";
export { default as CitySelect } from "./components/CitySelect";

// getLocationPickerData is never barrel-exported — queries.ts is
// server-only (uses next/headers). Import it directly:
//   import { getLocationPickerData } from "@/modules/location/queries";
