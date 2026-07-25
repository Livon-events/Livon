import { createClient } from "@/lib/supabase/server";
import type { ConnectionUser } from "@/components/profile/types";

/**
 * Backs the own-profile Connections tab (requests + connections sub-lists).
 * Was previously mock-only (`lib/mock/profile.ts`); this is the real query.
 *
 * Both sub-lists live on the same `connections` table used by
 * `lib/queries/public-profile.ts`'s `getConnectionState` — a row's
 * `status` is 'pending' or 'accepted', and RLS ("Users can view own
 * connections") only surfaces rows where the caller is requester or
 * receiver, whichever side they're on. Each row is embedded with both
 * possible counterparties (`requester`, `receiver`) so the "other" user
 * can be picked in JS once we know which id is the viewer's.
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

// Column-name hints (matching the pattern in lib/queries/users.ts) rather
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
