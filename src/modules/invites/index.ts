export { useShareEvent } from "./hooks/useShareEvent";
export type { ShareLinkResult } from "./mutations";

// getShareLink is not barrel-exported — it's only ever meant to be called
// from useShareEvent, same convention as rsvp/queries.ts staying
// direct-import-only. Import it directly if a future caller needs it:
//   import { getShareLink } from "@/modules/invites/mutations";
