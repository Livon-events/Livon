import { createClient } from "@/lib/supabase/server";
import type { GoingVisibility } from "@/lib/mutations/event-interests";

export type EventEditData = {
  id: string;
  title: string;
  categoryId: string;
  startDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  venueName: string;
  description: string;
  admission: "free" | "paid";
  price: number | undefined;
  coverImageUrl: string;
  status: string;
};

/**
 * Fetches an event for the edit form, pre-shaped to match
 * CreateEventInput's field names. Returns null if the event doesn't exist
 * OR the caller isn't its organizer — same treatment for both, so
 * /events/[id]/edit can't be used to probe whether an event id exists.
 *
 * `admission`/`price` are derived from the stored `price` column (there's
 * no separate admission-type column — schema.md just has `price numeric
 * NOT NULL DEFAULT 0`), matching how the create form treats "Free" as
 * price = 0.
 */
export async function getEventForEdit(
  eventId: string,
  userId: string
): Promise<EventEditData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(
      "event_id, organizer_id, title, category_id, starts_at, venue_name, description, price, cover_image_url, status"
    )
    .eq("event_id", eventId)
    .maybeSingle();

  if (error || !data || data.organizer_id !== userId) {
    return null;
  }

  const startsAt = new Date(data.starts_at);
  const startDate = startsAt.toISOString().slice(0, 10);
  const startTime = `${String(startsAt.getUTCHours()).padStart(2, "0")}:${String(
    startsAt.getUTCMinutes()
  ).padStart(2, "0")}`;

  // PostgREST returns `numeric` columns as strings — same convention
  // already used in queries/home-feed.ts.
  const priceNum = parseFloat(data.price as unknown as string);

  return {
    id: data.event_id,
    title: data.title,
    categoryId: data.category_id,
    startDate,
    startTime,
    venueName: data.venue_name,
    description: data.description ?? "",
    admission: priceNum > 0 ? "paid" : "free",
    price: priceNum > 0 ? priceNum : undefined,
    coverImageUrl: data.cover_image_url,
    status: data.status,
  };
}

export type EventDetails = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  venueName: string;
  area: string;
  hostUsername: string;
  coverImageUrl: string;
  startsAt: string; // ISO timestamp — start-only per docs/FR/event-details-page.md.
  // `events.ends_at` exists in the DB but isn't used here currently; add it
  // back if the details page ever needs to show a range.
  categoryName: string;
  status: string;
  peekConnectionsCount: number; // attending_connections_count + host_bonus, per docs/FR/peek.md
  isGoing: boolean;
  // The viewer's own privacy choice on this event, per
  // docs/FR/going-rsvp-privacy.md — null whenever isGoing is false.
  myVisibility: GoingVisibility | null;
};

type EventRow = {
  event_id: string;
  title: string;
  description: string | null;
  venue_name: string;
  starts_at: string;
  cover_image_url: string;
  status: string;
  price: string; // numeric comes back as a string over PostgREST
  organizer_id: string;
  areas: { name: string } | null;
  categories: { name: string } | null;
  organizer: { username: string } | null;
};

/**
 * Fetch full details for a single event (event details page).
 *
 * The core event fields are a straightforward join — `events`, `areas`,
 * `categories`, `users` are all publicly SELECT-able per RLS (see
 * pg_policies check). `peekConnectionsCount` and `isGoing` are
 * viewer-dependent and only computed when a user is signed in.
 *
 * `peekConnectionsCount` deliberately does NOT re-implement the
 * visibility/connection filter from docs/FR/peek.md — RLS policy
 * `event_interests_select_own_or_connection` already restricts a plain
 * select to exactly that set (the viewer's own row, or `visible` rows from
 * accepted connections), so a bare query + excluding the viewer's own row
 * gives `attending_connections_count` for free. `host_bonus` is a separate
 * check against `connections`.
 *
 * NOTE: this hasn't been run against a live Supabase instance — worth a
 * smoke test, particularly the `connections` OR-group syntax below.
 */
export async function getEventDetails(eventId: string): Promise<EventDetails | null> {
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from("events")
    .select(
      `event_id, title, description, venue_name, starts_at,
       cover_image_url, status, price, organizer_id,
       areas ( name ),
       categories ( name ),
       organizer:users!organizer_id ( username )`
    )
    .eq("event_id", eventId)
    .single<EventRow>();

  if (error || !event) {
    return null;
  }

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  let isGoing = false;
  let myVisibility: GoingVisibility | null = null;
  let peekConnectionsCount = 0;

  if (viewer) {
    const [{ data: myInterest }, { data: eventInterests }, { data: hostConnection }] =
      await Promise.all([
        supabase
          .from("event_interests")
          .select("event_interest_id, visibility")
          .eq("event_id", eventId)
          .eq("user_id", viewer.id)
          .maybeSingle(),

        // RLS already limits this to: the viewer's own row, plus `visible`
        // rows belonging to accepted connections. We only need to exclude
        // the viewer's own row from the count below.
        supabase.from("event_interests").select("user_id").eq("event_id", eventId),

        // host_bonus: is the viewer connected (accepted) to the organizer?
        supabase
          .from("connections")
          .select("connection_id")
          .eq("status", "accepted")
          .or(
            `and(requester_id.eq.${viewer.id},receiver_id.eq.${event.organizer_id}),` +
              `and(requester_id.eq.${event.organizer_id},receiver_id.eq.${viewer.id})`
          )
          .maybeSingle(),
      ]);

    isGoing = Boolean(myInterest);
    myVisibility = (myInterest?.visibility as GoingVisibility | undefined) ?? null;

    const attendingConnectionsCount = (eventInterests ?? []).filter(
      (row) => row.user_id !== viewer.id
    ).length;
    const hostBonus = hostConnection ? 1 : 0;
    peekConnectionsCount = attendingConnectionsCount + hostBonus;
  }

  return {
    id: event.event_id,
    title: event.title,
    description: event.description,
    price: parseFloat(event.price),
    venueName: event.venue_name,
    area: event.areas?.name ?? "",
    hostUsername: event.organizer?.username ?? "",
    coverImageUrl: event.cover_image_url,
    startsAt: event.starts_at,
    categoryName: event.categories?.name ?? "",
    status: event.status,
    peekConnectionsCount,
    isGoing,
    myVisibility,
  };
}
