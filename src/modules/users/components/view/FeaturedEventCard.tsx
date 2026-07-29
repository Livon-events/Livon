import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import type { FeaturedEvent } from "@/modules/events";

interface FeaturedEventCardProps {
  event: FeaturedEvent;
}

// Styled directly off raw_html_and_css/profile_view/view_profile/profile.css
// (.event-card / .event-image-placeholder / .event-meta / .event-title).
export default function FeaturedEventCard({ event }: FeaturedEventCardProps) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-center gap-4 rounded-2xl border-[3px] border-white p-1.5 transition-colors hover:border-[#FFE600]"
    >
      <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-[10px] bg-[#3A3A3C]">
        {event.coverImageUrl && (
          <Image
            src={event.coverImageUrl}
            alt={event.title}
            fill
            sizes="74px"
            className="object-cover"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex w-full items-center justify-between">
          <span className="font-display text-[15px] font-bold capitalize tracking-[-0.2px] text-[#FFE600]">
            {event.countdownLabel}
          </span>
          {event.areaName && (
            <div className="flex items-center gap-1 text-[#AEAEB2]">
              <MapPin className="h-[15px] w-[15px]" strokeWidth={2.2} />
              <span className="text-[14px] font-semibold tracking-[-0.1px]">{event.areaName}</span>
            </div>
          )}
        </div>
        <h2 className="truncate font-display text-2xl font-extrabold tracking-[-0.6px] max-[380px]:text-[22px]">
          {event.title}
        </h2>
      </div>
    </Link>
  );
}
