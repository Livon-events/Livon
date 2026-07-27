export type { EventSearchResult, PersonSearchResult } from "./queries";
export { useHeaderSearch } from "./hooks/useHeaderSearch";
export { default as SearchResults } from "./components/SearchResults";
export { default as EventResultCard } from "./components/EventResultCard";
export { default as PersonResultCard } from "./components/PersonResultCard";

// searchEvents / searchPeople are never barrel-exported — queries.ts is
// server-only (uses next/headers). Import directly:
//   import { searchEvents, searchPeople } from "@/modules/search/queries";
