import React from "react";
import Link from "next/link";

export type SocialPlatform = "instagram" | "facebook" | "tiktok";

export interface GuestlistAttendee {
  id: string;
  handle: string;
  avatarUrl?: string;
  socials?: SocialPlatform[];
}

interface GuestlistRowProps {
  attendee: GuestlistAttendee;
}

export default function GuestlistRow({ attendee }: GuestlistRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      {/* Left: Avatar + Handle — links to the attendee's public profile */}
      <Link
        href={`/profile/${attendee.id}`}
        className="flex items-center gap-3.5 min-w-0 group"
      >
        {/* Gray placeholder shown until the attendee's avatar image loads */}
        <div
          className="w-10 h-10 rounded-full bg-[#3A3A3C] shrink-0 bg-cover bg-center"
          style={
            attendee.avatarUrl
              ? { backgroundImage: `url(${attendee.avatarUrl})` }
              : undefined
          }
        />
        {/* Handle */}
        <span className="text-white text-base font-bold truncate group-hover:underline">
          {attendee.handle}
        </span>
      </Link>

      {/* Right: Social Platform Badges */}
      <div className="flex items-center gap-2.5 shrink-0">
        {attendee.socials?.map((platform) => (
          <SocialIcon key={platform} platform={platform} />
        ))}
      </div>
    </div>
  );
}

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case "instagram":
      return (
        <a
          href="#"
          aria-label="Instagram"
          className="text-white hover:text-gray-300 transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
        </a>
      );
    case "facebook":
      return (
        <a
          href="#"
          aria-label="Facebook"
          className="text-white hover:text-gray-300 transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
        </a>
      );
    case "tiktok":
      return (
        <a
          href="#"
          aria-label="TikTok"
          className="text-white hover:text-gray-300 transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.901 2.88 2.896 2.896 0 0 1-2.892-2.88 2.896 2.896 0 0 1 2.892-2.88c.277 0 .542.044.792.12v-3.52a6.34 6.34 0 0 0-.792-.05A6.338 6.338 0 0 0 3 15.672 6.338 6.338 0 0 0 9.373 22a6.338 6.338 0 0 0 6.373-6.328V9.284A8.16 8.16 0 0 0 20.3 10.63V7.177a4.83 4.83 0 0 1-.711-.491z" />
          </svg>
        </a>
      );
    default:
      return null;
  }
}
