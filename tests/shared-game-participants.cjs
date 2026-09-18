const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../src/lib/public-games.ts'),'utf8');
const ast = ts.createSourceFile('public-games.ts',source,ts.ScriptTarget.Latest,true);
const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'getGameByInviteCode');
const js = ts.transpileModule(fn.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
let requestedCode;
let selected;
let excluded;
let noStoreCalls = 0;
const sample = {id:'game',title:'Game',status:'open',participants:[{id:'a',player_name:'Alice',is_waitlisted:false},{id:'b',player_name:'Bob',is_waitlisted:true}],playground:null};
const api = {};
new Function('exports','noStore','getAdmin',js)(api,() => noStoreCalls++,() => ({from:() => ({
  select(columns){selected=columns;return this;},eq(key,value){assert.equal(key,'invite_code');requestedCode=value;return this;},
  neq(key,value){excluded=[key,value];return this;},limit(){return this;},
  async single(){return requestedCode==='VALID' ? {data:sample,error:null} : {data:null,error:new Error('missing')};}
})}));
(async () => {
  const game = await api.getGameByInviteCode(' valid ');
  assert.deepEqual(game.participants,sample.participants);
  assert.equal(game.joined,1);
  assert.deepEqual(excluded,['status','cancelled']);
  assert.match(selected,/friendly_game_participants\(id, player_name, is_waitlisted\)/);
  assert.doesNotMatch(selected,/member_id|pay_status|pay_receipt|email/);
  assert.equal(await api.getGameByInviteCode('invalid'),null);
  assert.equal(noStoreCalls,2);
  console.log('PASS: invite-scoped participant names, waitlist counts, invalid codes, minimal fields, and uncached reads');
})().catch(error => {console.error(error);process.exitCode=1;});
