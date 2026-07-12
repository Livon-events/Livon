import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("username")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-[#0a0a0a] px-6 text-center text-[#f5f3ee]">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#ffea00]">
        Protected route
      </p>
      <h1 className="text-2xl font-bold">
        You&rsquo;re logged in as {profile?.username ?? user.email}
      </h1>
      <p className="text-sm text-[#9a988f]">{user.email}</p>
      <SignOutButton />
    </main>
  );
}
