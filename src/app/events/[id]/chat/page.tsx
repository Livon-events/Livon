import type { Metadata } from "next";
import Link from "next/link";

type EventChatPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Chat",
};

// Placeholder destination for the event chat button — the feature itself
// isn't built yet, this page exists to measure whether people tap through.
export default async function EventChatPage({ params }: EventChatPageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#121212] text-white">
      <div className="mx-auto flex w-[min(calc(100%-24px),798px)] flex-col items-center gap-6 py-20 text-center sm:w-[min(calc(100%-48px),798px)]">
        <h1 className="text-[32px] font-extrabold tracking-[-0.5px]">Chat is in the works</h1>
        <p className="max-w-[420px] text-base text-[#AEAEB2]">
          Still building it — check back soon.
        </p>
        <Link
          href={`/events/${id}`}
          className="w-full max-w-[320px] rounded-md border-2 border-[#FFF335] py-3 text-lg font-bold text-[#FFF335] transition-transform active:scale-[0.98]"
        >
          Back to event
        </Link>
      </div>
    </main>
  );
}
