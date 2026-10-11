"use client";

import { useShareEvent } from "@/modules/invites";
import { TicketButton } from "@/modules/events";

type EventRailShareButtonProps = {
  eventId: string;
  eventTitle: string;
  ticketLinks: string[];
};

/** The only client island on a rail card — raised above the card's stretched Link. */
export default function EventRailShareButton({ eventId, eventTitle, ticketLinks }: EventRailShareButtonProps) {
  const { share, sharing, copied, error } = useShareEvent(eventId);

  return (
    <div className="relative z-10 m-[5px] mt-auto flex gap-[5px]">
      <button
        type="button"
        onClick={() => void share(eventTitle)}
        disabled={sharing}
        className="flex h-[44px] flex-1 items-center justify-center rounded-[6px] bg-[#FFF335] text-[16px] font-black text-[#0C0C0C] disabled:opacity-70"
      >
        {copied ? "Link copied" : "Share"}
      </button>
      <TicketButton
        eventId={eventId}
        links={ticketLinks}
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[6px] bg-[#FFF335] text-[#0C0C0C]"
      />
      {error && (
        <p className="absolute -top-8 right-0 rounded-[6px] bg-[#0C0C0C] px-2 py-1 text-[12px] font-semibold text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
