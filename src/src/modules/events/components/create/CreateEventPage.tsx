import BackButton from "@/modules/events/components/create/BackButton";
import CreateEventForm, {
  type EventFormInitialValues,
} from "@/modules/events/components/create/CreateEventForm";

export type CreateEventCategory = { id: string; name: string };

type CreateEventPageProps = {
  categories: CreateEventCategory[];
  locationReady: boolean;
  locationLabel: string | null;
} & (
  | { mode?: "create"; eventId?: undefined; initialValues?: undefined }
  | { mode: "edit"; eventId: string; initialValues: EventFormInitialValues }
);

/**
 * Server shell for /create-event AND /events/[id]/edit — the same form
 * (CreateEventForm) and shell handle both create and edit, per the
 * product decision to not build a second form from scratch. Only the two
 * thin route files differ (auth + which data they fetch); this shell and
 * the form component are shared as-is.
 *
 * Converted from raw_html_and_css/create_event/event_creation_form.html —
 * structure and visual language (colors, spacing, chip styling) preserved,
 * rebuilt with Tailwind utility classes to match how the rest of the
 * events surface (EventDetailsPage, EventCard) was converted, rather than
 * porting the raw CSS file wholesale.
 *
 * Only the back button and the form itself need interactivity — this shell
 * stays a Server Component.
 */
export default function CreateEventPage(props: CreateEventPageProps) {
  const { categories, locationReady, locationLabel } = props;
  const isEditing = props.mode === "edit";

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-[min(calc(100%-24px),798px)] pb-10 pt-4 sm:w-[min(calc(100%-48px),798px)]">
        <header className="mb-3 flex h-14 items-center justify-between">
          <BackButton />
          <h1 className="text-xl font-extrabold tracking-tight">
            {isEditing ? "Edit Event" : "Create Event"}
          </h1>
          <div className="w-10" />
        </header>

        {isEditing ? (
          <CreateEventForm
            mode="edit"
            eventId={props.eventId}
            initialValues={props.initialValues}
            categories={categories}
            locationReady={locationReady}
            locationLabel={locationLabel}
          />
        ) : (
          <CreateEventForm
            categories={categories}
            locationReady={locationReady}
            locationLabel={locationLabel}
          />
        )}
      </div>
    </main>
  );
}
