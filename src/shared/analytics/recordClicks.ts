import { createClient } from "@/shared/supabase/client";
import { getOrCreateAnonSessionId } from "@/shared/anonSession";

export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube";

export type RailTab = "recent" | "weekend";

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
 * Logs a public-profile social chip click. Server-side rate limit: 30 / 5 min
 * per viewer. Failures are swallowed — tracking must never block opening the
 * external link.
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
    const { error } = await supabase.rpc("record_profile_social_click", {
      p_profile_user_id: profileUserId,
      p_platform: platform,
      p_anon_session_id: viewer.kind === "anon" ? viewer.anonSessionId : null,
    });
    if (error) {
      console.error("recordProfileSocialClick failed", error);
    }
  } catch (error) {
    console.error("recordProfileSocialClick failed", error);
  }
}

/**
 * Logs a home rail tab switch. Server-side rate limit: 30 / 5 min per
 * viewer. Failures are swallowed — tracking must never block switching tabs.
 */
export async function recordRailTabClick({ tab }: { tab: RailTab }): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const viewer = await resolveViewer();
    if (!viewer) return;

    const supabase = createClient();
    const { error } = await supabase.rpc("record_rail_tab_click", {
      p_tab: tab,
      p_anon_session_id: viewer.kind === "anon" ? viewer.anonSessionId : null,
    });
    if (error) {
      console.error("recordRailTabClick failed", error);
    }
  } catch (error) {
    console.error("recordRailTabClick failed", error);
  }
}
