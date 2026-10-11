"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Info, X } from "lucide-react";

const WHATSAPP_HREF = "https://wa.me/26659034707";
const GUIDE_SEEN_KEY = "livon:install-guide-seen";
const GUIDE_SEEN_EVENT = "livon:install-guide-seen";

type Platform = "android" | "ios";

const STEPS: Record<Platform, { src: string; caption: string }[]> = {
  android: [
    { src: "/install/android-1-menu.png", caption: "Tap the menu (three dots) in Chrome" },
    { src: "/install/android-2-add-to-home.png", caption: "Tap Add to Home screen" },
    { src: "/install/android-3-install.png", caption: "Tap Install" },
  ],
  ios: [
    { src: "/install/ios-1-share.png", caption: "Tap Share in Safari" },
    { src: "/install/ios-2-add-to-home.png", caption: "Tap Add to Home Screen" },
    { src: "/install/ios-3-add.png", caption: "Tap Add" },
  ],
};

function subscribeNoop() {
  return () => {};
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function useInstallGuideSeen() {
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    function sync() {
      setSeen(isInstalled() || localStorage.getItem(GUIDE_SEEN_KEY) === "1");
    }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(GUIDE_SEEN_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(GUIDE_SEEN_EVENT, sync);
    };
  }, []);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {}
    window.dispatchEvent(new Event(GUIDE_SEEN_EVENT));
  }, []);

  return { seen, markSeen };
}

type AboutButtonProps = {
  onClick: () => void;
};

export function AboutButton({ onClick }: AboutButtonProps) {
  const { seen, markSeen } = useInstallGuideSeen();

  return (
    <button
      type="button"
      onClick={() => {
        markSeen();
        onClick();
      }}
      aria-label="How to install Livon"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 active:scale-95"
    >
      <Info className="h-[26px] w-[26px]" strokeWidth={2.25} />
      {!seen && (
        <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#FF3B30] ring-2 ring-[#0C0C0C]" />
      )}
    </button>
  );
}

type AboutSheetProps = {
  open: boolean;
  onClose: () => void;
  variant: "sheet" | "modal";
};

export default function AboutSheet({ open, onClose, variant }: AboutSheetProps) {
  const [chosenPlatform, setPlatform] = useState<Platform | null>(null);
  const isIOS = useSyncExternalStore(
    subscribeNoop,
    () => /iPhone|iPad|iPod/i.test(navigator.userAgent),
    () => false,
  );
  const platform = chosenPlatform ?? (isIOS ? "ios" : "android");

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
      className={`fixed inset-0 flex bg-[#0C0C0C]/65 transition-opacity duration-[250ms] ease-out ${
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
            ? `flex w-full max-h-[85dvh] flex-col origin-bottom rounded-t-3xl border-t border-[#222222] bg-[#0C0C0C] px-5 pt-4 transition-transform duration-[350ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
                open ? "translate-y-0" : "translate-y-full"
              }`
            : `w-full max-w-[480px] rounded-2xl border border-[#222222] bg-[#0C0C0C] p-6 transition-transform duration-[250ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
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
            How to install / Add to Home Screen
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#1f1f1f] text-[#8e8e93] transition-colors hover:bg-[#2a2a2a] hover:text-white active:bg-[#2a2a2a] active:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Device"
          className="mb-4 grid shrink-0 grid-cols-2 gap-1 rounded-full border border-[#222222] bg-[#141414] p-1"
        >
          {(["android", "ios"] as const).map((id) => {
            const active = platform === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPlatform(id)}
                className={`rounded-full py-2 text-[14px] font-semibold transition-colors ${
                  active
                    ? "bg-[#FFF335] text-[#0C0C0C]"
                    : "text-[#8e8e93] hover:text-white"
                }`}
              >
                {id === "android" ? "Android" : "iPhone"}
              </button>
            );
          })}
        </div>

        <div
          className={`min-h-0 space-y-5 overflow-y-auto overscroll-contain text-[15px] leading-relaxed text-[#d1d1d6] ${
            isSheet ? "flex-1 pb-6" : "max-h-[min(70vh,520px)]"
          }`}
        >
          <ol role="tabpanel" className="space-y-5">
            {STEPS[platform].map((step, index) => (
              <li key={step.src}>
                <p className="mb-2 font-semibold text-white">
                  {index + 1}. {step.caption}
                </p>
                <Image
                  src={step.src}
                  alt={step.caption}
                  width={576}
                  height={1024}
                  sizes="(max-width: 480px) 90vw, 432px"
                  className="mx-auto h-auto w-full max-w-[320px] rounded-2xl border border-[#222222]"
                />
              </li>
            ))}
          </ol>

          <section className="border-t border-[#1f1f1f] pt-5">
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
          </section>
        </div>
      </div>
    </div>
  );
}
