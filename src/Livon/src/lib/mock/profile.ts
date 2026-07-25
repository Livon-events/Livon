import type { SocialLink } from "@/components/profile/types";

// Connection requests/connections are now backed by real data
// (lib/queries/connections.ts) — only social links remain mock-only here.
export const mockSocialLinks: SocialLink[] = [
  { id: "tiktok", platform: "tiktok", placeholder: "tiktok.com/@username", value: "" },
  { id: "instagram", platform: "instagram", placeholder: "instagram.com/username", value: "" },
  { id: "facebook", platform: "facebook", placeholder: "facebook.com/username", value: "" },
];

