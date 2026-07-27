export type { EventEditData, EventDetails, EventSummary, FeaturedEvent } from "./types";
export { IMAGE_MAX_BYTES } from "./validation";
export { createEvent, updateEvent, cancelEvent } from "./mutations";
export type { CreateEventInput, UpdateEventInput } from "./mutations";
export {
  getPriceLabel,
  getCountdownLabel,
  getTimeOrLiveLabel,
  getEventDateTimeLabel,
  getProfileEventDateLabel,
} from "./format";

export { default as EventCard } from "./components/card/EventCard";
export { default as EventCardActions } from "./components/card/EventCardActions";
export { default as EventCardBackground } from "./components/card/EventCardBackground";
export { default as EventCardGrid } from "./components/card/EventCardGrid";
export { default as EventCardHead } from "./components/card/EventCardHead";
export { default as HostLink } from "./components/card/HostLink";
export { default as BackButton } from "./components/create/BackButton";
export { default as CreateEventForm } from "./components/create/CreateEventForm";
export { default as CreateEventPage } from "./components/create/CreateEventPage";
export { default as EventAboutSection } from "./components/details/EventAboutSection";
export { default as EventActionBar } from "./components/details/EventActionBar";
export { default as EventDetailsCard } from "./components/details/EventDetailsCard";
export { default as EventDetailsPage } from "./components/details/EventDetailsPage";

// Server-only — deliberately not re-exported here. `createEventOnServer` /
// `updateEventOnServer` pull in `sharp` via modules/events/images.ts.
// Route handlers import them directly:
//   import { createEventOnServer, updateEventOnServer } from "@/modules/events/serverMutations";

// queries.ts is never barrel-exported either — uses the server Supabase
// client (next/headers), which breaks any Client Component that ends up
// importing this file transitively. Server Components, Route Handlers,
// and other modules' server-only files import it directly:
//   import { getEventDetails } from "@/modules/events/queries";
