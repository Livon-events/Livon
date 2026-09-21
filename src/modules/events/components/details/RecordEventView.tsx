"use client";

import { useEffect } from "react";
import { recordEventView } from "../../recordEventView";

type RecordEventViewProps = {
  eventId: string;
};

/** Logs one details-page view after mount. Renders nothing. */
export default function RecordEventView({ eventId }: RecordEventViewProps) {
  useEffect(() => {
    void recordEventView(eventId);
  }, [eventId]);

  return null;
}
