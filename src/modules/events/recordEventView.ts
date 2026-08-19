import { createClient } from "@/shared/supabase/client";
import { getOrCreateAnonSessionId } from "@/shared/anonSession";

function viewLoggedKey(eventId: string): string {
  return `livon_event_view:${eventId}`;
}

function hasLoggedViewThisSession(eventId: string): boolean {
  try {
    return window.sessionStorage.getItem(viewLoggedKey(eventId)) === "1";
  } catch {
    return false;
  }
}

function markViewLoggedThisSession(eventId: string): void {
  try {
    window.sessionStorage.setItem(viewLoggedKey(eventId), "1");
  } catch {
    // Storage blocked — unique-viewer counts still collapse repeats by
    // user_id / anon_session_id; this only skips extra insert rows.
  }
}

/**
 * Records one event-details page view. Dedupes refreshes via sessionStorage
 * (same tab). Organizers opening their own listing are not counted.
 * Signed-out visitors use a localStorage anon session id so the same
 * browser stays one unique viewer. Failures are swallowed — view logging
 * must never block or surface errors on the details page.
 */
export async function recordEventView(eventId: string, organizerId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (hasLoggedViewThisSession(eventId)) return;

  markViewLoggedThisSession(eventId);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === organizerId) return;

  if (user) {
    const { error } = await supabase.from("event_views").insert({
      event_id: eventId,
      user_id: user.id,
    });
    if (error) {
      console.error("recordEventView failed", error);
    }
    return;
  }

  const anonSessionId = getOrCreateAnonSessionId();
  if (!anonSessionId) return;

  const { error } = await supabase.from("anonymous_event_views").insert({
    event_id: eventId,
    anon_session_id: anonSessionId,
  });
  if (error) {
    console.error("recordEventView failed", error);
  }
}
