import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { getPriceLabel } from "@/modules/events/format";
import EventCardHead from "./EventCardHead";
import EventCardActions from "./EventCardActions";
import EventCardBackground from "./EventCardBackground";
import HostLink from "./HostLink";
import type { GoingVisibility } from "@/modules/rsvp";

export type EventCardData = {
  id: string;
  title: string;
  price: number; // numeric, never null, schema default 0
  venueName: string;
  area: string;
  hostUsername: string;
  coverImageUrl: string | null;
  startsAt: string; // ISO timestamp
  endsAt: string | null; // ISO timestamp, or null (8hr fallback applies)
  peekConnectionsCount: number;
  isGoing: boolean;
  myVisibility: GoingVisibility | null;
};

type EventCardProps = {
  event: EventCardData;
  priority?: boolean;
};

export default function EventCard({ event, priority = false }: EventCardProps) {
  return (
    <Link
      href={`/events/${event.id}`}
      id={`eventCard-${event.id}`}
      className="relative flex h-full w-full flex-col overflow-hidden text-white"
    >
      <EventCardBackground eventId={event.id} />

      <EventCardHead
        startsAt={event.startsAt}
        endsAt={event.endsAt}
        peekConnectionsCount={event.peekConnectionsCount}
        eventId={event.id}
      />

      <div className="relative z-10 m-[3px] mt-[5px] flex flex-1 flex-col overflow-hidden rounded-[10px] bg-black">
        <div className="relative m-[4px] aspect-[1200/630] w-[calc(100%-8px)] shrink-0 overflow-hidden rounded-[9px] bg-[#3A3A3C]">
          {event.coverImageUrl && (
            <Image
              src={event.coverImageUrl}
              alt={event.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
              priority={priority}
            />
          )}
        </div>

        <div className="flex flex-1 flex-col p-[6px] text-white">
          <h2 className="mb-[12px] line-clamp-2 min-h-[2.75em] text-lg font-bold leading-snug">
            {event.title}
          </h2>
          <h3 className="text-base font-bold">{getPriceLabel(event.price)}</h3>
          <div className="my-1 flex items-center gap-1 text-[14px] text-[#B1B0B0]">
            <p className="truncate">
              <span>{event.venueName}</span>, <span>{event.area}</span>
            </p>
            <MapPin className="h-[20px] w-[20px] shrink-0" strokeWidth={2} />
          </div>
          <p className="text-[14px]">
            Hosted by <HostLink username={event.hostUsername} />
          </p>
        </div>

        <EventCardActions
          eventId={event.id}
          eventTitle={event.title}
          initialInterested={event.isGoing}
          initialVisibility={event.myVisibility}
        />
      </div>
    </Link>
  );
}