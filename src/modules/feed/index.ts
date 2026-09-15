export type { HomeFeedCursor, HomeFeedEvent, HomeFeedResult, HomeDiscoveryPerson, HomePeopleDiscoveryResult } from "./queries";
export { default as CategoryFilterBar } from "./components/CategoryFilterBar";
export { default as HomePeopleDiscovery } from "./components/HomePeopleDiscovery";

// getHomeFeed is never barrel-exported — queries.ts is server-only (uses
// next/headers). Import it directly:
//   import { getHomeFeed } from "@/modules/feed/queries";
