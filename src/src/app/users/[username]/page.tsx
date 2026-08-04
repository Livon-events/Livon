import { redirect, notFound } from "next/navigation";
import { resolveUsernameToUserId } from "@/modules/users/queries";

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
 * Open to anonymous visitors, same as `/profile/[userId]` itself: the
 * lookup goes through `resolveUsernameToUserId` -> `resolve_username_to_user_id`,
 * a `SECURITY DEFINER` function granted to `anon` + `authenticated`
 * (see docs/db/rls-policies.md, docs/db/functions.md) — this used to be a
 * direct `users` table select, which came back empty for a logged-out
 * visitor since `users` has no `anon` SELECT policy, forcing a login
 * redirect before the visitor ever reached the (already anon-friendly)
 * profile page. That's what this route no longer does.
 */
export default async function UsernameResolverPage({ params }: UsernameResolverPageProps) {
  const { username } = await params;

  const userId = await resolveUsernameToUserId(username);

  if (!userId) {
    notFound();
  }

  redirect(`/profile/${userId}`);
}
