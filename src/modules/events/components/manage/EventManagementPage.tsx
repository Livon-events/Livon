"use client";

import EventDateMetric from "./EventDateMetric";
import AttendingCountMetric from "./AttendingCountMetric";
import SharesCountMetric from "./SharesCountMetric";
import ViewsCountMetric from "./ViewsCountMetric";
import GuestlistSection from "./GuestlistSection";
import type { GuestlistAttendee } from "./GuestlistRow";

export interface EventManagementPageProps {
  dateLabel?: string;
  attendingCount?: number;
  sharesCount?: number;
  viewsCount?: number;
  attendees?: GuestlistAttendee[];
}

export default function EventManagementPage({
  dateLabel = "Dec 25, 2026",
  attendingCount = 15,
  sharesCount = 2,
  viewsCount = 0,
  attendees,
}: EventManagementPageProps) {
  return (
    <main className="min-h-screen bg-[#121212] text-white font-sans">
      <div className="mx-auto w-[min(calc(100%-24px),798px)] sm:w-[min(calc(100%-48px),798px)] flex flex-col pt-4 pb-24 sm:pb-12">
        {/* Section Title */}
        <div className="mb-2 sm:mb-4">
          <h1 className="text-2xl sm:text-[32px] font-extrabold text-white tracking-[-0.5px]">
            Event management
          </h1>
          <div className="w-full h-px bg-white/30 mt-3 mb-4 sm:mb-6" />
        </div>

        {/* Metrics */}
        <div className="flex flex-col">
          {/* Metric 1: Event Date display */}
          <EventDateMetric dateLabel={dateLabel} />

          {/* Metric 2: Interested Count */}
          <AttendingCountMetric count={attendingCount} />

          {/* Metric 3: Unique view count */}
          <ViewsCountMetric count={viewsCount} />

          {/* Metric 4: Shares Count */}
          <SharesCountMetric count={sharesCount} />

          {/* Metrics Divider */}
          <div className="w-full h-px bg-white/20 my-3 sm:my-4" />

          {/* Guestlist */}
          <GuestlistSection attendees={attendees} />
        </div>
      </div>
    </main>
  );
}
