import type { ConnectionUser, EventSummary, SocialLink } from "@/components/profile/types";

// Placeholder data only — this file exists so the components below are
// runnable/testable in isolation. Replace with real Supabase queries when
// this screen moves into the read-path work stream.

export const mockSocialLinks: SocialLink[] = [
  { id: "tiktok", platform: "tiktok", placeholder: "tiktok.com/@username", value: "" },
  { id: "instagram", platform: "instagram", placeholder: "instagram.com/username", value: "" },
  { id: "facebook", platform: "facebook", placeholder: "facebook.com/username", value: "" },
];

export const mockConnectionRequests: ConnectionUser[] = [
  { id: "req-1", name: "kaya" },
  { id: "req-2", name: "thabo" },
];

export const mockConnections: ConnectionUser[] = [
  { id: "conn-1", name: "mave" },
  { id: "conn-2", name: "mave" },
];

export const mockGoingEvents: EventSummary[] = [
  { id: "ev-1", title: "Rooftop Sunset Social", dateLabel: "Fri, 18 Jul", location: "Maseru Central", attendeeCount: 84 },
  { id: "ev-2", title: "Campus Battle of Bands", dateLabel: "Sat, 26 Jul", location: "NUL Amphitheatre", attendeeCount: 212 },
];

export const mockCreatedEvents: EventSummary[] = [
  { id: "ev-3", title: "First-Year Mixer", dateLabel: "Wed, 22 Jul", location: "Student Union Hall", attendeeCount: 47 },
];

