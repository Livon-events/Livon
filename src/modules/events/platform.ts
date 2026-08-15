/**
 * Livon platform account that owns curated, unclaimed events until a host
 * claims them. See docs/FR/event-claiming-plan.md and
 * docs/ops/publish-and-transfer.md.
 *
 * Platform identity is username `livon` (resolved in SQL). Optional env overrides
 * the UUID used by app-side checks when you need to pin a specific account:
 * NEXT_PUBLIC_LIVON_PLATFORM_USER_ID.
 *
 * Defaults:
 * - production: c0781e8f-980b-4a4c-aa98-097fa03ff509
 * - livon-test: 57ff202e-9386-47a2-aeb4-44dcbd8ac5c7 (set via .env.local)
 */
export const LIVON_PLATFORM_USERNAME = "livon";

export const LIVON_PLATFORM_USER_ID =
  process.env.NEXT_PUBLIC_LIVON_PLATFORM_USER_ID ??
  "c0781e8f-980b-4a4c-aa98-097fa03ff509";

export function isLivonPlatformUser(userId: string | null | undefined): boolean {
  return Boolean(userId) && userId === LIVON_PLATFORM_USER_ID;
}

export function isLivonPlatformUsername(
  username: string | null | undefined
): boolean {
  return username?.trim().toLowerCase() === LIVON_PLATFORM_USERNAME;
}

/** Unclaimed Livon listing — still owned by the platform account. */
export function isClaimableEvent(args: {
  organizerId: string;
  claimedAt: string | null;
  hostUsername?: string | null;
}): boolean {
  if (args.claimedAt != null) return false;
  if (isLivonPlatformUser(args.organizerId)) return true;
  // Username fallback so local/test works when UUID env differs from production.
  return isLivonPlatformUsername(args.hostUsername);
}
