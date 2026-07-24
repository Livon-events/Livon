import ProfileHeader from "@/components/profile/ProfileHeader";
import BioSection from "@/components/profile/BioSection";
import ConnectButton from "./ConnectButton";
import PublicLinksButton from "./PublicLinksButton";
import FeaturedEventCard from "./FeaturedEventCard";
import type { ConnectionState, FeaturedEvent, PublicProfile } from "@/lib/queries/public-profile";

interface PublicProfilePageProps {
  profile: PublicProfile;
  connectionsCount: number;
  connectionState: ConnectionState;
  featuredEvents: FeaturedEvent[];
}

// Discovery-oriented view of another user, per
// raw_html_and_css/profile_view/view_profile — header, bio, Connect/Links
// row, then a strip of their active upcoming hosted events. Deliberately
// smaller in scope than the own-profile page (no Connections/Events tabs
// here — see the query file's header comment for why).
export default function PublicProfilePage({
  profile,
  connectionsCount,
  connectionState,
  featuredEvents,
}: PublicProfilePageProps) {
  return (
    <div className="flex justify-center min-h-screen bg-black px-5 pt-4 pb-16 font-body">
      <div className="w-full max-w-[440px] md:max-w-[806px] flex flex-col">
        <ProfileHeader
          username={profile.username}
          connectionsCount={connectionsCount}
          avatarUrl={profile.avatarUrl ?? undefined}
        />

        <BioSection bio={profile.bio} />

        <hr className="border-none h-0.5 bg-[#FFE600] w-full mb-6" />

        <div className="flex gap-4 mb-7">
          <ConnectButton profileUserId={profile.userId} initialState={connectionState} />
          <PublicLinksButton
            tiktokUrl={profile.tiktokUrl}
            instagramUrl={profile.instagramUrl}
            facebookUrl={profile.facebookUrl}
          />
        </div>

        {featuredEvents.length > 0 && (
          <div className="flex flex-col gap-3">
            {featuredEvents.map((event) => (
              <FeaturedEventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
