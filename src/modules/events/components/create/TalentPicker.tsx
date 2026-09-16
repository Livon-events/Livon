"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { searchPeopleForTalent } from "@/modules/search";
import type { EventTalentProfile } from "@/modules/events";
import { AvatarImage } from "@/modules/users";

type TalentPickerProps = {
  value: EventTalentProfile[];
  onChange: (next: EventTalentProfile[]) => void;
  max: number;
};

export default function TalentPicker({ value, onChange, max }: TalentPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventTalentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSearch = query.trim().length >= 2 && value.length < max;

  useEffect(() => {
    const trimmed = query.trim();
    if (!canSearch) return;

    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void searchPeopleForTalent(trimmed)
        .then((people) => {
          if (!active) return;
          const selectedIds = new Set(value.map((talent) => talent.userId));
          setResults(
            people
              .filter((person) => !selectedIds.has(person.userId))
              .map((person) => ({
                ...person,
                tiktokUrl: null,
                instagramUrl: null,
                facebookUrl: null,
                youtubeUrl: null,
              }))
          );
        })
        .catch(() => {
          if (active) {
            setResults([]);
            setError("Could not search Talent right now.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [canSearch, query, value]);

  function addTalent(talent: EventTalentProfile) {
    if (value.length >= max || value.some((entry) => entry.userId === talent.userId)) return;
    onChange([...value, talent]);
    setQuery("");
    setResults([]);
  }

  function removeTalent(userId: string) {
    onChange(value.filter((talent) => talent.userId !== userId));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="talentSearch" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
          FEATURED TALENT <span className="text-[9px] font-semibold opacity-70">(OPTIONAL)</span>
        </label>
        <span className="text-[11px] font-semibold text-[#8e8e8e]">{value.length}/{max}</span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e8e]" />
        <input
          id="talentSearch"
          type="search"
          value={query}
          disabled={value.length >= max}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={value.length >= max ? "Talent limit reached" : "Search Livon accounts"}
          autoComplete="off"
          className="w-full rounded-[10px] border-2 border-[#262626] bg-[#0C0C0C] py-3 pl-11 pr-4 text-[15px] font-medium text-white outline-none transition focus:border-[#FFF335] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {value.map((talent) => (
            <li key={talent.userId} className="flex items-center gap-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
              <AvatarImage
                src={talent.avatarUrl}
                alt=""
                sizes="36px"
                className="h-9 w-9 shrink-0 rounded-full"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">@{talent.username}</span>
              <button
                type="button"
                onClick={() => removeTalent(talent.userId)}
                aria-label={`Remove ${talent.username}`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#a1a1a6] transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {canSearch && (loading || results.length > 0 || error) && (
        <div className="overflow-hidden rounded-xl border border-[#262626] bg-[#171717]">
          {loading && <p className="px-3 py-3 text-sm text-[#a1a1a6]">Searching Talent…</p>}
          {error && <p className="px-3 py-3 text-sm text-[#ff453a]">{error}</p>}
          {!loading && !error && results.map((talent) => (
            <button
              key={talent.userId}
              type="button"
              onClick={() => addTalent(talent)}
              className="flex w-full items-center gap-3 border-b border-[#262626] px-3 py-3 text-left last:border-b-0 hover:bg-white/5"
            >
              <AvatarImage
                src={talent.avatarUrl}
                alt=""
                sizes="40px"
                className="h-10 w-10 shrink-0 rounded-full"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">@{talent.username}</span>
                {talent.bio && <span className="block truncate text-xs text-[#a1a1a6]">{talent.bio}</span>}
              </span>
              <span className="text-lg font-bold text-[#FFF335]">+</span>
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[#8e8e8e]">Feature artists, creatives, and other people appearing at this event.</p>
    </div>
  );
}
