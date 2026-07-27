export { sendConnectionRequest, acceptConnectionRequest, removeConnection } from "./mutations";
export type { ConnectionUser, ConnectionState } from "./types";
export { useConnectAction } from "./hooks/useConnectAction";

// getConnectionRequests / getConnections / getConnectionStateBetween /
// getConnectionsCountFor / isConnectedTo are never barrel-exported —
// queries.ts is server-only (uses next/headers). Import directly:
//   import { getConnections } from "@/modules/connections/queries";
