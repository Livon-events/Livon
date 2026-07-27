import "server-only";
import { createClient } from "@/shared/supabase/server";
import type { ConnectionUser, ConnectionState } from "@/modules/connections/types";

/**
 * All reads of the `connections` table live in this one file — merged
 * during the modular-monolith restructuring from what used to be two
 * separate files (`lib/queries/connections.ts` and the connections-related
 * exports inside `lib/queries/public-profile.ts`). Per the module boundary
 * rule (docs/FR/architecture.md), any other module that needs connection
 * data calls one of these functions rather than querying `connections`
 * directly.
 */

type ConnectionPartyRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
};

type ConnectionRow = {
  connection_id: string;
  requester_id: string;
  receiver_id: string;
  requester: ConnectionPartyRow | null;
  receiver: ConnectionPartyRow | null;
};

// Column-name hints (matching the pattern in modules/users/queries.ts) rather
// than FK constraint names, disambiguating the two `users` embeds since
// `connections` has two FKs into the same table.
const CONNECTION_SELECT =
  "connection_id, requester_id, receiver_id, " +
  "requester:users!requester_id ( user_id, username, avatar_url ), " +
  "receiver:users!receiver_id ( user_id, username, avatar_url )";

function mapOtherParty(row: ConnectionRow, viewerId: string): ConnectionUser {
  const other = row.requester_id === viewerId ? row.receiver : row.requester;
  return {
    id: row.connection_id,
    userId: other?.user_id ?? "",
    name: other?.username ?? "User",
    avatarUrl: other?.avatar_url ?? undefined,
  };
}

/**
 * Incoming pending requests — someone else requested to connect with the
 * viewer and hasn't been responded to yet. Outgoing pending requests
 * (viewer requested someone else) aren't shown here; those only surface
 * as "Cancel" on that other person's own profile via ConnectButton.
 */
export async function getConnectionRequests(userId: string): Promise<ConnectionUser[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select(CONNECTION_SELECT)
    .eq("receiver_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<ConnectionRow[]>();

  if (error) {
    throw new Error(`getConnectionRequests failed: ${error.message}`);
  }

  return (data ?? []).map((row) => mapOtherParty(row, userId));
}

/** Accepted connections, regardless of which side originally requested. */
export async function getConnections(userId: string): Promise<ConnectionUser[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select(CONNECTION_SELECT)
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .returns<ConnectionRow[]>();

  if (error) {
    throw new Error(`getConnections failed: ${error.message}`);
  }

  return (data ?? []).map((row) => mapOtherParty(row, userId));
}

type ConnectionStateRow = {
  connection_id: string;
  requester_id: string;
  status: string;
};

/**
 * Resolves the Connect-button state between two users, per
 * docs/FR/connections.md's four states. Both possible row shapes (viewer
 * as requester, viewer as receiver) are covered by the same
 * "Users can view own connections" RLS policy — a row is visible as long
 * as *one* side is the caller, which is always true here.
 *
 * Renamed from `getConnectionState` (its name in the pre-restructuring
 * `lib/queries/public-profile.ts`) to make the two-user shape explicit at
 * the call site, now that it lives alongside other connections functions
 * rather than in a profile-specific file.
 */
export async function getConnectionStateBetween(
  viewerId: string,
  profileUserId: string
): Promise<ConnectionState> {
  if (viewerId === profileUserId) {
    return { status: "none" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select("connection_id, requester_id, status")
    .or(
      `and(requester_id.eq.${viewerId},receiver_id.eq.${profileUserId}),` +
        `and(requester_id.eq.${profileUserId},receiver_id.eq.${viewerId})`
    )
    .maybeSingle<ConnectionStateRow>();

  if (error || !data) {
    return { status: "none" };
  }

  if (data.status === "accepted") {
    return { status: "connected", connectionId: data.connection_id };
  }

  // status === "pending"
  return data.requester_id === viewerId
    ? { status: "outgoing", connectionId: data.connection_id }
    : { status: "incoming", connectionId: data.connection_id };
}

/**
 * Total accepted-connections count for a user, shown under the username on
 * a profile. `connections` RLS only lets a client see rows involving their
 * *own* uid, so a stranger's total can't be counted from a plain client
 * select — this goes through `get_public_connections_count`, a
 * SECURITY DEFINER function that returns nothing but the integer (no raw
 * rows), the same "count-only" exception already used for
 * `event_going_count`. See docs/db/functions.md.
 *
 * Renamed from `getPublicConnectionsCount` — it's not exclusively a
 * "public profile" concern, just a connections-table aggregate, so it
 * belongs here regardless of which page calls it.
 */
export async function getConnectionsCountFor(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_connections_count", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`getConnectionsCountFor failed: ${error.message}`);
  }

  return data ?? 0;
}

/**
 * Is `viewerId` connected (accepted, either direction) to `otherUserId`?
 * Extracted during the restructuring pass from what used to be inline
 * logic inside `lib/queries/events.ts`'s `getEventDetails` — that function
 * queried `connections` directly to compute the "host bonus" half of
 * `peekConnectionsCount`. Under the module boundary rule, that read now
 * lives here, and `modules/events/queries.ts` calls this function instead.
 */
export async function isConnectedTo(viewerId: string, otherUserId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("connections")
    .select("connection_id")
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${viewerId},receiver_id.eq.${otherUserId}),` +
        `and(requester_id.eq.${otherUserId},receiver_id.eq.${viewerId})`
    )
    .maybeSingle();

  return Boolean(data);
}
