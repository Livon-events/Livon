import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailsPage } from "@/modules/events";
import { getEventDetails } from "@/modules/events/queries";
import { safeImageUrl } from "@/shared/security/urls";

type EventPageProps = {
  params: Promise<{ id: string }>;
};

function truncateForPreview(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventDetails(id);

  if (!event) {
    return {
      title: "Event not found",
    };
  }

  const title = event.title;
  const coverImageUrl = safeImageUrl(event.coverImageUrl);
  const description = truncateForPreview(
    event.description?.trim() ||
      [event.venueName, event.area].filter(Boolean).join(" · ") ||
      `Join ${event.title} on Livon`
  );

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      url: `/events/${event.id}`,
      siteName: "Livon",
      images: coverImageUrl ? [{ url: coverImageUrl, alt: event.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: coverImageUrl ? [coverImageUrl] : [],
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;

  const event = await getEventDetails(id);

  if (!event) {
    notFound();
  }

  return <EventDetailsPage event={event} />;
}
