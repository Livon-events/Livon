import { notFound } from "next/navigation";
import { PeekPage } from "@/modules/events";
import { getPeekPageData } from "@/modules/events/queries";

type EventPeekPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventPeekPage({ params }: EventPeekPageProps) {
  const { id } = await params;

  const data = await getPeekPageData(id);

  if (!data) {
    notFound();
  }

  return <PeekPage data={data} />;
}
