import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getConnectionStateBetween } from "@/modules/connections/queries";
import { getUpcomingActiveEventsForProfile } from "@/modules/events/queries";
import { PublicProfilePage } from "@/modules/users";
import { getPublicProfile, resolveUsernameToUserId } from "@/modules/users/queries";
import { createClient } from "@/shared/supabase/server";

type ProfileByUsernamePageProps = {
  params: Promise<{ username: string }>;
};

/**
 * Canonical public profile route. Database relationships remain keyed by
 * stable user_id values; the username is resolved only at this URL boundary.
 */
export default async function ProfileByUsernamePage({ params }: ProfileByUsernamePageProps) {
  const { username } = await params;
  const requestedUsername = username.toLowerCase();
  const userId = await resolveUsernameToUserId(requestedUsername);

  if (!userId) {
    notFound();
  }

  const supabase = await createClient();
  const [
    profile,
    {
      data: { user: viewer },
    },
  ] = await Promise.all([getPublicProfile(userId), supabase.auth.getUser()]);

  if (!profile) {
    notFound();
  }

  if (username !== profile.username) {
    permanentRedirect(`/users/${encodeURIComponent(profile.username)}`);
  }

  if (viewer?.id === userId) {
    redirect("/profile");
  }

  const [connectionState, featuredEvents] = await Promise.all([
    viewer
      ? getConnectionStateBetween(viewer.id, userId)
      : Promise.resolve({ status: "none" as const }),
    getUpcomingActiveEventsForProfile(userId),
  ]);

  return (
    <PublicProfilePage
      profile={profile}
      connectionState={connectionState}
      featuredEvents={featuredEvents}
      isViewerSignedIn={!!viewer}
    />
  );
}
