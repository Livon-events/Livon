export type { PublicProfile, OrganizerLocationContext, OwnProfileBasics } from "./queries";

// getPublicProfile / getOrganizerLocationContext / getOwnProfileBasics are
// never barrel-exported — queries.ts is server-only (uses next/headers).
// Import directly:
//   import { getPublicProfile } from "@/modules/users/queries";
export { AVATAR_MAX_BYTES } from "./validation";
export { updateProfile, updateLocationPreference, updateSocialLink } from "./mutations";
export type { UpdateProfileInput, UpdateProfileData } from "./mutations";
export type { SocialLink, ConnectionsSubTab, EventsSubTab, ProfileMainTab } from "./types";

export { default as BioSection } from "./components/BioSection";
export { default as ConnectionRow } from "./components/ConnectionRow";
export { default as ConnectionsPanel } from "./components/ConnectionsPanel";
export { default as EditProfileModal } from "./components/EditProfileModal";
export { default as EventRow } from "./components/EventRow";
export { default as EventsPanel } from "./components/EventsPanel";
export { default as LinksSection } from "./components/LinksSection";
export { default as ProfileHeader } from "./components/ProfileHeader";
export { default as ProfileTabs } from "./components/ProfileTabs";
export { default as SegmentedTabs } from "./components/SegmentedTabs";
export { default as UserProfilePage } from "./components/UserProfilePage";
export { default as ConnectButton } from "./components/view/ConnectButton";
export { default as FeaturedEventCard } from "./components/view/FeaturedEventCard";
export { default as PublicLinksButton } from "./components/view/PublicLinksButton";
export { default as PublicProfilePage } from "./components/view/PublicProfilePage";

// Server-only — not re-exported here deliberately. `applyProfileUpdate`
// pulls in `sharp` via modules/users/images.ts; importing it through this
// barrel would risk it getting pulled into a Client Component's bundle.
// Route handlers import it directly:
//   import { applyProfileUpdate } from "@/modules/users/serverMutations";
