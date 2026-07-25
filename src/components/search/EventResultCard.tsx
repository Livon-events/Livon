import Link from "next/link";
import Image from "next/image";
import { getEventDateTimeLabel } from "@/lib/format/eventCard";
import type { EventSearchResult } from "@/lib/queries/search";

type EventResultCardProps = {
  event: EventSearchResult;
};

// Compact list-row variant of EventCard, sized for search results rather
// than the home feed grid — thumbnail + title + venue/area + date, no
// Going/price/host actions.
export default function EventResultCard({ event }: EventResultCardProps) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-center gap-3 rounded-xl bg-[#161616] p-2.5 transition-colors active:bg-[#1e1e1e]"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#CC00AA]">
        {event.coverImageUrl && (
          <Image
            src={event.coverImageUrl}
            alt={event.title}
            fill
            sizes="64px"
            className="object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-white">{event.title}</h3>
        <p className="truncate text-[13px] text-[#a1a1a6]">
          {event.venueName}, {event.areaName}
        </p>
        <p className="text-[12px] text-[#8e8e93]">
          {getEventDateTimeLabel(new Date(event.startsAt))}
        </p>
      </div>
    </Link>
  );
}
