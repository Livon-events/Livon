# FR: Invite

## Overview
Lets a user share an event to any platform via the device's native share sheet, using a personal, reusable invite link for that event. Clicks on that link are recorded (who shared it, how many times it was used) — but for MVP, none of this data is surfaced to anyone. It's collected quietly now so a non-numeric recognition feature (e.g. honoring frequent sharers periodically) can be built later without needing new data.

---

## User actions

1. **Tap Invite on an event** (card or event page) — opens the device's native share sheet (Web Share API), pre-filled with the event's title and that user's personal invite link for this event.
2. **Share to any target** — whatever the OS share sheet offers (WhatsApp, Facebook, SMS, copy link, etc.) — no per-platform integration needed since this rides on the native share mechanism rather than individual social APIs.
3. **Recipient taps the invite link** — lands on the event's page; the click is recorded against that specific link.

---

## Rules / constraints

### Link generation
- **One reusable link per (user, event) pair.** The first time a user taps Invite for a given event, a link is created; every subsequent share of that event by that same user reuses the same link rather than generating a new one.
- Link resolves to the event's page regardless of the viewer's auth state — events are public, so no login is required to land on the page from an invite link.

### Recording
- Each time the invite link is used (opened), `InviteLinks.click_count` increments — the one deliberate exception to the "derived counts must be computed, not stored" principle, since a simple counter is sufficient here and avoids recomputation on a high-traffic link.
- The record also retains which user the link belongs to (the sharer) and which event it's for — this is what allows "who shared" to be answered later, even though it's not surfaced yet.

### Visibility — none in MVP
- **No invite stats are shown to anyone** — not the sharer, not the organiser. No counts, no leaderboards, no dashboards.
- This is a deliberate MVP constraint to avoid social pressure or tension in small campus circles around who is or isn't sharing.
- Data is still fully recorded so that a **future non-numeric recognition feature** (e.g. periodically honoring active sharers without exposing exact numbers) can be built without a data migration. That feature itself is out of scope here — not designed yet, just noted as the reason this data matters despite not being displayed.

---

## Edge cases

- **Sharer clicks their own invite link:** excluded from `click_count` — compare `InviteLinks.user_id` to the clicker's session and skip the increment if they match. Confirmed, not just a default.
- **Same person clicks the link multiple times (repeat visits, refreshes):** no de-duplication specified — recommend treating `click_count` as a raw counter (every open increments it), consistent with it being a simple cached counter rather than a derived unique-visitor metric. If unique-clicker counting is wanted later, that's a bigger addition (would need a join table of clicker identities) — not needed for MVP given nothing is displayed yet anyway.
- **Invite link to a cancelled event:** per the Event Lifecycle FR, still resolves to the event page showing its cancelled state — the click still counts, since the link did get used, regardless of what the destination currently shows.
- **Invite link to an event that's already ended:** same as above — link still resolves and still counts; nothing in this FR prevents clicking through to a past event's page.
- **Non-signed-in visitor clicks an invite link:** the click still increments `InviteLinks.click_count`, and they land on the event page with no login wall (events are public). **No further tracking of that visitor is done** — if they later sign up and mark themselves "going," there is no attempt to link that account back to the invite link that brought them in. This is a deliberate simplification: the visitor is anonymous, there's little meaningful data to attach to them, and building signup-time attribution would add real complexity for limited benefit at MVP scale. Click count alone is treated as good enough signal.

---

## Inputs / outputs

**Tap Invite (client → server)**
- Input: `event_id`, current user
- Action: get-or-create `InviteLinks` row for (`user_id`, `event_id`)
- Output: link URL, handed to the native share sheet

**Invite link opened (visitor → server)**
- Input: invite link token/id
- Action: increment `InviteLinks.click_count` (skip if self-click — clicker matches the link's owner); redirect to event page
- Output: event page rendered; no visible change for the visitor beyond landing on the event

---

## Open items to confirm later
None — all prior open questions for this FR are resolved. The future "honoring frequent sharers" feature remains explicitly out of scope; it's noted only as the reason this data is retained despite not being surfaced yet.
