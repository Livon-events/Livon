export type { HomeFeedCursor, HomeFeedEvent, HomeFeedResult } from "./queries";
export { default as CategoryFilterBar } from "./components/CategoryFilterBar";

// getHomeFeed is never barrel-exported — queries.ts is server-only (uses
// next/headers). Import it directly:
//   import { getHomeFeed } from "@/modules/feed/queries";
