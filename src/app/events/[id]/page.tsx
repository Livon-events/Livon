import { notFound } from "next/navigation";
import EventDetailsPage from "@/components/events/details/EventDetailsPage";
import { getEventDetails } from "@/lib/queries/events";

type EventPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;

  const event = await getEventDetails(id);

  if (!event) {
    notFound();
  }

  return <EventDetailsPage event={event} />;
}
