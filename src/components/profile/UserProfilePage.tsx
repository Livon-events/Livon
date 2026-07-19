"use client";

import { useState } from "react";
import ProfileHeader from "./ProfileHeader";
import BioSection from "./BioSection";
import LinksSection from "./LinksSection";
import ProfileTabs from "./ProfileTabs";
import ConnectionsPanel from "./ConnectionsPanel";
import EventsPanel from "./EventsPanel";
import EditProfileModal from "./EditProfileModal";
import { SignOutButton } from "../auth/SignOutButton";
import {
  mockSocialLinks,
  mockConnectionRequests,
  mockConnections,
  mockGoingEvents,
  mockCreatedEvents,
} from "@/lib/mock/profile";
import type { ProfileMainTab } from "./types";

interface UserProfilePageProps {
  username: string;
  bio?: string | null;
  avatarUrl?: string;
}

export default function UserProfilePage({ username: initialUsername, bio: initialBio, avatarUrl: initialAvatarUrl }: UserProfilePageProps) {
  const [mainTab, setMainTab] = useState<ProfileMainTab>("connections");
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Own-profile edit surface (docs/FR/user-profile-fr.md §4) covers bio +
  // username + avatar. Kept as local state so a save reflects instantly
  // without waiting on the server-component re-fetch that router.refresh()
  // triggers alongside it.
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio ?? null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  return (
    <div className="flex justify-center min-h-screen bg-black px-5 pt-4 pb-16 font-body">
      {/* Matches the desktop search capsule's max width (798px) + 8px on md+ screens */}
      <div className="w-full max-w-[440px] md:max-w-[806px] flex flex-col relative">
        <ProfileHeader
          username={username}
          connectionsCount={mockConnections.length}
          avatarUrl={avatarUrl}
        />

        <BioSection bio={bio} />

        {/* Yellow divider line */}
        <hr className="border-none h-0.5 bg-[#FFE600] w-full mb-3" />

        <LinksSection links={mockSocialLinks} onEdit={() => setIsEditOpen(true)} />

        <div className="relative z-[1]">
          <ProfileTabs
            active={mainTab}
            onChange={setMainTab}
            connectionsCount={mockConnections.length + mockConnectionRequests.length}
            eventsCount={mockGoingEvents.length + mockCreatedEvents.length}
          />

          {mainTab === "connections" ? (
            <ConnectionsPanel requests={mockConnectionRequests} connections={mockConnections} />
          ) : (
            <EventsPanel going={mockGoingEvents} created={mockCreatedEvents} />
          )}
        </div>

        {/* Sign out button with spacing so it clears the fixed bottom nav */}
        <div className="mt-6 mb-4">
          <SignOutButton />
        </div>
      </div>

      {isEditOpen && (
        <EditProfileModal
          username={username}
          bio={bio}
          avatarUrl={avatarUrl}
          onClose={() => setIsEditOpen(false)}
          onSaved={(data) => {
            setUsername(data.username);
            setBio(data.bio);
            if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
          }}
        />
      )}
    </div>
  );
}