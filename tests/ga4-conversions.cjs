const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
function storage(map=new Map()){return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
const local=storage(),session=storage();
let location=new URL('https://playza.test/sports/tennis?utm_source=google&utm_medium=organic&utm_campaign=tennis_october&utm_id=fall2026&utm_content=hero&utm_term=tennis&email=private@example.com');
const w={location,sessionStorage:session,localStorage:local,crypto:webcrypto,playzaGaConfigured:true,navigator:{doNotTrack:'0'},dataLayer:[]};
global.window=w;global.document={referrer:'https://www.google.com/search?q=private@example.com'};
let user=null,profile=null,seat=null,game={sport:'Tennis',area:'New Cairo',playground:{country:'Egypt',governorate:'Cairo',area:'New Cairo'}},rpcResult={data:false,error:null},readError=null;
const client={auth:{getUser:async()=>({data:{user},error:null})},from:table=>{const chain={select(){return chain},eq(){return chain},maybeSingle:async()=>({data:table==='profiles'?profile:table==='friendly_game_participants'?seat:table==='friendly_games'?game:table==='academies'?{country:'Egypt',governorate:'Cairo',area:'New Cairo'}:null,error:readError}),then(resolve){resolve({data:table==='sports'?[{name:'Tennis'}]:[],error:null})}};return chain;}};
function load(rel,cache=new Map()){
 const file=path.join(root,rel);if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);
 const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('exports','require',output)(out,id=>{
 if(id==='@/lib/supabase/client')return {createClient:()=>client};
 if(id.startsWith('@/'))return load('src/'+id.slice(2)+'.ts',cache);
 if(id.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(file),id+'.ts')),cache);
 return require(id);
 });return out;
}
const cache=new Map(),events=load('src/lib/analytics/events.ts',cache),reg=load('src/lib/analytics/registrations.ts',cache);
const commands=()=>w.dataLayer.map(x=>Array.from(x));const sent=name=>commands().filter(x=>x[0]==='event'&&(!name||x[1]===name));
const flush=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
 events.trackPageView();assert.equal(sent('page_view').length,1);
 assert.equal(events.journey().journey_medium,'organic');
 const initial=sent('page_view')[0][2];assert.equal(initial.entry_page,'/sports/tennis');assert.ok(!JSON.stringify(initial).includes('private@'));assert.ok(!initial.page_referrer.includes('?'));
 w.location=new URL('https://playza.test/signup?redirectedFrom=%2Fgames%3Fjoin%3DSECRET&code=PRIVATE');
 events.trackBusinessEvent('join_game_click',{sport:'Tennis',country:'Egypt',governorate:'Cairo',city:'New Cairo',email:'private@example.com',amount:100,phone:'01012345678'});
 const intent=sent('join_game_click')[0][2];assert.equal(intent.sport,'tennis');assert.equal(intent.journey_campaign,'tennis_october');assert.ok(intent.page_location.includes('utm_content=hero'));assert.ok(intent.page_location.includes('utm_term=tennis'));assert.ok(intent.page_location.includes('utm_id=fall2026'));assert.ok(!('email' in intent));assert.ok(!('amount' in intent));assert.ok(!('phone' in intent));assert.equal(intent.city,'New Cairo');
 assert.deepEqual(events.analyticsContext({sport:'Private Person',country:'private@example.com',city:'01012345678',governorate:'Person Name'}),{});
 events.trackView('game_view','local-game',{sport:'Volleyball'});events.trackView('game_view','local-game',{sport:'Volleyball'});assert.equal(sent('game_view').length,1);
 events.trackView('academy_view','local-academy',{sport:'Tennis'});events.trackView('academy_view','local-academy',{});assert.equal(sent('academy_view').length,1);
 reg.academyRegistrationClick('local-academy',{sport:'Tennis'});assert.equal(sent('academy_registration_click').length,1);
 await Promise.all([events.trackCompletion('venue_registration_started','session-1'),events.trackCompletion('venue_registration_started','session-1')]);assert.equal(sent('venue_registration_started').length,1);
 await events.trackCompletion('academy_owner_registration_started','session-1');assert.equal(sent('academy_owner_registration_started').length,1);
 user={id:'local-account',created_at:new Date().toISOString()};profile={role:'member',phone:'PRIVATE',gender:'male',birth_date:'PRIVATE',academy_id:null};
 reg.startSignup('player','email',{sport:'Tennis'});reg.rememberSignupUser(user.id);await reg.confirmPendingSignup();await reg.confirmPendingSignup();assert.equal(sent('player_signup_completed').length,1);
 // New module instance simulates refresh: persistent deduplication survives module/component state loss.
 const reloaded=load('src/lib/analytics/events.ts');await reloaded.trackCompletion('player_signup_completed',user.id);assert.equal(sent('player_signup_completed').length,1);
 user={id:'email-confirmation-user',created_at:new Date().toISOString()};reg.startSignup('player','email');reg.rememberSignupUser(user.id);const saved=user;user=null;await reg.confirmPendingSignup();assert.equal(sent('player_signup_completed').length,1);user=saved;await reg.confirmPendingSignup();assert.equal(sent('player_signup_completed').length,2);
 reg.startSignup('player','google');user={id:'old-google-user',created_at:'2020-01-01T00:00:00Z'};await reg.confirmPendingSignup();assert.equal(sent('player_signup_completed').length,2);
 reg.startSignup('player','google');user={id:'new-google-user',created_at:new Date().toISOString()};profile.phone=null;await reg.confirmPendingSignup();assert.equal(sent('player_signup_completed').length,2);profile.phone='PRIVATE';await reg.confirmPendingSignup();assert.equal(sent('player_signup_completed').length,3);
 user={id:'venue-owner',created_at:new Date().toISOString()};profile={role:'member'};reg.startSignup('venue','email',{sport:'Basketball'});await reg.confirmPendingSignup();assert.equal(sent('venue_registration_completed').length,0);profile={role:'playground_owner'};await reg.confirmPendingSignup();assert.equal(sent('venue_registration_completed').length,1);
 user={id:'academy-owner',created_at:new Date().toISOString()};profile={role:'admin',academy_id:null};reg.startSignup('academy_owner','email');await reg.confirmPendingSignup();assert.equal(sent('academy_owner_registration_completed').length,0);profile.academy_id='local-academy';await reg.confirmPendingSignup();assert.equal(sent('academy_owner_registration_completed').length,1);
 user={id:'player-seat',created_at:new Date().toISOString()};await reg.confirmGameRegistration('game-a');assert.equal(sent('game_registration_completed').length,0);seat={is_waitlisted:true,pay_status:'approved'};await reg.confirmGameRegistration('game-a');assert.equal(sent('game_registration_completed').length,0);seat={is_waitlisted:false,pay_status:'unpaid'};await reg.confirmGameRegistration('game-a');assert.equal(sent('game_registration_completed').length,0);seat.pay_status='pending';readError={message:'offline'};await reg.confirmGameRegistration('game-a');assert.equal(sent('game_registration_completed').length,0);readError=null;await reg.confirmGameRegistration('game-a');await reg.confirmGameRegistration('game-a');assert.equal(sent('game_registration_completed').length,1);
 reg.rememberGameJoin('game-card');seat.pay_status='approved';await reg.confirmPendingGameRegistration();await reg.confirmPendingGameRegistration();assert.equal(sent('game_registration_completed').length,2);
 profile={role:'member',academy_id:'local-academy'};await reg.confirmAcademyRegistration('local-academy');await reg.confirmAcademyRegistration('local-academy');assert.equal(sent('academy_registration_completed').length,1);
 await events.trackCompletion('academy_registration_completed','player-seat:booking-a:training',{registration_type:'training_reservation',sport:'Tennis'});assert.equal(sent('academy_registration_completed').length,2);
 const before=sent().length;w.navigator.globalPrivacyControl=true;events.trackBusinessEvent('join_game_click');await events.trackCompletion('game_registration_completed','blocked');assert.equal(sent().length,before);w.navigator.globalPrivacyControl=false;w.playzaAnalyticsConsent='denied';events.trackPageView();assert.equal(sent().length,before);delete w.playzaAnalyticsConsent;w['ga-disable-G-XJPEX3WY2B']=true;events.trackBusinessEvent('game_view');assert.equal(sent().length,before);delete w['ga-disable-G-XJPEX3WY2B'];w.navigator.doNotTrack='1';events.trackBusinessEvent('game_view');assert.equal(sent().length,before);w.navigator.doNotTrack='0';
 assert.ok(!JSON.stringify(commands()).match(/PRIVATE|private@example|01012345678|local-account|venue-owner|academy-owner|player-seat|local-academy|game-card|booking-a/));
 const required=['game_view','join_game_click','game_registration_completed','player_signup_completed','academy_view','academy_registration_click','academy_registration_completed','venue_registration_started','venue_registration_completed','academy_owner_registration_started','academy_owner_registration_completed'];for(const event of required)assert.ok(sent(event).length,event);
 // Automatic bootstrap stays singular; all sent events target the existing destination.
 const layout=fs.readFileSync(path.join(root,'src/app/layout.tsx'),'utf8');assert.equal((layout.match(/googletagmanager.com\/gtag\/js/g)||[]).length,1);assert.ok(layout.includes('send_page_view: false'));
 w.playzaGaConfigured=false;events.trackBusinessEvent("join_game_click",{sport:"Tennis"});assert.equal(w.playzaGaQueue.length,1);
 const bootstrap=layout.match(/<Script id="google-analytics"[\s\S]*?\{`([\s\S]*?)`\}/)[1];
 new Function("window","navigator","dataLayer",bootstrap)(w,w.navigator,w.dataLayer);assert.equal(w.playzaGaQueue.length,0);assert.equal(commands().filter(c=>c[0]==="config").length,1);
 for(const [,name,params] of sent()){assert.equal(params.send_to,'G-XJPEX3WY2B');assert.ok(params.page_location.startsWith('https://playza.test/'));assert.ok(!params.page_location.includes('redirectedFrom'));}
 await flush();console.log('PASS: all 11 business events; confirmed-only signup and registrations; errors, waitlists, existing accounts, Google completion, email confirmation, durable dedupe, attribution, PII allowlists, consent/opt-outs and single tag');
})().catch(e=>{console.error(e);process.exitCode=1});
