// Domain types owned by the connections module. Moved here from
// components/profile/types.ts during the modular-monolith restructuring —
// any module that displays connection data (currently `users`, for the
// profile page) imports these types from here rather than defining its
// own competing shape.

export interface ConnectionUser {
  id: string; // connection_id — what accept/decline/remove actions act on
  userId: string; // the other party's user_id, kept for future profile links
  name: string;
  avatarUrl?: string;
}

export type ConnectionState =
  | { status: "none" }
  | { status: "outgoing"; connectionId: string } // viewer requested profile owner, still pending
  | { status: "incoming"; connectionId: string } // profile owner requested viewer, still pending
  | { status: "connected"; connectionId: string }; // accepted, either direction
