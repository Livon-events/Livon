import Link from "next/link";
import type { PeekPageData } from "@/modules/events/types";

type PeekPageProps = {
  data: PeekPageData;
};

/**
 * Converted from raw_html_and_css/peek/peek_list.html + .css. No client
 * interactivity needed here — "View Event" is a plain navigation, and the
 * connections list (per the FR and the mockup) isn't itself tappable — so
 * this stays a Server Component, unlike most of the event-card family.
 *
 * Per docs/FR/peek.md:
 * - Interests is always shown, as "{count}+", except a genuine zero which
 *   reads "Be the first to go" instead of "0+".
 * - The "Connections attending" section is omitted entirely (no count, no
 *   list, no empty state) when there are none — not just an empty list.
 * - "View Event" is always present regardless of the above.
 */
export default function PeekPage({ data }: PeekPageProps) {
  const { eventId, goingCount, attendingConnections } = data;
  const hasAttendingConnections = attendingConnections.length > 0;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-[min(calc(100%-24px),798px)] flex-col gap-6 py-5 sm:w-[min(calc(100%-48px),798px)]">
        <Link
          href={`/events/${eventId}`}
          className="w-full rounded-md border-2 border-[#FFEA00] py-3 text-center text-lg font-bold text-[#FFEA00] transition-transform active:scale-[0.98]"
        >
          View Event
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-[32px] font-extrabold tracking-[-0.5px]">Interests</h1>
          <span className="flex h-6 min-w-[40px] items-center justify-center whitespace-nowrap rounded bg-[#1F2023] px-2.5 text-sm font-bold text-white">
            {goingCount === 0 ? "Be the first to go" : `${goingCount}+`}
          </span>
        </div>

        {hasAttendingConnections && (
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-[15px] font-bold capitalize text-[#AEAEB2]">
                Connections attending
              </span>
              <span className="flex h-6 min-w-[40px] items-center justify-center rounded bg-[#1F2023] px-2.5 text-sm font-bold text-white">
                {attendingConnections.length}
              </span>
            </div>
            <div className="mb-2 h-px w-full bg-[#262626]" />
            <div className="flex flex-col">
              {attendingConnections.map((person) => (
                <div key={person.userId} className="flex items-center gap-3.5 py-3">
                  <div
                    className="h-11 w-11 shrink-0 rounded-full bg-[#d11a8c] bg-cover bg-center"
                    style={person.avatarUrl ? { backgroundImage: `url(${person.avatarUrl})` } : undefined}
                  />
                  <span className="text-base font-semibold text-white">@{person.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
