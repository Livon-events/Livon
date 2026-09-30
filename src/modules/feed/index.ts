export type { HomeFeedCursor, HomeFeedEvent, HomeFeedResult, WeekendEvent } from "./queries";
export { default as CategoryFilterBar } from "./components/CategoryFilterBar";
export { default as HomeFeed } from "./components/HomeFeed";
export { default as WeekendRail } from "./components/WeekendRail";

// getHomeFeed is never barrel-exported — queries.ts is server-only (uses
// next/headers). Import it directly:
//   import { getHomeFeed } from "@/modules/feed/queries";
