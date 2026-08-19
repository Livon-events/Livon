import { Eye } from "lucide-react";

interface ViewsCountMetricProps {
  count?: number;
}

export default function ViewsCountMetric({ count = 0 }: ViewsCountMetricProps) {
  return (
    <div className="flex items-center justify-between py-2.5 sm:py-3 text-sm sm:text-base">
      <div className="flex items-center gap-3 text-gray-300">
        <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2]" />
        <span className="text-[#AEAEB2] text-xs sm:text-sm font-normal">Views</span>
      </div>
      <span className="text-white font-bold text-xs sm:text-sm">{count}</span>
    </div>
  );
}
