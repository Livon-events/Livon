import { notFound } from "next/navigation";
import { EventDetailsPage } from "@/modules/events";
import { getEventDetails } from "@/modules/events/queries";

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