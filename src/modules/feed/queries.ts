import "server-only";
import { createClient } from "@/shared/supabase/server";
import type { GoingVisibility } from "@/modules/rsvp";

export type HomeFeedCursor = {
  rankScore: number;
  totalGoingCount: number;
  startsAt: string;
  eventId: string;
};

export type HomeFeedEvent = {
  id: string;
  title: string;
  price: number;
  venueName: string;
  area: string;
  hostUsername: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  peekConnectionsCount: number;
  // Viewer's own Going state, per docs/FR/going-rsvp-privacy.md — always
  // false/null for a signed-out viewer. `get_home_feed` itself doesn't
  // return this (it's a ranking/listing RPC, not viewer-state-aware for
  // this purpose), so it's merged in afterward from event_interests.
  isGoing: boolean;
  myVisibility: GoingVisibility | null;
  /** Livon-published, unclaimed — cards show "Published by Livon". */
  isClaimable: boolean;
};

export type HomeFeedResult = {
  events: HomeFeedEvent[];
  nextCursor: HomeFeedCursor | null;
};

export type HomeDiscoveryPerson = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

export type HomePeopleDiscoveryResult = {
  talent: HomeDiscoveryPerson[];
  makers: HomeDiscoveryPerson[];
};

type HomeDiscoveryRow = {
  section: "talent" | "makers";
  user_id: string;
  username: string | null;
  avatar_url: string | null;
};

const DEFAULT_PAGE_SIZE = 12; // matches 3-col grid at the lg breakpoint

type GetHomeFeedParams = {
  categoryId?: string | null;
  /** When true, only events with price = 0 (SQL filter, not a category). */
  freeOnly?: boolean;
  /** Required for location-scoped feeds — events.city_id match. */
  cityId?: string | null;
  /** null/omitted = all areas in the city; set = events.area_id match. */
  areaId?: string | null;
  cursor?: HomeFeedCursor | null;
  pageSize?: number;
};

type HomeFeedRow = {
  id: string;
  title: string;
  price: string; // numeric comes back as a string over PostgREST
  venue_name: string;
  area: string;
  host_username: string;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  peek_connections_count: number;
  rank_score: number;
  total_going_count: number;
  is_claimable: boolean;
};

export async function getHomeFeed({
  categoryId = null,
  freeOnly = false,
  cityId = null,
  areaId = null,
  cursor = null,
  pageSize = DEFAULT_PAGE_SIZE,
}: GetHomeFeedParams = {}): Promise<HomeFeedResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_home_feed", {
    p_category_id: categoryId,
    p_city_id: cityId,
    p_area_id: areaId,
    p_cursor_rank_score: cursor?.rankScore ?? null,
    p_cursor_total_going: cursor?.totalGoingCount ?? null,
    p_cursor_starts_at: cursor?.startsAt ?? null,
    p_cursor_event_id: cursor?.eventId ?? null,
    p_page_size: pageSize,
    p_free_only: freeOnly,
  });

  if (error) {
    throw new Error(`get_home_feed failed: ${error.message}`);
  }

  const rows = (data ?? []) as HomeFeedRow[];

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  // event_id -> visibility, for just this page's events and just the
  // signed-in viewer's own rows (RLS already scopes a plain select on
  // event_interests to "own rows, or visible rows from connections" — the
  // .eq("user_id", ...) below just makes the "own rows" intent explicit).
  let myInterestByEventId = new Map<string, GoingVisibility>();
  if (viewer && rows.length > 0) {
    const { data: myInterests } = await supabase
      .from("event_interests")
      .select("event_id, visibility")
      .eq("user_id", viewer.id)
      .in(
        "event_id",
        rows.map((r) => r.id)
      );

    myInterestByEventId = new Map(
      (myInterests ?? []).map((row) => [row.event_id, row.visibility as GoingVisibility])
    );
  }

  const events: HomeFeedEvent[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    price: parseFloat(row.price),
    venueName: row.venue_name,
    area: row.area,
    hostUsername: row.host_username,
    coverImageUrl: row.cover_image_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    peekConnectionsCount: row.peek_connections_count,
    isGoing: myInterestByEventId.has(row.id),
    myVisibility: myInterestByEventId.get(row.id) ?? null,
    isClaimable: Boolean(row.is_claimable),
  }));

  const lastRow = rows[rows.length - 1];
  const nextCursor: HomeFeedCursor | null =
    lastRow && rows.length === pageSize
      ? {
          rankScore: lastRow.rank_score,
          totalGoingCount: lastRow.total_going_count,
          startsAt: lastRow.starts_at,
          eventId: lastRow.id,
        }
      : null;

  return { events, nextCursor };
}

/**
 * Optional home discovery data. It intentionally fails soft: the event feed
 * remains the primary page content and should still render when this newer
 * feature's RPC is unavailable or temporarily unhealthy.
 */
export async function getHomePeopleDiscovery({
  cityId = null,
  areaId = null,
}: Pick<GetHomeFeedParams, "cityId" | "areaId"> = {}): Promise<HomePeopleDiscoveryResult> {
  const empty: HomePeopleDiscoveryResult = { talent: [], makers: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_home_people_discovery", {
    p_city_id: cityId,
    p_area_id: areaId,
    p_limit: 12,
  });

  if (error) {
    // PGRST202 means this optional RPC has not reached PostgREST's schema
    // cache yet (for example, while a test database migration is being
    // rolled out). Treat it like an empty optional section rather than
    // emitting a noisy server-console error or blocking the feed.
    if (error.code === "PGRST202") return empty;
    console.error("get_home_people_discovery failed:", error.message);
    return empty;
  }

  return ((data ?? []) as HomeDiscoveryRow[]).reduce<HomePeopleDiscoveryResult>((result, row) => {
    if (!row.username || (row.section !== "talent" && row.section !== "makers")) return result;
    result[row.section].push({
      userId: row.user_id,
      username: row.username,
      avatarUrl: row.avatar_url,
    });
    return result;
  }, empty);
}
