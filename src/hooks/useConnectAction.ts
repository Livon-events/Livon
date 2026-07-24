"use client";

import { useState } from "react";
import {
  sendConnectionRequest,
  acceptConnectionRequest,
  removeConnection,
} from "@/lib/mutations/connections";
import type { ConnectionState } from "@/lib/queries/public-profile";

/**
 * Drives the Connect button's four states from docs/FR/connections.md:
 *   none -> tap "Connect" -> outgoing (request sent)
 *   outgoing -> tap "Cancel" -> none (request withdrawn)
 *   incoming -> tap "Accept" -> connected
 *   connected -> tap "Unconnect" -> none
 *
 * Optimistic like useGoingAction: the button flips immediately and rolls
 * back on a failed mutation, rather than blocking on the round-trip.
 *
 * `isPending` blocks re-entrant clicks while a mutation is in flight —
 * this matters specifically for "none" -> "outgoing": until
 * `sendConnectionRequest` resolves, there's no real `connection_id` yet
 * to cancel with. Without this guard, tapping Connect then immediately
 * Cancel would try to delete a connection with an empty-string id
 * ("invalid input syntax for type uuid"). Disabling the button for that
 * one round-trip removes the race entirely rather than special-casing an
 * empty id.
 */
export function useConnectAction(profileUserId: string, initialState: ConnectionState) {
  const [state, setState] = useState<ConnectionState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (isPending) return;

    setError(null);
    setIsPending(true);
    const previous = state;

    try {
      if (state.status === "none") {
        const result = await sendConnectionRequest(profileUserId);
        if (result.ok) {
          setState({ status: "outgoing", connectionId: result.data });
        } else {
          setError(result.error);
        }
        return;
      }

      if (state.status === "outgoing") {
        setState({ status: "none" });
        const result = await removeConnection(state.connectionId);
        if (!result.ok) {
          setState(previous);
          setError(result.error);
        }
        return;
      }

      if (state.status === "incoming") {
        const connectionId = state.connectionId;
        setState({ status: "connected", connectionId });
        const result = await acceptConnectionRequest(connectionId);
        if (!result.ok) {
          setState(previous);
          setError(result.error);
        }
        return;
      }

      // state.status === "connected"
      setState({ status: "none" });
      const result = await removeConnection(state.connectionId);
      if (!result.ok) {
        setState(previous);
        setError(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  return { state, error, isPending, handleClick };
}
