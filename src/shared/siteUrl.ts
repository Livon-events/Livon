/**
 * Canonical public origin for absolute URLs (Open Graph, invite links, etc.).
 *
 * Prefer NEXT_PUBLIC_SITE_URL in production (e.g. https://livon.live).
 * On Vercel previews, VERCEL_URL is used when the public site URL is unset.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
