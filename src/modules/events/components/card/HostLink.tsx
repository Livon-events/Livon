"use client";

import { useRouter } from "next/navigation";

interface HostLinkProps {
  username: string;
}

/**
 * The event card (EventCard.tsx) is itself one big <Link>, so the host
 * name can't just be a nested <a> — invalid HTML, and it'd fire both
 * navigations. This stops the outer Link's click (same
 * preventDefault/stopPropagation pattern EventCardActions already uses
 * for its buttons) and navigates itself instead, to the username
 * resolver (`/u/[username]` -> `/profile/[userId]`, see that route's
 * header comment for why it's not a direct user_id link here).
 */
export default function HostLink({ username }: HostLinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/users/${encodeURIComponent(username)}`);
  };

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={handleClick}
      className="font-bold text-[#FFF335] underline-offset-2 hover:underline"
    >
      {username}
    </span>
  );
}
