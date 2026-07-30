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
import { SignOutButton } from "@/modules/auth";
import { updateSocialLink } from "@/modules/users/mutations";
import { markNotGoing } from "@/modules/rsvp";
import { acceptConnectionRequest, removeConnection } from "@/modules/connections";
import type { ConnectionUser, EventSummary, ProfileMainTab, SocialLink } from "./types";

interface UserProfilePageProps {
  username: string;
  bio?: string | null;
  avatarUrl?: string;
  tiktokUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  createdEvents: EventSummary[];
  goingEvents: EventSummary[];
  connectionRequests: ConnectionUser[];
  connections: ConnectionUser[];
}

export default function UserProfilePage({
  username: initialUsername,
  bio: initialBio,
  avatarUrl: initialAvatarUrl,
  tiktokUrl,
  instagramUrl,
  facebookUrl,
  createdEvents,
  goingEvents: initialGoingEvents,
  connectionRequests: initialConnectionRequests,
  connections: initialConnections,
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

  // Links section (docs/FR/user-profile-fr.md §3) — three fixed platform
  // slots, each with its own independent submit button (LinksSection
  // handles per-row draft/validation state itself; this just holds the
  // last-confirmed value per slot so a failed save can roll back).
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([
    { id: "tiktok", platform: "tiktok", placeholder: "tiktok.com/@username", value: tiktokUrl ?? "" },
    { id: "instagram", platform: "instagram", placeholder: "instagram.com/username", value: instagramUrl ?? "" },
    { id: "facebook", platform: "facebook", placeholder: "facebook.com/username", value: facebookUrl ?? "" },
  ]);

  // Local copy so the "leave" (X) button can remove an event from view
  // immediately after un-marking interest, without waiting on a full
  // server-component re-fetch.
  const [goingEvents, setGoingEvents] = useState(initialGoingEvents);

  // Local copies of the Connections tab so accept/decline/remove can
  // update the list immediately (optimistic), rolling back only if the
  // mutation itself fails.
  const [connectionRequests, setConnectionRequests] = useState(initialConnectionRequests);
  const [connections, setConnections] = useState(initialConnections);

  async function handleAcceptRequest(connectionId: string) {
    const request = connectionRequests.find((item) => item.id === connectionId);
    if (!request) return;

    const previousRequests = connectionRequests;
    const previousConnections = connections;
    setConnectionRequests((requests) => requests.filter((item) => item.id !== connectionId));
    setConnections((current) => [request, ...current]);

    const result = await acceptConnectionRequest(connectionId);
    if (!result.ok) {
      setConnectionRequests(previousRequests);
      setConnections(previousConnections);
    }
  }

  async function handleDeclineRequest(connectionId: string) {
    const previous = connectionRequests;
    setConnectionRequests((requests) => requests.filter((item) => item.id !== connectionId));

    const result = await removeConnection(connectionId);
    if (!result.ok) {
      setConnectionRequests(previous);
    }
  }

  async function handleRemoveConnection(connectionId: string) {
    const previous = connections;
    setConnections((current) => current.filter((item) => item.id !== connectionId));

    const result = await removeConnection(connectionId);
    if (!result.ok) {
      setConnections(previous);
    }
  }

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

  async function handleLinkSubmit(id: string, value: string) {
    // LinksSection has already run validateSocialLink and blocked the
    // call entirely if that failed — by the time this fires the value is
    // known-good client-side. This only has to handle the save itself.
    const previous = socialLinks;
    setSocialLinks((links) => links.map((link) => (link.id === id ? { ...link, value } : link)));

    const platform = previous.find((link) => link.id === id)?.platform;
    if (!platform) return;

    const result = await updateSocialLink(platform, value);
    if (!result.ok) {
      // Silent rollback, same as handleAcceptRequest/handleDeclineRequest
      // above — LinksSection re-syncs its draft from this prop on the
      // next render, so the row snaps back to the pre-save value.
      setSocialLinks(previous);
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
          connectionsCount={connections.length}
          avatarUrl={avatarUrl}
        />

        <BioSection bio={bio} />

        {/* Yellow divider line */}
        <hr className="border-none h-0.5 bg-[#FFE600] w-full mb-3" />

        <LinksSection links={socialLinks} onEdit={() => setIsEditOpen(true)} onLinkSubmit={handleLinkSubmit} />

        <div className="relative z-[1]">
          <ProfileTabs
            active={mainTab}
            onChange={setMainTab}
            connectionsCount={connections.length + connectionRequests.length}
            eventsCount={goingEvents.length + createdEvents.length}
          />

          {mainTab === "connections" ? (
            <ConnectionsPanel
              requests={connectionRequests}
              connections={connections}
              onAcceptRequest={handleAcceptRequest}
              onDeclineRequest={handleDeclineRequest}
              onRemoveConnection={handleRemoveConnection}
            />
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