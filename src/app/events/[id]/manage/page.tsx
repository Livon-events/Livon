import { redirect, notFound } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { getEventManagementData } from "@/modules/events/queries";
import { EventManagementPage } from "@/modules/events";

type EventManageRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EventManageRoute({ params }: EventManageRouteProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/events/${id}/manage`);
  }

  const data = await getEventManagementData(id, user.id);

  // If the event does not exist OR the user is not the host/organizer,
  // return a 404 to ensure only the host can access the management page.
  if (!data) {
    notFound();
  }

  return (
    <EventManagementPage
      dateLabel={data.dateLabel}
      attendingCount={data.attendingCount}
      sharesCount={data.sharesCount}
      attendees={data.attendees}
    />
  );
}
