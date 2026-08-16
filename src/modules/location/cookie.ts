import "server-only";
import { cookies } from "next/headers";
import {
  LOCATION_COOKIE_KEY,
  type StoredLocationPreference,
} from "@/modules/location/constants";

/**
 * Server-readable twin of the device location preference. localStorage alone
 * can't scope the SSR feed, so the client also writes this cookie (same JSON
 * shape as `LOCATION_STORAGE_KEY` in localStorage).
 */
export async function readLocationPreferenceCookie(): Promise<StoredLocationPreference | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCATION_COOKIE_KEY)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as StoredLocationPreference).cityId !== "string"
    ) {
      return null;
    }
    const areaId = (parsed as StoredLocationPreference).areaId;
    if (typeof areaId !== "string" && areaId !== null) return null;
    return {
      cityId: (parsed as StoredLocationPreference).cityId,
      areaId,
    };
  } catch {
    return null;
  }
}
