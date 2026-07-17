import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UserProfilePage from "@/components/profile/UserProfilePage";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("username, avatar_url")
    .eq("user_id", user.id)
    .single();
  
  return (
    <UserProfilePage
      username={profile?.username ?? user.email ?? "User"}
      avatarUrl={profile?.avatar_url ?? undefined}
    />
  );
}