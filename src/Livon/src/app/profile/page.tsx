import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileCreatedEvents, getProfileGoingEvents } from "@/lib/queries/profile-events";
import { getConnectionRequests, getConnections } from "@/lib/queries/connections";
import UserProfilePage from "@/components/profile/UserProfilePage";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("username, bio, avatar_url")
    .eq("user_id", user.id)
    .single();

  const [createdEvents, goingEvents, connectionRequests, connections] = await Promise.all([
    getProfileCreatedEvents(user.id),
    getProfileGoingEvents(user.id),
    getConnectionRequests(user.id),
    getConnections(user.id),
  ]);

  return (
    <UserProfilePage
      username={profile?.username ?? user.email ?? "User"}
      bio={profile?.bio ?? null}
      avatarUrl={profile?.avatar_url ?? undefined}
      createdEvents={createdEvents}
      goingEvents={goingEvents}
      connectionRequests={connectionRequests}
      connections={connections}
    />
  );
}