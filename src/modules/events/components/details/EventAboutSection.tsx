"use client";

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
// page-specific variant, so this is a TODO until that route exists,
// mirroring the placeholder in EventCardHead.
export default function EventAboutSection({
  eventId,
  title,
  description,
  peekConnectionsCount,
}: EventAboutSectionProps) {
  const handlePeekClick = () => {
    // TODO: navigate to the Peek page for `eventId` per docs/FR/peek.md.
  };

  return (
    <div className="mt-5 sm:mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold sm:text-[32px]">About</h2>

        <button
          type="button"
          onClick={handlePeekClick}
          data-event-id={eventId}
          className="relative min-h-[32px] min-w-[84px] rounded-lg border-2 border-[#FFEA00] px-4 text-sm font-extrabold text-white transition-transform active:scale-95 sm:min-h-[40px] sm:min-w-[104px] sm:text-base"
        >
          Peek
          {peekConnectionsCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFEA00] text-[10px] font-black leading-none text-black">
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
