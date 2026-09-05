"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ProfileHeaderProps {
  username: string;
  connectionsCount: number;
  avatarUrl?: string;
}

export default function ProfileHeader({ username, connectionsCount, avatarUrl }: ProfileHeaderProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Close on Escape while the viewer is open.
  useEffect(() => {
    if (!isViewerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsViewerOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen]);

  return (
    <div className="flex items-center gap-5 mb-5">
      <button
        type="button"
        onClick={() => avatarUrl && setIsViewerOpen(true)}
        disabled={!avatarUrl}
        aria-label={avatarUrl ? `View ${username}'s profile picture` : undefined}
        className="w-16 h-16 max-[380px]:w-14 max-[380px]:h-14 rounded-full bg-[#3A3A3C] flex-shrink-0 bg-cover bg-center appearance-none p-0 border-0 enabled:cursor-pointer disabled:cursor-default"
        style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
      />
      <div className="flex flex-col gap-1">
        <div className="font-display text-[26px] max-[380px]:text-[22px] font-extrabold tracking-[-0.6px] text-white">
          {username}
        </div>
        <div className="text-[15px] font-medium text-[#AEAEB2]">
          {connectionsCount} connection{connectionsCount === 1 ? "" : "s"}
        </div>
      </div>

      {/* Enlarged avatar viewer — stays circular (unlike the WhatsApp/
          Facebook rectangular photo-viewer pattern), like tapping a
          channel avatar on YouTube. On md+ it's allowed to grow up to
          the profile page's own container width (806px) rather than
          being capped by some smaller default modal width. */}
      {isViewerOpen && avatarUrl && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${username}'s profile picture`}
        >
          <div
            className="absolute inset-0 bg-[#121212]/85"
            onClick={() => setIsViewerOpen(false)}
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={() => setIsViewerOpen(false)}
            aria-label="Close"
            className="absolute top-5 right-5 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-[#1F2023] text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative w-[min(90vw,90vh,440px)] md:w-[min(80vw,80vh,806px)] aspect-square rounded-full bg-cover bg-center shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            style={{ backgroundImage: `url(${avatarUrl})` }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
