"use client";

import { useLinksDropdown } from "@/modules/users/components/useLinksDropdown";

interface PublicLinksButtonProps {
  tiktokUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
}

type Platform = "tiktok" | "instagram" | "facebook";

function LinkIcon({ platform }: { platform: Platform }) {
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

const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
};

/**
 * Read-only counterpart to LinksSection (own profile, editable). Per
 * docs/FR/user-profile-fr.md §3: tapping "Links" opens a panel listing
 * only the platforms that are actually set, each opening the external URL
 * in a new tab — unset platforms are omitted, not shown disabled.
 */
export default function PublicLinksButton({
  tiktokUrl,
  instagramUrl,
  facebookUrl,
}: PublicLinksButtonProps) {
  const { isOpen, toggle, close } = useLinksDropdown();

  const links: { platform: Platform; url: string }[] = [
    tiktokUrl ? { platform: "tiktok" as const, url: tiktokUrl } : null,
    instagramUrl ? { platform: "instagram" as const, url: instagramUrl } : null,
    facebookUrl ? { platform: "facebook" as const, url: facebookUrl } : null,
  ].filter((link): link is { platform: Platform; url: string } => link !== null);

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="w-full font-display text-lg max-[380px]:text-base font-extrabold text-center rounded-xl py-3 max-[380px]:py-3 cursor-pointer bg-[#FFE600] text-black border-[3px] border-transparent transition-transform active:scale-[0.97]"
      >
        Links
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} aria-hidden="true" />
          <div className="absolute top-[calc(100%+12px)] right-0 z-20 flex w-[260px] flex-col gap-2.5 rounded-2xl border border-[#1F2023] bg-[#17181A] p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
            {links.length === 0 ? (
              <p className="py-2 text-center text-sm text-[#AEAEB2]">No links added yet.</p>
            ) : (
              links.map((link) => (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl bg-[#1F2023] px-3.5 py-3 text-white"
                >
                  <LinkIcon platform={link.platform} />
                  <span className="text-[15px] font-semibold">{PLATFORM_LABEL[link.platform]}</span>
                </a>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}