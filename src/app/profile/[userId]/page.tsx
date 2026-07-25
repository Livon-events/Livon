import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPublicProfile,
  getPublicConnectionsCount,
  getConnectionState,
  getPublicUpcomingHostedEvents,
} from "@/lib/queries/public-profile";
import PublicProfilePage from "@/components/profile/view/PublicProfilePage";

type ProfileByIdPageProps = {
  params: Promise<{ userId: string }>;
};

// Keyed by user_id (stable), not username — per docs/FR/user-profile-fr.md's
// note that username is cosmetic/display-only and internal references
// should never break on a rename.
export default async function ProfileByIdPage({ params }: ProfileByIdPageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  // Viewing your own id here while signed in — send back to the real
  // own-profile page (edit surface, Created/Going tabs) instead of the
  // read-only view.
  if (viewer && viewer.id === userId) {
    redirect("/profile");
  }

  // As of docs/FR/search.md, this page no longer redirects anonymous
  // visitors to /login. `getPublicProfile` now goes through a
  // SECURITY DEFINER function (`get_public_profile`) that's a deliberate,
  // narrow exception to `users`' anon-closed RLS — see
  // docs/db/rls-policies.md and the updated header comment in
  // lib/queries/public-profile.ts.
  const profile = await getPublicProfile(userId);
  if (!profile) {
    notFound();
  }

  const [connectionsCount, connectionState, featuredEvents] = await Promise.all([
    getPublicConnectionsCount(userId),
    // getConnectionState needs a real viewer id — for an anonymous
    // visitor there's no relationship to resolve, so it's skipped
    // entirely rather than called with a placeholder id.
    viewer ? getConnectionState(viewer.id, userId) : Promise.resolve({ status: "none" as const }),
    getPublicUpcomingHostedEvents(userId),
  ]);

  return (
    <PublicProfilePage
      profile={profile}
      connectionsCount={connectionsCount}
      connectionState={connectionState}
      featuredEvents={featuredEvents}
      isViewerSignedIn={!!viewer}
    />
  );
}
