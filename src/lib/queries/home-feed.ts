import { createClient } from "@/lib/supabase/server";

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
};

export type HomeFeedResult = {
  events: HomeFeedEvent[];
  nextCursor: HomeFeedCursor | null;
};

const DEFAULT_PAGE_SIZE = 12; // matches 3-col grid at the lg breakpoint

type GetHomeFeedParams = {
  categoryId?: string | null;
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
};

export async function getHomeFeed({
  categoryId = null,
  cursor = null,
  pageSize = DEFAULT_PAGE_SIZE,
}: GetHomeFeedParams = {}): Promise<HomeFeedResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_home_feed", {
    p_category_id: categoryId,
    p_cursor_rank_score: cursor?.rankScore ?? null,
    p_cursor_total_going: cursor?.totalGoingCount ?? null,
    p_cursor_starts_at: cursor?.startsAt ?? null,
    p_cursor_event_id: cursor?.eventId ?? null,
    p_page_size: pageSize,
  });

  if (error) {
    throw new Error(`get_home_feed failed: ${error.message}`);
  }

  const rows = (data ?? []) as HomeFeedRow[];

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