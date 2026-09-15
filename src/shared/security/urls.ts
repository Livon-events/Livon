const LOCAL_URL_BASE = "https://livon.invalid";
const MAX_IMAGE_URL_LENGTH = 2_048;

/**
 * Returns a same-origin path or the supplied fallback.
 *
 * Parsing against a fixed base catches protocol-relative URLs and backslash
 * variants that simple `startsWith("/")` checks can miss.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, LOCAL_URL_BASE);
    if (parsed.origin !== LOCAL_URL_BASE) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Normalizes image URLs before placing them in an HTML/CSS URL context.
 * Persisted images must be HTTPS or same-origin; blob URLs are accepted for
 * local upload previews. Other schemes (including data/javascript) fail shut.
 */
export function safeImageUrl(value: string | null | undefined): string | null {
  if (!value || value.length > MAX_IMAGE_URL_LENGTH) return null;

  try {
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
      const parsed = new URL(value, LOCAL_URL_BASE);
      if (parsed.origin !== LOCAL_URL_BASE) return null;
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    const parsed = new URL(value);
    if (parsed.protocol === "blob:") return parsed.href;
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Produces a quoted CSS url() value from a normalized URL. URL parsing
 * percent-encodes quote characters before interpolation.
 */
export function safeBackgroundImage(value: string | null | undefined): string | undefined {
  const safe = safeImageUrl(value);
  return safe ? `url("${safe}")` : undefined;
}
