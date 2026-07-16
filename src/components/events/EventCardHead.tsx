"use client";

import { useEffect, useState } from "react";
import { getCountdownLabel, getTimeOrLiveLabel } from "@/lib/format/eventCard";

type EventCardHeadProps = {
  startsAt: string; // ISO timestamp
  endsAt: string | null; // ISO timestamp, or null (8hr fallback applies)
  peekConnectionsCount: number;
  eventId: string;
};

export default function EventCardHead({
  startsAt,
  endsAt,
  peekConnectionsCount,
  eventId,
}: EventCardHeadProps) {
  const [labels, setLabels] = useState<{ countdown: string; time: string } | null>(
    null
  );

  useEffect(() => {
    const now = new Date();
    const starts = new Date(startsAt);
    const ends = endsAt ? new Date(endsAt) : null;
    setLabels({
      countdown: getCountdownLabel(starts, now),
      time: getTimeOrLiveLabel(starts, ends, now),
    });
  }, [startsAt, endsAt]);

  const handlePeekClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: open the Peek flow for `eventId` per docs/fr/peek.md.
  };

  return (
    <div className="relative z-10 flex h-[46px] w-full flex-row items-center gap-[13px] p-[5px]">
      <div className="flex h-full flex-1 items-center justify-center rounded-[7px] bg-black text-[13px] font-bold text-white">
        {labels?.countdown ?? "\u00A0"}
      </div>

      <button
        type="button"
        id={`peekBtn-${eventId}`}
        onClick={handlePeekClick}
        data-event-id={eventId}
        className="relative flex h-full flex-1 items-center justify-center rounded-[7px] border-[3px] border-[#FFEA00] bg-black text-[14px] font-bold text-[#FFEA00] transition-transform active:scale-95"
      >
        <span>Peek</span>
        <span className="absolute right-[6px] top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[#FFEA00] text-[10px] font-black leading-none text-black">
          {peekConnectionsCount}
        </span>
      </button>

      <div className="flex h-full flex-1 items-center justify-center rounded-[7px] bg-black text-[13px] font-bold text-white">
        {labels?.time ?? "\u00A0"}
      </div>
    </div>
  );
}
