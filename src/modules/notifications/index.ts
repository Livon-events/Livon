export type { SendDueEventRemindersOptions, SendDueEventRemindersResult } from "./reminders";

// sendDueEventReminders lives in reminders.ts and is deliberately not
// re-exported here — it uses the service-role admin client (server-only).
// Route handlers / scripts import it directly:
//   import { sendDueEventReminders } from "@/modules/notifications/reminders";
