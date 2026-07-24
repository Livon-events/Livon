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

const MASERU_CITY_FALLBACK_ID = '11111111-1111-1111-1111-111111111102';
const MASERU_CENTRAL_AREA_FALLBACK_ID = '11111111-1111-1111-1111-111111111203';

const CATEGORY = {
  SPORTS: '11111111-1111-1111-1111-111111111302',
  ARTS_CULTURE: '11111111-1111-1111-1111-111111111304',
  NIGHTLIFE: '11111111-1111-1111-1111-111111111306',
};

const STALE_CATEGORY_IDS = [
  '11111111-1111-1111-1111-111111111301', // Music
  '11111111-1111-1111-1111-111111111303', // Food & Drink
  '11111111-1111-1111-1111-111111111305', // Networking
];

const EVENT = {
  ONE: '11111111-1111-1111-1111-111111111401',
  TWO: '11111111-1111-1111-1111-111111111402',
  THREE: '11111111-1111-1111-1111-111111111403',
  FOUR: '11111111-1111-1111-1111-111111111404',
  FIVE: '11111111-1111-1111-1111-111111111405',
  SIX_CANCELLED: '11111111-1111-1111-1111-111111111406',
  SEVEN: '11111111-1111-1111-1111-111111111407',
  EIGHT: '11111111-1111-1111-1111-111111111408',
  NINE: '11111111-1111-1111-1111-111111111409',
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
  F: '11111111-1111-1111-1111-111111111606',
  G: '11111111-1111-1111-1111-111111111607',
  H: '11111111-1111-1111-1111-111111111608',
};

const EVENT_VIEW = {
  A: '11111111-1111-1111-1111-111111111701',
  B: '11111111-1111-1111-1111-111111111702',
};

const ANON_VIEW = {
  A: '11111111-1111-1111-1111-111111111801',
  B: '11111111-1111-1111-1111-111111111802',
};

// Profile fields keyed by username — filled in with real city/area ids at
// runtime once seedLocation() has resolved them (see main()).
const TEST_USER_DEFS = [
  {
    email: 'seed.user1@livonseed.test',
    password: 'SeedUser1!23',
    username: 'seed_user1',
    bio: 'Seed test account #1 — organizer of most seed events, Maseru Central.',
    hasLocationPreference: true,
  },
  {
    email: 'seed.user2@livonseed.test',
    password: 'SeedUser2!23',
    username: 'seed_user2',
    bio: 'Seed test account #2 — regular attendee, Maseru Central.',
    hasLocationPreference: true,
  },
  {
    email: 'seed.user3@livonseed.test',
    password: 'SeedUser3!23',
    username: 'seed_user3',
    bio: 'Seed test account #3 — Maseru based, hosts arts & nightlife events.',
    hasLocationPreference: true,
  },
  {
    email: 'seed.user4@livonseed.test',
    password: 'SeedUser4!23',
    username: 'seed_user4',
    bio: 'Seed test account #4 — no city preference set.',
    hasLocationPreference: false, // deliberate test case: null city/area preference
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

/**
 * Resolves the canonical Maseru city id and Maseru Central area id, then
 * deletes every OTHER row in `cities`/`areas` so exactly one of each
 * survives. Robust to however many stray city/area rows already exist from
 * earlier partial fixes — this doesn't assume any particular prior state.
 *
 * Order matters: areas are pruned before cities (areas.city_id -> cities.city_id
 * FK would otherwise block deleting a city that still has area rows pointing
 * at it).
 */
async function seedLocation() {
  // --- City ---
  const { data: existingCity, error: cityLookupError } = await supabase
    .from('cities')
    .select('city_id')
    .eq('name', 'Maseru')
    .maybeSingle();
  if (cityLookupError) throw cityLookupError;

  let cityId = existingCity?.city_id ?? MASERU_CITY_FALLBACK_ID;

  if (existingCity) {
    console.log(`✓ found existing Maseru city row (${cityId}) — reusing it`);
  } else {
    const res = await supabase
      .from('cities')
      .upsert([{ city_id: cityId, name: 'Maseru' }], { onConflict: 'city_id' });
    must('Maseru city created', res);
  }

  // --- Area ---
  const { data: existingArea, error: areaLookupError } = await supabase
    .from('areas')
    .select('area_id')
    .eq('city_id', cityId)
    .eq('name', 'Maseru Central')
    .maybeSingle();
  if (areaLookupError) throw areaLookupError;

  let areaId = existingArea?.area_id ?? MASERU_CENTRAL_AREA_FALLBACK_ID;

  if (existingArea) {
    console.log(`✓ found existing Maseru Central area row (${areaId}) — reusing it`);
  } else {
    const res = await supabase
      .from('areas')
      .upsert([{ area_id: areaId, city_id: cityId, name: 'Maseru Central' }], {
        onConflict: 'area_id',
      });
    must('Maseru Central area created', res);
  }

  // --- Repoint any stray references first ---
  // If ANY user (not just the 4 seed accounts — e.g. a real account used
  // while testing the header picker) still has preferred_city_id pointing
  // at a retired city, or ANY event still has city_id pointing at one, the
  // prune below would hit a foreign-key violation and silently no-op
  // (logged as a warning, not a crash) — leaving the stale row behind.
  // Repoint everything onto the canonical city/area first so the prune can
  // never be blocked like that again.
  const { data: strayUsers, error: strayUsersError } = await supabase
    .from('users')
    .select('user_id, preferred_area_id')
    .not('preferred_city_id', 'is', null)
    .neq('preferred_city_id', cityId);
  if (strayUsersError) throw strayUsersError;

  for (const u of strayUsers ?? []) {
    const res = await supabase
      .from('users')
      .update({
        preferred_city_id: cityId,
        // Preserve an existing "All areas" (null) selection; otherwise the
        // old specific area is gone, so repoint to the one that survives.
        preferred_area_id: u.preferred_area_id === null ? null : areaId,
      })
      .eq('user_id', u.user_id);
    if (res.error) throw res.error;
  }
  if ((strayUsers ?? []).length) {
    console.log(`✓ repointed ${strayUsers.length} user(s) off a retired city/area onto Maseru`);
  }

  const strayEventsRes = await supabase
    .from('events')
    .update({ city_id: cityId, area_id: areaId })
    .neq('city_id', cityId);
  if (strayEventsRes.error) throw strayEventsRes.error;
  console.log('✓ repointed any stray events onto Maseru / Maseru Central');

  // --- Prune every other area, then every other city ---
  const areaPruneRes = await supabase.from('areas').delete().neq('area_id', areaId);
  if (areaPruneRes.error) {
    console.warn(
      `⚠ could not prune extra areas (${areaPruneRes.error.message}) — check nothing still references them`
    );
  } else {
    console.log('✓ pruned any other area rows (Maseru Central is now the only one)');
  }

  const cityPruneRes = await supabase.from('cities').delete().neq('city_id', cityId);
  if (cityPruneRes.error) {
    console.warn(
      `⚠ could not prune extra cities (${cityPruneRes.error.message}) — check nothing still references them`
    );
  } else {
    console.log('✓ pruned any other city rows (Maseru is now the only one)');
  }

  return { cityId, areaId };
}

async function seedCategories() {
  const res = await supabase
    .from('categories')
    .upsert(
      [
        { category_id: CATEGORY.SPORTS, name: 'Sports' },
        { category_id: CATEGORY.ARTS_CULTURE, name: 'Arts & Culture' },
        { category_id: CATEGORY.NIGHTLIFE, name: 'Nightlife' },
      ],
      { onConflict: 'category_id' }
    );
  must('categories seeded', res);
}

async function seedUsers({ cityId, areaId }) {
  const userIds = {};
  for (const u of TEST_USER_DEFS) {
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
        preferred_city_id: u.hasLocationPreference ? cityId : null,
        preferred_area_id: u.hasLocationPreference ? areaId : null,
      })
      .eq('user_id', authUser.id);
    must(`profile updated: ${u.username}`, res);
  }
  return userIds;
}

async function seedEvents(userIds, { cityId, areaId }) {
  const organizer1 = userIds['seed_user1'];
  const organizer2 = userIds['seed_user3'];

  const placeholderImg = (seed) => `https://picsum.photos/seed/${seed}/800/450`;

  const res = await supabase.from('events').upsert(
    [
      {
        event_id: EVENT.ONE,
        organizer_id: organizer1,
        category_id: CATEGORY.SPORTS,
        city_id: cityId,
        area_id: areaId,
        title: 'Basotho Derby: 5-a-side Showcase',
        description: 'Local 5-a-side clubs face off, sunset kickoff.',
        venue_name: 'LNDC Sports Complex',
        starts_at: daysFromNow(5, 18),
        ends_at: daysFromNow(5, 22),
        cover_image_url: placeholderImg('livon-event-1'),
        status: 'active',
        price: 0,
      },
      {
        event_id: EVENT.TWO,
        organizer_id: organizer1,
        category_id: CATEGORY.ARTS_CULTURE,
        city_id: cityId,
        area_id: areaId,
        title: 'Thaba Bosiu Heritage Talk & Exhibit',
        description: 'A morning talk and small exhibit on Basotho heritage and Moshoeshoe I.',
        venue_name: 'Maseru National Museum',
        starts_at: daysFromNow(2, 9),
        ends_at: daysFromNow(2, 11),
        cover_image_url: placeholderImg('livon-event-2'),
        status: 'active',
        price: 0,
      },
      {
        event_id: EVENT.THREE,
        organizer_id: organizer2,
        category_id: CATEGORY.NIGHTLIFE,
        city_id: cityId,
        area_id: areaId,
        title: 'Friday Night Sessions: Maseru Edition',
        description: 'Live DJ sets and local vendors, weekly Friday night gathering.',
        venue_name: 'Maseru Club',
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
        city_id: cityId,
        area_id: areaId,
        title: 'Gallery Opening: New Voices',
        description: 'Group exhibition opening night, wine and canapés.',
        venue_name: 'Limkokwing Gallery',
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
        city_id: cityId,
        area_id: areaId,
        title: 'Late Night Sessions',
        description: 'A recent past event — useful for testing feed ordering.',
        venue_name: 'Pioneer Mall Rooftop Bar',
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
        city_id: cityId,
        area_id: areaId,
        title: '5-a-side Tournament (Cancelled)',
        description: 'Cancelled — venue booking fell through. Tests cancelled-state filtering.',
        venue_name: 'Maseru Central Sports Grounds',
        starts_at: daysFromNow(7, 10),
        ends_at: daysFromNow(7, 14),
        cover_image_url: placeholderImg('livon-event-6'),
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        price: 20,
      },
      {
        event_id: EVENT.SEVEN,
        organizer_id: organizer1,
        category_id: CATEGORY.SPORTS,
        city_id: cityId,
        area_id: areaId,
        title: 'Likhopo Cycling Trail Ride',
        description: 'Group cycling ride along the Likhopo trails, all levels welcome.',
        venue_name: 'Maseru Central Trailhead',
        starts_at: daysFromNow(11, 7),
        ends_at: daysFromNow(11, 10),
        cover_image_url: placeholderImg('livon-event-7'),
        status: 'active',
        price: 0,
      },
      {
        event_id: EVENT.EIGHT,
        organizer_id: organizer2,
        category_id: CATEGORY.ARTS_CULTURE,
        city_id: cityId,
        area_id: areaId,
        title: 'Basotho Blanket Weaving Showcase',
        description: 'Local weavers demonstrate traditional Basotho blanket-making techniques.',
        venue_name: 'Maseru Cultural Centre',
        starts_at: daysFromNow(4, 10),
        ends_at: daysFromNow(4, 13),
        cover_image_url: placeholderImg('livon-event-8'),
        status: 'active',
        price: 0,
      },
      {
        event_id: EVENT.NINE,
        organizer_id: organizer1,
        category_id: CATEGORY.NIGHTLIFE,
        city_id: cityId,
        area_id: areaId,
        title: 'Sesotho Sounds: Live DJ Night',
        description: 'A night of local Sesotho house and afrobeats, rooftop setting.',
        venue_name: 'Maseru Club Rooftop',
        starts_at: daysFromNow(6, 19),
        ends_at: daysFromNow(6, 23),
        cover_image_url: placeholderImg('livon-event-9'),
        status: 'active',
        price: 30,
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
      { event_interest_id: INTEREST.F, user_id: u2, event_id: EVENT.SEVEN, visibility: 'visible' },
      { event_interest_id: INTEREST.G, user_id: u4, event_id: EVENT.EIGHT, visibility: 'private' },
      { event_interest_id: INTEREST.H, user_id: u3, event_id: EVENT.NINE, visibility: 'visible' },
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

/**
 * Deletes retired category rows (Music / Food & Drink / Networking) now
 * that seedCategories()/seedEvents() have already run — every event was
 * repointed to one of the 3 surviving categories above, so nothing should
 * reference these ids anymore. Must run AFTER seedEvents(), or the delete
 * fails on the events.category_id FK (NOT NULL, references categories).
 * Safe to re-run: no-ops once the rows are gone.
 */
async function removeStaleCategoryRows() {
  const res = await supabase.from('categories').delete().in('category_id', STALE_CATEGORY_IDS);
  if (res.error) {
    console.warn(
      `⚠ could not remove stale categories (${res.error.message}) — check nothing still references them`
    );
    return;
  }
  console.log('✓ stale categories removed (Music / Food & Drink / Networking, or already gone)');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding Livon dev data...\n');

  const { cityId, areaId } = await seedLocation();
  console.log(`\nResolved location — city: ${cityId}, area: ${areaId}\n`);

  await seedCategories();

  const userIds = await seedUsers({ cityId, areaId });
  console.log('\nSeed user IDs:', userIds, '\n');

  await seedEvents(userIds, { cityId, areaId });
  await seedConnections(userIds);
  await seedEventInterests(userIds);
  await seedViews(userIds);

  await removeStaleCategoryRows();

  console.log('\nDone. Test login credentials:');
  for (const u of TEST_USER_DEFS) {
    console.log(`  ${u.email} / ${u.password}`);
  }
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
