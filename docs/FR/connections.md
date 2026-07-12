# FR: Connections

## Overview
Connections are mutual — there is no follow model. A user finds others only through search; there is no suggested-connections or mutual-friends browsing in MVP. Requests are initiated from a user's profile and managed from a dedicated Connections tab, which separates pending Requests (incoming and outgoing) from established Connections.

---

## User actions

1. Search for a user.
2. View a user's profile from search results.
3. Tap **Connect** on that profile to send a request. This is the only place a request can be initiated — not available inline from search results.
4. Open own **Connections tab** — shows a collapsible Requests section and, below it, the Connections list.
5. Toggle the Requests section open to reveal its two sub-sections: **Incoming** and **Outgoing**.
6. On an incoming request: **Accept** or **Decline**.
7. On an outgoing request: **Cancel**.
8. View established connections in the Connections list at the bottom of the tab.

---

## Rules / constraints

### Discovery
- Search is the only path to find another user in MVP — no suggested connections, no "people you may know," no mutual-connection browsing.

### Connect button (on profile)
- Only rendered on a user's profile page. Never shown in search results directly, and never shown on the viewer's own profile.
- Four states, reflecting the relationship between viewer and profile owner:
  - **Connect** — no relationship exists. Tapping sends a request.
  - **Cancel** — viewer has an outgoing request pending on this profile. Tapping withdraws it, reverting the button to Connect.
  - **Accept** — profile owner has an incoming request already sitting with the viewer (they requested the viewer first). Tapping accepts it directly from the profile — equivalent to accepting via the Connections tab — and the button becomes Unconnect.
  - **Unconnect** — viewer and profile owner are already connected. Tapping removes the connection, reverting the button to Connect.
- No cooldown on any transition — a user can Connect again immediately after Cancel or Unconnect.

### Connections tab structure
- **Requests** section is collapsed by default and toggled open by the user ("drop reveals" the list).
- When expanded, Requests splits into two sub-sections: **Incoming** (requests sent to the user) and **Outgoing** (requests the user has sent, still pending).
- **Connections** list sits below the Requests section regardless of whether Requests is expanded or collapsed.

### Incoming requests
- Actions: **Accept** or **Decline**.
- Accept creates a connection (single bidirectional row, per the existing Connections schema model) and moves the person into the Connections list; the request is removed from Incoming.
- Decline removes the request outright — no connection is created.

### Outgoing requests
- Action: **Cancel**.
- Cancel removes the pending request. The Connect button on that person's profile reverts to "Connect," allowing the viewer to send another request later.

### Connections list
- Shows all current mutual connections for the user.
- Ordering: most-recently-connected first.

---

## Edge cases
- **Mutual simultaneous requests** (both users send a request to each other before either responds): still requires one side to explicitly accept — there is no auto-accept, even if requests exist in both directions.
- **Re-requesting after Cancel/Unconnect:** no cooldown — Connect is available again immediately.
- Viewing your own profile never shows a Connect button, regardless of any other state.

---

## Inputs / outputs

**Connect button (profile render)**
- Input: viewer's user_id, profile owner's user_id, existing Connections/request state between the two
- Output: button state — Connect / Cancel / Accept / Unconnect

**Connections tab**
- Input: viewer's user_id
- Output:
  - Incoming requests: list of {avatar, username} with Accept/Decline actions
  - Outgoing requests: list of {avatar, username} with Cancel action
  - Connections: list of {avatar, username} for all accepted connections

---

## Open items to confirm later
None — all prior open questions for this FR are resolved.
