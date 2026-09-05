"use client";

import { useEffect } from "react";
import { Info, X } from "lucide-react";

const WHATSAPP_HREF = "https://wa.me/26659034707";
const WHATSAPP_GROUP_HREF = "https://chat.whatsapp.com/DNm1CIW7I9u2mZWi4fHLbj";

type AboutButtonProps = {
  onClick: () => void;
};

export function AboutButton({ onClick }: AboutButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="About Livon"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 active:scale-95"
    >
      <Info className="h-[26px] w-[26px]" strokeWidth={2.25} />
    </button>
  );
}

type AboutSheetProps = {
  open: boolean;
  onClose: () => void;
  variant: "sheet" | "modal";
};

export default function AboutSheet({ open, onClose, variant }: AboutSheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const isSheet = variant === "sheet";

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 flex bg-[#121212]/65 transition-opacity duration-[250ms] ease-out ${
        isSheet
          ? "z-[1100] items-end"
          : "z-[200] items-center justify-center"
      } ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      aria-hidden={!open}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-livon-title"
        className={
          isSheet
            ? `flex w-full max-h-[85dvh] flex-col origin-bottom rounded-t-3xl border-t border-[#222222] bg-[#121212] px-5 pt-4 transition-transform duration-[350ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
                open ? "translate-y-0" : "translate-y-full"
              }`
            : `w-full max-w-[480px] rounded-2xl border border-[#222222] bg-[#121212] p-6 transition-transform duration-[250ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
                open ? "translate-y-0 scale-100" : "translate-y-2.5 scale-95"
              }`
        }
        style={
          isSheet
            ? { paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 16px))" }
            : undefined
        }
      >
        <div
          className="relative mb-4 flex shrink-0 items-center justify-between border-b border-[#1f1f1f] pb-4"
        >
          {isSheet && (
            <div className="absolute -top-1.5 left-1/2 h-1 w-[38px] -translate-x-1/2 rounded-full bg-[#333333]" />
          )}
          <h2
            id="about-livon-title"
            className="text-lg font-semibold tracking-[-0.2px] text-white"
          >
            About Livon
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#1f1f1f] text-[#8e8e93] transition-colors hover:bg-[#2a2a2a] hover:text-white active:bg-[#2a2a2a] active:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={`min-h-0 space-y-5 overflow-y-auto overscroll-contain text-[15px] leading-relaxed text-[#d1d1d6] ${
            isSheet ? "flex-1 pb-6" : "max-h-[min(70vh,520px)]"
          }`}
        >
          <p>
            Livon is how Maseru finds out what&apos;s on and how hosts reach
            people looking for something to do.
          </p>

          <section>
            <h3 className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.8px] text-[#FFF335]">
              Going out
            </h3>
            <p>
              See what&apos;s happening around Maseru in one place. Discover
              events your connections are interested in and decide what&apos;s
              worth checking out. Mark an event as Interested to get reminders
              and help your connections discover it too.
            </p>
          </section>

          <section>
            <h3 className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.8px] text-[#FFF335]">
              Hosting
            </h3>
            <p>
              Post an event in minutes and reach people beyond your own circle.
              See who&apos;s interested and make it easier for people to
              discover what you&apos;re putting on.
            </p>
          </section>

          <section>
            <h3 className="mb-1.5 text-[13px] font-bold uppercase tracking-[0.8px] text-[#FFF335]">
              Contact
            </h3>
            <p>
              WhatsApp or call:{" "}
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white underline decoration-[#FFF335] underline-offset-2"
              >
                +266 5903 4707
              </a>
            </p>
            <p className="mt-2">
              Join the{" "}
              <a
                href={WHATSAPP_GROUP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white underline decoration-[#FFF335] underline-offset-2"
              >
                WhatsApp group
              </a>{" "}
              for updates and to share suggestions.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
