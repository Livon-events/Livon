import "server-only";
import { createClient } from "@/shared/supabase/server";

/**
 * Backs the `/search` page (docs/FR/search.md). Both functions call
 * SECURITY DEFINER RPCs (`search_events`, `search_people`) so results are
 * available to anonymous visitors too — `events` is already anon-open via
 * RLS, and `search_people` is a deliberate narrow exception mirroring
 * `get_public_profile`'s.
 *
 * Both return an empty array for queries under 2 characters (also
 * enforced inside the SQL functions themselves) rather than erroring, so
 * callers can pass a raw, un-trimmed query straight through.
 */

const DEFAULT_PAGE_SIZE = 10;
const MIN_QUERY_LENGTH = 2;

export type EventSearchResult = {
  id: string;
  title: string;
  venueName: string;
  areaName: string;
  cityName: string;
  coverImageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
};

export type PersonSearchResult = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

type EventSearchRow = {
  event_id: string;
  title: string;
  venue_name: string;
  area_name: string;
  city_name: string;
  cover_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
};

type PersonSearchRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export async function searchEvents(
  query: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<EventSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_events", {
    p_query: trimmed,
    p_page_size: pageSize,
  });

  if (error) {
    throw new Error(`search_events failed: ${error.message}`);
  }

  return ((data ?? []) as EventSearchRow[]).map((row) => ({
    id: row.event_id,
    title: row.title,
    venueName: row.venue_name,
    areaName: row.area_name,
    cityName: row.city_name,
    coverImageUrl: row.cover_image_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));
}

export async function searchPeople(
  query: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<PersonSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_people", {
    p_query: trimmed,
    p_page_size: pageSize,
  });

  if (error) {
    throw new Error(`search_people failed: ${error.message}`);
  }

  return ((data ?? []) as PersonSearchRow[]).map((row) => ({
    userId: row.user_id,
    username: row.username ?? "User",
    avatarUrl: row.avatar_url,
    bio: row.bio,
  }));
}
