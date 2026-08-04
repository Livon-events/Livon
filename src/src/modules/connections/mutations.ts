import { createClient } from "@/shared/supabase/client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Connect-button mutations, per docs/FR/connections.md. All three go
 * through the browser client so RLS enforces the actual authorization
 * (matches the pattern in lib/mutations/event-interests.ts) — there's no
 * separate server-side check duplicating what the policies already do.
 */

/**
 * "Connect" tapped with no existing relationship — sends a pending
 * request. Returns the new row's id so the button can flip to "Cancel"
 * and later remove the exact row without a re-fetch.
 */
export async function sendConnectionRequest(receiverId: string): Promise<Result<string>> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data, error } = await supabase
    .from("connections")
    .insert({ requester_id: user.id, receiver_id: receiverId })
    .select("connection_id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data.connection_id as string };
}

/**
 * "Accept" tapped on an incoming request — profile owner had already
 * requested the viewer; this flips it straight to accepted, equivalent to
 * accepting from the Connections tab. RLS
 * (`connections_receiver_respond_to_pending`) only allows this when the
 * caller is the receiver and the row is still pending, which is exactly
 * the "incoming" state this button is shown for.
 */
export async function acceptConnectionRequest(connectionId: string): Promise<Result> {
  const supabase = createClient();

  const { error } = await supabase
    .from("connections")
    .update({ status: "accepted" })
    .eq("connection_id", connectionId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/**
 * "Cancel" (outgoing pending) or "Unconnect" (accepted) — both are a
 * plain delete of the connection row; RLS ("Either party can remove
 * connection") allows either side to do this regardless of status.
 */
export async function removeConnection(connectionId: string): Promise<Result> {
  const supabase = createClient();

  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("connection_id", connectionId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
