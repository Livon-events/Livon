import { NextResponse, type NextRequest } from "next/server";
import { getHomeFeed, type HomeFeedCursor } from "@/modules/feed/queries";
import { getCategories } from "@/modules/categories/queries";
import { getLocationPickerData, resolveFeedLocationScope } from "@/modules/location/queries";
import { getOrganizerLocationContext } from "@/modules/users/queries";
import { createClient } from "@/shared/supabase/server";
import { isSameOriginRequest, jsonError } from "@/shared/http";

export const runtime = "nodejs";

const PAGE_SIZE = 12;

function parseCursor(searchParams: URLSearchParams): HomeFeedCursor | null {
  const rankScoreRaw = searchParams.get("rankScore");
  const totalGoingRaw = searchParams.get("totalGoingCount");
  const startsAt = searchParams.get("startsAt");
  const eventId = searchParams.get("eventId");

  const present = [rankScoreRaw, totalGoingRaw, startsAt, eventId].filter(
    (v) => v !== null && v !== ""
  );
  if (present.length === 0) return null;
  if (present.length !== 4 || !rankScoreRaw || !totalGoingRaw || !startsAt || !eventId) {
    return null;
  }

  const rankScore = Number(rankScoreRaw);
  const totalGoingCount = Number(totalGoingRaw);
  if (!Number.isFinite(rankScore) || !Number.isFinite(totalGoingCount)) {
    return null;
  }

  return { rankScore, totalGoingCount, startsAt, eventId };
}

/**
 * Cursor page of the home feed. Location scope is resolved server-side from
 * the same account/cookie path as `/` — clients must not supply city/area.
 * Auth cookies are required for correct Going / Peek viewer state.
 */
export async function GET(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Request rejected.", 403);
  }

  const { searchParams } = request.nextUrl;
  const cursor = parseCursor(searchParams);
  if (!cursor) {
    return jsonError("A complete feed cursor is required.", 400);
  }

  const categoryName = searchParams.get("category");
  const freeParam = searchParams.get("free");
  const freeOnly = freeParam === "1" || freeParam === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [categories, cities, accountLocation] = await Promise.all([
    getCategories(),
    getLocationPickerData(),
    user ? getOrganizerLocationContext(user.id) : Promise.resolve(null),
  ]);

  const activeCategory = categoryName
    ? (categories.find((c) => c.name === categoryName) ?? null)
    : null;

  const { cityId, areaId } = await resolveFeedLocationScope({
    cities,
    accountLocation,
  });

  try {
    const result = await getHomeFeed({
      categoryId: activeCategory?.id ?? null,
      freeOnly,
      cityId,
      areaId,
      cursor,
      pageSize: PAGE_SIZE,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Feed request failed.";
    return jsonError(message, 500);
  }
}
