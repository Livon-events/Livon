import { notFound, redirect } from "next/navigation";
import { getPublicProfile } from "@/modules/users/queries";

type ProfileByIdPageProps = {
  params: Promise<{ userId: string }>;
};

/**
 * Legacy compatibility route. IDs remain the stable database key, but public
 * profile URLs use the current username.
 */
export default async function ProfileByIdPage({ params }: ProfileByIdPageProps) {
  const { userId } = await params;
  const profile = await getPublicProfile(userId);

  if (!profile) {
    notFound();
  }

  redirect(`/users/${encodeURIComponent(profile.username)}`);
}
