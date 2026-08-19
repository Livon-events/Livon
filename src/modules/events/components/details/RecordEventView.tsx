"use client";

import { useEffect } from "react";
import { recordEventView } from "../../recordEventView";

type RecordEventViewProps = {
  eventId: string;
  organizerId: string;
};

/** Logs one details-page view after mount. Renders nothing. */
export default function RecordEventView({ eventId, organizerId }: RecordEventViewProps) {
  useEffect(() => {
    void recordEventView(eventId, organizerId);
  }, [eventId, organizerId]);

  return null;
}
