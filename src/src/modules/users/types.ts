// Domain types owned by the users module.
// `ConnectionUser` moved to modules/connections/types.ts and `EventSummary`
// moved to modules/events/types.ts during the restructuring — both
// described data owned by those modules' tables, not `users`. Profile UI
// components that display that data (ConnectionsPanel, EventsPanel, etc.)
// import those types from their owning modules directly.

export interface SocialLink {
  id: string;
  platform: "tiktok" | "instagram" | "facebook";
  placeholder: string;
  value: string;
}

export type ConnectionsSubTab = "requests" | "connections";
export type EventsSubTab = "going" | "created";
export type ProfileMainTab = "connections" | "events";
