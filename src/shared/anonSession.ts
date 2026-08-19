const STORAGE_KEY = "livon_anon_session_id";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Stable anonymous visitor id for invite-click dedup and anonymous event
 * view logging (docs/FR/architecture.md). Client-only — localStorage is
 * not available in Server Components.
 *
 * Returns null when storage is blocked (settings, some private modes,
 * quota). Callers should skip anonymous tracking rather than invent a
 * fresh id every page load, which would inflate unique-viewer counts.
 */
export function getOrCreateAnonSessionId(): string | null {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && UUID_RE.test(existing)) {
      return existing;
    }

    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
}
