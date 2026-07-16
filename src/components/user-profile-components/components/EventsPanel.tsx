"use client";

import { useState } from "react";
import type { EventSummary, EventsSubTab } from "../types/profile";
import SegmentedTabs from "./SegmentedTabs";
import EventRow from "./EventRow";

interface EventsPanelProps {
  going: EventSummary[];
  created: EventSummary[];
  onLeaveEvent?: (id: string) => void;
  onManageEvent?: (id: string) => void;
}

export default function EventsPanel({ going, created, onLeaveEvent, onManageEvent }: EventsPanelProps) {
  const [subTab, setSubTab] = useState<EventsSubTab>("going");

  const list = subTab === "going" ? going : created;

  return (
    <div>
      <SegmentedTabs<EventsSubTab>
        active={subTab}
        onChange={setSubTab}
        options={[
          { value: "going", label: "Going", count: going.length },
          { value: "created", label: "Created", count: created.length },
        ]}
      />

      {list.length === 0 ? (
        <div className="text-center text-[#AEAEB2] text-sm py-8">
          {subTab === "going" ? "You're not going to any events yet." : "You haven't created any events yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((event) =>
            subTab === "going" ? (
              <EventRow key={event.id} event={event} actionLabel="leave" onAction={onLeaveEvent} />
            ) : (
              <EventRow key={event.id} event={event} actionLabel="manage" onAction={onManageEvent} />
            )
          )}
        </div>
      )}
    </div>
  );
}
