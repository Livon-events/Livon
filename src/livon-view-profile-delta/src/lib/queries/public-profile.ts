import { createClient } from "@/lib/supabase/server";
import { getCountdownLabel } from "@/lib/format/eventCard";

/**
 * Data + queries backing the "view someone else's profile" route
 * (`/profile/[userId]`), styled off raw_html_and_css/profile_view/view_profile.
 *
 * Distinct from `lib/queries/profile-events.ts`, which backs the
 * *signed-in user's own* profile page (Created/Going tabs, full mock
 * connections panel). This file is deliberately smaller in scope — header,
 * bio, links, Connect button state, and a featured-hosted-events strip —
 * matching what the reference mockup actually shows, not the fuller
 * Connections/Events-tabs spec in docs/FR/user-profile-fr.md.
 *
 * Every query here assumes an authenticated caller. RLS on `users` has no
 * `anon` SELECT policy at all (see docs/db/rls-policies.md), so an
 * anonymous visitor can't read *any* profile — the page route redirects to
 * /login before any of these run.
 */

export type PublicProfile = {
  userId: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  tiktokUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
};

type PublicProfileRow = {
  user_id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  tiktok_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
};

/** Basic profile fields for the header/bio/links sections. Null if no such user. */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("user_id, username, bio, avatar_url, tiktok_url, instagram_url, facebook_url")
    .eq("user_id", userId)
    .maybeSingle<PublicProfileRow>();

  if (error || !data) {
    return null;
  }

  return {
    userId: data.user_id,
    username: data.username ?? "User",
    bio: data.bio,
    avatarUrl: data.avatar_url,
    tiktokUrl: data.tiktok_url,
    instagramUrl: data.instagram_url,
    facebookUrl: data.facebook_url,
  };
}

/**
 * Total accepted-connections count for the profile owner, shown under the
 * username. `connections` RLS only lets a client see rows involving their
 * *own* uid, so a stranger's total can't be counted from a plain client
 * select — this goes through `get_public_connections_count`, a
 * SECURITY DEFINER function that returns nothing but the integer (no raw
 * rows), the same "count-only" exception already used for
 * `event_going_count`. See docs/db/functions.md.
 */
export async function getPublicConnectionsCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_connections_count", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`getPublicConnectionsCount failed: ${error.message}`);
  }

  return data ?? 0;
}

export type ConnectionState =
  | { status: "none" }
  | { status: "outgoing"; connectionId: string } // viewer requested profile owner, still pending
  | { status: "incoming"; connectionId: string } // profile owner requested viewer, still pending
  | { status: "connected"; connectionId: string }; // accepted, either direction

type ConnectionRow = {
  connection_id: string;
  requester_id: string;
  status: string;
};

/**
 * Resolves the Connect-button state between two users, per
 * docs/FR/connections.md's four states. Both possible row shapes (viewer
 * as requester, viewer as receiver) are covered by the same
 * "Users can view own connections" RLS policy — a row is visible as long
 * as *one* side is the caller, which is always true here.
 */
export async function getConnectionState(
  viewerId: string,
  profileUserId: string
): Promise<ConnectionState> {
  if (viewerId === profileUserId) {
    return { status: "none" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connections")
    .select("connection_id, requester_id, status")
    .or(
      `and(requester_id.eq.${viewerId},receiver_id.eq.${profileUserId}),` +
        `and(requester_id.eq.${profileUserId},receiver_id.eq.${viewerId})`
    )
    .maybeSingle<ConnectionRow>();

  if (error || !data) {
    return { status: "none" };
  }

  if (data.status === "accepted") {
    return { status: "connected", connectionId: data.connection_id };
  }

  // status === "pending"
  return data.requester_id === viewerId
    ? { status: "outgoing", connectionId: data.connection_id }
    : { status: "incoming", connectionId: data.connection_id };
}

export type FeaturedEvent = {
  id: string;
  title: string;
  countdownLabel: string; // "Today" / "1 Day" / "N Days" / "N Months" — same chip logic as the feed card
  areaName: string;
  coverImageUrl: string | null;
};

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
 * not-yet-ended events, soonest first. Reuses the same
 * ends_at ?? starts_at+8h "still live" derivation as `get_home_feed`
 * (docs/db/functions.md) rather than a stored "past" flag, per the
 * archival-over-deletion principle. Empty array means the section should
 * be hidden entirely, not shown empty.
 */
export async function getPublicUpcomingHostedEvents(userId: string): Promise<FeaturedEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select("event_id, title, starts_at, ends_at, cover_image_url, areas ( name )")
    .eq("organizer_id", userId)
    .eq("status", "active")
    .order("starts_at", { ascending: true })
    .returns<FeaturedEventRow[]>();

  if (error) {
    throw new Error(`getPublicUpcomingHostedEvents failed: ${error.message}`);
  }

  const now = new Date();

  return (data ?? [])
    .filter((row) => {
      const startsAt = new Date(row.starts_at);
      const effectiveEnd = row.ends_at
        ? new Date(row.ends_at)
        : new Date(startsAt.getTime() + 8 * 60 * 60 * 1000);
      return now.getTime() < effectiveEnd.getTime();
    })
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
