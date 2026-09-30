import WeekendEventCard from "./WeekendEventCard";
import type { WeekendEvent } from "../queries";

type WeekendRailProps = {
  events: WeekendEvent[];
};

/**
 * Horizontal "This weekend" rail. Native overflow + CSS scroll-snap only —
 * no scroll listeners or carousel lib, and every cover image except the
 * first lazy-loads. No content-visibility: its placeholder height stretches
 * every card in the flex row, leaving empty space at the card bottom.
 */
export default function WeekendRail({ events }: WeekendRailProps) {
  if (events.length === 0) return null;

  const now = new Date();

  return (
    <section aria-labelledby="weekendRailHeading" className="w-full bg-[#0C0C0C] pb-2">
      <h2
        id="weekendRailHeading"
        className="mx-auto max-w-[1400px] px-3 pb-2 text-[22px] font-bold text-white lg:px-6"
      >
        This weekend
      </h2>
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
              <WeekendEventCard event={event} now={now} priority={index === 0} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
