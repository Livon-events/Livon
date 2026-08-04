import { redirect } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { getOwnProfileBasics } from "@/modules/users/queries";
import { getEventsOrganizedBy, getEventsUserIsGoingTo } from "@/modules/events/queries";
import { getConnectionRequests, getConnections } from "@/modules/connections/queries";
import { UserProfilePage } from "@/modules/users";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const [profile, createdEvents, goingEvents, connectionRequests, connections] = await Promise.all([
    getOwnProfileBasics(user.id),
    getEventsOrganizedBy(user.id),
    getEventsUserIsGoingTo(user.id),
    getConnectionRequests(user.id),
    getConnections(user.id),
  ]);

  return (
    <UserProfilePage
      username={profile?.username ?? user.email ?? "User"}
      bio={profile?.bio ?? null}
      avatarUrl={profile?.avatarUrl ?? undefined}
      createdEvents={createdEvents}
      goingEvents={goingEvents}
      connectionRequests={connectionRequests}
      connections={connections}
    />
  );
}
