import "server-only";
import { cache } from "react";
import { createClient } from "@/shared/supabase/server";
import type { GoingVisibility } from "@/modules/rsvp";
import {
  getMyInterest,
  getConnectionsGoingCount,
  getEventIdsUserIsGoingTo,
  getEventGoingCount,
  getConnectionsAttendingList,
} from "@/modules/rsvp/queries";
import { isConnectedTo } from "@/modules/connections/queries";
import {
  getProfileEventDateLabel,
  getEventManagementDateLabel,
  getCountdownLabel,
  isEventStillLive,
} from "@/modules/events/format";
import { isClaimableEvent } from "@/modules/events/platform";
import type {
  EventSummary,
  FeaturedEvent,
  EventEditData,
  EventDetails,
  PeekPageData,
  EventManagementData,
} from "@/modules/events/types";

export type { EventEditData, EventDetails, PeekPageData };

/**
 * All reads of the `events` table live in this one file — merged during
 * the modular-monolith restructuring from what used to be three separate
 * files: `lib/queries/events.ts`, the events-related exports in
 * `lib/queries/profile-events.ts`, and `getPublicUpcomingHostedEvents` from
 * `lib/queries/public-profile.ts`. Functions are named for what they do,
 * not for which page originally called them.
 */

/**
 * Fetches an event for the edit form, pre-shaped to match
 * CreateEventInput's field names. Returns null if the event doesn't exist
 * OR the caller isn't its organizer — same treatment for both, so
 * /events/[id]/edit can't be used to probe whether an event id exists.
 */
export async function getEventForEdit(
  eventId: string,
  userId: string
): Promise<EventEditData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(
      "event_id, organizer_id, title, category_id, starts_at, ends_at, venue_name, description, price, cover_image_url, status"
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

  let endDate = "";
  let endTime = "";
  if (data.ends_at) {
    const endsAt = new Date(data.ends_at);
    endDate = endsAt.toISOString().slice(0, 10);
    endTime = `${String(endsAt.getUTCHours()).padStart(2, "0")}:${String(
      endsAt.getUTCMinutes()
    ).padStart(2, "0")}`;
  }

  // PostgREST returns `numeric` columns as strings.
  const priceNum = parseFloat(data.price as unknown as string);

  return {
    id: data.event_id,
    title: data.title,
    categoryId: data.category_id,
    startDate,
    startTime,
    endDate,
    endTime,
    venueName: data.venue_name,
    description: data.description ?? "",
    admission: priceNum > 0 ? "paid" : "free",
    price: priceNum > 0 ? priceNum : undefined,
    coverImageUrl: data.cover_image_url,
    status: data.status,
  };
}

type EventDetailsRow = {
  event_id: string;
  title: string;
  description: string | null;
  venue_name: string;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string;
  status: string;
  price: string; // numeric comes back as a string over PostgREST
  organizer_id: string;
  claimed_at: string | null;
  intended_claim_user_id: string | null;
  intended_claim_email: string | null;
  areas: { name: string } | null;
  categories: { name: string } | null;
  organizer: { username: string } | null;
};

/**
 * Fetch full details for a single event (event details page).
 *
 * The core event fields are a straightforward join — `events`, `areas`,
 * `categories`, `users` are all publicly SELECT-able per RLS. Viewer-
 * dependent fields (`isGoing`, `myVisibility`, `peekConnectionsCount`) used
 * to be computed here with direct queries against `event_interests` and
 * `connections` — under the module boundary rule those tables belong to
 * `rsvp` and `connections` respectively, so this function now composes
 * their exported query functions instead of reading those tables itself.
 */
/** Cached per request so `generateMetadata` and the page share one fetch. */
export const getEventDetails = cache(async function getEventDetails(
  eventId: string
): Promise<EventDetails | null> {
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from("events")
    .select(
      `event_id, title, description, venue_name, starts_at, ends_at,
       cover_image_url, status, price, organizer_id,
       claimed_at, intended_claim_user_id, intended_claim_email,
       areas ( name ),
       categories ( name ),
       organizer:users!organizer_id ( username )`
    )
    .eq("event_id", eventId)
    .single<EventDetailsRow>();

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
    const [myInterest, connectionsGoingCount, hostIsConnected] = await Promise.all([
      getMyInterest(eventId, viewer.id),
      getConnectionsGoingCount(eventId, viewer.id),
      isConnectedTo(viewer.id, event.organizer_id),
    ]);

    isGoing = myInterest.isGoing;
    myVisibility = myInterest.visibility;
    peekConnectionsCount = connectionsGoingCount + (hostIsConnected ? 1 : 0);
  }

  const isClaimable = isClaimableEvent({
    organizerId: event.organizer_id,
    claimedAt: event.claimed_at,
    hostUsername: event.organizer?.username ?? "",
  });

  const intendedEmail = event.intended_claim_email?.trim() || null;
  const hasIntendedClaimant = Boolean(event.intended_claim_user_id || intendedEmail);
  const claimNeedsOpsTransfer = isClaimable && !hasIntendedClaimant;

  let canViewerClaim = false;
  if (viewer && isClaimable && hasIntendedClaimant) {
    if (event.intended_claim_user_id) {
      canViewerClaim = viewer.id === event.intended_claim_user_id;
    } else if (intendedEmail && viewer.email && viewer.email_confirmed_at) {
      canViewerClaim =
        viewer.email.trim().toLowerCase() === intendedEmail.toLowerCase();
    }
  }

  return {
    id: event.event_id,
    organizerId: event.organizer_id,
    title: event.title,
    description: event.description,
    price: parseFloat(event.price),
    venueName: event.venue_name,
    area: event.areas?.name ?? "",
    hostUsername: event.organizer?.username ?? "",
    coverImageUrl: event.cover_image_url,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    categoryName: event.categories?.name ?? "",
    status: event.status,
    peekConnectionsCount,
    isGoing,
    myVisibility,
    isClaimable,
    canViewerClaim,
    claimNeedsOpsTransfer,
  };
});

/**
 * Data for the Peek page (docs/FR/peek.md) — reached from the Peek button
 * on either the feed card or the event details "About" section. Only
 * needs `event_id` (to look up the host, so it can be excluded from the
 * attendees list) and the signed-in viewer, per the FR's inputs/outputs
 * section. Returns null if the event doesn't exist, so the route can
 * 404 the same way `getEventForEdit`/`getEventDetails` do.
 */
export async function getPeekPageData(eventId: string): Promise<PeekPageData | null> {
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from("events")
    .select("event_id, organizer_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error || !event) {
    return null;
  }

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const [goingCount, attendingConnections] = await Promise.all([
    getEventGoingCount(eventId),
    viewer ? getConnectionsAttendingList(eventId, viewer.id, event.organizer_id) : Promise.resolve([]),
  ]);

  return {
    eventId,
    goingCount,
    attendingConnections,
  };
}

type EventSummaryRow = {
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string;
  cover_image_url: string;
  // PostgREST aggregate embed (`event_interests(count)`) — always comes
  // back as a one-element array containing `{ count }`, even when zero.
  event_interests: { count: number }[];
};

const EVENT_SUMMARY_SELECT =
  "event_id, title, starts_at, ends_at, venue_name, cover_image_url, event_interests(count)";

function mapEventSummaryRow(row: EventSummaryRow): EventSummary {
  return {
    id: row.event_id,
    title: row.title,
    dateLabel: getProfileEventDateLabel(new Date(row.starts_at)),
    location: row.venue_name,
    imageUrl: row.cover_image_url,
    attendeeCount: row.event_interests?.[0]?.count ?? 0,
  };
}

/**
 * Events a user organizes — the profile page's "Created" tab. Renamed
 * from `getProfileCreatedEvents` (its name in the pre-restructuring
 * `lib/queries/profile-events.ts`) since it's not exclusively a profile
 * concern, just an events-table read parameterized by organizer.
 *
 */
export async function getEventsOrganizedBy(userId: string): Promise<EventSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SUMMARY_SELECT)
    .eq("organizer_id", userId)
    .order("starts_at", { ascending: false })
    .returns<EventSummaryRow[]>();

  if (error) {
    throw new Error(`getEventsOrganizedBy failed: ${error.message}`);
  }

  const summaries = (data ?? []).map(mapEventSummaryRow);
  // The embedded aggregate is filtered by attendee-visibility RLS. Use the
  // count-only RPC so organizers see the same total as Peek and Manage.
  const attendeeCounts = await Promise.all(
    summaries.map((event) => getEventGoingCount(event.id))
  );

  return summaries.map((event, index) => ({
    ...event,
    attendeeCount: attendeeCounts[index],
  }));
}

/**
 * Fetches specific events by id, in `EventSummary` shape. Extracted as its
 * own function during the restructuring so `getEventsUserIsGoingTo` below
 * can compose it with `rsvp.getEventIdsUserIsGoingTo` — `events` owns the
 * `events` table read, `rsvp` owns the `event_interests` id lookup, and
 * neither reaches into the other's table directly.
 *
 * When `options.excludeEnded` is true (the Going tab), drops events whose
 * derived end has passed — same ends_at ?? starts_at+8h rule as the home
 * feed. Interest rows are kept in the DB (archival); they just stop
 * surfacing in "going" lists once the event is over.
 */
export async function getEventsByIds(
  eventIds: string[],
  options: { excludeEnded?: boolean } = {}
): Promise<EventSummary[]> {
  if (eventIds.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SUMMARY_SELECT)
    .in("event_id", eventIds)
    .order("starts_at", { ascending: false })
    .returns<EventSummaryRow[]>();

  if (error) {
    throw new Error(`getEventsByIds failed: ${error.message}`);
  }

  const rows = data ?? [];
  const now = new Date();
  const visible = options.excludeEnded
    ? rows.filter((row) =>
        isEventStillLive(
          new Date(row.starts_at),
          row.ends_at ? new Date(row.ends_at) : null,
          now
        )
      )
    : rows;

  return visible.map(mapEventSummaryRow);
}

/**
 * Events a user has expressed interest in — the profile page's "Going"
 * tab. Renamed from `getProfileGoingEvents`. Composes `rsvp`'s id lookup
 * with this module's own `getEventsByIds` rather than querying
 * `event_interests` directly (that table belongs to `rsvp`) — this is the
 * same "two round-trips" shape the original function already used, just
 * with the first round-trip now living in its owning module.
 *
 * Cancelled events never show up here — cancelling deletes the event row,
 * which cascades and removes the corresponding event_interests row too,
 * so there's nothing left for `getEventIdsUserIsGoingTo` to return.
 * Ended events are filtered out at read time (see getEventsByIds).
 */
export async function getEventsUserIsGoingTo(userId: string): Promise<EventSummary[]> {
  const eventIds = await getEventIdsUserIsGoingTo(userId);
  return getEventsByIds(eventIds, { excludeEnded: true });
}

type FeaturedEventRow = {
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string;
  areas: { name: string } | null;
};

/**
 * "Featured Hosted-Events" strip on another user's profile — their active,
 * not-yet-ended events, soonest first. Renamed from
 * `getPublicUpcomingHostedEvents`. Reuses the same
 * ends_at ?? starts_at+8h "still live" derivation as `get_home_feed`
 * rather than a stored "past" flag, per the archival-over-deletion
 * principle. Empty array means the section should be hidden entirely, not
 * shown empty.
 */
export async function getUpcomingActiveEventsOrganizedBy(userId: string): Promise<FeaturedEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("event_id, title, starts_at, ends_at, cover_image_url, areas ( name )")
    .eq("organizer_id", userId)
    .eq("status", "active")
    .order("starts_at", { ascending: true })
    .returns<FeaturedEventRow[]>();

  if (error) {
    throw new Error(`getUpcomingActiveEventsOrganizedBy failed: ${error.message}`);
  }

  const now = new Date();

  return (data ?? [])
    .filter((row) =>
      isEventStillLive(
        new Date(row.starts_at),
        row.ends_at ? new Date(row.ends_at) : null,
        now
      )
    )
    .map((row) => {
      const startsAt = new Date(row.starts_at);
      return {
        id: row.event_id,
        title: row.title,
        countdownLabel: getCountdownLabel(startsAt, now),
        areaName: row.areas?.name ?? "",
        coverImageUrl: row.cover_image_url,
      };
    });
}

type EventManagementDataRow = {
  event_id: string;
  organizer_id: string;
  venue_name: string;
  starts_at: string;
  area_name: string | null;
  attending_count: number;
  shares_count: number;
  views_count: number;
  attendees: Array<{
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    tiktok_url: string | null;
  }>;
};

/**
 * Fetches management data for an event in a single round trip, via the
 * `get_event_management_data` SECURITY DEFINER function (see
 * docs/db/functions.md). Returns null if the event does not exist OR the
 * caller isn't its organizer — the function checks `organizer_id =
 * auth.uid()` internally and returns null itself in either case, so this
 * one RPC call replaces what used to be an `events` select (to resolve
 * organizer/venue/date) followed by three further calls
 * (`event_going_count`, `get_event_share_count`, `get_event_guestlist`).
 *
 * Consolidating them isn't just fewer requests for its own sake: the old
 * shape needed the `events` select to resolve first before the other
 * three could even be issued (their inputs didn't depend on it, but the
 * null/not-organizer check gating the whole page did), so it was two
 * sequential round trips no matter how parallel the second batch was.
 * This function does the same underlying work (guestlist join, three
 * counts) in one query — each count/subquery still runs once, not once
 * per guestlist row, so cost doesn't increase with attendee count.
 * `views_count` is unique viewers (authenticated user_id + anonymous
 * session id), not raw page loads, so a refresh does not raise the
 * number organizers see.
 */
export async function getEventManagementData(
  eventId: string,
  userId: string
): Promise<EventManagementData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_event_management_data", { p_event_id: eventId })
    .maybeSingle<EventManagementDataRow>();

  if (error) {
    throw new Error(`getEventManagementData failed: ${error.message}`);
  }

  // The function already scopes to organizer_id = auth.uid() internally,
  // so this should always hold — but userId is checked explicitly here too
  // as defense in depth against a stale/mismatched session being passed in.
  if (!data || data.organizer_id !== userId) {
    return null;
  }

  const startsAt = new Date(data.starts_at);
  const dateLabel = getEventManagementDateLabel(startsAt);

  const attendees = data.attendees.map((row) => {
    const socials: Array<"instagram" | "facebook" | "tiktok"> = [];
    if (row.instagram_url) socials.push("instagram");
    if (row.facebook_url) socials.push("facebook");
    if (row.tiktok_url) socials.push("tiktok");

    return {
      id: row.user_id,
      handle: row.username ? `@${row.username}` : "@user",
      avatarUrl: row.avatar_url ?? undefined,
      socials,
    };
  });

  return {
    eventId: data.event_id,
    locationName: data.area_name ?? "Maseru",
    locationSub: data.venue_name || "Maseru central",
    dateLabel,
    attendingCount: data.attending_count,
    sharesCount: data.shares_count,
    viewsCount: data.views_count,
    attendees,
  };
}


