"use client";

import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EventCardGrid } from "@/modules/events";
import type { HomeFeedCursor, HomeFeedEvent, HomeFeedResult } from "@/modules/feed";

type HomeFeedProps = {
  initial: HomeFeedResult;
};

export default function HomeFeed({ initial }: HomeFeedProps) {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<HomeFeedEvent[]>(initial.events);
  const [nextCursor, setNextCursor] = useState<HomeFeedCursor | null>(initial.nextCursor);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    const category = searchParams.get("category");
    const free = searchParams.get("free");
    if (category) params.set("category", category);
    if (free === "1" || free === "true") params.set("free", "1");
    params.set("rankScore", String(nextCursor.rankScore));
    params.set("totalGoingCount", String(nextCursor.totalGoingCount));
    params.set("startsAt", nextCursor.startsAt);
    params.set("eventId", nextCursor.eventId);

    try {
      const res = await fetch(`/api/feed?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not load more events.");
      }
      const page = (await res.json()) as HomeFeedResult;
      setEvents((prev) => [...prev, ...page.events]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more events.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [nextCursor, searchParams]);

  if (events.length === 0) {
    return (
      <p className="mx-auto max-w-[1400px] px-3 py-10 text-center text-[15px] text-[#8e8e8e] lg:px-6">
        No events right now.
      </p>
    );
  }

  return (
    <div>
      <EventCardGrid events={events} />
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-2 px-3 py-6 lg:px-6">
        {nextCursor ? (
          <>
            <button
              type="button"
              onClick={() => {
                void loadMore();
              }}
              disabled={isLoading}
              className="rounded-[10px] bg-[#1F2023] px-6 py-3 font-display text-[15px] font-bold text-white disabled:opacity-60"
            >
              {isLoading ? "Loading…" : "Load more"}
            </button>
            {error ? (
              <p className="text-center text-[13px] text-[#ff453a]" role="alert">
                {error}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-center text-[15px] text-[#8e8e8e]">You&apos;re all caught up</p>
        )}
      </div>
    </div>
  );
}
