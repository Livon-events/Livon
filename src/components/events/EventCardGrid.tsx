import EventCard, { type EventCardData } from "./EventCard";

type EventCardGridProps = {
  events: EventCardData[];
};

export default function EventCardGrid({ events }: EventCardGridProps) {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-[13px] px-3 py-0 md:grid-cols-2 lg:grid-cols-3 lg:px-6">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
