"use client";

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react";

type FeedFilterPendingValue = {
  isPending: boolean;
  startTransition: TransitionStartFunction;
};

const FeedFilterPendingContext = createContext<FeedFilterPendingValue | null>(null);

/**
 * Shares one filter-navigation transition between the filter bar and the
 * feed — they sit in sibling Suspense boundaries, so the pending flag has to
 * live in a common parent.
 */
export function FeedFilterPendingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <FeedFilterPendingContext.Provider value={{ isPending, startTransition }}>
      {children}
    </FeedFilterPendingContext.Provider>
  );
}

export function useFeedFilterPending(): FeedFilterPendingValue {
  const value = useContext(FeedFilterPendingContext);
  if (!value) {
    throw new Error("useFeedFilterPending must be used inside FeedFilterPendingProvider.");
  }
  return value;
}

/** Dims the feed and blocks taps while a filter change is loading. */
export function FeedPendingFrame({ children }: { children: ReactNode }) {
  const { isPending } = useFeedFilterPending();
  return (
    <div
      aria-busy={isPending || undefined}
      className={`transition-opacity duration-150 ${isPending ? "pointer-events-none opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}
