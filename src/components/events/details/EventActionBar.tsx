"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

type EventActionBarProps = {
  eventId: string;
  initialGoing?: boolean;
};

// "Going" and its privacy popup (Private/Visible on first tap, Change
// privacy/Not going on re-tap) are fully specced in
// docs/FR/going-rsvp-privacy.md and not redefined here — this page only
// covers the button's position/presence, per docs/FR/event-details-page.md.
// Toggling local state is a placeholder until that flow is wired in.
export default function EventActionBar({ eventId, initialGoing = false }: EventActionBarProps) {
  const [going, setGoing] = useState(initialGoing);

  const handleGoingClick = () => {
    setGoing((prev) => !prev);
    // TODO: open the Going privacy popup / re-tap menu for `eventId` per
    // docs/FR/going-rsvp-privacy.md.
  };

  const handleShareClick = () => {
    // TODO: trigger the invite-link share flow for `eventId` per
    // docs/FR/invite-links.md.
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-black">
      <div className="mx-auto flex w-[min(calc(100%-24px),798px)] gap-3 pt-2 sm:w-[min(calc(100%-48px),798px)] sm:gap-4 sm:pt-3">
        <button
          type="button"
          onClick={handleGoingClick}
          data-event-id={eventId}
          className={`min-h-[44px] flex-1 rounded-md text-base font-extrabold transition-transform active:scale-[0.98] sm:min-h-[48px] ${
            going
              ? "border-2 border-[#FFEA00] bg-black text-[#FFEA00]"
              : "border-none bg-[#FFEA00] text-black"
          }`}
        >
          Going
        </button>
        <button
          type="button"
          onClick={handleShareClick}
          data-event-id={eventId}
          aria-label="Share event"
          className="flex min-h-[44px] flex-[0_0_31%] items-center justify-center gap-2 rounded-md bg-[#FFEA00] text-base font-extrabold text-black transition-transform active:scale-[0.98] sm:min-h-[48px] sm:flex-[0_0_196px]"
        >
          <Share2 className="h-5 w-5" strokeWidth={2.5} />
          Share
        </button>
      </div>
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
