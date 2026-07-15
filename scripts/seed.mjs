// scripts/seed.mjs
//
// Idempotent dev seed script for Livon Step 4 (first read path).
// Safe to re-run: cities/areas/categories/events/connections/event_interests/
// views use fixed UUIDs and are upserted on their primary key. Test auth users
// are found-or-created by email so re-running never duplicates auth accounts.
//
// Requires (in .env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   <-- server-only, never expose to the client
//
// If your .env.local uses different variable names, update SUPABASE_URL_ENV /
// SUPABASE_SERVICE_KEY_ENV below to match before running.
//
// Run with:  node scripts/seed.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL_ENV = 'NEXT_PUBLIC_SUPABASE_URL';
const SUPABASE_SERVICE_KEY_ENV = 'SUPABASE_SERVICE_ROLE_KEY';

const supabaseUrl = process.env[SUPABASE_URL_ENV];
const serviceKey = process.env[SUPABASE_SERVICE_KEY_ENV];

if (!supabaseUrl || !serviceKey) {
  console.error(
    `Missing env vars. Expected ${SUPABASE_URL_ENV} and ${SUPABASE_SERVICE_KEY_ENV} in .env.local.\n` +
    `If your project uses different names, edit the *_ENV constants at the top of this file.`
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Fixed IDs — keep these stable across runs so upserts are true no-ops/updates
// rather than creating duplicate rows with new random UUIDs each time.
// ---------------------------------------------------------------------------

const CITY = {
  JHB: '11111111-1111-1111-1111-111111111101',
  CPT: '11111111-1111-1111-1111-111111111102',
};

const AREA = {
  BRAAMFONTEIN: '11111111-1111-1111-1111-111111111201', // JHB
  SANDTON: '11111111-1111-1111-1111-111111111202', // JHB
  OBSERVATORY: '11111111-1111-1111-1111-111111111203', // CPT
  CITY_BOWL: '11111111-1111-1111-1111-111111111204', // CPT
};

const CATEGORY = {
  MUSIC: '11111111-1111-1111-1111-111111111301',
  SPORTS: '11111111-1111-1111-1111-111111111302',
  FOOD_DRINK: '11111111-1111-1111-1111-111111111303',
  ARTS_CULTURE: '11111111-1111-1111-1111-111111111304',
  NETWORKING: '11111111-1111-1111-1111-111111111305',
  NIGHTLIFE: '11111111-1111-1111-1111-111111111306',
};

const EVENT = {
  ONE: '11111111-1111-1111-1111-111111111401',
  TWO: '11111111-1111-1111-1111-111111111402',
  THREE: '11111111-1111-1111-1111-111111111403',
  FOUR: '11111111-1111-1111-1111-111111111404',
  FIVE: '11111111-1111-1111-1111-111111111405',
  SIX_CANCELLED: '11111111-1111-1111-1111-111111111406',
};

const CONNECTION = {
  ACCEPTED: '11111111-1111-1111-1111-111111111501',
  PENDING: '11111111-1111-1111-1111-111111111502',
};

const INTEREST = {
  A: '11111111-1111-1111-1111-111111111601',
  B: '11111111-1111-1111-1111-111111111602',
  C: '11111111-1111-1111-1111-111111111603',
  D: '11111111-1111-1111-1111-111111111604',
  E: '11111111-1111-1111-1111-111111111605',
};

const EVENT_VIEW = {
  A: '11111111-1111-1111-1111-111111111701',
  B: '11111111-1111-1111-1111-111111111702',
};

const ANON_VIEW = {
  A: '11111111-1111-1111-1111-111111111801',
  B: '11111111-1111-1111-1111-111111111802',
};

const TEST_USERS = [
  {
    email: 'seed.user1@livonseed.test',
    password: 'SeedUser1!23',
    username: 'seed_user1',
    bio: 'Seed test account #1 — organizer of most seed events.',
    preferred_city_id: CITY.JHB,
    preferred_area_id: AREA.BRAAMFONTEIN,
  },
  {
    email: 'seed.user2@livonseed.test',
    password: 'SeedUser2!23',
    username: 'seed_user2',
    bio: 'Seed test account #2 — regular attendee.',
    preferred_city_id: CITY.JHB,
    preferred_area_id: AREA.SANDTON,
  },
  {
    email: 'seed.user3@livonseed.test',
    password: 'SeedUser3!23',
    username: 'seed_user3',
    bio: 'Seed test account #3 — Cape Town based.',
    preferred_city_id: CITY.CPT,
    preferred_area_id: AREA.OBSERVATORY,
  },
  {
    email: 'seed.user4@livonseed.test',
    password: 'SeedUser4!23',
    username: 'seed_user4',
    bio: 'Seed test account #4 — no city preference set.',
    preferred_city_id: null,
    preferred_area_id: null,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(days, hour = 18) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function findOrCreateAuthUser({ email, password, username }) {
  // Page through admin.listUsers looking for an existing account with this email.
  // (supabase-js admin API has no direct getUserByEmail, so we search manually.)
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) break;
    page += 1;
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // seed users should be usable immediately, no confirmation email
    user_metadata: { username },
  });
  if (createError) throw createError;
  return created.user;
}

function must(label, { error }) {
  if (error) {
    console.error(`✗ ${label} failed:`, error.message);
    throw error;
  }
  console.log(`✓ ${label}`);
}

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

async function seedCities() {
  const res = await supabase
    .from('cities')
    .upsert(
      [
        { city_id: CITY.JHB, name: 'Johannesburg' },
        { city_id: CITY.CPT, name: 'Cape Town' },
      ],
      { onConflict: 'city_id' }
    );
  must('cities seeded', res);
}

async function seedAreas() {
  const res = await supabase
    .from('areas')
    .upsert(
      [
        { area_id: AREA.BRAAMFONTEIN, city_id: CITY.JHB, name: 'Braamfontein' },
        { area_id: AREA.SANDTON, city_id: CITY.JHB, name: 'Sandton' },
        { area_id: AREA.OBSERVATORY, city_id: CITY.CPT, name: 'Observatory' },
        { area_id: AREA.CITY_BOWL, city_id: CITY.CPT, name: 'City Bowl' },
      ],
      { onConflict: 'area_id' }
    );
  must('areas seeded', res);
}

async function seedCategories() {
  const res = await supabase
    .from('categories')
    .upsert(
      [
        { category_id: CATEGORY.MUSIC, name: 'Music' },
        { category_id: CATEGORY.SPORTS, name: 'Sports' },
        { category_id: CATEGORY.FOOD_DRINK, name: 'Food & Drink' },
        { category_id: CATEGORY.ARTS_CULTURE, name: 'Arts & Culture' },
        { category_id: CATEGORY.NETWORKING, name: 'Networking' },
        { category_id: CATEGORY.NIGHTLIFE, name: 'Nightlife' },
      ],
      { onConflict: 'category_id' }
    );
  must('categories seeded', res);
}

async function seedUsers() {
  const userIds = {};
  for (const u of TEST_USERS) {
    const authUser = await findOrCreateAuthUser(u);
    userIds[u.username] = authUser.id;

    // handle_new_user trigger already created/updates the base public.users row
    // (user_id, email, username, avatar_url) on auth user creation. Update the
    // remaining profile fields here — this also covers the case where the auth
    // user already existed from a previous run.
    const res = await supabase
      .from('users')
      .update({
        bio: u.bio,
        preferred_city_id: u.preferred_city_id,
        preferred_area_id: u.preferred_area_id,
      })
      .eq('user_id', authUser.id);
    must(`profile updated: ${u.username}`, res);
  }
  return userIds;
}

async function seedEvents(userIds) {
  const organizer1 = userIds['seed_user1'];
  const organizer2 = userIds['seed_user3'];

  const placeholderImg = (seed) => `https://picsum.photos/seed/${seed}/800/450`;

  const res = await supabase.from('events').upsert(
    [
      {
        event_id: EVENT.ONE,
        organizer_id: organizer1,
        category_id: CATEGORY.MUSIC,
        city_id: CITY.JHB,
        area_id: AREA.BRAAMFONTEIN,
        title: 'Rooftop Live Sessions',
        description: 'Acoustic sets on the Braamfontein rooftop, sunset start.',
        venue_name: 'The Wolves Braamfontein',
        starts_at: daysFromNow(5, 18),
        ends_at: daysFromNow(5, 22),
        cover_image_url: placeholderImg('livon-event-1'),
        status: 'active',
        price: 0,
      },
      {
        event_id: EVENT.TWO,
        organizer_id: organizer1,
        category_id: CATEGORY.NETWORKING,
        city_id: CITY.JHB,
        area_id: AREA.SANDTON,
        title: 'Founders & Coffee Meetup',
        description: 'Casual monthly meetup for early-stage founders.',
        venue_name: 'Sandton Digital Campus',
        starts_at: daysFromNow(2, 9),
        ends_at: daysFromNow(2, 11),
        cover_image_url: placeholderImg('livon-event-2'),
        status: 'active',
        price: 0,
      },
      {
        event_id: EVENT.THREE,
        organizer_id: organizer2,
        category_id: CATEGORY.FOOD_DRINK,
        city_id: CITY.CPT,
        area_id: AREA.OBSERVATORY,
        title: 'Night Market: Obs Edition',
        description: 'Street food stalls, local vendors, live DJ.',
        venue_name: 'Observatory Main Road',
        starts_at: daysFromNow(9, 17),
        ends_at: daysFromNow(9, 23),
        cover_image_url: placeholderImg('livon-event-3'),
        status: 'active',
        price: 50,
      },
      {
        event_id: EVENT.FOUR,
        organizer_id: organizer2,
        category_id: CATEGORY.ARTS_CULTURE,
        city_id: CITY.CPT,
        area_id: AREA.CITY_BOWL,
        title: 'Gallery Opening: New Voices',
        description: 'Group exhibition opening night, wine and canapés.',
        venue_name: 'City Bowl Project Space',
        starts_at: daysFromNow(14, 18),
        ends_at: daysFromNow(14, 21),
        cover_image_url: placeholderImg('livon-event-4'),
        status: 'active',
        price: 0,
      },
      {
        event_id: EVENT.FIVE,
        organizer_id: organizer1,
        category_id: CATEGORY.NIGHTLIFE,
        city_id: CITY.JHB,
        area_id: AREA.SANDTON,
        title: 'Late Night Sessions',
        description: 'A recent past event — useful for testing feed ordering.',
        venue_name: 'Sandton Rooftop Bar',
        starts_at: daysFromNow(-3, 21),
        ends_at: daysFromNow(-3, 23),
        cover_image_url: placeholderImg('livon-event-5'),
        status: 'active',
        price: 100,
      },
      {
        event_id: EVENT.SIX_CANCELLED,
        organizer_id: organizer1,
        category_id: CATEGORY.SPORTS,
        city_id: CITY.JHB,
        area_id: AREA.BRAAMFONTEIN,
        title: '5-a-side Tournament (Cancelled)',
        description: 'Cancelled — venue booking fell through. Tests cancelled-state filtering.',
        venue_name: 'Braamfontein Sports Club',
        starts_at: daysFromNow(7, 10),
        ends_at: daysFromNow(7, 14),
        cover_image_url: placeholderImg('livon-event-6'),
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        price: 20,
      },
    ],
    { onConflict: 'event_id' }
  );
  must('events seeded', res);
}

async function seedConnections(userIds) {
  const u1 = userIds['seed_user1'];
  const u2 = userIds['seed_user2'];
  const u3 = userIds['seed_user3'];

  const res = await supabase.from('connections').upsert(
    [
      {
        connection_id: CONNECTION.ACCEPTED,
        requester_id: u1,
        receiver_id: u2,
        status: 'accepted',
      },
      {
        connection_id: CONNECTION.PENDING,
        requester_id: u1,
        receiver_id: u3,
        status: 'pending',
      },
    ],
    { onConflict: 'connection_id' }
  );
  must('connections seeded', res);
}

async function seedEventInterests(userIds) {
  const u1 = userIds['seed_user1'];
  const u2 = userIds['seed_user2'];
  const u3 = userIds['seed_user3'];
  const u4 = userIds['seed_user4'];

  const res = await supabase.from('event_interests').upsert(
    [
      { event_interest_id: INTEREST.A, user_id: u2, event_id: EVENT.ONE, visibility: 'visible' },
      { event_interest_id: INTEREST.B, user_id: u3, event_id: EVENT.ONE, visibility: 'visible' },
      { event_interest_id: INTEREST.C, user_id: u4, event_id: EVENT.TWO, visibility: 'private' },
      { event_interest_id: INTEREST.D, user_id: u1, event_id: EVENT.THREE, visibility: 'visible' },
      { event_interest_id: INTEREST.E, user_id: u2, event_id: EVENT.FOUR, visibility: 'private' },
    ],
    { onConflict: 'event_interest_id' }
  );
  must('event_interests seeded', res);
}

async function seedViews(userIds) {
  const u4 = userIds['seed_user4'];

  const viewsRes = await supabase.from('event_views').upsert(
    [
      { event_view_id: EVENT_VIEW.A, event_id: EVENT.ONE, user_id: u4 },
      { event_view_id: EVENT_VIEW.B, event_id: EVENT.THREE, user_id: u4 },
    ],
    { onConflict: 'event_view_id' }
  );
  must('event_views seeded', viewsRes);

  const anonRes = await supabase.from('anonymous_event_views').upsert(
    [
      {
        anon_view_id: ANON_VIEW.A,
        event_id: EVENT.ONE,
        anon_session_id: '22222222-2222-2222-2222-222222222201',
      },
      {
        anon_view_id: ANON_VIEW.B,
        event_id: EVENT.ONE,
        anon_session_id: '22222222-2222-2222-2222-222222222202',
      },
    ],
    { onConflict: 'anon_view_id' }
  );
  must('anonymous_event_views seeded', anonRes);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding Livon dev data...\n');

  await seedCities();
  await seedAreas();
  await seedCategories();

  const userIds = await seedUsers();
  console.log('\nSeed user IDs:', userIds, '\n');

  await seedEvents(userIds);
  await seedConnections(userIds);
  await seedEventInterests(userIds);
  await seedViews(userIds);

  console.log('\nDone. Test login credentials:');
  for (const u of TEST_USERS) {
    console.log(`  ${u.email} / ${u.password}`);
  }
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
