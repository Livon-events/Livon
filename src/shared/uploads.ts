/**
 * Client-side upload transport helpers. Used by events and users
 * `mutations.ts` so a weak uplink fails with an honest message instead of
 * a generic "Network error", and so those failures show up in Vercel logs.
 */

export const UPLOAD_TIMEOUT_MS = 60_000;

export async function fetchWithUploadTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = UPLOAD_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function messageForUploadFailure(error: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try again.";
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "The upload took too long and was stopped. Try again, or switch to mobile data.";
  }
  return "The upload was interrupted before it finished. This can happen on slow Wi-Fi — try again, or switch to mobile data.";
}

export type UploadFailureReport = {
  route: "/api/events" | "/api/events/[id]" | "/api/profile";
  errorName: string;
  originalBytes?: number;
  uploadedBytes?: number;
};

/**
 * Fire-and-forget beacon so client-side upload failures appear in Vercel
 * logs. Must never throw, and must not be awaited by callers — the payload
 * is a few hundred bytes, small enough to survive the uplink that killed
 * the original multipart POST.
 */
export function reportUploadFailure(report: UploadFailureReport): void {
  try {
    const body = JSON.stringify({
      route: report.route,
      errorName: report.errorName.slice(0, 64),
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      effectiveType: readEffectiveType(),
      originalBytes: report.originalBytes,
      uploadedBytes: report.uploadedBytes,
    });
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Ignore — reporting must never surface to the organizer.
    });
  } catch {
    // Ignore.
  }
}

function readEffectiveType(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string };
  }).connection;
  const value = connection?.effectiveType;
  return typeof value === "string" ? value.slice(0, 32) : undefined;
}

export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
