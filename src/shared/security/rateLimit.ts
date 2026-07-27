/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * This is a best-effort spam guard, not a hard security boundary: it's
 * per-process state, so it resets on redeploy and does not coordinate
 * across multiple server instances. That's an acceptable tradeoff for
 * "stop a script from hammering /api/events", but if this app ever runs
 * on more than one instance, replace this with a shared store (e.g.
 * Postgres-backed via a Supabase RPC, or Upstash Redis) keyed the same way.
 */

type Bucket = {
  count: number;
  windowStartMs: number;
};

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so `buckets` doesn't grow unbounded — runs at most
// once per call, only when the map has grown past a threshold.
function pruneIfNeeded(nowMs: number, windowMs: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (nowMs - bucket.windowStartMs > windowMs) {
      buckets.delete(key);
    }
  }
}

/**
 * Returns true if the caller identified by `key` is within limit, false if
 * they've exceeded `maxRequests` within the current `windowMs` window.
 */
export function checkRateLimit(
  key: string,
  { maxRequests, windowMs }: { maxRequests: number; windowMs: number }
): boolean {
  const now = Date.now();
  pruneIfNeeded(now, windowMs);

  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartMs > windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return true;
  }

  if (existing.count >= maxRequests) {
    return false;
  }

  existing.count += 1;
  return true;
}
