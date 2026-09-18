"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const nextCursorRef = useRef(nextCursor);
  const errorRef = useRef(error);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => Promise<void>>(async () => {});

  nextCursorRef.current = nextCursor;
  errorRef.current = error;

  const loadMore = useCallback(async () => {
    const cursor = nextCursorRef.current;
    if (!cursor || loadingRef.current || errorRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    const category = searchParams.get("category");
    const free = searchParams.get("free");
    if (category) params.set("category", category);
    if (free === "1" || free === "true") params.set("free", "1");
    params.set("rankScore", String(cursor.rankScore));
    params.set("totalGoingCount", String(cursor.totalGoingCount));
    params.set("startsAt", cursor.startsAt);
    params.set("eventId", cursor.eventId);

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
  }, [searchParams]);

  loadMoreRef.current = loadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreRef.current();
        }
      },
      // Modest prefetch — avoids mid-fling spam on low-end while still feeling automatic.
      { root: null, rootMargin: "120px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor]);

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
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
            {isLoading ? (
              <p className="text-center text-[15px] text-[#8e8e8e]">Loading…</p>
            ) : null}
            {error ? (
              <>
                <p className="text-center text-[13px] text-[#ff453a]" role="alert">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    errorRef.current = null;
                    setError(null);
                    void loadMore();
                  }}
                  className="rounded-[10px] bg-[#1F2023] px-6 py-3 font-display text-[15px] font-bold text-white"
                >
                  Try again
                </button>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-center text-[15px] text-[#8e8e8e]">You&apos;re all caught up</p>
        )}
      </div>
    </div>
  );
}
