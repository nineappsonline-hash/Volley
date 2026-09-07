const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', js)(module.exports, module);
  return module.exports;
}
const { isPlatformAdmin } = load('src/lib/platform-admin.ts');
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
  const source = ts.transpileModule(fs.readFileSync('src/app/api/platform-admin/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
    if (name === '@/lib/supabase/server') return { createClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }) };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => { adminCalls++; throw new Error('Unexpected privileged access'); } };
    if (name === '@/lib/platform-admin') return { isPlatformAdmin };
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
  console.log('Admin route authorization, validation, and self-protection checks passed');
}
checkRoutes().catch(error => { console.error(error); process.exitCode = 1; });
