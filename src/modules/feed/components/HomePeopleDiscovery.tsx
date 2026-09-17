"use client";

import Link from "next/link";
import { useState } from "react";
import { Zap } from "lucide-react";
import type { HomePeopleDiscoveryResult } from "@/modules/feed";
import { AvatarImage } from "@/modules/users";
import { recordDiscoveryPersonClick } from "@/shared/analytics/recordClicks";

type Mode = "talent" | "makers";

type HomePeopleDiscoveryProps = {
  discovery: HomePeopleDiscoveryResult;
};

const COPY: Record<Mode, { active: string; inactive: string; subtitle: string }> = {
  talent: {
    active: "The Talent",
    inactive: "The Makers",
    subtitle: "Discover artists and creatives appearing at upcoming events",
  },
  makers: {
    active: "The Makers",
    inactive: "The Talent",
    subtitle: "Discover the people and teams creating upcoming events",
  },
};

export default function HomePeopleDiscovery({ discovery }: HomePeopleDiscoveryProps) {
  const hasTalent = discovery.talent.length > 0;
  const hasMakers = discovery.makers.length > 0;
  const [mode, setMode] = useState<Mode>(hasTalent ? "talent" : "makers");

  if (!hasTalent && !hasMakers) return null;

  const canToggle = hasTalent && hasMakers;
  const people = discovery[mode];
  const copy = COPY[mode];

  return (
    <section className="mx-auto mb-5 w-full max-w-[1400px] overflow-hidden px-3 lg:mb-7 lg:px-6" aria-labelledby="home-discovery-heading">
      {canToggle ? (
        <button
          type="button"
          onClick={() => setMode((current) => (current === "talent" ? "makers" : "talent"))}
          aria-label={`Switch to ${copy.inactive}`}
          className="group flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#FFF335]"
        >
          <span id="home-discovery-heading" className="text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
            {copy.active}
          </span>
          <span className="text-lg font-bold leading-none text-[#636366]" aria-hidden="true">
            ›
          </span>
          <span className="text-sm font-bold text-[#AEAEB2] group-hover:text-white sm:text-base">
            {copy.inactive}
          </span>
        </button>
      ) : (
        <h2 id="home-discovery-heading" className="text-2xl font-extrabold tracking-tight text-white sm:text-[28px]">
          {copy.active}
        </h2>
      )}

      <p className="mt-0.5 max-w-md text-sm leading-tight text-[#a1a1a6]">{copy.subtitle}</p>

      <div className="-mx-3 mt-3 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:-mx-6 lg:px-6">
        <ul className="flex w-max snap-x snap-mandatory gap-3 pb-1">
          {people.map((person) => (
            <li key={person.userId} className="w-[min(calc(100vw-3rem),22rem)] shrink-0 snap-start">
              <Link
                href={`/users/${encodeURIComponent(person.username)}`}
                onClick={() => {
                  void recordDiscoveryPersonClick({
                    targetUserId: person.userId,
                    section: mode,
                  });
                }}
                className="group relative block aspect-square overflow-hidden rounded-xl bg-[#3A3A3C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF335]"
              >
                {person.avatarUrl && (
                  <span className="absolute inset-0">
                    <AvatarImage
                      src={person.avatarUrl}
                      alt=""
                      sizes="(max-width: 400px) calc(100vw - 3rem), 352px"
                      className="h-full w-full"
                    />
                  </span>
                )}
                <span className="absolute inset-x-2 bottom-2 flex items-center rounded-full border-2 border-white bg-[#0C0C0C] py-0.5 pl-3 pr-0.5">
                  <span className="min-w-0 flex-1 truncate text-center text-[13px] font-extrabold text-white">
                    {person.username}
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF335]"
                  >
                    <Zap
                      className="h-5 w-5 text-[#0C0C0C]"
                      fill="currentColor"
                      strokeWidth={0}
                    />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
