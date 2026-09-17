const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/queries.ts'), 'utf8');
const ast = ts.createSourceFile('queries.ts', source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'useMyUpcomingGames');
const js = ts.transpileModule(declaration.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const today = new Date().toISOString().slice(0, 10);
const game = (id, status = 'open', date = today, time = '18:00') => ({ id, title: id, status, game_date: date, start_time: time, invite_code: 'PRIVATE' });
const rows = [
  { id: 'a', member_id: 'me', is_waitlisted: true, game: game('waitlist', 'full', today, '20:00') },
  { id: 'b', member_id: 'me', is_waitlisted: false, game: game('private') },
  { id: 'c', member_id: 'other', game: game('someone-else') },
  { id: 'd', member_id: 'me', game: game('cancelled', 'cancelled') },
  { id: 'e', member_id: 'me', game: game('completed', 'completed') },
  { id: 'f', member_id: 'me', game: game('past', 'open', '2000-01-01') },
];
let failure = null;
function supabase() {
  return { from: () => {
    let result = rows;
    const read = (row, field) => field.split('.').reduce((v, k) => v[k], row);
    return {
      select() { return this; },
      eq(field, value) { result = result.filter(row => read(row, field) === value); return this; },
      gte(field, value) { result = result.filter(row => read(row, field) >= value); return this; },
      in(field, values) { result = result.filter(row => values.includes(read(row, field))); return Promise.resolve({ data: result, error: failure }); },
    };
  }};
}
const api = {};
new Function('exports', 'useQuery', 'supabase', 'queryKeys', js)(api, options => options, supabase, {myGameParticipants: ['my-game-participants']});
(async () => {
  const query = api.useMyUpcomingGames('me');
  const result = await query.queryFn();
  assert.deepEqual(result.map(row => row.game.id), ['private', 'waitlist']);
  assert.equal(result[1].is_waitlisted, true);
  assert.equal(api.useMyUpcomingGames('').enabled, false);
  failure = new Error('connection failed');
  await assert.rejects(query.queryFn(), /connection failed/);
  console.log('PASS: upcoming participation includes private games and waitlists, excludes other members/past/closed games, sorts chronologically, and exposes errors');
})().catch(error => {console.error(error);process.exitCode = 1;});
