"use client";

import HostLink from "./HostLink";

type EventHostLineProps = {
  isClaimable: boolean;
  hostUsername: string;
  /** Feed card sits inside a Link — use HostLink. Details page can use a real <a>. */
  nestedInLink?: boolean;
};

/**
 * Unclaimed Livon listings: "Published by Livon" (plain text).
 * Claimed / self-published: "Hosted by @username" (linked).
 */
export default function EventHostLine({
  isClaimable,
  hostUsername,
  nestedInLink = false,
}: EventHostLineProps) {
  if (isClaimable) {
    return (
      <p
        className={
          nestedInLink
            ? "text-[14px] text-[#d1d5db]"
            : "text-xs text-[#d1d5db] sm:text-sm"
        }
      >
        Published by <span className="font-bold text-[#FFF335]">Livon</span>
      </p>
    );
  }

  if (nestedInLink) {
    return (
      <p className="text-[14px]">
        Hosted by <HostLink username={hostUsername} />
      </p>
    );
  }

  return (
    <p className="text-xs text-[#d1d5db] sm:text-sm">
      Hosted by{" "}
      <a
        href={`/users/${encodeURIComponent(hostUsername)}`}
        className="font-semibold text-[#FFF335] hover:underline"
      >
        {hostUsername}
      </a>
    </p>
  );
}
