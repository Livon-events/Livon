"use client";

import { useState } from "react";
import type { ConnectionUser, ConnectionsSubTab } from "../types/profile";
import SegmentedTabs from "./SegmentedTabs";
import ConnectionRow from "./ConnectionRow";

interface ConnectionsPanelProps {
  requests: ConnectionUser[];
  connections: ConnectionUser[];
  onAcceptRequest?: (id: string) => void;
  onDeclineRequest?: (id: string) => void;
  onRemoveConnection?: (id: string) => void;
}

export default function ConnectionsPanel({
  requests,
  connections,
  onAcceptRequest,
  onDeclineRequest,
  onRemoveConnection,
}: ConnectionsPanelProps) {
  const [subTab, setSubTab] = useState<ConnectionsSubTab>("requests");

  const list = subTab === "requests" ? requests : connections;

  return (
    <div>
      <SegmentedTabs<ConnectionsSubTab>
        active={subTab}
        onChange={setSubTab}
        options={[
          { value: "requests", label: "Requests", count: requests.length },
          { value: "connections", label: "Connections", count: connections.length },
        ]}
      />

      {list.length === 0 ? (
        <div className="text-center text-[#AEAEB2] text-sm py-8">
          {subTab === "requests" ? "No pending requests." : "No connections yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((connection) =>
            subTab === "requests" ? (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                actionLabel="accept"
                onAction={onAcceptRequest}
                secondaryActionLabel="decline"
                onSecondaryAction={onDeclineRequest}
              />
            ) : (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                actionLabel="remove"
                onAction={onRemoveConnection}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
