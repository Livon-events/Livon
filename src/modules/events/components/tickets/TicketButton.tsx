"use client";

import { useMemo, useState } from "react";
import { safeTicketLinks, type TicketLink } from "@/modules/events/ticketLinks";
import TicketChooserModal from "./TicketChooserModal";

type TicketButtonProps = {
  eventId: string;
  links: string[];
  className: string;
  iconClassName?: string;
};

function DollarCircleIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} fill="currentColor" aria-hidden="true">
      <path d="M 45 0 C 20.147 0 0 20.147 0 45 c 0 24.853 20.147 45 45 45 s 45 -20.147 45 -45 C 90 20.147 69.853 0 45 0 z M 42.746 38.786 c 0.809 0.838 2.11 1.638 3.902 2.399 c 1.792 0.761 3.482 1.551 5.072 2.37 c 1.589 0.819 2.962 1.748 4.119 2.789 c 1.156 1.04 2.061 2.255 2.716 3.642 c 0.655 1.387 0.983 3.054 0.983 4.999 c 0 3.295 -1.045 5.983 -3.136 8.064 c -2.091 2.081 -4.937 3.295 -8.54 3.641 v 5.81 h -4.595 v -5.838 c -4.201 -0.444 -7.423 -1.883 -9.668 -4.321 c -2.245 -2.437 -3.367 -5.65 -3.367 -9.638 h 9.74 c 0 2.197 0.486 3.869 1.459 5.014 c 0.973 1.147 2.356 1.72 4.148 1.72 c 1.310 0 2.341 -0.39 3.093 -1.171 c 0.75 -0.78 1.127 -1.853 1.127 -3.222 c 0 -1.522 -0.376 -2.716 -1.127 -3.584 c -0.752 -0.867 -2.072 -1.686 -3.96 -2.456 c -1.889 -0.77 -3.632 -1.551 -5.231 -2.341 c -1.599 -0.79 -2.977 -1.706 -4.133 -2.746 c -1.156 -1.04 -2.043 -2.245 -2.659 -3.614 c -0.617 -1.367 -0.925 -3.024 -0.925 -4.971 c 0 -3.256 1.098 -5.939 3.295 -8.049 c 2.196 -2.11 5.125 -3.338 8.786 -3.685 V 17.5 h 4.596 v 6.214 c 3.525 0.521 6.295 1.971 8.309 4.35 c 2.013 2.38 3.02 5.4 3.02 9.06 H 50 c 0 -2.003 -0.386 -3.545 -1.157 -4.624 c -0.77 -1.079 -1.869 -1.618 -3.294 -1.618 c -1.272 0 -2.259 0.4 -2.963 1.199 c -0.703 0.8 -1.055 1.903 -1.055 3.309 C 41.532 36.816 41.936 37.948 42.746 38.786 z" />
    </svg>
  );
}

function openTicketLink(link: TicketLink) {
  window.open(link.url, "_blank", "noopener,noreferrer");
}

/**
 * Renders nothing without links. One link opens it directly; several open
 * a chooser. A button (not an <a>) because the feed card is already a Link.
 */
export default function TicketButton({ eventId, links, className, iconClassName = "h-6 w-6" }: TicketButtonProps) {
  const ticketLinks = useMemo(() => safeTicketLinks(links), [links]);
  const [chooserOpen, setChooserOpen] = useState(false);

  if (ticketLinks.length === 0) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (ticketLinks.length === 1) {
      openTicketLink(ticketLinks[0]);
    } else {
      setChooserOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-event-id={eventId}
        aria-label="Buy tickets"
        aria-haspopup={ticketLinks.length > 1 ? "dialog" : undefined}
        className={className}
      >
        <DollarCircleIcon className={iconClassName} />
      </button>
      {chooserOpen && (
        <TicketChooserModal
          links={ticketLinks}
          onSelect={(link) => {
            openTicketLink(link);
            setChooserOpen(false);
          }}
          onClose={() => setChooserOpen(false)}
        />
      )}
    </>
  );
}
