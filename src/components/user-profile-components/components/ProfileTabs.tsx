import type { ProfileMainTab } from "../types/profile";

interface ProfileTabsProps {
  active: ProfileMainTab;
  onChange: (tab: ProfileMainTab) => void;
  connectionsCount: number;
  eventsCount: number;
}

export default function ProfileTabs({ active, onChange, connectionsCount, eventsCount }: ProfileTabsProps) {
  return (
    <div className="flex bg-[#17181A] rounded-xl p-1 mb-4">
      <button
        type="button"
        onClick={() => onChange("connections")}
        className={`flex-1 flex items-center justify-center gap-2 rounded-[9px] py-3 font-display text-[15px] font-bold cursor-pointer ${
          active === "connections" ? "bg-black text-white" : "bg-transparent text-[#AEAEB2]"
        }`}
      >
        Connections
        <span className="bg-[#FFE600] text-black text-[13px] font-extrabold px-2 py-0.5 rounded-full">
          {connectionsCount}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("events")}
        className={`flex-1 flex items-center justify-center gap-2 rounded-[9px] py-3 font-display text-[15px] font-bold cursor-pointer ${
          active === "events" ? "bg-black text-white" : "bg-transparent text-[#AEAEB2]"
        }`}
      >
        Events
        <span className="bg-[#FFE600] text-black text-[13px] font-extrabold px-2 py-0.5 rounded-full">
          {eventsCount}
        </span>
      </button>
    </div>
  );
}
