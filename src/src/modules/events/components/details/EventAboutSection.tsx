"use client";

import { useRouter } from "next/navigation";

type EventAboutSectionProps = {
  eventId: string;
  title: string;
  description: string;
  peekConnectionsCount: number;
};

// Peek lives in the About section's header row (grouped with About, not
// with the Event Card above) — same component/logic as the feed card:
// attending_connections_count + host_bonus, no badge if the count is 0.
// Tapping it navigates to the same Peek page used everywhere else — no
// page-specific variant, matching the placeholder that used to live here
// and in EventCardHead.
export default function EventAboutSection({
  eventId,
  title,
  description,
  peekConnectionsCount,
}: EventAboutSectionProps) {
  const router = useRouter();

  const handlePeekClick = () => {
    router.push(`/events/${eventId}/peek`);
  };

  return (
    <div className="mt-5 sm:mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold sm:text-[32px]">About</h2>

        <button
          type="button"
          onClick={handlePeekClick}
          data-event-id={eventId}
          className="relative flex min-h-[36px] min-w-[84px] items-center justify-center rounded-[7px] border-[3px] border-[#FFEA00] bg-black px-4 text-[14px] font-bold text-[#FFEA00] transition-transform active:scale-95 sm:min-h-[40px] sm:min-w-[104px]"
        >
          <span className={peekConnectionsCount > 0 ? "-translate-x-1.5" : ""}>Peek</span>
          {peekConnectionsCount > 0 && (
            <span className="absolute right-[6px] top-1/2 flex min-w-[16px] h-4 -translate-y-1/2 items-center justify-center rounded-full bg-[#FFEA00] px-1 text-[10px] font-black leading-none text-black">
              {peekConnectionsCount}
            </span>
          )}
        </button>
      </div>

      {/* Full, untruncated title — distinct from the Event Card block
          above, which truncates it (see the FR's "About section content"). */}
      <h3 className="mt-3 text-xl font-extrabold leading-snug">{title}</h3>

      <p className="mt-3.5 max-w-[680px] text-base font-bold leading-snug text-[#a9a9a9]">
        {description}
      </p>
    </div>
  );
}
