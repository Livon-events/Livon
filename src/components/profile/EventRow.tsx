import type { EventSummary } from "./types";

interface EventRowProps {
  event: EventSummary;
  actionLabel: string;
  onAction?: (id: string) => void;
}

export default function EventRow({ event, actionLabel, onAction }: EventRowProps) {
  return (
    <div className="flex items-center gap-3.5 bg-[#17181A] rounded-2xl px-3 py-2.5">
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
      <button
        type="button"
        onClick={() => onAction?.(event.id)}
        className="font-display text-sm font-extrabold border-none rounded-[10px] px-4 py-2.5 bg-[#FFE600] text-black cursor-pointer flex-shrink-0"
      >
        {actionLabel}
      </button>
    </div>
  );
}
