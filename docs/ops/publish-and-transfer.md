# Operator guide: publish an event and hand it to the host

This is the day-to-day guide for **you** (Livon). It is not a product spec.

**Your Livon login:** `livonevents2026@gmail.com`  
**How you talk to hosts:** WhatsApp

Two jobs:

1. **Publish** the event so it shows in the feed.  
2. **Transfer** it to the real organizer when they have a Livon account.

Until the Claim button ships, transfer is always done in Supabase (section 3). After Claim ships, they can do it themselves (section 2) and you only use Supabase if something gets stuck.

---

## 1. One-time setup

Do this once, not per event.

1. Open Livon.
2. Sign in with **Google** using `livonevents2026@gmail.com` (or email + password on that same address).
3. Open your profile and set username to **`livon`** (or another short public name). Do not leave a random Google name.
4. Do **not** send or accept connection requests on this account.
5. In [Supabase](https://supabase.com/dashboard) → Table Editor → `users` → find this email → copy `user_id` and keep it somewhere private. That is the Livon owner id (you need it if you ever reverse a transfer).

You are ready to list events.

---

## 2. Publish an event (WhatsApp → live)

You do **not** upload posters in Supabase. You use **Create Event** on the site, same as any host.

### 2.1 What to get on WhatsApp

| Ask for | What you type into the form |
|---|---|
| Flyer / poster photo | Cover photo |
| Event name | Title (max 60 characters — shorten if needed) |
| Date and time | Start date + start time |
| Venue name | Location (max 60 characters) |
| Area (e.g. Maseru Central) | Area picker — must be a Livon area |
| Free or ticket price | Free, or Paid + amount (LSL) |
| Short blurb (optional) | Description (max 500 characters — you can write this from the chat) |

They do **not** need a Livon account before you publish.

### 2.2 Save the poster

1. In WhatsApp, open the flyer.
2. Save it to your phone (long-press → Save image).
3. If they sent a **PDF**, screenshot or crop the poster and save that image. The form only accepts photos (JPEG / PNG / WebP).

WhatsApp photos are often blurry. If the flyer looks muddy, ask them to send it as a **document / file**, then save that file and use it in the form.

### 2.3 Create the event

1. On your phone, make sure you are signed in as `livonevents2026@gmail.com`.
2. Open Livon → **Create Event**.
3. Tap the **photo area at the top** → pick the saved flyer from the gallery. That is how the poster gets onto the event.
4. Fill title, category, date, time, area, venue, price, description.
5. Tap **Publish Event**.
6. You should land on a success screen. Open the event and **copy the link**.

If you forget the poster, publish anyway, then **Edit** the event and add the photo there.

You can create about **5 events every 10 minutes** on this account. If you hit an error about too many events, wait a few minutes.

### 2.4 Message them on WhatsApp

Send the link:

> Your event is live:  
> `https://…/events/THE-ID`  
> It is listed by Livon for now. When you have a Livon account, tell me your username and I will move it onto your profile.

After the Claim button exists, change the last sentence to:

> Sign in, open that link, and tap **Claim this event**.

### 2.5 While it is still yours

Stay signed in as Livon. You can:

- **Edit** — change poster, title, time, description, price  
- **Manage** — see who is going  

After you transfer (or they claim), those buttons belong to **them**. You cannot edit in the app anymore.

---

## 3. Transfer the event to the correct owner

Use this when they have a Livon account and you are ready to put the listing under their name.

**What “transfer” means:** the event’s `organizer_id` changes from your Livon user to theirs. The feed then shows **Hosted by their username**. They get Edit and Manage. You lose those in the app.

### 3.1 Before you transfer — checklist

- [ ] They have signed up on Livon.  
- [ ] You know their **username** (best) or the **email** they used to sign up.  
- [ ] You have the **event link**. The long id after `/events/` is the `event_id`.  
- [ ] You are transferring to the person you spoke to on WhatsApp — not a similar username.

Google sign-up often uses a different Gmail than the one they gave you on WhatsApp. Always look them up by **username** if they have one.

### 3.2 Find their user id (Supabase)

1. Open Supabase → **Table Editor** → table **`users`**.  
2. Filter:
   - `username` **eq** their username, or  
   - `email` **eq** the email they signed up with (lowercase).  
3. Open the row. Copy **`user_id`** (a long uuid).  
4. Confirm it looks like the right person (username + email match the WhatsApp conversation).

If you find **zero rows**, they do not have an account yet. Do not transfer. Ask them to sign up, then come back.

If you find **two rows**, stop. Do not guess. Check with them which login they use.

### 3.3 Point the event at them (Supabase)

1. Table Editor → table **`events`**.  
2. Filter `event_id` **eq** the id from the URL.  
3. Confirm the **title** is the right event.  
4. Confirm **`organizer_id`** is still your Livon user id.  
5. Paste their `user_id` into **`organizer_id`**. Save.

If these columns exist (after claim is built), also set:

- `claimed_by` → the same `user_id`  
- `claimed_at` → now (or leave the Claim button to set these)

6. Open the event link in the app (incognito or signed out). The host line should show **Hosted by their username**, not Livon.  
7. Ask them to sign in, open the event, and check they can see **Edit** / **Manage**.  
8. WhatsApp them: the event is on their account now.

### 3.4 Same thing in SQL (if you prefer the SQL editor)

Replace the three placeholders. Run the `SELECT`s first and read the result before `UPDATE`.

```sql
-- 1. Find the host
SELECT user_id, username, email
FROM users
WHERE lower(username) = lower('their_username');
-- or: WHERE lower(email) = lower('their@email.com');

-- 2. Confirm the event (should still be owned by Livon)
SELECT event_id, title, organizer_id
FROM events
WHERE event_id = 'EVENT_ID_FROM_THE_URL';

-- 3. Transfer
UPDATE events
SET organizer_id = 'HOST_USER_ID'
WHERE event_id = 'EVENT_ID_FROM_THE_URL';
```

After claim columns exist, use:

```sql
UPDATE events
SET
  organizer_id = 'HOST_USER_ID',
  claimed_by = 'HOST_USER_ID',
  claimed_at = now()
WHERE event_id = 'EVENT_ID_FROM_THE_URL';
```

### 3.5 They claim it themselves (after the Claim button ships)

1. They must be **signed in**.  
2. They open the event details page.  
3. They tap **Claim this event** and confirm.  
4. You should see **Hosted by their username** on the card.

If Claim says they are not the invited organizer, you probably have the wrong person bound, or they signed up with a different account. Look them up (section 3.2) and either:

- set `intended_claim_user_id` to their real `user_id` and ask them to tap Claim again, or  
- transfer with section 3.3 yourself.

Do not ask them to tap Claim while logged out. Sign in first, then Claim.

---

## 4. Undo a wrong transfer

If you gave the event to the wrong account:

1. Table Editor → `events` → that `event_id`.  
2. Put **`organizer_id`** back to **your Livon `user_id`**.  
3. Clear `claimed_by` and `claimed_at` if those columns are filled.  
4. Check the event page: it should look like a Livon listing again.  
5. Then transfer to the correct person (section 3).

SQL:

```sql
UPDATE events
SET
  organizer_id = 'LIVON_USER_ID',
  claimed_by = NULL,
  claimed_at = NULL
WHERE event_id = 'EVENT_ID_FROM_THE_URL';
```

Message both people on WhatsApp if the wrong person already saw Manage.

---

## 5. If something looks wrong

| What you see | What to do |
|---|---|
| Event not in the feed | Check start date/time (wrong day or already past). Check you picked the right **area**. Hard-refresh the app. |
| Poster missing / placeholder | Edit event → tap photo → pick the saved flyer again. |
| Poster blurry | Ask for the flyer as a WhatsApp **document**, then Edit and replace. |
| “Too many events created recently” | Wait ~10 minutes. Limit is 5 publishes per 10 minutes. |
| Host line still says Livon after transfer | You edited the wrong `event_id`, or did not save. Re-open the row and check `organizer_id`. |
| They cannot Edit / Manage | They are signed into a different account than the `user_id` you set. Look up `users` again. |
| They have no account | Do not transfer. Keep it as Livon. Send them the signup link. |
| You cancelled by mistake | Cancel **deletes** the event and the guest list. Do not use Cancel unless the event is truly off. Recreate if needed. |

---

## 6. Short version (print this)

**Publish**

1. WhatsApp: poster + details.  
2. Save poster to phone.  
3. Signed in as `livonevents2026@gmail.com` → Create Event → pick poster → fill form → Publish.  
4. Send them the event link.

**Transfer**

1. They have an account. Get their username.  
2. Supabase `users`: copy their `user_id`.  
3. Supabase `events`: paste that id into `organizer_id`.  
4. Check the event page. Tell them it is theirs.

**Undo**

Put `organizer_id` back to your Livon `user_id`.
