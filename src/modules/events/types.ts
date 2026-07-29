import type { GoingVisibility } from "@/modules/rsvp";

/**
 * Types owned by the events module. `EventSummary` and `FeaturedEvent`
 * moved here during the restructuring pass from `components/profile/types.ts`
 * and `lib/queries/public-profile.ts` respectively — both describe events
 * data, so `events` is what should define and export them, regardless of
 * which page (profile, public profile) originally consumed them.
 */

export interface EventSummary {
  id: string;
  title: string;
  dateLabel: string;
  location?: string;
  imageUrl?: string;
  attendeeCount?: number;
}

export type FeaturedEvent = {
  id: string;
  title: string;
  countdownLabel: string; // "Today" / "1 Day" / "N Days" / "N Months" — same chip logic as the feed card
  areaName: string;
  coverImageUrl: string | null;
};

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

export type PeekAttendee = {
  userId: string;
  username: string;
  avatarUrl: string | null;
};

/**
 * Data for the Peek page (docs/FR/peek.md) — reached by tapping a Peek
 * button (on the feed card or the event details "About" section). Unlike
 * `EventDetails.peekConnectionsCount` (which folds `host_bonus` in for the
 * button badge), `attendingConnections` never includes the host — see the
 * FR's "host bonus does not apply here" rule.
 */
export type PeekPageData = {
  eventId: string;
  // Total "going" count for the event, unfiltered by visibility — render
  // as "{count}+", or "Be the first to go" when it's exactly 0.
  goingCount: number;
  // Empty when the viewer has no connections attending (or is signed
  // out) — the page should omit the whole "Connections attending"
  // section in that case, not render it empty.
  attendingConnections: PeekAttendee[];
};

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
  categoryName: string;
  status: string;
  peekConnectionsCount: number; // attending_connections_count + host_bonus, per docs/FR/peek.md
  isGoing: boolean;
  // The viewer's own privacy choice on this event, per
  // docs/FR/going-rsvp-privacy.md — null whenever isGoing is false.
  myVisibility: GoingVisibility | null;
};
