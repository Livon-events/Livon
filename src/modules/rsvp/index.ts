export { markGoing, changeGoingPrivacy, markNotGoing, type GoingVisibility } from "./mutations";
export type { MyEventInterest } from "./queries";
export { useGoingAction, type GoingPopupMode } from "./hooks/useGoingAction";
export { default as GoingPrivacyPopup } from "./components/GoingPrivacyPopup";

// getEventIdsUserIsGoingTo / getMyInterest / getConnectionsGoingCount /
// getEventGoingCount / getConnectionsAttendingList are never barrel-exported
// — queries.ts is server-only (uses next/headers). Import directly:
//   import { getMyInterest } from "@/modules/rsvp/queries";
