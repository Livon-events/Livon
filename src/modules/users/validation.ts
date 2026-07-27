import { z } from "zod";

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
