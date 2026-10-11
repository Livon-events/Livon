import { z } from "zod";

/**
 * Ticket links are external purchase pages on one of these four Lesotho
 * ticketing sites — nothing else is accepted. The same allowlist is enforced
 * by the events_ticket_links_allowed CHECK constraint
 * (scripts/migrations/2026-10-event-ticket-links.sql), so keep them in sync.
 */
export const TICKET_PROVIDERS = [
  { id: "ecoticket", label: "EcoTicket", host: "ecoticket.co.ls" },
  { id: "ticketbox", label: "TicketBox", host: "ticketbox.co.ls" },
  { id: "mytag", label: "MyTag", host: "mytag.co.ls" },
  { id: "etickets", label: "eTickets", host: "etickets.co.ls" },
] as const;

export type TicketProvider = (typeof TICKET_PROVIDERS)[number];
export type TicketProviderId = TicketProvider["id"];

export type TicketLink = { provider: TicketProvider; url: string };

export const TICKET_LINKS_MAX = TICKET_PROVIDERS.length;
const TICKET_URL_MAX_LENGTH = 2_048;

/** Returns the normalized link when `value` is an allowed ticket URL, else null. */
export function parseTicketLink(value: string | null | undefined): TicketLink | null {
  if (!value || value.length > TICKET_URL_MAX_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    return null;
  }

  const host = parsed.hostname.startsWith("www.") ? parsed.hostname.slice(4) : parsed.hostname;
  const provider = TICKET_PROVIDERS.find((p) => p.host === host);
  if (!provider) return null;

  const url = parsed.href;
  if (url.length > TICKET_URL_MAX_LENGTH || url.includes("@")) return null;

  return { provider, url };
}

export function getTicketProvider(value: string | null | undefined): TicketProvider | null {
  return parseTicketLink(value)?.provider ?? null;
}

/** Render-time filter: drops anything not on the allowlist and keeps one link per provider. */
export function safeTicketLinks(values: readonly string[] | null | undefined): TicketLink[] {
  const seen = new Set<TicketProviderId>();
  const links: TicketLink[] = [];
  for (const value of values ?? []) {
    const link = parseTicketLink(value);
    if (!link || seen.has(link.provider.id)) continue;
    seen.add(link.provider.id);
    links.push(link);
  }
  return links;
}

/** Validates and normalizes submitted ticket URLs (empty strings are ignored). */
export const ticketLinksSchema = z
  .array(z.string())
  .transform((values, ctx) => {
    const links: string[] = [];
    const seen = new Set<TicketProviderId>();
    for (const raw of values) {
      if (raw.trim() === "") continue;
      const link = parseTicketLink(raw);
      if (!link) {
        ctx.addIssue({ code: "custom", message: "This ticket site isn't supported" });
        return z.NEVER;
      }
      if (seen.has(link.provider.id)) {
        ctx.addIssue({ code: "custom", message: `Only one ${link.provider.label} link is allowed` });
        return z.NEVER;
      }
      seen.add(link.provider.id);
      links.push(link.url);
    }
    if (links.length > TICKET_LINKS_MAX) {
      ctx.addIssue({ code: "custom", message: `At most ${TICKET_LINKS_MAX} ticket links are allowed` });
      return z.NEVER;
    }
    return links;
  });
