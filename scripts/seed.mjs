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
  FAITH_WORSHIP: '11111111-1111-1111-1111-111111111302',
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

// Stable keys for cross-referencing in seedEvents / connections / interests.
const USER = {
  THABO: 'thabo',
  LERATO: 'lerato',
  NTSIKELELO: 'ntsi',
  PULANE: 'pulane',
};

// Profile fields — city/area ids are filled at runtime in seedUsers() after
// seedLocation() resolves Maseru Central.
const TEST_USER_DEFS = [
  {
    key: USER.THABO,
    email: 'thabo.moleko@livonseed.test',
    password: 'ThaboMoleko!23',
    username: 'thabo_moleko',
    bio: 'Everyday is my birthday\nThe best organizer around maseru central',
    hasLocationPreference: true,
    instagramUrl: 'https://instagram.com/thabo_moleko_ls',
    tiktokUrl: 'https://tiktok.com/@thabo_moleko_ls',
    facebookUrl: null,
    youtubeUrl: 'https://youtube.com/@thabo_moleko_football',
  },
  {
    key: USER.LERATO,
    email: 'lerato.sekhonyana@livonseed.test',
    password: 'LeratoSekh!23',
    username: 'lerato_sekhonyana',
    bio: 'Maseru local — always on the guestlist for heritage talks and gallery openings. Blanket season is year-round.',
    hasLocationPreference: true,
    instagramUrl: 'https://instagram.com/lerato.sekhonyana',
    tiktokUrl: null,
    facebookUrl: 'https://facebook.com/lerato.sekhonyana.maseru',
    youtubeUrl: null,
  },
  {
    key: USER.NTSIKELELO,
    email: 'ntsi.mokone@livonseed.test',
    password: 'NtsiMokone!23',
    username: 'ntsi_mokone',
    bio: 'Friday night sessions & arts in Maseru. DJ sets, weaving showcases, rooftop vibes.',
    hasLocationPreference: true,
    instagramUrl: 'https://instagram.com/ntsi_mokone',
    tiktokUrl: 'https://tiktok.com/@ntsi_mokone',
    facebookUrl: 'https://facebook.com/ntsi.mokone.events',
    youtubeUrl: 'https://youtube.com/@ntsi_mokone_sessions',
  },
  {
    key: USER.PULANE,
    email: 'pulane.mohapi@livonseed.test',
    password: 'PulaneMohapi!23',
    username: 'pulane_mohapi',
    bio: 'Still choosing my corner of Maseru — browsing events before I set a home area on Livon.',
    hasLocationPreference: false, // deliberate test case: null city/area preference
    instagramUrl: 'https://instagram.com/pulane_mohapi',
    tiktokUrl: 'https://tiktok.com/@pulane_mohapi',
    facebookUrl: null,
    youtubeUrl: null,
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

const BEREA_COMMUNITY_COUNCIL_AREAS = [
  'Teyateyaneng (TY)',
  'Kanana',
  'Khubetsoana',
  'Kueneng',
  'Mabote',
  'Makeoana',
  'Makhoroana',
  'Maluba-Lube',
  'Mapoteng',
  'Motanasela',
  'Phuthiatsana',
  'Senekane',
  'Tebe-Tebe',
];

/**
 * Resolves the canonical Maseru city id and Maseru Central area id used by
 * seed events, and ensures Berea + its councils exist. Does not prune other
 * cities/areas — those are product location data and must survive a seed run.
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

  const { data: existingBerea, error: bereaLookupError } = await supabase
    .from('cities')
    .select('city_id')
    .eq('name', 'Berea')
    .maybeSingle();
  if (bereaLookupError) throw bereaLookupError;

  let bereaCityId = existingBerea?.city_id;
  if (!bereaCityId) {
    const created = await supabase
      .from('cities')
      .insert({ name: 'Berea' })
      .select('city_id')
      .single();
    must('Berea city created', created);
    bereaCityId = created.data?.city_id;
    if (!bereaCityId) throw new Error('Berea city insert returned no city_id');
  } else {
    console.log(`✓ found existing Berea city row (${bereaCityId}) — reusing it`);
  }

  const bereaAreasRes = await supabase.from('areas').upsert(
    BEREA_COMMUNITY_COUNCIL_AREAS.map((name) => ({ city_id: bereaCityId, name })),
    { onConflict: 'city_id,name', ignoreDuplicates: true }
  );
  must('Berea areas upserted', bereaAreasRes);

  return { cityId, areaId };
}

async function seedCategories() {
  const res = await supabase
    .from('categories')
    .upsert(
      [
        { category_id: CATEGORY.FAITH_WORSHIP, name: 'Faith & Worship' },
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
    userIds[u.key] = authUser.id;

    // handle_new_user trigger already created/updates the base public.users row
    // (user_id, email, username, avatar_url) on auth user creation. Update the
    // remaining profile fields here — this also covers the case where the auth
    // user already existed from a previous run.
    const res = await supabase
      .from('users')
      .update({
        username: u.username,
        bio: u.bio,
        instagram_url: u.instagramUrl,
        tiktok_url: u.tiktokUrl,
        facebook_url: u.facebookUrl,
        youtube_url: u.youtubeUrl,
        preferred_city_id: u.hasLocationPreference ? cityId : null,
        preferred_area_id: u.hasLocationPreference ? areaId : null,
      })
      .eq('user_id', authUser.id);
    must(`profile updated: ${u.username}`, res);
  }
  return userIds;
}

async function seedEvents(userIds, { cityId, areaId }) {
  const organizer1 = userIds[USER.THABO];
  const organizer2 = userIds[USER.NTSIKELELO];

  const placeholderImg = (seed) => `https://picsum.photos/seed/${seed}/800/450`;

  const res = await supabase.from('events').upsert(
    [
      {
        event_id: EVENT.ONE,
        organizer_id: organizer1,
        category_id: CATEGORY.FAITH_WORSHIP,
        city_id: cityId,
        area_id: areaId,
        title: 'Basotho Derby: 5-a-side Showcase',
        description: 'Local 5-a-side clubs face off, sunset kickoff.',
        venue_name: 'LNDC Sports Complex',
        starts_at: daysFromNow(32, 18),
        ends_at: daysFromNow(32, 22),
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
        starts_at: daysFromNow(35, 9),
        ends_at: daysFromNow(35, 11),
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
        starts_at: daysFromNow(38, 17),
        ends_at: daysFromNow(38, 23),
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
        starts_at: daysFromNow(42, 18),
        ends_at: daysFromNow(42, 21),
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
        description: 'Rooftop late-night sets with local DJs.',
        venue_name: 'Pioneer Mall Rooftop Bar',
        starts_at: daysFromNow(45, 21),
        ends_at: daysFromNow(45, 23),
        cover_image_url: placeholderImg('livon-event-5'),
        status: 'active',
        price: 100,
      },
      {
        event_id: EVENT.SIX_CANCELLED,
        organizer_id: organizer1,
        category_id: CATEGORY.FAITH_WORSHIP,
        city_id: cityId,
        area_id: areaId,
        title: '5-a-side Tournament (Cancelled)',
        description: 'Cancelled — venue booking fell through. Tests cancelled-state filtering.',
        venue_name: 'Maseru Central Sports Grounds',
        starts_at: daysFromNow(48, 10),
        ends_at: daysFromNow(48, 14),
        cover_image_url: placeholderImg('livon-event-6'),
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        price: 20,
      },
      {
        event_id: EVENT.SEVEN,
        organizer_id: organizer1,
        category_id: CATEGORY.FAITH_WORSHIP,
        city_id: cityId,
        area_id: areaId,
        title: 'Likhopo Cycling Trail Ride',
        description: 'Group cycling ride along the Likhopo trails, all levels welcome.',
        venue_name: 'Maseru Central Trailhead',
        starts_at: daysFromNow(51, 7),
        ends_at: daysFromNow(51, 10),
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
        starts_at: daysFromNow(55, 10),
        ends_at: daysFromNow(55, 13),
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
        starts_at: daysFromNow(60, 19),
        ends_at: daysFromNow(60, 23),
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
  const u1 = userIds[USER.THABO];
  const u2 = userIds[USER.LERATO];
  const u3 = userIds[USER.NTSIKELELO];

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
  const u1 = userIds[USER.THABO];
  const u2 = userIds[USER.LERATO];
  const u3 = userIds[USER.NTSIKELELO];
  const u4 = userIds[USER.PULANE];

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
  const u4 = userIds[USER.PULANE];

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

  console.log('\nDone. Test login credentials (Basotho seed personas):');
  for (const u of TEST_USER_DEFS) {
    console.log(`  @${u.username} — ${u.email} / ${u.password}`);
  }
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
