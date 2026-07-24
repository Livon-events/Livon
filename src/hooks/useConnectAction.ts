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
 */
export function useConnectAction(profileUserId: string, initialState: ConnectionState) {
  const [state, setState] = useState<ConnectionState>(initialState);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    const previous = state;

    if (state.status === "none") {
      setState({ status: "outgoing", connectionId: "" }); // real id filled in below
      const result = await sendConnectionRequest(profileUserId);
      if (result.ok) {
        setState({ status: "outgoing", connectionId: result.data });
      } else {
        setState(previous);
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
  }

  return { state, error, handleClick };
}
