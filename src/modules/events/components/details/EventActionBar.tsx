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

const secondaryButtonClass =
  "flex min-h-[44px] w-[48px] shrink-0 items-center justify-center rounded-md bg-[#FFF335] text-[#0C0C0C] transition-transform active:scale-[0.98] sm:min-h-[48px] sm:w-[52px]";

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
    <div className="relative flex w-full gap-2 sm:gap-3">
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
            ? "border-2 border-[#FFF335] bg-[#0C0C0C] text-[#FFF335]"
            : "border-none bg-[#FFF335] text-[#0C0C0C]"
        }`}
      >
        Interested
      </button>
      <button
        type="button"
        onClick={handleShareClick}
        data-event-id={eventId}
        aria-label="Share event"
        className={secondaryButtonClass}
      >
        {copied ? (
          <Check className="h-5 w-5" strokeWidth={2.5} />
        ) : (
          <Share2 className="h-5 w-5" strokeWidth={2.5} />
        )}
      </button>

      {error && (
        <p className="absolute -top-8 right-0 rounded-md bg-[#0C0C0C] px-2 py-1 text-[12px] font-semibold text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
