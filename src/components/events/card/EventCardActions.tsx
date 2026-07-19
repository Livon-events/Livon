"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

type EventCardActionsProps = {
  eventId: string;
  initialInterested?: boolean;
};

export default function EventCardActions({
  eventId,
  initialInterested = false,
}: EventCardActionsProps) {
  const [interested, setInterested] = useState(initialInterested);

  const handleInterestedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInterested((prev) => !prev);
    // TODO: call the toggle-interest mutation for `eventId` here per
    // docs/fr/going-rsvp-privacy.md.
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: trigger the invite-link share flow for `eventId` per
    // docs/fr/invite-links.md.
  };

  return (
    <div className="m-[5px] flex w-[calc(100%-10px)] flex-row items-center gap-[5px]">
      <button
        type="button"
        onClick={handleInterestedClick}
        data-event-id={eventId}
        className={`h-[50px] flex-1 rounded-[6px] border-[3px] text-[1.2rem] font-black transition-all active:scale-[0.96] ${
          interested
            ? "border-[#FFEA00] bg-black text-[#FFEA00]"
            : "border-transparent bg-[#FFEA00] text-black"
        }`}
      >
        Interested
      </button>
      <button
        type="button"
        onClick={handleShareClick}
        data-event-id={eventId}
        aria-label="Share event"
        className="flex h-[50px] shrink-0 basis-1/4 items-center justify-center rounded-[6px] bg-[#FFEA00] text-black transition-transform active:scale-[0.96]"
      >
        <Share2 className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
