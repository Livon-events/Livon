"use client";

import type { GoingPopupMode, GoingVisibility } from "@/hooks/useGoingAction";

type GoingPrivacyPopupProps = {
  mode: Exclude<GoingPopupMode, "closed">;
  onSelectPrivacy: (visibility: GoingVisibility) => void;
  onChangePrivacy: () => void;
  onNotGoing: () => void;
  onClose: () => void;
};

/**
 * Renders above its trigger button (`absolute bottom-full`) — the parent
 * must be `position: relative`. Covers both popup states from
 * docs/FR/going-rsvp-privacy.md:
 *   - "choose-privacy": first-time Going, or re-picking privacy
 *   - "manage": re-tap while already going (Change privacy / Not going)
 *
 * The invisible full-screen backdrop closes the popup on an outside tap;
 * `stopPropagation` on the panel itself keeps taps inside it from also
 * hitting the backdrop. Callers that live inside a clickable card (the
 * feed card wraps everything in a Link) additionally stop propagation at
 * their own root so nothing here triggers a navigation.
 */
export default function GoingPrivacyPopup({
  mode,
  onSelectPrivacy,
  onChangePrivacy,
  onNotGoing,
  onClose,
}: GoingPrivacyPopupProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-[#262626] bg-[#161616] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      >
        {mode === "choose-privacy" ? (
          <>
            <button
              type="button"
              onClick={() => onSelectPrivacy("private")}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <span className="text-[15px] font-bold text-white">Private</span>
              <span className="text-xs text-[#8e8e8e]">Your connections won&apos;t see you&apos;re going</span>
            </button>
            <div className="h-px bg-[#262626]" />
            <button
              type="button"
              onClick={() => onSelectPrivacy("visible")}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/10"
            >
              <span className="text-[15px] font-bold text-white">Visible</span>
              <span className="text-xs text-[#8e8e8e]">Your connections can see you&apos;re going</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onChangePrivacy}
              className="w-full px-4 py-3 text-left text-[15px] font-bold text-white transition-colors hover:bg-white/5 active:bg-white/10"
            >
              Change privacy
            </button>
            <div className="h-px bg-[#262626]" />
            <button
              type="button"
              onClick={onNotGoing}
              className="w-full px-4 py-3 text-left text-[15px] font-bold text-[#ff453a] transition-colors hover:bg-white/5 active:bg-white/10"
            >
              Not going
            </button>
          </>
        )}
      </div>
    </>
  );
}
