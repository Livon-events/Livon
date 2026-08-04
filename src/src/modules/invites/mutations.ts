import { createClient } from "@/shared/supabase/client";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Postgres error code for a unique-constraint violation — used below to
// retry once if a freshly generated `code` collides with an existing row.
const UNIQUE_VIOLATION = "23505";

/**
 * `invite_links.code` has no DB default (docs/db/schema.md), so the client
 * generates it. 10 base36 chars from a CSPRNG is ~51 bits of entropy —
 * fine for a code that's only ever looked up by exact match, never
 * enumerated or guessed against.
 */
function generateCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

export type ShareLinkResult = {
  /** Full URL to hand to the share sheet / clipboard. */
  shareUrl: string;
  /**
   * Whether this URL is a tracked `invite_links` link (resolves through
   * `/i/{code}` -> `redeem_invite`) or just the plain event page URL.
   * Only authenticated users get a tracked link — `invite_links.creator_id`
   * is NOT NULL and its INSERT policy is `authenticated`-only (see
   * docs/db/rls-policies.md), so a signed-out sharer has nowhere to attach
   * a row. Their share still works, it's just untracked at the source;
   * the click still counts as a normal page view either way.
   */
  tracked: boolean;
};

/**
 * Get-or-create the caller's invite link for this event, per FR decision:
 * a signed-in user always gets the *same* link back for a given event
 * (looked up by creator_id + event_id, not a new row every tap) — even
 * though the schema itself permits multiple links per (event, creator)
 * per docs/FR/invite-links-fr-resolutions.md. We just never exercise
 * that multiplicity from this one entry point.
 *
 * Signed-out callers can't own an invite_links row at all (RLS insert
 * policy is authenticated-only), so they fall back to the plain event
 * page URL — untracked, but still shareable and still viewable.
 */
export async function getShareLink(eventId: string): Promise<Result<ShareLinkResult>> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (!user) {
    return {
      ok: true,
      data: { shareUrl: `${origin}/events/${eventId}`, tracked: false },
    };
  }

  // `invite_links` has no unique constraint on (event_id, creator_id) —
  // multiple rows are allowed by design (docs/FR/invite-links-fr-resolutions.md).
  // .maybeSingle() throws PGRST116 the moment more than one row matches,
  // which happens in practice (a double-tap, or a leftover row from
  // earlier testing) — so order + take the oldest instead of assuming
  // there's exactly one.
  const { data: existingRows, error: selectError } = await supabase
    .from("invite_links")
    .select("code")
    .eq("event_id", eventId)
    .eq("creator_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (selectError) {
    return { ok: false, error: selectError.message };
  }

  const existing = existingRows?.[0];

  if (existing) {
    return {
      ok: true,
      data: { shareUrl: `${origin}/i/${existing.code}`, tracked: true },
    };
  }

  // Two attempts: a fresh random code should essentially never collide,
  // but `code` is globally unique (not just per-event), so retry once
  // with a new code rather than surfacing a spurious error to the user.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: created, error: insertError } = await supabase
      .from("invite_links")
      .insert({ event_id: eventId, creator_id: user.id, code: generateCode() })
      .select("code")
      .single();

    if (created) {
      return {
        ok: true,
        data: { shareUrl: `${origin}/i/${created.code}`, tracked: true },
      };
    }

    if (insertError?.code !== UNIQUE_VIOLATION) {
      return { ok: false, error: insertError?.message ?? "Could not create invite link." };
    }
  }

  return { ok: false, error: "Could not create invite link." };
}
