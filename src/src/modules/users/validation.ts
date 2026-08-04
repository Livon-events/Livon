import { z } from "zod";
import type { SocialLink } from "./types";

/**
 * Single source of truth for profile-edit limits + validation, shared by
 * the client form (fast feedback) and the `/api/profile` route handler
 * (authoritative — the client's checks are a UX nicety only, never trusted).
 *
 * Limits come from docs/FR/user-profile-fr.md §2 (Bio) and §4 (Edit).
 */

export const BIO_MAX = 150;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Matches the pattern already enforced at signup (SignupForm.tsx) — kept in
// sync deliberately so a rename can never produce a username the signup
// flow itself wouldn't have allowed.
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// Avatar upload constraints. Enforced server-side in the route handler
// (this file only hosts the numbers so client + server can't drift) —
// mirrors src/lib/validation/eventCreation.ts's image constants.
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const AVATAR_MAX_DIMENSION = 6000; // px, either side
export const AVATAR_MAX_PIXELS = 30_000_000; // ~30MP decode budget (decompression-bomb guard)
export const ALLOWED_AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export const profileFieldsSchema = z.object({
  // Always normalized to lowercase before this schema sees it (both in the
  // client form and the route handler) — the DB's username unique index is
  // plain btree/case-sensitive (docs/db/schema.md), so lowercasing in app
  // code is what actually makes uniqueness behave case-insensitively.
  username: z
    .string()
    .trim()
    .regex(USERNAME_PATTERN, "Username must be 3–20 characters: letters, numbers, and underscores only."),

  // Empty string means "clear the bio" — mapped to null before the DB write.
  bio: z
    .string()
    .max(BIO_MAX, `Bio must be ${BIO_MAX} characters or fewer`),
});

export type ProfileFieldsInput = z.infer<typeof profileFieldsSchema>;

// --- Social links (docs/FR/user-profile-fr.md §3) ---------------------
//
// Three fixed platform slots, no user-defined links — so "reject
// inappropriate links" here means "reject anything that isn't actually a
// link to that platform," not general content moderation. A URL's
// destination content can't be judged in the browser at all (or trusted
// even if it could be); this only rejects malformed input and wrong-
// platform/wrong-scheme links before they're ever sent. The route
// handler that eventually persists these MUST import and re-run this
// same function — this file is the shared source of truth, same as
// USERNAME_PATTERN/BIO_MAX above.

export const SOCIAL_LINK_MAX_LENGTH = 200;

const PLATFORM_HOSTS: Record<SocialLink["platform"], readonly string[]> = {
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
};

/**
 * Validates one link against its platform slot. Returns `null` when the
 * value is valid (or empty — clearing a slot is always allowed), or a
 * user-facing error string otherwise.
 *
 * Deliberately uses the `URL` constructor rather than a regex for the
 * scheme/host check: it's the only reliable way to reject
 * `javascript:`/`data:`/other dangerous schemes and to read the real host
 * (as opposed to matching "tiktok.com" anywhere in the string, which
 * `evil.com/tiktok.com` would also match).
 */
export function validateSocialLink(platform: SocialLink["platform"], raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null; // empty clears the slot

  if (value.length > SOCIAL_LINK_MAX_LENGTH) {
    return `Link must be ${SOCIAL_LINK_MAX_LENGTH} characters or fewer`;
  }

  let url: URL;
  try {
    // No-scheme input ("tiktok.com/me") is a common paste — try once with
    // https:// prepended before giving up, rather than rejecting it outright.
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return "Enter a valid link";
  }

  if (url.protocol !== "https:") {
    return "Link must use https://";
  }

  const host = url.hostname.toLowerCase().replace(/^(www|vm|vt|m)\./, "");
  const allowed = PLATFORM_HOSTS[platform];
  if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) {
    return `Enter a ${platform} link`;
  }

  return null;
}
