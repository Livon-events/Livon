/**
 * Authorization tests for the SECURITY DEFINER RPCs in `public`
 * (docs/security-definer-risks.md Phase 4). Every one of these functions
 * bypasses RLS, so the only thing standing between an anonymous caller and
 * the data is its execute grant plus its own input handling — both are
 * asserted here through the real Data API, not through browser code.
 *
 * Run against livon-test (never production): the authenticated checks create
 * and delete a throwaway user.
 *
 * Run: node scripts/test-rpc-authorization.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;

function assert(condition, message, detail) {
  if (condition) {
    console.log(`  ok    ${message}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL  ${message}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

function section(title) {
  console.log(`\n${title}`);
}

// PostgREST answers a forbidden function with 42501, and hides functions the
// role cannot execute from the schema cache entirely (PGRST202/404). Both mean
// "not callable by this role"; a dropped function also lands here.
function isNotCallable(error) {
  if (!error) return false;
  return error.code === "42501" || error.code === "PGRST202" || error.code === "PGRST203";
}

function hasEmailLikeKey(rows) {
  return (Array.isArray(rows) ? rows : [rows])
    .filter((row) => row && typeof row === "object")
    .some((row) => Object.keys(row).some((key) => /e-?mail/i.test(key)));
}

async function main() {
  const { data: eventRow } = await admin
    .from("events")
    .select("event_id, organizer_id")
    .eq("status", "active")
    .limit(1)
    .single();

  const { data: userRow } = await admin
    .from("users")
    .select("user_id, username")
    .not("username", "is", null)
    .limit(1)
    .single();

  if (!eventRow || !userRow) {
    console.error("Seed the test project first — need at least one active event and one user.");
    process.exit(1);
  }

  section("anon cannot reach internal or privileged RPCs");

  {
    const { error } = await anon.rpc("check_and_increment_rate_limit", {
      p_key: "authz-test",
      p_max_requests: 1,
      p_window_interval: "5 minutes",
    });
    assert(isNotCallable(error), "check_and_increment_rate_limit is not callable by anon", error);
  }

  {
    const { error } = await anon.rpc("handle_new_user", {});
    assert(isNotCallable(error), "handle_new_user is not callable by anon", error);
  }

  {
    const { data, error } = await anon.rpc("resolve_login_email", { p_identifier: userRow.username });
    assert(isNotCallable(error), "resolve_login_email no longer exists as an anon RPC", error);
    assert(
      data === null || data === undefined,
      "resolve_login_email returns no email address to anon",
      data
    );
  }

  {
    const { error } = await anon.rpc("redeem_invite", {
      p_code: "anything",
      p_anon_session_id: "11111111-1111-1111-1111-111111111111",
      p_user_id: null,
      p_client_ip: "203.0.113.9",
    });
    assert(isNotCallable(error), "redeem_invite is not callable by anon", error);
  }

  {
    // The 2-argument signature is what a browser could previously call to
    // inflate click counts with a fresh UUID each time.
    const { error } = await anon.rpc("redeem_invite", {
      p_code: "anything",
      p_anon_session_id: "11111111-1111-1111-1111-111111111111",
    });
    assert(isNotCallable(error), "the old 2-argument redeem_invite signature is gone", error);
  }

  for (const fn of ["claim_event", "get_event_management_data", "get_my_event_view_stats"]) {
    const { error } = await anon.rpc(fn, { p_event_id: eventRow.event_id });
    assert(isNotCallable(error), `${fn} is not callable by anon`, error);
  }

  section("anon can still reach every intentional public read");

  const publicReads = [
    ["get_home_feed", {}],
    ["get_home_people_discovery", {}],
    ["search_events", { p_query: "the" }],
    ["search_people", { p_query: "th" }],
    ["get_public_profile", { p_user_id: userRow.user_id }],
    ["get_public_profile_events", { p_user_id: userRow.user_id }],
    ["get_public_connections_count", { p_user_id: userRow.user_id }],
    ["resolve_username_to_user_id", { p_username: userRow.username }],
    ["event_going_count", { p_event_id: eventRow.event_id }],
    ["get_event_talent", { p_event_id: eventRow.event_id }],
  ];

  for (const [fn, args] of publicReads) {
    const { data, error } = await anon.rpc(fn, args);
    assert(!error, `${fn} is callable by anon`, error);
    assert(!hasEmailLikeKey(data), `${fn} returns no email-like column`, data);
  }

  section("public read inputs are bounded inside SQL, not by the browser");

  {
    const { data, error } = await anon.rpc("search_events", { p_query: "a", p_page_size: 1_000_000 });
    assert(!error, "search_events accepts an absurd page size without erroring", error);
    assert((data ?? []).length <= 50, "search_events clamps page size to 50", (data ?? []).length);
  }

  {
    const { data, error } = await anon.rpc("get_home_feed", { p_page_size: 1_000_000 });
    assert(!error, "get_home_feed accepts an absurd page size without erroring", error);
    assert((data ?? []).length <= 50, "get_home_feed clamps page size to 50", (data ?? []).length);
  }

  for (const pageSize of [0, -5, null]) {
    const { error } = await anon.rpc("get_home_feed", { p_page_size: pageSize });
    assert(!error, `get_home_feed survives p_page_size=${pageSize}`, error);
  }

  {
    const { count } = await admin.from("users").select("*", { count: "exact", head: true });
    const { data, error } = await anon.rpc("search_people", { p_query: "%%" });
    assert(!error, "search_people accepts a wildcard-only query", error);
    assert(
      (data ?? []).length === 0,
      "search_people treats '%' literally instead of matching every user",
      { matched: (data ?? []).length, users: count }
    );
  }

  {
    const { data, error } = await anon.rpc("search_people", { p_query: "_".repeat(3) });
    assert(!error, "search_people accepts an underscore-only query", error);
    assert((data ?? []).length === 0, "search_people treats '_' literally", (data ?? []).length);
  }

  {
    const { data, error } = await anon.rpc("search_events", { p_query: "x".repeat(101) });
    assert(!error, "search_events accepts an overlong query without erroring", error);
    assert((data ?? []).length === 0, "search_events rejects an overlong query", (data ?? []).length);
  }

  section("authenticated non-owner is still refused");

  const password = `pw-${crypto.randomUUID()}`;
  const email = `authz-test-${crypto.randomUUID()}@example.com`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    console.log(`  skip  could not create a test user (${createError?.message ?? "unknown"})`);
  } else {
    // handle_new_user is no longer executable by anon or authenticated; the
    // signup trigger must still fire (EXECUTE on a trigger function is checked
    // when the trigger is created, not when it fires).
    const { count: triggeredRows } = await admin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("user_id", created.user.id);
    assert(triggeredRows === 1, "signup still creates exactly one public.users row", triggeredRows);

    const user = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: signInError } = await user.auth.signInWithPassword({ email, password });

    if (signInError) {
      console.log(`  skip  password sign-in unavailable (${signInError.message})`);
    } else {
      const notOwned = eventRow.organizer_id !== created.user.id;
      assert(notOwned, "the throwaway user does not own the sampled event");

      const { data: management, error: managementError } = await user.rpc(
        "get_event_management_data",
        { p_event_id: eventRow.event_id }
      );
      assert(!managementError, "get_event_management_data is callable by authenticated", managementError);
      assert(
        (management ?? []).length === 0,
        "get_event_management_data returns nothing to a non-owner",
        management
      );

      const { error: statsError } = await user.rpc("get_my_event_view_stats", {
        p_event_id: eventRow.event_id,
      });
      assert(!!statsError, "get_my_event_view_stats refuses a non-owner", statsError);

      const { error: claimError } = await user.rpc("claim_event", { p_event_id: eventRow.event_id });
      assert(!!claimError, "claim_event refuses a user who was not invited to claim", claimError);

      const { error: rateLimitError } = await user.rpc("check_and_increment_rate_limit", {
        p_key: "authz-test",
        p_max_requests: 1,
        p_window_interval: "5 minutes",
      });
      assert(
        isNotCallable(rateLimitError),
        "check_and_increment_rate_limit is not callable by authenticated",
        rateLimitError
      );

      const { error: redeemError } = await user.rpc("redeem_invite", {
        p_code: "anything",
        p_anon_session_id: null,
        p_user_id: created.user.id,
        p_client_ip: "203.0.113.9",
      });
      assert(isNotCallable(redeemError), "redeem_invite is not callable by authenticated", redeemError);

      await user.auth.signOut();
    }

    await admin.auth.admin.deleteUser(created.user.id);
  }

  if (failures > 0) {
    console.error(`\n${failures} authorization check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll RPC authorization checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
