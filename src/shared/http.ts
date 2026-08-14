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

/** Accepts the small JSON event payload used after client-side downscale. */
export function isJsonRequest(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().startsWith("application/json");
}

type FileFieldOption = { maxBytes: number };

/**
 * Reads either legacy multipart or the JSON body the current client sends.
 * JSON file fields are `{ name, type, data }` where `data` is standard
 * base64 — reconstructed into a `File` so `createEventOnServer` /
 * `updateEventOnServer` stay unchanged.
 */
export async function readJsonOrMultipartFormData(
  request: NextRequest,
  options: {
    maxMultipartBytes: number;
    maxJsonBytes: number;
    fileFields: Record<string, FileFieldOption>;
  }
): Promise<{ ok: true; formData: FormData } | { ok: false; error: string; status: number }> {
  const isMultipart = isMultipartFormRequest(request);
  const isJson = isJsonRequest(request);
  if (!isMultipart && !isJson) {
    return { ok: false, error: "Invalid request format.", status: 400 };
  }

  const maxBytes = isMultipart ? options.maxMultipartBytes : options.maxJsonBytes;
  if (exceedsDeclaredContentLength(request, maxBytes)) {
    return { ok: false, error: "Request is too large.", status: 413 };
  }

  if (isMultipart) {
    try {
      return { ok: true, formData: await request.formData() };
    } catch {
      return { ok: false, error: "Could not read the submitted form.", status: 400 };
    }
  }

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return { ok: false, error: "Could not read the submitted form.", status: 400 };
  }

  return jsonToFormData(value, options.fileFields);
}

function jsonToFormData(
  value: unknown,
  fileFields: Record<string, FileFieldOption>
): { ok: true; formData: FormData } | { ok: false; error: string; status: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Could not read the submitted form.", status: 400 };
  }

  const formData = new FormData();
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    const fileOption = fileFields[key];
    if (fileOption) {
      const file = decodeJsonFile(field, fileOption.maxBytes);
      if (file && "ok" in file) return file;
      if (file) formData.set(key, file);
      continue;
    }

    if (field === null || field === undefined) continue;
    if (typeof field === "string" || typeof field === "number") {
      formData.set(key, String(field));
      continue;
    }
    return { ok: false, error: "Could not read the submitted form.", status: 400 };
  }

  return { ok: true, formData };
}

function decodeJsonFile(
  value: unknown,
  maxBytes: number
): File | { ok: false; error: string; status: number } | null {
  if (value === null || value === undefined || value === "") return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Invalid file upload.", status: 400 };
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.data !== "string" || raw.data.length === 0) {
    return { ok: false, error: "Invalid file upload.", status: 400 };
  }

  let base64 = raw.data;
  const dataUrl = base64.indexOf("base64,");
  if (base64.startsWith("data:") && dataUrl !== -1) {
    base64 = base64.slice(dataUrl + "base64,".length);
  }
  base64 = base64.replace(/\s+/g, "");

  const maxBase64Chars = Math.ceil(maxBytes / 3) * 4 + 4;
  if (base64.length > maxBase64Chars) {
    return { ok: false, error: "Request is too large.", status: 413 };
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return { ok: false, error: "Invalid file upload.", status: 400 };
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Could not read the uploaded photo.", status: 400 };
  }

  if (bytes.length === 0) {
    return { ok: false, error: "Invalid file upload.", status: 400 };
  }
  if (bytes.length > maxBytes) {
    return { ok: false, error: "Request is too large.", status: 413 };
  }

  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "cover";
  const type = typeof raw.type === "string" ? raw.type : "application/octet-stream";
  return new File([new Uint8Array(bytes)], name, { type });
}
