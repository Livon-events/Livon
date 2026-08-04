"use client";

import { useRef, useState } from "react";
import { getShareLink } from "@/modules/invites/mutations";

/**
 * Windows/macOS/Linux browsers technically expose `navigator.share`, but
 * desktop OSes usually have no registered share targets — the share
 * sheet opens, finds nothing, and silently closes itself. There's no
 * error or rejection to catch in that case, so it can't be detected and
 * used as a signal to fall back to clipboard after the fact. Instead,
 * gate on the platform up front: only Android/iOS reliably have apps
 * (WhatsApp, Facebook, Instagram, Messages, etc.) registered as share
 * targets, so only there is the share sheet worth attempting at all.
 */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Drives the Invite/Share button on both the feed card and the event
 * details page (docs/FR/invite.md, docs/FR/invite-links.md).
 *
 * Tap flow:
 *   1. Resolve a share URL — the caller's tracked `/i/{code}` link if
 *      signed in, or the plain event page URL if not.
 *   2. On Android/iOS with Web Share API support, hand it to the OS share
 *      sheet (WhatsApp, Facebook, Instagram, etc. all show up there).
 *   3. Everywhere else (desktop Windows/macOS/Linux, or a mobile browser
 *      that lacks the API), copy the URL to the clipboard directly and
 *      expose `copied` so the button can show brief confirmation.
 *
 * `navigator.share` throws `AbortError` when the person just closes the
 * share sheet without picking anything — that's not a failure, so it's
 * swallowed rather than surfaced as an error. Any other share-sheet
 * failure falls back to clipboard rather than leaving the tap looking
 * like it did nothing.
 */
export function useShareEvent(eventId: string) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not just the `sharing` state, because state updates are async —
  // a fast double-tap can fire both calls before the first re-render
  // commits, letting two inserts race past a state-only check. The ref
  // updates synchronously, so the second tap sees it immediately.
  const inFlightRef = useRef(false);

  async function copyToClipboard(shareUrl: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setError("Could not copy the link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link.");
    }
  }

  async function share(eventTitle: string) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setSharing(true);
    setError(null);
    setCopied(false);

    const result = await getShareLink(eventId);

    if (!result.ok) {
      setError(result.error);
      setSharing(false);
      inFlightRef.current = false;
      return;
    }

    const { shareUrl } = result.data;

    if (isMobileDevice() && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: eventTitle, url: shareUrl });
      } catch (err) {
        if (!(err instanceof Error) || err.name !== "AbortError") {
          await copyToClipboard(shareUrl);
        }
      }
    } else {
      await copyToClipboard(shareUrl);
    }

    setSharing(false);
    inFlightRef.current = false;
  }

  return { share, sharing, copied, error };
}
