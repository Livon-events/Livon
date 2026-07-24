"use client";

import { useState } from "react";
import {
  markGoing,
  changeGoingPrivacy,
  markNotGoing,
  type GoingVisibility,
} from "@/lib/mutations/event-interests";

export type { GoingVisibility };

export type GoingPopupMode = "closed" | "choose-privacy" | "manage";

/**
 * Product decision (not a technical limitation): the Private/Visible
 * picker and the Change-privacy/Not-going menu from
 * docs/FR/going-rsvp-privacy.md are deferred until after MVP. Until then,
 * tapping the button skips straight to the default action instead of
 * opening a popup — everyone who marks going defaults to `visible`.
 *
 * The whole popup flow (state, mutations, GoingPrivacyPopup component,
 * the `{popup !== "closed" && <GoingPrivacyPopup .../>}` render in
 * EventActionBar/EventCardActions) is still here and still correct, just
 * unreachable while this is false. Turning the popup back on later is a
 * one-line change — flip this to `true` — with no changes needed in
 * either calling component.
 */
const PRIVACY_PROMPT_ENABLED = false;

const DEFAULT_VISIBILITY: GoingVisibility = "visible";

/**
 * Drives the full tap flow from docs/FR/going-rsvp-privacy.md:
 *   - Not going yet, tap button -> privacy popup (Private/Visible) -> mark going
 *   - Already going, tap button -> manage menu (Change privacy/Not going)
 *   - Change privacy -> re-opens the privacy popup, updates the existing row
 *   - Not going -> deletes the row
 *
 * While PRIVACY_PROMPT_ENABLED is false (see above), the button instead
 * goes straight to marking going as `visible` / un-marking, skipping the
 * popup entirely.
 *
 * Updates local state optimistically (the popup closes and the button
 * reflects the new state immediately) and rolls back if the mutation
 * fails, rather than blocking the UI on the network round-trip.
 */
export function useGoingAction(
  eventId: string,
  initialGoing: boolean,
  initialVisibility: GoingVisibility | null
) {
  const [going, setGoing] = useState(initialGoing);
  const [visibility, setVisibility] = useState<GoingVisibility | null>(initialVisibility);
  const [popup, setPopup] = useState<GoingPopupMode>("closed");
  const [error, setError] = useState<string | null>(null);

  async function handleButtonClick() {
    setError(null);

    if (!PRIVACY_PROMPT_ENABLED) {
      if (going) {
        await selectNotGoing();
      } else {
        await choosePrivacy(DEFAULT_VISIBILITY);
      }
      return;
    }

    setPopup(going ? "manage" : "choose-privacy");
  }

  function closePopup() {
    setPopup("closed");
  }

  function selectChangePrivacy() {
    setPopup("choose-privacy");
  }

  async function choosePrivacy(nextVisibility: GoingVisibility) {
    const wasGoing = going;
    const previousVisibility = visibility;

    // Optimistic update — the popup closes and the button flips state
    // immediately; rolled back below if the write fails.
    setGoing(true);
    setVisibility(nextVisibility);
    setPopup("closed");
    setError(null);

    const result = wasGoing
      ? await changeGoingPrivacy(eventId, nextVisibility)
      : await markGoing(eventId, nextVisibility);

    if (!result.ok) {
      setGoing(wasGoing);
      setVisibility(previousVisibility);
      setError(result.error);
    }
  }

  async function selectNotGoing() {
    const previousVisibility = visibility;

    setGoing(false);
    setVisibility(null);
    setPopup("closed");
    setError(null);

    const result = await markNotGoing(eventId);

    if (!result.ok) {
      setGoing(true);
      setVisibility(previousVisibility);
      setError(result.error);
    }
  }

  return {
    going,
    visibility,
    popup,
    error,
    handleButtonClick,
    closePopup,
    selectChangePrivacy,
    selectNotGoing,
    choosePrivacy,
  };
}
