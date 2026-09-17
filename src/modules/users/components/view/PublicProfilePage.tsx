import ProfileHeader from "@/modules/users/components/ProfileHeader";
import BioSection from "@/modules/users/components/BioSection";
import ConnectButton from "./ConnectButton";
import PublicSocialIcons from "./PublicSocialIcons";
import FeaturedEventCard from "./FeaturedEventCard";
import type { ConnectionState } from "@/modules/connections";
import type { FeaturedEvent } from "@/modules/events";
import type { PublicProfile } from "@/modules/users/queries";

interface PublicProfilePageProps {
  profile: PublicProfile;
  connectionState: ConnectionState;
  featuredEvents: FeaturedEvent[];
  // Anon visitors can view this page as of docs/FR/search.md, but can't
  // send connection requests (connections RLS is unchanged) — passed
  // down so ConnectButton can show a sign-in prompt instead of a Connect
  // button that would just fail silently.
  isViewerSignedIn: boolean;
}

// Discovery-oriented view of another user, per
// raw_html_and_css/profile_view/view_profile — header, bio, labeled social
// links, full-width Connect button, then active upcoming events involving the
// profile as organizer or Talent. Deliberately smaller in scope than the
// own-profile page (no Connections/Events tabs here).
export default function PublicProfilePage({
  profile,
  connectionState,
  featuredEvents,
  isViewerSignedIn,
}: PublicProfilePageProps) {
  return (
    <div className="flex min-h-screen justify-center bg-[#0C0C0C] px-5 pb-16 pt-6 font-body">
      {/* Same width as own profile (UserProfilePage): 440px mobile, 806px md+ */}
      <div className="flex w-full max-w-[440px] flex-col md:max-w-[806px]">
        <ProfileHeader
          username={profile.username}
          avatarUrl={profile.avatarUrl ?? undefined}
          variant="public"
        />

        <BioSection bio={profile.bio} />

        <hr className="mb-2 h-0.5 w-full border-none bg-[#FFF335]" />

        <section className="flex w-full min-w-0 flex-col gap-3" aria-label="Social links and connect">
          <PublicSocialIcons
            profileUserId={profile.userId}
            facebookUrl={profile.facebookUrl}
            instagramUrl={profile.instagramUrl}
            tiktokUrl={profile.tiktokUrl}
            youtubeUrl={profile.youtubeUrl}
          />
          <ConnectButton
            profileUserId={profile.userId}
            profileUsername={profile.username}
            initialState={connectionState}
            isViewerSignedIn={isViewerSignedIn}
          />
        </section>

        {featuredEvents.length > 0 && (
          <section className="mt-16 flex w-full flex-col" aria-labelledby="public-profile-upcoming-events">
            <div className="flex items-center justify-between pb-2">
              <h2
                id="public-profile-upcoming-events"
                className="text-[15px] font-bold capitalize text-[#AEAEB2]"
              >
                Upcoming events
              </h2>
              <span className="flex h-6 min-w-[40px] items-center justify-center rounded bg-[#1F2023] px-2.5 text-sm font-bold text-white">
                {featuredEvents.length}
              </span>
            </div>
            <div className="mb-2 h-px w-full bg-[#262626]" />
            <div className="flex flex-col gap-3">
              {featuredEvents.map((event) => (
                <FeaturedEventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
