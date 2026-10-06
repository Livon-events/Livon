"use client";

import { useShareEvent } from "@/modules/invites";

type EventRailShareButtonProps = {
  eventId: string;
  eventTitle: string;
};

/** The only client island on a rail card — raised above the card's stretched Link. */
export default function EventRailShareButton({ eventId, eventTitle }: EventRailShareButtonProps) {
  const { share, sharing, copied, error } = useShareEvent(eventId);

  return (
    <div className="relative z-10 m-[5px] mt-auto">
      <button
        type="button"
        onClick={() => void share(eventTitle)}
        disabled={sharing}
        className="flex h-[44px] w-full items-center justify-center rounded-[6px] bg-[#FFF335] text-[16px] font-black text-[#0C0C0C] disabled:opacity-70"
      >
        {copied ? "Link copied" : "Share"}
      </button>
      {error && (
        <p className="absolute -top-8 right-0 rounded-[6px] bg-[#0C0C0C] px-2 py-1 text-[12px] font-semibold text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
