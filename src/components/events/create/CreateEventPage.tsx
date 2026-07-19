import BackButton from "@/components/events/create/BackButton";
import CreateEventForm from "@/components/events/create/CreateEventForm";

export type CreateEventCategory = { id: string; name: string };

type CreateEventPageProps = {
  categories: CreateEventCategory[];
  locationReady: boolean;
  locationLabel: string | null;
};

/**
 * Server shell for /create-event. Converted from
 * raw_html_and_css/create_event/event_creation_form.html — structure and
 * visual language (colors, spacing, chip styling) preserved, rebuilt with
 * Tailwind utility classes to match how the rest of the events surface
 * (EventDetailsPage, EventCard) was converted, rather than porting the raw
 * CSS file wholesale.
 *
 * Only the back button and the form itself need interactivity — this shell
 * stays a Server Component.
 */
export default function CreateEventPage({
  categories,
  locationReady,
  locationLabel,
}: CreateEventPageProps) {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-[min(calc(100%-24px),798px)] pb-10 pt-4 sm:w-[min(calc(100%-48px),798px)]">
        <header className="mb-3 flex h-14 items-center justify-between">
          <BackButton />
          <h1 className="text-xl font-extrabold tracking-tight">Create Event</h1>
          <div className="w-10" />
        </header>

        <CreateEventForm
          categories={categories}
          locationReady={locationReady}
          locationLabel={locationLabel}
        />
      </div>
    </main>
  );
}
