import Link from "next/link";
import { X, Wrench } from "lucide-react";
import type { EventSummary } from "./types";

interface EventRowProps {
  event: EventSummary;
  actionLabel: "leave" | "manage";
  onAction?: (id: string) => void;
}

export default function EventRow({ event, actionLabel, onAction }: EventRowProps) {
  const Icon = actionLabel === "leave" ? X : Wrench;

  return (
    <div className="flex items-center gap-3.5 bg-[#17181A] rounded-2xl px-3 py-2.5">
      {/* Action button is a sibling, not nested inside this Link, so it
          needs no preventDefault/stopPropagation to avoid double-triggering
          a navigation. */}
      <Link href={`/events/${event.id}`} className="flex flex-1 min-w-0 items-center gap-3.5">
        <div
          className="w-14 h-14 rounded-xl bg-[#d11a8c] flex-shrink-0 bg-cover bg-center"
          style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
        />
        <div className="flex-1 min-w-0">
          <div className="font-display text-[16px] font-bold text-white truncate">{event.title}</div>
          <div className="text-[13px] text-[#AEAEB2] truncate">
            {event.dateLabel}
            {event.location ? ` · ${event.location}` : ""}
          </div>
          {typeof event.attendeeCount === "number" && (
            <div className="text-[12px] text-[#AEAEB2]">{event.attendeeCount} going</div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onAction?.(event.id)}
        aria-label={actionLabel}
        title={actionLabel}
        className="flex items-center justify-center border-none rounded-[10px] w-10 h-10 bg-[#FFE600] text-black cursor-pointer flex-shrink-0"
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={2.5} />
      </button>
    </div>
  );
}