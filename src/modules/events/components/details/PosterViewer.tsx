"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface PosterViewerProps {
  src: string;
  alt: string;
}

/**
 * Renders the event poster thumbnail. Clicking it opens a full-size modal
 * viewer (same UX pattern as ProfileHeader's avatar viewer).
 */
export default function PosterViewer({ src, alt }: PosterViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`View full poster: ${alt}`}
        className="relative aspect-[16/7] min-h-[180px] w-full cursor-pointer overflow-hidden rounded-md bg-[#3A3A3C] border-0 p-0 appearance-none sm:min-h-[220px]"
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(min-width: 768px) 798px, 100vw"
          className="object-cover"
        />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Full poster: ${alt}`}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/90"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Close button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
            className="absolute top-5 right-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#1F2023] text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Full poster */}
          <div
            className="relative z-[1] max-h-[90vh] w-[min(90vw,900px)] overflow-hidden rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="block h-auto max-h-[90vh] w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
