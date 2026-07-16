"use client";

import { useState } from "react";
import type { ProfileMainTab } from "../types/profile";
import ProfileHeader from "./ProfileHeader";
import LinksSection from "./LinksSection";
import ProfileTabs from "./ProfileTabs";
import ConnectionsPanel from "./ConnectionsPanel";
import EventsPanel from "./EventsPanel";
import {
  mockSocialLinks,
  mockConnectionRequests,
  mockConnections,
  mockGoingEvents,
  mockCreatedEvents,
} from "../types/mockData";

// Wired to mock data for now — this component is scoped to the
// HTML-to-React conversion work stream. Replace the mock arrays with
// Supabase queries once the read-path work stream picks this screen up.

export default function UserProfilePage() {
  const [mainTab, setMainTab] = useState<ProfileMainTab>("connections");

  return (
    <div className="flex justify-center min-h-screen bg-black px-5 py-10 font-body">
      <div className="w-full max-w-[440px] flex flex-col relative">
        <ProfileHeader username="User2026" connectionsCount={mockConnections.length} />

        <hr className="border-none h-0.5 bg-[#FFE600] w-full mb-4" />

        <LinksSection links={mockSocialLinks} />

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
      </div>
    </div>
  );
}
