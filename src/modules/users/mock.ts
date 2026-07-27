import type { SocialLink } from "@/modules/users/types";

// Connection requests/connections and profile events are all backed by
// real data now (modules/connections/queries.ts, modules/events/queries.ts)
// — only social links remain mock-only here.
export const mockSocialLinks: SocialLink[] = [
  { id: "tiktok", platform: "tiktok", placeholder: "tiktok.com/@username", value: "" },
  { id: "instagram", platform: "instagram", placeholder: "instagram.com/username", value: "" },
  { id: "facebook", platform: "facebook", placeholder: "facebook.com/username", value: "" },
];
