"use client";

import { useState, type ReactNode } from "react";
import { recordRailTabClick, type RailTab } from "@/shared/analytics/recordClicks";

export type EventRailTab = {
  id: string;
  label: string;
  /** Server-rendered EventRailList. */
  content: ReactNode;
  /** Logged to rail_tab_clicks when the user switches to this tab. */
  analyticsKey?: RailTab;
};

type EventRailTabsProps = {
  tabs: EventRailTab[];
};

/**
 * Toggle between home rails ("This weekend" / "Recently added"). Both lists
 * arrive server-rendered; inactive panels stay mounted but `hidden`, so
 * switching is instant, keeps each list's scroll position, and their lazy
 * cover images don't load until the panel is shown.
 */
export default function EventRailTabs({ tabs }: EventRailTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);

  if (tabs.length === 0) return null;

  // Only real switches are logged; not awaited so tracking never delays the UI.
  const selectTab = (tab: EventRailTab) => {
    if (tab.id === activeId) return;
    setActiveId(tab.id);
    if (tab.analyticsKey) void recordRailTabClick({ tab: tab.analyticsKey });
  };

  return (
    <section aria-label="Featured events" className="w-full bg-[#0C0C0C] pb-2">
      {/* Underline tabs: a grey track across the full width, with a thicker
          yellow bar under the selected tab — unlike the category chips below. */}
      <div className="mx-auto max-w-[1400px] px-3 pb-3 lg:px-6">
        <div
          role="tablist"
          aria-label="Featured events"
          className="flex w-full border-b-2 border-[#3A3A3C] md:max-w-[520px]"
        >
          {tabs.map((tab) => {
            const selected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`${tab.id}Tab`}
                aria-selected={selected}
                aria-controls={`${tab.id}Panel`}
                onClick={() => selectTab(tab)}
                className={`relative flex-1 whitespace-nowrap px-4 pb-3 pt-2 text-[16px] font-bold transition-colors ${
                  selected ? "text-white" : "text-[#A1A1A6] hover:text-white"
                }`}
              >
                {tab.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 -bottom-[2px] h-[3px] transition-colors ${
                    selected ? "bg-[#FFF335]" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${tab.id}Panel`}
          aria-labelledby={`${tab.id}Tab`}
          hidden={tab.id !== activeId}
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}
