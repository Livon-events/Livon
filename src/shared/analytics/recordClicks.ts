import { createClient } from "@/shared/supabase/client";
import { getOrCreateAnonSessionId } from "@/shared/anonSession";

export type DiscoverySection = "talent" | "makers";
export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube";

async function resolveViewer(): Promise<
  | { kind: "auth"; userId: string }
  | { kind: "anon"; anonSessionId: string }
  | null
> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Signed-out is expected; getUser() surfaces AuthSessionMissingError.
  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("resolveViewer failed", authError);
    return null;
  }

  if (user) {
    return { kind: "auth", userId: user.id };
  }

  const anonSessionId = getOrCreateAnonSessionId();
  if (!anonSessionId) return null;
  return { kind: "anon", anonSessionId };
}

/**
 * Logs a home discovery person-card click (Talent / Makers → profile).
 * Failures are swallowed — tracking must never block navigation.
 */
export async function recordDiscoveryPersonClick({
  targetUserId,
  section,
}: {
  targetUserId: string;
  section: DiscoverySection;
}): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const viewer = await resolveViewer();
    if (!viewer) return;
    if (viewer.kind === "auth" && viewer.userId === targetUserId) return;

    const supabase = createClient();
    const row =
      viewer.kind === "auth"
        ? {
            target_user_id: targetUserId,
            section,
            viewer_user_id: viewer.userId,
            anon_session_id: null,
          }
        : {
            target_user_id: targetUserId,
            section,
            viewer_user_id: null,
            anon_session_id: viewer.anonSessionId,
          };

    const { error } = await supabase.from("discovery_person_clicks").insert(row);
    if (error) {
      console.error("recordDiscoveryPersonClick failed", error);
    }
  } catch (error) {
    console.error("recordDiscoveryPersonClick failed", error);
  }
}

/**
 * Logs a public-profile social chip click. Failures are swallowed — tracking
 * must never block opening the external link.
 */
export async function recordProfileSocialClick({
  profileUserId,
  platform,
}: {
  profileUserId: string;
  platform: SocialPlatform;
}): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const viewer = await resolveViewer();
    if (!viewer) return;
    if (viewer.kind === "auth" && viewer.userId === profileUserId) return;

    const supabase = createClient();
    const row =
      viewer.kind === "auth"
        ? {
            profile_user_id: profileUserId,
            platform,
            viewer_user_id: viewer.userId,
            anon_session_id: null,
          }
        : {
            profile_user_id: profileUserId,
            platform,
            viewer_user_id: null,
            anon_session_id: viewer.anonSessionId,
          };

    const { error } = await supabase.from("profile_social_clicks").insert(row);
    if (error) {
      console.error("recordProfileSocialClick failed", error);
    }
  } catch (error) {
    console.error("recordProfileSocialClick failed", error);
  }
}
