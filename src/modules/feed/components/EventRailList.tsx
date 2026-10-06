import EventRailCard from "./EventRailCard";
import type { RailEvent } from "../queries";

type EventRailListProps<T extends RailEvent> = {
  events: T[];
  now: Date;
  getDayLabel: (event: T, now: Date) => string;
  /** Eager-load the first cover — only for the list visible on first paint. */
  prioritizeFirst?: boolean;
};

/**
 * Horizontal card list for the home rail. Native overflow + CSS scroll-snap
 * only — no scroll listeners or carousel lib, and every cover image except
 * the first lazy-loads. No content-visibility: its placeholder height
 * stretches every card in the flex row, leaving empty space at the card
 * bottom. Must stay a Server Component — getDayLabel is a function and
 * can't cross into a Client Component; pass the rendered list instead.
 */
export default function EventRailList<T extends RailEvent>({
  events,
  now,
  getDayLabel,
  prioritizeFirst = false,
}: EventRailListProps<T>) {
  return (
    <div
      className="
        mx-auto max-w-[1400px]
        snap-x snap-mandatory overflow-x-auto overscroll-x-contain
        scroll-px-3 px-3 lg:scroll-px-6 lg:px-6
        [scrollbar-width:none]
        [-webkit-overflow-scrolling:touch]
        [&::-webkit-scrollbar]:hidden
      "
    >
      <ul className="flex w-max list-none gap-[13px]">
        {events.map((event, index) => (
          <li
            key={event.id}
            className="w-[85vw] max-w-[340px] shrink-0 snap-start"
          >
            <EventRailCard
              event={event}
              now={now}
              dayLabel={getDayLabel(event, now)}
              priority={prioritizeFirst && index === 0}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
