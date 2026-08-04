import { createClient } from "@/shared/supabase/client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type GoingVisibility = "private" | "visible";

/**
 * First-time "Going" — inserts an EventInterests row with the chosen
 * privacy. Uses upsert (onConflict user_id,event_id, the table's own
 * unique constraint) rather than a plain insert so a double-tap or a
 * stale "not going" client state can't produce a duplicate-key error —
 * it just converges on the latest choice either way.
 *
 * RLS ("Users can mark own interest": with check `user_id = auth.uid()")
 * already scopes this to the caller's own row.
 */
export async function markGoing(eventId: string, visibility: GoingVisibility): Promise<Result> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("event_interests")
    .upsert(
      { event_id: eventId, user_id: user.id, visibility },
      { onConflict: "user_id,event_id" }
    );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/** Re-tap "Going" → "Change privacy": updates the existing row's visibility. */
export async function changeGoingPrivacy(
  eventId: string,
  visibility: GoingVisibility
): Promise<Result> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("event_interests")
    .update({ visibility })
    .eq("event_id", eventId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/** Re-tap "Going" → "Not going": removes the EventInterests row entirely. */
export async function markNotGoing(eventId: string): Promise<Result> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { error } = await supabase
    .from("event_interests")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
