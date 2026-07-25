"use client";

import Link from "next/link";
import { useConnectAction } from "@/hooks/useConnectAction";
import type { ConnectionState } from "@/lib/queries/public-profile";

interface ConnectButtonProps {
  profileUserId: string;
  initialState: ConnectionState;
  isViewerSignedIn: boolean;
}

const LABEL: Record<ConnectionState["status"], string> = {
  none: "Connect",
  outgoing: "Cancel",
  incoming: "Accept",
  connected: "Unconnect",
};

const buttonClasses =
  "font-display text-lg max-[380px]:text-base font-extrabold text-center rounded-xl py-4 max-[380px]:py-3.5 transition-transform active:scale-[0.97]";

export default function ConnectButton({
  profileUserId,
  initialState,
  isViewerSignedIn,
}: ConnectButtonProps) {
  // Anonymous visitors can view this profile (docs/FR/search.md), but
  // `connections` RLS is unchanged — sending a request would just fail.
  // Rather than let that happen silently, send them to sign in first.
  if (!isViewerSignedIn) {
    return (
      <div className="flex-[1.8] flex flex-col">
        <Link
          href={`/login?next=/profile/${profileUserId}`}
          className={`${buttonClasses} bg-[#FFE600] text-black border-[3px] border-transparent`}
        >
          Sign in to Connect
        </Link>
      </div>
    );
  }

  return <ConnectButtonInteractive profileUserId={profileUserId} initialState={initialState} />;
}

function ConnectButtonInteractive({
  profileUserId,
  initialState,
}: {
  profileUserId: string;
  initialState: ConnectionState;
}) {
  const { state, error, isPending, handleClick } = useConnectAction(profileUserId, initialState);

  // Solid yellow for the "make a move" actions (Connect / Accept); an
  // outlined yellow-on-black for the "you're already in a state, tap to
  // undo it" actions (Cancel / Unconnect) — same solid-vs-outline language
  // EventCardActions uses for its own toggle button.
  const isOutline = state.status === "outgoing" || state.status === "connected";

  return (
    <div className="flex-[1.8] flex flex-col">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`${buttonClasses} disabled:cursor-not-allowed disabled:opacity-60 ${
          isPending ? "cursor-wait" : "cursor-pointer"
        } ${
          isOutline
            ? "bg-black text-[#FFE600] border-[3px] border-[#FFE600]"
            : "bg-[#FFE600] text-black border-[3px] border-transparent"
        }`}
      >
        {isPending ? "…" : LABEL[state.status]}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
