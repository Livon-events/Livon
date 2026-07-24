import type { ConnectionUser, SocialLink } from "@/components/profile/types";

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

