import EventDetailsCard from "./EventDetailsCard";
import EventAboutSection from "./EventAboutSection";
import EventActionBar from "./EventActionBar";
import type { EventDetails } from "@/modules/events/queries";

type EventDetailsPageProps = {
  event: EventDetails;
};

export default function EventDetailsPage({ event }: EventDetailsPageProps) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-[min(calc(100%-24px),798px)] pb-24 sm:w-[min(calc(100%-48px),798px)] sm:pb-12">
        <h1 className="mb-1 text-2xl font-extrabold leading-tight sm:mb-2 sm:text-[32px]">
          Event details
        </h1>

        <EventDetailsCard event={event} />

        {/*
          Ad slot — sits between the Event Card and the About section.
          Not specced yet (network/format/targeting all open), per
          docs/FR/event-details-page.md — only its position is confirmed,
          so no ad UI renders here yet.
        */}

        <EventAboutSection
          eventId={event.id}
          title={event.title}
          description={event.description ?? ""}
          peekConnectionsCount={event.peekConnectionsCount}
        />

        <div className="mt-6 sm:mt-8">
          <EventActionBar
            eventId={event.id}
            eventTitle={event.title}
            initialGoing={event.isGoing}
            initialVisibility={event.myVisibility}
          />
        </div>
      </div>
    </main>
  );
}
