import { createClient } from "@/shared/supabase/client";
import { getOrCreateAnonSessionId } from "@/shared/anonSession";

const pendingEventViews = new Set<string>();

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
 * Records one event-details page view via rate-limited RPC (30 / 5 min per
 * viewer). Dedupes refreshes via sessionStorage (same tab). Organizer
 * self-views are rejected server-side. Signed-out visitors use a
 * localStorage anon session id. Failures are swallowed — view logging must
 * never block or surface errors on the details page.
 */
export async function recordEventView(eventId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (hasLoggedViewThisSession(eventId) || pendingEventViews.has(eventId)) return;

  pendingEventViews.add(eventId);

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Signed-out is expected; getUser() surfaces AuthSessionMissingError.
    if (authError && authError.name !== "AuthSessionMissingError") {
      console.error("recordEventView failed", authError);
      return;
    }

    let anonSessionId: string | null = null;
    if (!user) {
      anonSessionId = getOrCreateAnonSessionId();
      if (!anonSessionId) return;
    }

    const { error } = await supabase.rpc("record_event_view", {
      p_event_id: eventId,
      p_anon_session_id: anonSessionId,
    });
    if (error) {
      console.error("recordEventView failed", error);
      return;
    }

    markViewLoggedThisSession(eventId);
  } catch (error) {
    console.error("recordEventView failed", error);
  } finally {
    pendingEventViews.delete(eventId);
  }
}
