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

  // `users` RLS has no `anon` SELECT policy at all (docs/db/rls-policies.md)
  // — every query below would just come back empty for a logged-out
  // visitor, so redirect straight to login rather than rendering a broken
  // page.
  if (!viewer) {
    redirect(`/login?next=/profile/${userId}`);
  }

  // Viewing your own id here — send back to the real own-profile page
  // (edit surface, Created/Going tabs) instead of the read-only view.
  if (viewer.id === userId) {
    redirect("/profile");
  }

  const profile = await getPublicProfile(userId);
  if (!profile) {
    notFound();
  }

  const [connectionsCount, connectionState, featuredEvents] = await Promise.all([
    getPublicConnectionsCount(userId),
    getConnectionState(viewer.id, userId),
    getPublicUpcomingHostedEvents(userId),
  ]);

  return (
    <PublicProfilePage
      profile={profile}
      connectionsCount={connectionsCount}
      connectionState={connectionState}
      featuredEvents={featuredEvents}
    />
  );
}
