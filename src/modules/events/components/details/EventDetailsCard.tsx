import { MapPin } from "lucide-react";
import { getPriceLabel, getEventDateTimeLabel } from "@/modules/events/format";
import { getPricePhaseEndLabel } from "@/modules/events/pricePhases";
import type { EventDetails } from "@/modules/events/queries";
import PosterViewer from "./PosterViewer";
import EventHostLine from "../card/EventHostLine";

type EventDetailsCardProps = {
  event: EventDetails;
};

// The yellow-bordered card in the reference mockup. Shows a time range
// when the organizer has set an end time; otherwise start time only.
export default function EventDetailsCard({ event }: EventDetailsCardProps) {
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const dateTimeLabel = getEventDateTimeLabel(new Date(event.startsAt), endsAt);

  return (
    <div className="overflow-hidden rounded-lg border-2 border-[#FFF335]">
      {/* Poster — 4px gap from the card border on all sides, matching the
          mockup's .poster-wrap/.poster treatment. */}
      <div className="bg-[#0C0C0C] p-1">
        {event.coverImageUrl ? (
          <PosterViewer src={event.coverImageUrl} alt={event.title} />
        ) : (
          <div className="relative aspect-[16/7] min-h-[180px] w-full overflow-hidden rounded-md bg-[#3A3A3C] sm:min-h-[220px]" />
        )}
      </div>

      <div className="px-2 pb-4 pt-3 sm:px-4 sm:pt-[18px]">
        <h1 className="line-clamp-2 text-2xl font-extrabold leading-tight sm:text-[32px]">
          {event.title}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-[#d1d5db] sm:mt-3 sm:text-sm">
          <span className="font-semibold text-white">{dateTimeLabel}</span>
        </div>

        <div className="mt-1 flex items-center gap-1 text-xs text-[#9ca3af] sm:mt-1.5 sm:text-sm">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">
            {event.venueName}, {event.area}
          </span>
        </div>

        <div className="mt-2 sm:mt-2.5">
          <EventHostLine
            isClaimable={event.isClaimable}
            hostUsername={event.hostUsername}
          />
        </div>

        <div className="mt-5 flex items-center justify-between sm:mt-7">
          <span className="rounded bg-[#242424] px-2.5 py-2 text-xs font-extrabold text-[#e5e7eb] sm:px-3.5 sm:text-sm">
            {event.categoryName}
          </span>
          <span className="text-2xl font-extrabold text-[#FFF335] sm:text-[32px]">
            {getPriceLabel(event.price)}
          </span>
        </div>

        {(event.pricePhases.length > 0 || event.gatePrice !== null) && (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-[#262626] pt-3 text-xs sm:text-sm">
            {event.pricePhases.map((phase, index) => (
              <PriceScheduleRow
                key={index}
                label={phase.label ?? `Phase ${index + 1}`}
                detail={`${getPriceLabel(phase.price)} · ${
                  phase.until ? `until ${getPricePhaseEndLabel(phase.until)}` : "until the event"
                }`}
                state={
                  event.isGatePriceNow || index < event.currentPricePhaseIndex
                    ? "past"
                    : index === event.currentPricePhaseIndex
                      ? "current"
                      : "upcoming"
                }
              />
            ))}
            {event.gatePrice !== null && (
              <PriceScheduleRow
                label="At the gate"
                detail={getPriceLabel(event.gatePrice)}
                state={event.isGatePriceNow ? "current" : "upcoming"}
              />
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function PriceScheduleRow({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: "past" | "current" | "upcoming";
}) {
  const isPast = state === "past";
  return (
    <li
      className={`flex items-center justify-between gap-3 ${
        state === "current" ? "font-bold text-white" : isPast ? "text-[#6b7280]" : "text-[#9ca3af]"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={`truncate ${isPast ? "line-through" : ""}`}>{label}</span>
        {state === "current" && (
          <span className="shrink-0 rounded bg-[#FFF335] px-1.5 py-0.5 text-[10px] font-extrabold text-[#0C0C0C]">
            NOW
          </span>
        )}
      </span>
      <span className={`shrink-0 ${isPast ? "line-through" : ""}`}>{detail}</span>
    </li>
  );
}
