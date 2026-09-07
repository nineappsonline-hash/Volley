const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', js)(module.exports, module);
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
  const deleted = [];
  const source = ts.transpileModule(fs.readFileSync('src/app/api/platform-admin/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
    if (name === '@/lib/supabase/server') return { createClient: () => ({ rpc: async () => ({ data: true }), auth: { getUser: async () => ({ data: { user } }) } }) };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => { adminCalls++; return { auth: { admin: { getUserById: async id => ({ data: { user: { id, email: 'nayera@gmail.com' } } }), deleteUser: async id => { deleted.push(id); return { error: null }; } } }, from: table => { assert.equal(table, 'venues'); return { update: changes => { saved = changes; return { eq: () => ({ select: () => ({ single: async () => ({ error: null }) }) }) }; } }; } };  } };
    if (name === '@/lib/platform-admin') return { isPlatformAdmin, matchesAccountEmail };
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
  assert.equal(matchesAccountEmail('', null), false);
  console.log('Admin route authorization, validation, and self-protection checks passed');
}
checkRoutes().catch(error => { console.error(error); process.exitCode = 1; });
