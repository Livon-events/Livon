import { searchEvents, searchPeople } from "@/lib/queries/search";
import SearchResults from "@/components/search/SearchResults";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

const MIN_QUERY_LENGTH = 2;

// The search input itself lives in the header (see useHeaderSearch,
// AppHeader, DesktopHeader) and navigates here as the person types —
// this page is purely a results view for whatever `?q=` is in the URL,
// so there's exactly one search bar in the whole app, not two.
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [events, people] =
    query.length >= MIN_QUERY_LENGTH
      ? await Promise.all([searchEvents(query), searchPeople(query)])
      : [[], []];

  return <SearchResults query={query} events={events} people={people} />;
}
