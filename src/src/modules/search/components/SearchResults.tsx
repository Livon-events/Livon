import EventResultCard from "./EventResultCard";
import PersonResultCard from "./PersonResultCard";
import type { EventSearchResult, PersonSearchResult } from "@/modules/search/queries";

type SearchResultsProps = {
  query: string;
  events: EventSearchResult[];
  people: PersonSearchResult[];
};

const MIN_QUERY_LENGTH = 2;

// Pure results view — the actual search input lives in the header
// (AppHeader / DesktopHeader via useHeaderSearch), not here, per the
// decision not to duplicate a second search bar on this page.
export default function SearchResults({ query, events, people }: SearchResultsProps) {
  const hasSearched = query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="mx-auto min-h-screen w-full max-w-[700px] px-4 pb-24 pt-24">
      {!hasSearched && (
        <p className="mt-10 text-center text-[14px] text-[#6e6e73]">
          Search for events or people using the search bar above.
        </p>
      )}

      {hasSearched && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#8e8e93]">
              Events
            </h2>
            {events.length === 0 ? (
              <p className="text-[14px] text-[#6e6e73]">No events found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {events.map((event) => (
                  <EventResultCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#8e8e93]">
              People
            </h2>
            {people.length === 0 ? (
              <p className="text-[14px] text-[#6e6e73]">No people found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {people.map((person) => (
                  <PersonResultCard key={person.userId} person={person} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
