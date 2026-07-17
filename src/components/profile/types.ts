// Shared domain types for the user profile page.
// These are intentionally minimal/UI-shaped — swap for generated Supabase
// types when this screen is wired to real data in a later work stream.

export interface SocialLink {
  id: string;
  platform: "tiktok" | "instagram" | "facebook";
  placeholder: string;
  value: string;
}

export interface ConnectionUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface EventSummary {
  id: string;
  title: string;
  dateLabel: string;
  location?: string;
  imageUrl?: string;
  attendeeCount?: number;
}

export type ConnectionsSubTab = "requests" | "connections";
export type EventsSubTab = "going" | "created";
export type ProfileMainTab = "connections" | "events";
