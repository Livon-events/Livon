"use client";

import { Check, Share2 } from "lucide-react";
import { useGoingAction, type GoingVisibility } from "@/modules/rsvp";
import { GoingPrivacyPopup } from "@/modules/rsvp";
import { useShareEvent } from "@/modules/invites";

type EventActionBarProps = {
  eventId: string;
  eventTitle: string;
  initialGoing?: boolean;
  initialVisibility?: GoingVisibility | null;
};

// Full "Going" flow (privacy popup on first tap, change-privacy/not-going
// menu on re-tap) per docs/FR/going-rsvp-privacy.md, via the shared
// useGoingAction hook — also used by EventCardActions on the feed card.
export default function EventActionBar({
  eventId,
  eventTitle,
  initialGoing = false,
  initialVisibility = null,
}: EventActionBarProps) {
  const { going, popup, handleButtonClick, closePopup, selectChangePrivacy, selectNotGoing, choosePrivacy } =
    useGoingAction(eventId, initialGoing, initialVisibility);
  const { share, copied, error } = useShareEvent(eventId);

  const handleShareClick = () => {
    void share(eventTitle);
  };

  return (
    <div className="relative flex w-full gap-3 sm:gap-4">
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
        Interested
      </button>
      <button
        type="button"
        onClick={handleShareClick}
        data-event-id={eventId}
        aria-label="Share event"
        className="flex min-h-[44px] flex-[0_0_31%] items-center justify-center gap-2 rounded-md bg-[#FFEA00] text-base font-extrabold text-black transition-transform active:scale-[0.98] sm:min-h-[48px] sm:flex-[0_0_196px]"
      >
        {copied ? (
          <>
            <Check className="h-5 w-5" strokeWidth={2.5} />
            Copied!
          </>
        ) : (
          <>
            <Share2 className="h-5 w-5" strokeWidth={2.5} />
            Share
          </>
        )}
      </button>

      {error && (
        <p className="absolute -top-8 right-0 rounded-md bg-black px-2 py-1 text-[12px] font-semibold text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
