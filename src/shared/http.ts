import { NextResponse, type NextRequest } from "next/server";

/**
 * Generic Route Handler helpers. Extracted during the modular-monolith
 * restructuring — `isSameOriginRequest` and `jsonError` were copy-pasted
 * identically across `api/events/route.ts`, `api/events/[id]/route.ts`,
 * and `api/profile/route.ts`. This isn't events logic or profile logic,
 * it's generic request-handling infra, so it belongs in `shared/`, not in
 * any one module.
 */

/**
 * Generic result shape for server-only mutation functions (see
 * modules/events/serverMutations.ts, modules/users/serverMutations.ts).
 * Lives here rather than in one module's file so neither module has to
 * import from the other just to share this type.
 */
export type ServerMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Best-effort same-origin check as defense-in-depth against CSRF. Not a
 * full CSRF-token scheme, but combined with Supabase's SameSite auth
 * cookies it meaningfully raises the bar: a form or script hosted on
 * another origin that tries to submit here (using the victim's browser
 * cookies) will send an `Origin` header that fails this check.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  // Some legitimate same-origin requests omit Origin (older browsers,
  // certain non-CORS navigations) — only reject when it's present AND
  // mismatched, rather than requiring it outright.
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * Cheap pre-check on the declared Content-Length so an obviously-oversized
 * multipart request can be rejected before the body is read at all. The
 * authoritative size check still happens on the decoded file itself
 * inside each module's image-processing function (e.g.
 * `processEventCoverImage`, `processAvatarImage`) — this is only a fast
 * reject for the common case.
 */
export function exceedsDeclaredContentLength(request: NextRequest, maxBytes: number): boolean {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  return declaredLength > maxBytes;
}

/** Rejects anything that isn't a multipart/form-data request. */
export function isMultipartFormRequest(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().startsWith("multipart/form-data");
}
