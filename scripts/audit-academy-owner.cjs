// Local owner-flow probes. Never reads environment credentials or contacts Supabase.
// Regression checks for the audited owner flows. SQL generation is also exercised in tests/academy-owner-scheduling.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const results = [];
function load(file, mocks) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('exports', 'require', output)(exports, name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/components/') || name === './academy-training-prices') return new Proxy({}, { get: (_, key) => String(key) });
    if (name.startsWith('@/')) return {};
    return require(name);
  });
  return exports;
}
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', reason: error.message }); }
}
(async () => {
  const db = new PGlite();
  try {
    const own = '10000000-0000-4000-8000-000000000001';
    const other = '10000000-0000-4000-8000-000000000002';
    await db.exec(`CREATE ROLE authenticated; CREATE TABLE academies(id uuid PRIMARY KEY,is_public boolean);
      CREATE FUNCTION current_academy_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${own}'::uuid $$;
      ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON academies TO authenticated;`);
    // Exercise the actual SELECT policies from the checked-in schema.
    const schema = fs.readFileSync('supabase/schema.sql', 'utf8');
    for (const name of ['View own academy', 'Public view public academies']) {
      const start = schema.indexOf(`CREATE POLICY "${name}"`);
      assert.ok(start >= 0);
      await db.exec(schema.slice(start, schema.indexOf(';', start) + 1));
    }
    await db.query('INSERT INTO academies VALUES ($1,false),($2,true)', [own, other]);
    await db.exec('SET ROLE authenticated');
    const visible = (await db.query('SELECT * FROM academies')).rows;
    await db.exec('RESET ROLE');
    const inserted = [];
    let academyContext = own;
    const rpcCalls = [];
    const queries = load('src/lib/queries.ts', {
      '@tanstack/react-query': { useQuery: x => x, useMutation: x => x, useQueryClient: () => ({ invalidateQueries() {} }) },
      '@/lib/supabase/client': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, rpc: async (name, args) => { rpcCalls.push({name,args}); return {data:2,error:null}; }, from: table => {
        let filters = [];
        return {
          select() { return this; }, eq(k,v) { filters.push([k,v]); return this; },
          maybeSingle: async () => {
            if (table === 'profiles') return {data:{academy_id:academyContext},error:null};
            assert.equal(table, 'academies');
            const rows = visible.filter(r => filters.every(([k,v]) => r[k] === v));
            return rows.length > 1 ? { data: null, error: new Error('PGRST116: multiple visible academies') } : { data: rows[0], error: null };
          },
          insert: async rows => { inserted.push(...(Array.isArray(rows) ? rows : [rows])); return { error: null }; },
        };
      } }) },
    });
    await check('Owner academy lookup works alongside another public academy', async () => {
      const academy = await queries.useAcademy().queryFn();
      assert.equal(academy.id, own);
    });
    await db.exec(`CREATE TABLE recurring_schedules(academy_id uuid NOT NULL DEFAULT current_academy_id(),name text)`);
    await check('Account without an academy never falls back to a public academy', async () => {
      academyContext = null;
      assert.equal(await queries.useAcademy().queryFn(), null);
      academyContext = own;
    });
    await check('Recurring creation uses the trusted database default', async () => {
      inserted.length = 0;
      await queries.useCreateRecurringSchedule().mutationFn({name:'Weekly training',weekday:1,time:'18:00',start_date:'2026-10-19',end_date:'2026-10-26'});
      assert.ok(!('academy_id' in inserted[0]));
      await db.query('INSERT INTO recurring_schedules(name) VALUES($1)',[inserted[0].name]);
      assert.equal((await db.query('SELECT academy_id FROM recurring_schedules')).rows[0].academy_id,own);
    });
    await check('Recurring generation delegates a verified schedule ID and returns the count', async () => {
      assert.equal(await queries.useGenerateSessions().mutationFn({id:own}),2);
      assert.deepEqual(rpcCalls.at(-1),{name:'generate_recurring_training_sessions',args:{p_schedule_id:own}});
    });
    let user = { id: 'owner', app_metadata: { role: 'admin' } };
    let profile, existing = null, profileError = null, deleted = null, invitation = null;
    let ownerProfile = {id:'owner',role:'admin',is_active:true,academy_id:own};
    const api = load('src/app/api/admin/users/route.ts', {
      '@/lib/supabase/server': { createClient: () => ({ auth: { getUser: async () => ({ data: { user } }) }, from: () => ({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:ownerProfile,error:null})}) }) },
      '@/lib/supabase/admin': { createAdminClient: () => ({
        auth: { admin: { createUser: async () => ({ data: { user: { id: 'new-member' } }, error: null }), inviteUserByEmail: async (...args) => { invitation=args; return {data:{user:{id:'new-member'}},error:null}; }, deleteUser: async id => { deleted=id; return {error:null}; } } },
        from: () => ({ select(){return this;},eq(){return this;},maybeSingle:async()=>({data:existing,error:null}),update:()=>({eq(){return this;},then:resolve=>Promise.resolve({error:null}).then(resolve)}),upsert: async data => { profile = data; return { error: profileError }; } }),
      }) },
      '@/lib/seo': { SITE_URL: 'https://playza.example' },
    });
    const request = (overrides={}) => new Request('http://localhost/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner-audit@example.invalid', password: 'local-only-test', name: 'Audit member', ...overrides }) });
    await check('New member is explicitly assigned to the verified owner academy', async () => {
      const response = await api.POST(request());
      assert.equal(response.status, 200);
      assert.ok(profile.academy_id, 'service-role upsert and auth metadata omit academy context');
    });
    await check('Creating an unpaid member does not grant paid sessions', async () => {
      assert.equal(profile.subscription_sessions, 0, '8 sessions granted without recording payment');
    });
    await check('Inactive owner cannot create accounts', async () => {
      ownerProfile.is_active=false;
      assert.equal((await api.POST(request())).status,403);
      ownerProfile.is_active=true;
    });
    await check('Profile failure rolls back only the newly created account', async () => {
      profileError=new Error('profile unavailable');
      assert.equal((await api.POST(request())).status,400);
      assert.equal(deleted,'new-member'); profileError=null;
    });
    await check('Trial conversion sends a password setup invitation', async () => {
      assert.equal((await api.POST(request({invite:true,password:undefined}))).status,200);
      assert.equal(invitation[0],'owner-audit@example.invalid');
      assert.equal(invitation[1].redirectTo,'https://playza.example/auth/update-password');
      assert.equal(profile.academy_id,own); assert.equal(profile.subscription_sessions,0);
    });
    await check('Existing account in another academy is never reassigned', async () => {
      existing={id:'elsewhere',role:'member',academy_id:other};
      assert.equal((await api.POST(request())).status,409); existing=null;
    });
    await check('Member role cannot create other accounts', async () => {
      user = { id: 'member', app_metadata: { role: 'member' } };
      assert.equal((await api.POST(request())).status, 403);
    });
    await check('Anonymous visitor cannot create owner-managed accounts', async () => {
      user = null;
      assert.equal((await api.POST(request())).status, 401);
    });
    const pricing = load('src/lib/academy-pricing.ts', {});
    await check('Free training prices and unset prices remain distinct', async () => {
      assert.deepEqual(pricing.parseAcademyPrices('8','0','0'),{monthly_sessions:8,monthly_price:0,tryout_price:0});
      assert.deepEqual(pricing.parseAcademyPrices('','',''),{monthly_sessions:null,monthly_price:null,tryout_price:null});
      for (const values of [['','800','0'],['8','','0'],['0','0','0'],['1.5','800','0'],['8','-1','0'],['8','800','-1'],['8','Infinity','0']]) assert.throws(() => pricing.parseAcademyPrices(...values));
    });
    let pathname = '/upgrade';
    const gate = load('src/components/shared/trial-gate.tsx', {
      react: { useMemo: fn => fn() },
      'next/navigation': { usePathname: () => pathname },
      '@/lib/i18n': { useI18n: () => ({ t: x => x, lang: 'en' }) },
      '@/lib/queries': { useAcademy: () => ({ data: { is_trial: true, trial_ends_at: '2000-01-01T00:00:00Z' } }) },
    });
    for (const route of ['/upgrade', '/checkout']) {
      await check('Expired owner can reach ' + route, async () => {
        pathname = route;
        assert.equal(gate.TrialGate({ isAdmin: true, children: 'owner-content' }).props.children, 'owner-content');
      });
    }
    await check('Expired owner dashboard shows renewal gate', async () => {
      pathname = '/dashboard';
      assert.notEqual(gate.TrialGate({ isAdmin: true, children: 'owner-content' }).props.children, 'owner-content');
    });
    let stateIndex = 0, saved;
    const settings = load('src/components/settings/settings-client.tsx', {
      react: { useState: initial => [stateIndex++ === 0 ? 'Audit Academy' : stateIndex === 13 ? '0' : initial, () => {}], useEffect() {}, useRef: () => ({ current: null }) },
      '@/lib/i18n': { useI18n: () => ({ t: x => x }) },
      '@/lib/queries': { useAcademy: () => ({ data: { id: own }, isLoading: false }), useUpdateAcademy: () => ({ mutateAsync: async data => { saved = data; } }) },
      '@/lib/utils': { errorMessage: error => error.message },
      sonner: { toast: { success() {}, error() {} } },
    });
    await check('Saving a zero-percent platform fee preserves zero', async () => {
      const tree = settings.SettingsClient({ isAdmin: true });
      function find(node) {
        if (!node || typeof node !== 'object') return;
        if (node.props?.onClick && [].concat(node.props.children ?? []).includes('common_save')) return node;
        for (const child of [].concat(node.props?.children ?? [])) { const found = find(child); if (found) return found; }
      }
      const save = find(tree); assert.ok(save, 'Save button found');
      await save.props.onClick();
      assert.equal(saved.platform_fee_percent, 0, 'zero fee silently replaced with 5');
    });
  } finally { await db.close(); }
  for (const result of results) console.log(`${result.status}: ${result.name}${result.reason ? '\n  ' + result.reason.replaceAll('\n',' ') : ''}`);
  console.log(JSON.stringify({ total: results.length, passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length }));
  if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 2; });
