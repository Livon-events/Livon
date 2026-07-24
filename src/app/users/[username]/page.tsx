import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type UsernameResolverPageProps = {
  params: Promise<{ username: string }>;
};

/**
 * Thin resolver: `/u/[username]` -> `/profile/[userId]`.
 *
 * Every place a host/organizer's name shows up in the app (event cards,
 * event details) only has their `username` on hand, not their `user_id` —
 * `get_home_feed` returns `host_username`, not an id (see
 * docs/db/functions.md). The canonical profile route is still keyed by
 * `user_id` (per docs/FR/user-profile-fr.md: username is cosmetic/display,
 * never load-bearing), so this route exists purely to bridge the two
 * without having to thread organizer_id through the home-feed function
 * and every card type — a smaller, safer change than altering
 * `get_home_feed`'s return columns.
 *
 * Requires sign-in for the same reason `/profile/[userId]` does: `users`
 * RLS has no `anon` SELECT policy, so the lookup itself would come back
 * empty for a logged-out visitor. Redirects to login with `next` pointing
 * back at this same resolver, so the redirect chain completes once
 * they're signed in.
 */
export default async function UsernameResolverPage({ params }: UsernameResolverPageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  if (!viewer) {
    redirect(`/login?next=/users/${encodeURIComponent(username)}`);
  }

  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  redirect(`/profile/${data.user_id}`);
}
