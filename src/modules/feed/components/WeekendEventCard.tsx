import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { getPriceLabel, getTimeOrLiveLabel, getWeekendDayLabel } from "@/modules/events";
import { safeImageUrl } from "@/shared/security/urls";
import type { WeekendEvent } from "../queries";

type WeekendEventCardProps = {
  event: WeekendEvent;
  now: Date;
  priority?: boolean;
};

/**
 * Server-only rail card — no hooks, no measured SVG chrome, no RSVP actions,
 * so 20 of these ship zero client JS. The title Link is stretched over the
 * whole card via ::after so the entire card is tappable.
 */
export default function WeekendEventCard({ event, now, priority = false }: WeekendEventCardProps) {
  const coverImageUrl = safeImageUrl(event.coverImageUrl);
  const starts = new Date(event.startsAt);
  const ends = event.endsAt ? new Date(event.endsAt) : null;

  return (
    <article className="relative flex h-full flex-col rounded-[12px] bg-[#FFF335] p-[3px] text-white">
      <div className="flex h-[36px] p-[2px]">
        <div className="flex flex-1 items-center gap-2 rounded-[7px] bg-[#0C0C0C] px-3 text-[14px] font-medium text-white">
          <span className="flex-[3] truncate text-center">{getWeekendDayLabel(starts, now)}</span>
          <span aria-hidden="true" className="h-4 w-[2px] shrink-0 bg-white" />
          <span className="flex-[2] whitespace-nowrap text-center">{getTimeOrLiveLabel(starts, ends, now)}</span>
        </div>
      </div>

      <div className="mt-[3px] flex flex-1 flex-col overflow-hidden rounded-[10px] bg-[#0C0C0C]">
        <div className="relative m-[4px] aspect-[1200/630] w-[calc(100%-8px)] shrink-0 overflow-hidden rounded-[9px] bg-[#3A3A3C]">
          {coverImageUrl && (
            <Image
              src={coverImageUrl}
              alt=""
              fill
              sizes="(min-width: 768px) 340px, 85vw"
              className="object-cover"
              preload={priority}
              loading={priority ? "eager" : undefined}
              fetchPriority={priority ? "high" : undefined}
            />
          )}
          <span className="absolute bottom-[6px] right-[6px] rounded-[7px] bg-[#FFF335] px-3 py-[3px] text-[14px] font-bold text-[#0C0C0C]">
            {getPriceLabel(event.price)}
          </span>
        </div>

        <div className="flex flex-col gap-1 px-[8px] pb-[8px] pt-[4px]">
          <h3 className="line-clamp-1 text-[17px] font-bold leading-tight">
            <Link
              href={`/events/${event.id}`}
              className="after:absolute after:inset-0 after:rounded-[12px] after:content-['']"
            >
              {event.title}
            </Link>
          </h3>
          <p className="flex items-center gap-1 text-[14px] text-white">
            <MapPin className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            <span className="truncate">
              {event.venueName}, {event.area}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}
