interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedTabsProps<T extends string> {
  options: SegmentedOption<T>[];
  active: T;
  onChange: (value: T) => void;
}

export default function SegmentedTabs<T extends string>({ options, active, onChange }: SegmentedTabsProps<T>) {
  return (
    <div className="flex gap-2 mb-3">
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-1.5 rounded-[8px] px-4 py-2 font-display text-[13px] font-bold border transition-colors ${
              isActive
                ? "bg-white text-[#121212] border-white"
                : "bg-transparent text-[#AEAEB2] border-[#1F2023]"
            }`}
          >
            {option.label}
            {typeof option.count === "number" && (
              <span
                className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-[#121212] text-white" : "bg-[#1F2023] text-[#AEAEB2]"
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
