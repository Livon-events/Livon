"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { safeImageUrl } from "@/shared/security/urls";
import AvatarImage from "./AvatarImage";

interface ProfileHeaderProps {
  username: string;
  connectionsCount?: number;
  avatarUrl?: string;
  variant?: "default" | "public";
}

export default function ProfileHeader({
  username,
  connectionsCount = 0,
  avatarUrl,
  variant = "default",
}: ProfileHeaderProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const isPublic = variant === "public";
  const safeAvatarUrl = safeImageUrl(avatarUrl);
  const avatarSizes = isPublic ? "(max-width: 380px) 76px, 88px" : "(max-width: 380px) 56px, 64px";

  // Close on Escape while the viewer is open.
  useEffect(() => {
    if (!isViewerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsViewerOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen]);

  useEffect(() => {
    if (!isViewerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isViewerOpen]);

  return (
    <div className={`flex items-center mb-5 ${isPublic ? "gap-6" : "gap-5"}`}>
      <button
        type="button"
        onClick={() => safeAvatarUrl && setIsViewerOpen(true)}
        disabled={!safeAvatarUrl}
        aria-label={safeAvatarUrl ? `View ${username}'s profile picture` : undefined}
        className={`shrink-0 appearance-none rounded-full border-0 p-0 enabled:cursor-pointer disabled:cursor-default ${
          isPublic
            ? "h-[88px] w-[88px] max-[380px]:h-[76px] max-[380px]:w-[76px]"
            : "w-16 h-16 max-[380px]:w-14 max-[380px]:h-14"
        }`}
      >
        <AvatarImage
          src={safeAvatarUrl}
          alt=""
          sizes={avatarSizes}
          eager
          className="h-full w-full rounded-full"
        />
      </button>
      <div className="flex flex-col gap-1">
        <div className="font-display text-[26px] max-[380px]:text-[22px] font-extrabold tracking-[-0.6px] text-white">
          {username}
        </div>
        {!isPublic && (
          <div className="text-[15px] font-medium text-[#AEAEB2]">
            {connectionsCount} connection{connectionsCount === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* Enlarged avatar viewer — stays circular (unlike the WhatsApp/
          Facebook rectangular photo-viewer pattern), like tapping a
          channel avatar on YouTube. On md+ it's allowed to grow up to
          the profile page's own container width (806px) rather than
          being capped by some smaller default modal width. */}
      {isViewerOpen && safeAvatarUrl && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${username}'s profile picture`}
        >
          <div
            className="absolute inset-0 bg-[#0C0C0C]/85"
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
            className="relative z-[1] w-[min(90vw,90vh,440px)] md:w-[min(80vw,80vh,806px)] aspect-square overflow-hidden rounded-full"
            onClick={(e) => e.stopPropagation()}
          >
            <AvatarImage
              src={safeAvatarUrl}
              alt={`${username}'s profile picture`}
              sizes="(min-width: 1008px) 806px, (min-width: 768px) 80vw, (min-width: 489px) 440px, 90vw"
              className="h-full w-full rounded-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
