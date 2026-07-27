"use client";

import { Share2 } from "lucide-react";
import { useGoingAction, type GoingVisibility } from "@/modules/rsvp";
import { GoingPrivacyPopup } from "@/modules/rsvp";

type EventActionBarProps = {
  eventId: string;
  initialGoing?: boolean;
  initialVisibility?: GoingVisibility | null;
};

// Full "Going" flow (privacy popup on first tap, change-privacy/not-going
// menu on re-tap) per docs/FR/going-rsvp-privacy.md, via the shared
// useGoingAction hook — also used by EventCardActions on the feed card.
export default function EventActionBar({
  eventId,
  initialGoing = false,
  initialVisibility = null,
}: EventActionBarProps) {
  const { going, popup, handleButtonClick, closePopup, selectChangePrivacy, selectNotGoing, choosePrivacy } =
    useGoingAction(eventId, initialGoing, initialVisibility);

  const handleShareClick = () => {
    // TODO: trigger the invite-link share flow for `eventId` per
    // docs/FR/invite-links.md.
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-black">
      <div className="relative mx-auto flex w-[min(calc(100%-24px),798px)] gap-3 pt-2 sm:w-[min(calc(100%-48px),798px)] sm:gap-4 sm:pt-3">
        {popup !== "closed" && (
          <GoingPrivacyPopup
            mode={popup}
            onSelectPrivacy={choosePrivacy}
            onChangePrivacy={selectChangePrivacy}
            onNotGoing={selectNotGoing}
            onClose={closePopup}
          />
        )}

        <button
          type="button"
          onClick={handleButtonClick}
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
