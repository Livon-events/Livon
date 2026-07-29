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

/**
 * Total "going" count for an event, unfiltered by visibility — the Peek
 * page's Interests number (docs/FR/peek.md). A plain count against
 * `event_interests` can't be used here: `event_interests_select_own_or_connection`
 * RLS would silently under-count for anyone who isn't connected to every
 * attendee. `event_going_count` is a SECURITY DEFINER RPC that returns
 * nothing but the integer (see docs/db/functions.md), the same "count-only"
 * exception `connections.getConnectionsCountFor` already relies on.
 */
export async function getEventGoingCount(eventId: string): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("event_going_count", { p_event_id: eventId });

  if (error) {
    throw new Error(`getEventGoingCount failed: ${error.message}`);
  }

  return data ?? 0;
}

export type PeekAttendee = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

type PeekAttendeeRow = {
  user_id: string;
  created_at: string;
  user: { username: string | null; avatar_url: string | null } | null;
};

/**
 * The Peek page's "Connections attending" list (docs/FR/peek.md) — every
 * connection with a `visible` interest row on this event, most-recently-
 * marked-going first. Relies on the same
 * `event_interests_select_own_or_connection` RLS policy as
 * `getConnectionsGoingCount`: a plain select already comes back scoped to
 * just the viewer's own row plus `visible` rows from accepted connections,
 * so excluding the viewer's own row and the host's row here is all this
 * function needs to do itself.
 *
 * `hostId` is excluded deliberately even if the host also has a `going`
 * row: the host isn't "attending" their own event as a guest, so they're
 * never counted or listed here — distinct from the button's `host_bonus`,
 * which does include them.
 */
export async function getConnectionsAttendingList(
  eventId: string,
  viewerId: string,
  hostId: string
): Promise<PeekAttendee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("event_interests")
    .select("user_id, created_at, user:users!user_id ( username, avatar_url )")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .returns<PeekAttendeeRow[]>();

  if (error) {
    throw new Error(`getConnectionsAttendingList failed: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => row.user_id !== viewerId && row.user_id !== hostId)
    .map((row) => ({
      userId: row.user_id,
      username: row.user?.username ?? "User",
      avatarUrl: row.user?.avatar_url ?? null,
    }));
}
