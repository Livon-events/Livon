import { createClient } from "@/lib/supabase/server";
import { getProfileEventDateLabel } from "@/lib/format/eventCard";
import type { EventSummary } from "@/components/profile/types";

type EventRow = {
  event_id: string;
  title: string;
  starts_at: string;
  venue_name: string;
  cover_image_url: string;
  // PostgREST aggregate embed (`event_interests(count)`) — always comes
  // back as a one-element array containing `{ count }`, even when zero.
  event_interests: { count: number }[];
};

const EVENT_SUMMARY_SELECT =
  "event_id, title, starts_at, venue_name, cover_image_url, event_interests(count)";

function mapEventRow(row: EventRow): EventSummary {
  return {
    id: row.event_id,
    title: row.title,
    dateLabel: getProfileEventDateLabel(new Date(row.starts_at)),
    location: row.venue_name,
    imageUrl: row.cover_image_url,
    attendeeCount: row.event_interests?.[0]?.count ?? 0,
  };
}

/**
 * Events the given user organizes — the profile page's "Created" tab.
 * Was previously backed by mock data only (`lib/mock/profile.ts`); this is
 * the real query.
 *
 * Includes cancelled events deliberately — this is the organiser managing
 * their own events (hence the "manage" action in EventRow), so it
 * shouldn't hide ones they've cancelled. RLS ("Events are viewable by
 * everyone") already permits reading them regardless.
 */
export async function getProfileCreatedEvents(userId: string): Promise<EventSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SUMMARY_SELECT)
    .eq("organizer_id", userId)
    .order("starts_at", { ascending: false })
    .returns<EventRow[]>();

  if (error) {
    throw new Error(`getProfileCreatedEvents failed: ${error.message}`);
  }

  return (data ?? []).map(mapEventRow);
}

/**
 * Events the given user has expressed interest in — the profile page's
 * "Going" tab. Two round-trips (ids from `event_interests`, then the
 * actual event rows) rather than one deeply-nested embed, to avoid
 * ambiguity between the forward relation (event_interests -> events) and
 * the reverse aggregate (events -> event_interests(count)) at different
 * levels of the same query.
 *
 * RLS on event_interests already scopes `.eq("user_id", userId)` here to
 * rows the caller is allowed to see; filtering by their own id further is
 * just being explicit about intent, not doing any extra access control.
 *
 * Excludes cancelled events — unlike "Created" above, seeing an event
 * you're going to as if it's still upcoming after the organiser cancelled
 * it isn't useful. (Not spelled out in any FR doc — a reasonable default,
 * easy to revisit.)
 */
export async function getProfileGoingEvents(userId: string): Promise<EventSummary[]> {
  const supabase = await createClient();

  const { data: interests, error: interestsError } = await supabase
    .from("event_interests")
    .select("event_id")
    .eq("user_id", userId);

  if (interestsError) {
    throw new Error(`getProfileGoingEvents failed: ${interestsError.message}`);
  }

  const eventIds = (interests ?? []).map((row) => row.event_id);
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SUMMARY_SELECT)
    .in("event_id", eventIds)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: false })
    .returns<EventRow[]>();

  if (error) {
    throw new Error(`getProfileGoingEvents failed: ${error.message}`);
  }

  return (data ?? []).map(mapEventRow);
}
