export type {
  HomeFeedCursor,
  HomeFeedEvent,
  HomeFeedResult,
  RailEvent,
  RecentEvent,
  WeekendEvent,
} from "./queries";
export { default as CategoryFilterBar } from "./components/CategoryFilterBar";
export { default as HomeFeed } from "./components/HomeFeed";
export { default as EventRailList } from "./components/EventRailList";
export { default as EventRailTabs, type EventRailTab } from "./components/EventRailTabs";

// getHomeFeed is never barrel-exported — queries.ts is server-only (uses
// next/headers). Import it directly:
//   import { getHomeFeed } from "@/modules/feed/queries";
