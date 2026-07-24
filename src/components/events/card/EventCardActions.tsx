"use client";

import { Share2 } from "lucide-react";
import { useGoingAction, type GoingVisibility } from "@/hooks/useGoingAction";
import GoingPrivacyPopup from "@/components/events/shared/GoingPrivacyPopup";

type EventCardActionsProps = {
  eventId: string;
  initialInterested?: boolean;
  initialVisibility?: GoingVisibility | null;
};

// "Interested" is this card's label for the same Going/RSVP action as the
// event details page's "Going" button — full privacy-popup flow per
// docs/FR/going-rsvp-privacy.md, via the shared useGoingAction hook.
export default function EventCardActions({
  eventId,
  initialInterested = false,
  initialVisibility = null,
}: EventCardActionsProps) {
  const { going, popup, handleButtonClick, closePopup, selectChangePrivacy, selectNotGoing, choosePrivacy } =
    useGoingAction(eventId, initialInterested, initialVisibility);

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: trigger the invite-link share flow for `eventId` per
    // docs/fr/invite-links.md.
  };

  return (
    // The whole card is a Link (see EventCard.tsx) — stop every click in
    // here (button taps, popup taps, the popup's own backdrop) from also
    // triggering a navigation.
    <div
      className="relative m-[5px] flex w-[calc(100%-10px)] flex-row items-center gap-[5px]"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
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
        className={`h-[50px] flex-1 rounded-[6px] border-[3px] text-[1.2rem] font-black transition-all active:scale-[0.96] ${
          going
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
