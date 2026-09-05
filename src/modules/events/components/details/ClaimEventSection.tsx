"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { claimEvent } from "@/modules/events/mutations";

type ClaimEventSectionProps = {
  eventId: string;
  isClaimable: boolean;
  canViewerClaim: boolean;
  claimNeedsOpsTransfer: boolean;
  isSignedIn: boolean;
};

/**
 * Host claim CTA on event details. Only rendered for Livon-published
 * unclaimed events. Claim requires a signed-in invited host — no auto-claim
 * after login (docs/FR/event-claiming-plan.md).
 */
export default function ClaimEventSection({
  eventId,
  isClaimable,
  canViewerClaim,
  claimNeedsOpsTransfer,
  isSignedIn,
}: ClaimEventSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isClaimable) {
    return null;
  }

  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  async function handleConfirmClaim() {
    setPending(true);
    setError(null);
    const result = await claimEvent(eventId);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirming(false);
    router.push(`/events/${eventId}/manage`);
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-lg border border-[#3A3A3C] bg-[#161616] p-4 sm:mt-8 sm:p-5">
      <h2 className="text-base font-extrabold text-white sm:text-lg">Are you the host?</h2>

      {!isSignedIn && (
        <>
          <p className="mt-2 text-sm text-[#a1a1a6]">
            Sign in to claim this event and manage the guestlist under your account.
          </p>
          <Link
            href={loginHref}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#FFF335] px-4 text-sm font-extrabold text-[#121212] transition-transform active:scale-[0.98]"
          >
            Sign in to claim this event
          </Link>
        </>
      )}

      {isSignedIn && claimNeedsOpsTransfer && (
        <p className="mt-2 text-sm text-[#a1a1a6]">
          This listing is still managed by Livon. Message Livon on WhatsApp to move it
          onto your account.
        </p>
      )}

      {isSignedIn && !claimNeedsOpsTransfer && !canViewerClaim && (
        <p className="mt-2 text-sm text-[#a1a1a6]">
          This event can only be claimed by the invited organizer. If that is you,
          message Livon on WhatsApp.
        </p>
      )}

      {isSignedIn && canViewerClaim && !confirming && (
        <>
          <p className="mt-2 text-sm text-[#a1a1a6]">
            Claim this event to show it as hosted by you and unlock edit and guestlist
            tools.
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#FFF335] px-4 text-sm font-extrabold text-[#121212] transition-transform active:scale-[0.98]"
          >
            Claim this event
          </button>
        </>
      )}

      {isSignedIn && canViewerClaim && confirming && (
        <div className="mt-3 rounded-md border border-[#3A3A3C] bg-[#121212]/40 p-3">
          <p className="text-sm text-[#d1d5db]">
            By claiming, you confirm you are authorized to manage this event. You will
            be able to edit details, view the guestlist, and cancel the listing.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleConfirmClaim()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#FFF335] px-4 text-sm font-extrabold text-[#121212] disabled:opacity-60"
            >
              {pending ? "Claiming…" : "Confirm claim"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-[#3A3A3C] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm font-semibold text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
