"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProfileHeader from "./ProfileHeader";
import BioSection from "./BioSection";
import LinksSection from "./LinksSection";
import ProfileTabs from "./ProfileTabs";
import ConnectionsPanel from "./ConnectionsPanel";
import EventsPanel from "./EventsPanel";
import EditProfileModal from "./EditProfileModal";
import { SignOutButton } from "../auth/SignOutButton";
// Connections + social links are still mock-only — a different, separate
// gap from the events lists below (see docs/db/rls-policies.md for the
// connections queries this would need; not wired up yet).
import { mockSocialLinks, mockConnectionRequests, mockConnections } from "@/lib/mock/profile";
import { markNotGoing } from "@/lib/mutations/event-interests";
import type { EventSummary, ProfileMainTab } from "./types";

interface UserProfilePageProps {
  username: string;
  bio?: string | null;
  avatarUrl?: string;
  createdEvents: EventSummary[];
  goingEvents: EventSummary[];
}

export default function UserProfilePage({
  username: initialUsername,
  bio: initialBio,
  avatarUrl: initialAvatarUrl,
  createdEvents,
  goingEvents: initialGoingEvents,
}: UserProfilePageProps) {
  const router = useRouter();
  const [mainTab, setMainTab] = useState<ProfileMainTab>("connections");
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Own-profile edit surface (docs/FR/user-profile-fr.md §4) covers bio +
  // username + avatar. Kept as local state so a save reflects instantly
  // without waiting on the server-component re-fetch that router.refresh()
  // triggers alongside it.
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio ?? null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  // Local copy so the "leave" (X) button can remove an event from view
  // immediately after un-marking interest, without waiting on a full
  // server-component re-fetch.
  const [goingEvents, setGoingEvents] = useState(initialGoingEvents);

  async function handleLeaveEvent(eventId: string) {
    const previous = goingEvents;
    // Optimistic removal — same pattern as useGoingAction (the same
    // underlying action, "Not going", just triggered from the profile
    // list's X button instead of the event's own Going button).
    setGoingEvents((events) => events.filter((event) => event.id !== eventId));

    const result = await markNotGoing(eventId);
    if (!result.ok) {
      setGoingEvents(previous);
    }
  }

  function handleManageEvent(eventId: string) {
    // The wrench action opens the same create-event form in edit mode
    // (src/app/events/[id]/edit) rather than a separate management
    // screen — includes both editing the event's details and cancelling
    // it (see the Cancel Event button on that page).
    router.push(`/events/${eventId}/edit`);
  }

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
            eventsCount={goingEvents.length + createdEvents.length}
          />

          {mainTab === "connections" ? (
            <ConnectionsPanel requests={mockConnectionRequests} connections={mockConnections} />
          ) : (
            <EventsPanel
              going={goingEvents}
              created={createdEvents}
              onLeaveEvent={handleLeaveEvent}
              onManageEvent={handleManageEvent}
            />
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