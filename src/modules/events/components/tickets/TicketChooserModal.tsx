"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import type { TicketLink } from "@/modules/events/ticketLinks";

type TicketChooserModalProps = {
  links: TicketLink[];
  onSelect: (link: TicketLink) => void;
  onClose: () => void;
};

/**
 * Portaled to <body> so card overflow/stacking can't clip it. React events
 * still bubble through the component tree, so every click stops here —
 * otherwise a tap would reach the feed card's wrapping Link.
 */
export default function TicketChooserModal({ links, onSelect, onClose }: TicketChooserModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-chooser-title"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="w-full max-w-[320px] rounded-xl border border-[#262626] bg-[#0C0C0C] p-4 text-white"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="ticket-chooser-title" className="text-[17px] font-extrabold">
            Buy tickets
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#8e8e8e] hover:bg-white/5"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {links.map((link) => (
            <button
              key={link.provider.id}
              type="button"
              onClick={() => onSelect(link)}
              className="flex h-[48px] w-full items-center justify-between rounded-[6px] bg-[#FFF335] px-4 text-[16px] font-black text-[#0C0C0C] transition-transform active:scale-[0.98]"
            >
              {link.provider.label}
              <ExternalLink className="h-4 w-4" strokeWidth={2.5} />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
