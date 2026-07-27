"use client";

import { useRouter } from "next/navigation";

/**
 * Converted from raw_html_and_css/create_event's `.back-btn`. Always
 * confirms before leaving, matching the original mockup's behavior — event
 * drafts aren't persisted anywhere, so navigating away silently would lose
 * whatever the organiser already typed.
 */
export default function BackButton() {
  const router = useRouter();

  function handleClick() {
    const confirmed = window.confirm("Discard this event draft?");
    if (confirmed) {
      router.back();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Go back"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 active:scale-95"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-6 w-6">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </button>
  );
}
