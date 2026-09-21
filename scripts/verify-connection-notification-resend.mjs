/**
 * One-off livon-test verification: enqueue → claim → Resend delivered@resend.dev.
 * Not part of the normal test suite.
 */
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

if (!url?.includes("vlfmgceimhduemsslhsg")) {
  console.error("Refusing to run: .env.local must point at livon-test");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const resend = new Resend(resendKey);

const organizerId = crypto.randomUUID();
const recipientId = crypto.randomUUID();
const password = `pw-${crypto.randomUUID()}`;
const testEmail = "delivered@resend.dev";
let eventId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log("OK:", message);
}

try {
  const { data: city } = await admin.from("cities").select("city_id").limit(1).single();
  const { data: area } = await admin
    .from("areas")
    .select("area_id")
    .eq("city_id", city.city_id)
    .limit(1)
    .single();
  const { data: category } = await admin.from("categories").select("category_id").limit(1).single();
  assert(city && area && category, "seed city/area/category present");

  for (const [id, email, username] of [
    [
      organizerId,
      `notif-org-${organizerId.slice(0, 8)}@example.com`,
      `notif_org_${organizerId.slice(0, 8)}`,
    ],
    [recipientId, testEmail, `notif_acc_${recipientId.slice(0, 8)}`],
  ]) {
    const { error } = await admin.auth.admin.createUser({
      id,
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });
    if (error) throw error;
  }

  await admin.from("users").upsert([
    {
      user_id: organizerId,
      email: `notif-org-${organizerId.slice(0, 8)}@example.com`,
      username: `notif_org_${organizerId.slice(0, 8)}`,
    },
    {
      user_id: recipientId,
      email: testEmail,
      username: `notif_acc_${recipientId.slice(0, 8)}`,
    },
  ]);

  const { error: connError } = await admin.from("connections").insert({
    requester_id: organizerId,
    receiver_id: recipientId,
    status: "accepted",
  });
  if (connError) throw connError;

  const { data: event, error: eventError } = await admin
    .from("events")
    .insert({
      organizer_id: organizerId,
      category_id: category.category_id,
      city_id: city.city_id,
      area_id: area.area_id,
      title: "Resend connection-upload fixture",
      venue_name: "Fixture Venue",
      starts_at: new Date(Date.now() + 40 * 86400000).toISOString(),
      cover_image_url: "/images/event-cover-placeholder.jpg",
      status: "active",
      price: 0,
    })
    .select("event_id")
    .single();
  if (eventError) throw eventError;
  eventId = event.event_id;

  const { count } = await admin
    .from("connection_event_notification_queue")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("recipient_user_id", recipientId);
  assert(count === 1, "accepted connection enqueued on insert");

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_connection_event_notifications",
    {
      p_limit: 5,
      p_stale_minutes: 15,
      p_max_attempts: 5,
    }
  );
  if (claimError) throw claimError;
  const row = (claimed ?? []).find((r) => r.event_id === eventId);
  assert(!!row, "claim returned fixture row");
  assert(row.recipient_email === testEmail, "claimed recipient is Resend test address");

  const { data: sendData, error: sendError } = await resend.emails.send(
    {
      from: fromEmail,
      to: testEmail,
      subject: `${row.organizer_username || "A connection"} uploaded a new event: ${row.event_title}`,
      html: `<p>Hi ${row.recipient_username || "there"},</p><p>connection-upload fixture verification</p>`,
      text: "connection-upload fixture verification",
    },
    { idempotencyKey: `connection-event:${row.event_id}:${row.recipient_user_id}` }
  );
  if (sendError) throw sendError;
  assert(!!sendData?.id, `Resend accepted delivery id=${sendData.id}`);

  await admin
    .from("connection_event_notification_queue")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      claimed_at: null,
    })
    .eq("id", row.queue_id);

  console.log("\nControlled Resend delivery succeeded.");
} catch (error) {
  console.error("FAIL:", error.message || error);
  process.exitCode = 1;
} finally {
  if (eventId) await admin.from("events").delete().eq("event_id", eventId);
  await admin
    .from("connections")
    .delete()
    .or(`requester_id.eq.${organizerId},receiver_id.eq.${organizerId}`);
  await admin.from("users").delete().in("user_id", [organizerId, recipientId]);
  await admin.auth.admin.deleteUser(organizerId).catch(() => {});
  await admin.auth.admin.deleteUser(recipientId).catch(() => {});
  console.log("Cleanup complete.");
}
