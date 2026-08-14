import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest, exceedsDeclaredContentLength, jsonError } from "@/shared/http";
import { checkRateLimit } from "@/shared/security/rateLimit";

/**
 * Accepts a tiny JSON beacon from the browser when a multipart upload
 * fails before any HTTP response arrives. Those failures never show up
 * under `route:/api/events`, which is why the Wi-Fi publish issue had to
 * be inferred from absent log lines — this endpoint makes them visible.
 *
 * No PII. No auth required (the beacon has to outlive a failing upload).
 * Same-origin + a tight body cap + a per-IP rate limit are the guards.
 */
const MAX_BODY_BYTES = 512;
const ALLOWED_ROUTES = new Set(["/api/events", "/api/events/[id]", "/api/profile"]);

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Request rejected.", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonError("Invalid request format.", 400);
  }

  if (exceedsDeclaredContentLength(request, MAX_BODY_BYTES)) {
    return jsonError("Request is too large.", 413);
  }

  const ip = clientIp(request);
  if (
    !checkRateLimit(`client-error:${ip}`, {
      maxRequests: 20,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return jsonError("Too many requests.", 429);
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return jsonError("Could not read the request.", 400);
  }

  if (text.length > MAX_BODY_BYTES) {
    return jsonError("Request is too large.", 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonError("Invalid request format.", 400);
  }

  const report = sanitizeReport(parsed);
  if (!report) {
    return jsonError("Invalid request format.", 400);
  }

  console.warn("[client-error]", JSON.stringify(report));
  return new NextResponse(null, { status: 204 });
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "unknown";
}

function sanitizeReport(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.route !== "string" || !ALLOWED_ROUTES.has(raw.route)) return null;
  if (typeof raw.errorName !== "string") return null;

  const errorName = raw.errorName.replace(/[^\w.-]/g, "").slice(0, 64);
  if (!errorName) return null;

  const report: Record<string, unknown> = {
    route: raw.route,
    errorName,
  };

  if (typeof raw.online === "boolean") report.online = raw.online;

  if (typeof raw.effectiveType === "string") {
    const effectiveType = raw.effectiveType.replace(/[^\w.-]/g, "").slice(0, 32);
    if (effectiveType) report.effectiveType = effectiveType;
  }

  const originalBytes = asNonNegativeInt(raw.originalBytes);
  if (originalBytes !== undefined) report.originalBytes = originalBytes;

  const uploadedBytes = asNonNegativeInt(raw.uploadedBytes);
  if (uploadedBytes !== undefined) report.uploadedBytes = uploadedBytes;

  return report;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.min(Math.round(value), 20 * 1024 * 1024);
}
