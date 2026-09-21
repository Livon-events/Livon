export type { SendDueEventRemindersOptions, SendDueEventRemindersResult } from "./reminders";
export type {
  SendConnectionEventNotificationsOptions,
  SendConnectionEventNotificationsResult,
} from "./connectionEventNotifications";

// sendDueEventReminders / sendDueConnectionEventNotifications live in
// server-only files and are deliberately not re-exported here — they use
// the service-role admin client. Route handlers / scripts import them
// directly:
//   import { sendDueEventReminders } from "@/modules/notifications/reminders";
//   import { sendDueConnectionEventNotifications } from "@/modules/notifications/connectionEventNotifications";
