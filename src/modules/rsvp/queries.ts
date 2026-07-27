import "server-only";
import { createClient } from "@/shared/supabase/server";
import type { GoingVisibility } from "@/modules/rsvp/mutations";

/**
 * All reads of the `event_interests` table live here. Extracted during the
 * modular-monolith restructuring from two places that used to query
 * `event_interests` directly even though they weren't the rsvp module:
 * `lib/queries/profile-events.ts` (the "Going" tab's first round-trip) and
 * `lib/queries/events.ts`'s `getEventDetails` (the viewer's own interest
 * row, and the raw rows used to compute `attendingConnectionsCount`).
 * `modules/events/queries.ts` now calls these functions instead of
 * touching `event_interests` itself.
 */

/**
 * Event ids a user has expressed interest in, regardless of visibility —
 * used by `modules/events/queries.ts`'s `getEventsUserIsGoingTo` as the
 * first of two round-trips (ids here, then the actual event rows from the
 * `events` table, which `rsvp` doesn't own and shouldn't query itself).
 */
export async function getEventIdsUserIsGoingTo(userId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("event_interests")
    .select("event_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`getEventIdsUserIsGoingTo failed: ${error.message}`);
  }

  return (data ?? []).map((row) => row.event_id);
}

export type MyEventInterest = {
  isGoing: boolean;
  visibility: GoingVisibility | null;
};

/** The signed-in viewer's own interest row for one event, if any. */
export async function getMyInterest(eventId: string, userId: string): Promise<MyEventInterest> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("event_interests")
    .select("event_interest_id, visibility")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    isGoing: Boolean(data),
    visibility: (data?.visibility as GoingVisibility | undefined) ?? null,
  };
}

/**
 * How many of the viewer's connections are marked as going to this event —
 * the `attending_connections_count` half of `peekConnectionsCount`
 * (docs/FR/peek.md). Deliberately does NOT re-implement the
 * visibility/connection filter itself: RLS policy
 * `event_interests_select_own_or_connection` already restricts a plain
 * select on `event_interests` to exactly the right set (the viewer's own
 * row, or `visible` rows from accepted connections), so a bare query here
 * plus excluding the viewer's own row gives the right count for free.
 */
export async function getConnectionsGoingCount(eventId: string, viewerId: string): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase.from("event_interests").select("user_id").eq("event_id", eventId);

  return (data ?? []).filter((row) => row.user_id !== viewerId).length;
}
