import { redirect, notFound } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { getCategories } from "@/modules/categories/queries";
import { getEventForEdit } from "@/modules/events/queries";
import { CreateEventPage } from "@/modules/events";

type EditEventRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditEventRoute({ params }: EditEventRouteProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/events/${id}/edit`);
  }

  const [event, categories] = await Promise.all([
    getEventForEdit(id, user.id),
    getCategories(),
  ]);

  // getEventForEdit returns null for "doesn't exist" and "not your event"
  // alike — same 404 either way, so this route can't be used to probe
  // which event ids exist or who organizes them.
  if (!event) {
    notFound();
  }

  return (
    <CreateEventPage
      mode="edit"
      eventId={event.id}
      initialValues={{
        title: event.title,
        categoryId: event.categoryId,
        startDate: event.startDate,
        startTime: event.startTime,
        endDate: event.endDate,
        endTime: event.endTime,
        venueName: event.venueName,
        description: event.description,
        admission: event.admission,
        price: event.price,
        coverImageUrl: event.coverImageUrl,
      }}
      categories={categories}
    />
  );
}
