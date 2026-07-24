"use client";

import { useConnectAction } from "@/hooks/useConnectAction";
import type { ConnectionState } from "@/lib/queries/public-profile";

interface ConnectButtonProps {
  profileUserId: string;
  initialState: ConnectionState;
}

const LABEL: Record<ConnectionState["status"], string> = {
  none: "Connect",
  outgoing: "Cancel",
  incoming: "Accept",
  connected: "Unconnect",
};

export default function ConnectButton({ profileUserId, initialState }: ConnectButtonProps) {
  const { state, error, handleClick } = useConnectAction(profileUserId, initialState);

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
        className={`font-display text-lg max-[380px]:text-base font-extrabold text-center rounded-xl py-4 max-[380px]:py-3.5 cursor-pointer transition-transform active:scale-[0.97] ${
          isOutline
            ? "bg-black text-[#FFE600] border-[3px] border-[#FFE600]"
            : "bg-[#FFE600] text-black border-[3px] border-transparent"
        }`}
      >
        {LABEL[state.status]}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
