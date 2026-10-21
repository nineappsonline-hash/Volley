const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', js)(module.exports, module);
  return module.exports;
}
function loadWithRequire(path) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', 'require', js)(module.exports, module, require);
  return module.exports;
}
const { isPlatformAdmin, matchesAccountEmail } = load('src/lib/platform-admin.ts');
assert.equal(isPlatformAdmin(null), false);
assert.equal(isPlatformAdmin({ email: 'mo.dowaik@gmail.com' }), false);
assert.equal(isPlatformAdmin({ email: 'other@gmail.com', email_confirmed_at: '2026-01-01', app_metadata: { role: 'super_admin' } }), false);
assert.equal(isPlatformAdmin({ email: 'MO.DOWAIK@gmail.com', email_confirmed_at: '2026-01-01' }), true);
const { rentalCoverage } = load('src/lib/admin-schedule.ts');
assert.deepEqual(rentalCoverage([], '2026-09-07'), { occupied: 0, gaps: ['00:00–24:00'] });
assert.deepEqual(rentalCoverage([
  { rental_date: '2026-09-07', start_time: '10:00:00', hours: 2 },
  { rental_date: '2026-09-07', start_time: '11:00:00', hours: 2 },
], '2026-09-07'), { occupied: 180, gaps: ['00:00–10:00', '13:00–24:00'] });
assert.deepEqual(rentalCoverage([
  { rental_date: '2026-09-06', start_time: '23:00:00', hours: 3 },
  { rental_date: '2026-09-07', start_time: '23:30:00', hours: 2 },
], '2026-09-07'), { occupied: 150, gaps: ['02:00–23:30'] });
console.log('Platform admin access and rental coverage checks passed');
async function checkRoutes() {
  let user = null;
  let adminCalls = 0;
  let saved;
  let savedSettings = [];
  const deleted = [];
  // training_program_slots() rows: one program with two open seats, one that is
  // full (a zero-seat row), and a program the catalog never mentions.
  const programs = [
    { id: '00000000-0000-4000-8000-0000000000a1', name: 'Open group', active: true },
    { id: '00000000-0000-4000-8000-0000000000a2', name: 'Full group', active: true },
    { id: '00000000-0000-4000-8000-0000000000a3', name: 'Unscheduled group', active: true },
  ];
  const catalog = [
    { id: '00000000-0000-4000-8000-0000000000a1', slots: [{ seats_left: 1 }, { seats_left: 1 }] },
    { id: '00000000-0000-4000-8000-0000000000a2', slots: [{ seats_left: 0 }] },
  ];
  let deletionError = null;
  let profileRows = [];
  let profileReadError = null;
  const source = ts.transpileModule(fs.readFileSync('src/app/api/platform-admin/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
    if (name === '@/lib/supabase/server') return { createClient: () => ({ rpc: async (name, args) => {
      if (name !== 'platform_delete_account') return {data:true};
      if (deletionError) return {error:deletionError};
      if (!matchesAccountEmail(args.p_confirmation, 'nayera@gmail.com')) return {error:{code:'P0001',message:'Enter the account email to confirm deletion'}};
      deleted.push(args.p_id); return {error:null};
    }, auth: { getUser: async () => ({ data: { user } }) } }) };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => { adminCalls++; return { rpc: async fn => fn === 'academy_training_catalog' ? { data: catalog, error: null } : { data: null, error: null }, auth: { admin: { getUserById: async id => ({ data: { user: { id, email: 'nayera@gmail.com' } } }), deleteUser: async id => { deleted.push(id); return { error: null }; }, listUsers: async () => ({ data: { users: [] }, error: null }) } }, from: table => {
      if (table === 'sport_settings') {
        return { upsert: row => { savedSettings.push(row); return Promise.resolve({ error: null }); }, select: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }) };
      }
      return {
        select: () => ({ order: () => ({ range: async (start,end) => ({ data: table === 'profiles' ? profileRows.slice(start,end+1) : table === 'academy_training_programs' ? programs : [], error: table === 'profiles' ? profileReadError : null }) }) }),
        update: changes => { assert.equal(table, 'venues'); saved = changes; return { eq: () => ({ select: () => ({ single: async () => ({ error: null }) }) }) }; },
      };
    } }; } };
    if (name === '@/lib/platform-admin') return { isPlatformAdmin, matchesAccountEmail };
    // Load the real module rather than stubbing it so the member_details
    // action is exercised through its actual validation schema.
    if (name === '@/lib/admin/member-details') return loadWithRequire('src/lib/admin/member-details.ts');
    return require(name);
  };
  new Function('exports', 'module', 'require', source)(module.exports, module, mockRequire);
  const { GET, POST } = module.exports;
  assert.equal((await GET()).status, 403);
  assert.equal((await POST({ json: async () => ({}) })).status, 403);
  user = { id: '00000000-0000-4000-8000-000000000001', email: 'someone@gmail.com', email_confirmed_at: '2026-01-01', app_metadata: { role: 'super_admin' } };
  assert.equal((await GET()).status, 403);
  user.email = 'mo.dowaik@gmail.com';
  assert.equal((await POST({ json: async () => ({ action: 'delete', id: user.id, confirmation: user.email }) })).status, 400);
  assert.equal((await POST({ json: async () => ({ action: 'membership', id: 'bad' }) })).status, 400);
  assert.equal(adminCalls, 0);
  const venue = { action: 'venue', id: '00000000-0000-4000-8000-000000000002', name: 'Court', capacity: '12', rental_cost: '150.50', rental_hours: '2', sport_id: '', country: 'Egypt', governorate: 'Cairo', city: 'Nasr City' };
  assert.equal((await POST({ json: async () => venue })).status, 200);
  assert.equal(saved.area, 'Nasr City');
  assert.equal(saved.capacity, 12);
  assert.equal(saved.rental_cost, 150.5);
  assert.equal(saved.sport_id, null);
  assert.equal((await POST({ json: async () => ({ ...venue, rental_hours: '-1' }) })).status, 400);
  assert.equal(adminCalls, 1);
  const memberId = '00000000-0000-4000-8000-000000000003';
  for (const confirmation of ['Nayera', 'wrong@gmail.com', '']) {
    assert.equal((await POST({ json: async () => ({ action: 'delete', id: memberId, confirmation }) })).status, 400);
  }
  assert.deepEqual(deleted, []);
  assert.equal((await POST({ json: async () => ({ action: 'delete', id: memberId, confirmation: '  Nayera@gmail.com  ' }) })).status, 200);
  assert.deepEqual(deleted, [memberId]);
  deletionError = {code:'PGRST202',message:'missing function'};
  const unavailable = await POST({json:async()=>({action:'delete',id:memberId,confirmation:'nayera@gmail.com'})});
  assert.equal(unavailable.status,503);
  assert.match(unavailable.body.error,/20261120000000/);
  deletionError = {code:'23503',message:'private constraint details'};
  const failed = await POST({json:async()=>({action:'delete',id:memberId,confirmation:'nayera@gmail.com'})});
  assert.equal(failed.status,400);
  assert.match(failed.body.error,/rolled back/);
  assert.ok(!failed.body.error.includes('private constraint'));
  assert.deepEqual(deleted,[memberId]);
  deletionError = null;
  assert.equal(matchesAccountEmail('', null), false);
  // sport_setting action: upserts a platform-wide rule; invalid values rejected.
  assert.equal((await POST({ json: async () => ({ action: 'sport_setting', sport: 'Beach Volleyball', min_players: 1 }) })).status, 400);
  assert.equal((await POST({ json: async () => ({ action: 'sport_setting', sport: 'Beach Volleyball', min_players: 99 }) })).status, 400);
  assert.equal((await POST({ json: async () => ({ action: 'sport_setting', sport: '', min_players: 8 }) })).status, 400);
  assert.deepEqual(savedSettings, []);
  assert.equal((await POST({ json: async () => ({ action: 'sport_setting', sport: 'Beach Volleyball', min_players: 8 }) })).status, 200);
  assert.deepEqual(savedSettings.map(r => ({ sport: r.sport, min_players: r.min_players })), [{ sport: 'Beach Volleyball', min_players: 8 }]);
  // Training enrollment needs each group's open seats, which live in the
  // computed catalog rather than on the program row itself.
  const records = await GET();
  assert.equal(records.status, 200);
  const enrolled = new Map(records.body.academy_training_programs.map(p => [p.id, p.slots]));
  assert.deepEqual(enrolled.get('00000000-0000-4000-8000-0000000000a1'), catalog[0].slots, 'every program carries its computed slots');
  assert.equal(enrolled.get('00000000-0000-4000-8000-0000000000a1').filter(s => s.seats_left > 0).length, 2, 'open seats reach the enrollment form');
  assert.equal(enrolled.get('00000000-0000-4000-8000-0000000000a2')[0].seats_left, 0, 'a full group reports a zero seat rather than a missing schedule');
  assert.deepEqual(enrolled.get('00000000-0000-4000-8000-0000000000a3'), [], 'a program absent from the catalog reports no slots instead of crashing');
  profileRows = Array.from({length:1001},(_,i)=>({id:`member-${i}`,name:`Member ${i}`,created_at:'2026-10-01T10:00:00Z'}));
  const allMembers = await GET();
  assert.equal(allMembers.body.profiles.length,1001,'admin records include members beyond the first page');
  profileRows.push({id:'new-signup',name:'New member',created_at:'2026-10-22T10:00:00Z'});
  const refreshedMembers = await GET();
  assert.equal(refreshedMembers.body.profiles.length,1002);
  assert.ok(refreshedMembers.body.profiles.some(p=>p.id==='new-signup'),'a new signup appears on the next uncached request');
  profileReadError = {code:'42501',message:'test profile read failure'};
  const profileFailure = await GET();
  assert.equal(profileFailure.status,500,'profile read errors cannot silently hide every member');
  assert.ok(!profileFailure.body.error.includes('test profile read failure'),'database details stay private');
  console.log('Admin route authorization, full member pagination, fresh signups, explicit profile errors and training slots checks passed');
}
checkRoutes().catch(error => { console.error(error); process.exitCode = 1; });
