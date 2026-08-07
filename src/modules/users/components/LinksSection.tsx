"use client";

import { useState } from "react";
import type { SocialLink } from "./types";
import { useLinksDropdown } from "./useLinksDropdown";
import { validateSocialLink } from "@/modules/users/validation";

interface LinksSectionProps {
  links: SocialLink[];
  onEdit?: () => void;
  onLinkChange?: (id: string, value: string) => void;
  onLinkSubmit?: (id: string, value: string) => void;
}

function LinkIcon({ platform }: { platform: SocialLink["platform"] }) {
  if (platform === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]">
        <path d="M16.6 5.82c-1.02-.9-1.6-2.2-1.6-3.62h-3.2v13.9c0 1.6-1.3 2.9-2.9 2.9s-2.9-1.3-2.9-2.9 1.3-2.9 2.9-2.9c.3 0 .58.05.85.13V9.98a6.1 6.1 0 0 0-.85-.06 6.1 6.1 0 1 0 6.1 6.1V9.1a9.3 9.3 0 0 0 5.4 1.72V7.6c-1.5 0-2.85-.5-3.7-1.78z" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-[22px] h-[22px]">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]">
      <path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.5c0-.9.25-1.5 1.55-1.5H16.5V4.3C16.2 4.26 15.2 4.17 14 4.17c-2.4 0-4 1.46-4 4.14V10.5H7.5v3H10V21h3.5z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function LinksSection({ links, onEdit, onLinkChange, onLinkSubmit }: LinksSectionProps) {
  const { isOpen, toggle, close } = useLinksDropdown();

  // Each row has its own submit button and is fully independent of the
  // others (and of EditProfileModal's separate form) — so validation,
  // errors, and the "typed but not yet submitted" value are all tracked
  // per link id here rather than lifted to the parent.
  const [draftValues, setDraftValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(links.map((link) => [link.id, link.value]))
  );
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // Re-sync drafts when the parent hands back new canonical `links` (e.g.
  // after a successful save updates state from the server response).
  // Deliberately NOT a useEffect — that would setState synchronously
  // during an effect, triggering a redundant extra render (the lint rule
  // that flagged this). React's own recommended fix for "adjust state
  // when a prop changes" is to compare against the previous prop value
  // during render itself: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevLinks, setPrevLinks] = useState(links);
  if (links !== prevLinks) {
    setPrevLinks(links);
    setDraftValues(Object.fromEntries(links.map((link) => [link.id, link.value])));
  }

  function handleChange(link: SocialLink, value: string) {
    setDraftValues((prev) => ({ ...prev, [link.id]: value }));
    if (errors[link.id]) {
      setErrors((prev) => ({ ...prev, [link.id]: undefined }));
    }
    onLinkChange?.(link.id, value);
  }

  function handleSubmit(link: SocialLink) {
    const value = draftValues[link.id] ?? link.value;
    const error = validateSocialLink(link.platform, value);

    if (error) {
      // Blocked: never reaches onLinkSubmit. Cleared: the field snaps
      // back to the last known-good value rather than sitting on
      // rejected input, so the row's state stays unambiguous.
      setErrors((prev) => ({ ...prev, [link.id]: error }));
      setDraftValues((prev) => ({ ...prev, [link.id]: link.value }));
      return;
    }

    setErrors((prev) => ({ ...prev, [link.id]: undefined }));
    onLinkSubmit?.(link.id, value.trim());
  }

  return (
    <div className="relative z-20 mb-7">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex items-center gap-1.5 bg-transparent border-none text-white font-display text-[22px] font-extrabold py-1 cursor-pointer"
        >
          Links
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-[18px] h-[18px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="font-display text-[15px] font-bold border-none rounded-[10px] px-[18px] py-2.5 bg-[#1F2023] text-white cursor-pointer"
        >
          Edit
        </button>
      </div>

      <div
        className={`absolute top-[calc(100%+12px)] inset-x-0 flex flex-col gap-2.5 
          bg-[#17181A] border border-[#1F2023] rounded-2xl p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)] 
          transition-all duration-[180ms] ease-out z-20
          max-h-[min(65vh,280px)] supports-[height:100dvh]:max-h-[min(65dvh,280px)] overflow-y-auto overscroll-contain
          ${isOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1.5"}`}
      >
        {links.map((link) => {
          const value = draftValues[link.id] ?? link.value;
          const error = errors[link.id];
          return (
            <div key={link.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-white">
                  <LinkIcon platform={link.platform} />
                </div>
                <input
                  type="text"
                  placeholder={link.placeholder}
                  value={value}
                  aria-invalid={Boolean(error)}
                  onChange={(e) => handleChange(link, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSubmit(link);
                    }
                  }}
                  className={`flex-1 h-12 bg-[#1F2023] border-2 rounded-xl px-3.5 text-white text-[15px] outline-none placeholder:text-[#AEAEB2] focus:border-[#FFE600] ${
                    error ? "border-[#ff453a]" : "border-[#1F2023]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleSubmit(link)}
                  className="w-12 h-12 flex-shrink-0 border-none rounded-xl bg-[#FFE600] text-black flex items-center justify-center cursor-pointer active:scale-[0.985] transition-transform"
                >
                  <ArrowIcon />
                </button>
              </div>
              {error && (
                <p className="pl-[42px] text-xs font-semibold text-[#ff453a]">{error}</p>
              )}
            </div>
          );
        })}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
      )}
    </div>
  );
}
