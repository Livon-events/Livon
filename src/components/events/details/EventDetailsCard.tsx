import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { getPriceLabel, getEventDateTimeLabel } from "@/lib/format/eventCard";
import type { EventDetails } from "@/lib/queries/events";

type EventDetailsCardProps = {
  event: EventDetails;
};

// The yellow-bordered card in the reference mockup. Excludes end time — no
// end-time input exists on the creation form (see the FR's "Event Card
// block" section), so the date/time line is start time only, not a range.
export default function EventDetailsCard({ event }: EventDetailsCardProps) {
  const dateTimeLabel = getEventDateTimeLabel(new Date(event.startsAt));

  return (
    <div className="overflow-hidden rounded-lg border-2 border-[#FFEA00]">
      {/* Poster — 4px gap from the card border on all sides, matching the
          mockup's .poster-wrap/.poster treatment. */}
      <div className="bg-black p-1">
        <div className="relative aspect-[16/7] min-h-[180px] w-full overflow-hidden rounded-md bg-[#CC00AA] sm:min-h-[220px]">
          {event.coverImageUrl && (
            <Image
              src={event.coverImageUrl}
              alt={event.title}
              fill
              sizes="(min-width: 768px) 798px, 100vw"
              className="object-cover"
            />
          )}
        </div>
      </div>

      <div className="px-2 pb-4 pt-3 sm:px-4 sm:pt-[18px]">
        <h1 className="line-clamp-2 text-2xl font-extrabold leading-tight sm:text-[32px]">
          {event.title}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-[#d1d5db] sm:mt-3 sm:text-sm">
          <span className="font-semibold text-white">{dateTimeLabel}</span>
        </div>

        <div className="mt-1 flex items-center gap-1 text-xs text-[#9ca3af] sm:mt-1.5 sm:text-sm">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">
            {event.venueName}, {event.area}
          </span>
        </div>

        <p className="mt-2 text-xs text-[#d1d5db] sm:mt-2.5 sm:text-sm">
          Hosted by{" "}
          <Link
            href={`/users/${encodeURIComponent(event.hostUsername)}`}
            className="font-semibold text-[#FFEA00] hover:underline"
          >
            {event.hostUsername}
          </Link>
        </p>

        <div className="mt-5 flex items-center justify-between sm:mt-7">
          <span className="rounded bg-[#242424] px-2.5 py-2 text-xs font-extrabold text-[#e5e7eb] sm:px-3.5 sm:text-sm">
            {event.categoryName}
          </span>
          <span className="text-2xl font-extrabold text-[#FFEA00] sm:text-[32px]">
            {getPriceLabel(event.price)}
          </span>
        </div>
      </div>
    </div>
  );
}
