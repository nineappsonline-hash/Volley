const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const {NextRequest}=require('next/server');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
let refreshCookies=false,user=null,session=null,lang='en',pathname='/dashboard',params=new URLSearchParams('sport=tennis');
const mocks={
 '@supabase/ssr':{createServerClient:(_url,_key,options)=>({auth:{getUser:async()=>{if(refreshCookies)options.cookies.setAll([{name:'sb-test',value:'fresh',options:{httpOnly:true}}]);return {data:{user}}},signOut:async()=>{}},rpc:async()=>({data:false,error:null})})},
 '@/lib/session':{getSession:async()=>session},
 'next/navigation':{usePathname:()=>pathname,useSearchParams:()=>params},
 '@/lib/i18n':{useI18n:()=>({lang,t:key=>key})},
 '@/components/ui/button':{Button:({asChild,children,...p})=>asChild?children:React.createElement('button',p,children)},
 '@/components/shared/directions-links':{DirectionsLinks:()=>null},
 '@/components/games/game-card-shell':{GameCardShell:({children,game,initialExpanded})=>React.createElement('article',{'data-game':game.id,'data-expanded':initialExpanded},game.title,children)},
};
const cache=new Map();
function load(file){file=path.resolve(file);if(file.endsWith('.css'))return {default:new Proxy({},{get:(_,key)=>String(key)})};if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','exports',code)(id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?path.resolve('src',id.slice(2)):path.resolve(path.dirname(file),id);return load(['.ts','.tsx',''].map(x=>base+x).find(f=>fs.existsSync(f)&&fs.statSync(f).isFile()));}return require(id)},out);return out;}
(async()=>{
 const {updateSession}=load('src/lib/supabase/middleware.ts');const {isGuestBrowsePath,landingBrowsePath}=load('src/lib/guest-access.ts');
 for(const dest of ['/shop','/shop/checkout?variant=abc','/shop/orders','/dashboard','/dashboard/games?sport=tennis','/dashboard/tournaments','/dashboard/academies','/playgrounds','/academies','/games','/courts']){
  const response=await updateSession(new NextRequest('https://playza.test'+dest));assert.equal(response.status,200,dest);
 }
 for(const dest of ['/dashboard/my-games?focus=game','/profile','/schedule','/members','/admin','/academy','/parent','/checkout','/complete-profile','/dashboard/games/edit']){
  const response=await updateSession(new NextRequest('https://playza.test'+dest));assert.equal(response.status,307,dest);const url=new URL(response.headers.get('location'));assert.equal(url.pathname,'/login');assert.equal(url.searchParams.get('redirectedFrom'),dest);
 }
 assert.equal(isGuestBrowsePath('/dashboard/my-games'),false);
 assert.equal(landingBrowsePath('/shop'),'/shop');assert.equal(landingBrowsePath('/games'),'/games');assert.equal(landingBrowsePath('/games/abc'),'/games?focus=abc');assert.equal(landingBrowsePath('/sports/archery'),'/sports/archery');assert.equal(landingBrowsePath('/courts'),'/courts');assert.equal(landingBrowsePath('/academies'),'/academies'); assert.equal(landingBrowsePath('/dashboard?sport=tennis'),'/sports/tennis');assert.equal(landingBrowsePath('/dashboard?sport=padel'),'/sports/padel');assert.equal(landingBrowsePath('/games?sport=tennis'),'/games?sport=tennis');assert.equal(landingBrowsePath('/tournaments'),'/tournaments');assert.equal(landingBrowsePath('/login'),'/login');
 refreshCookies=true;
 const refreshed=await updateSession(new NextRequest('https://playza.test/profile',{headers:{'x-playza-path':'https://evil.test'}}));assert.ok(refreshed.headers.get('set-cookie').includes('sb-test=fresh'));assert.equal(new URL(refreshed.headers.get('location')).searchParams.get('redirectedFrom'),'/profile');
 const publicRefresh=await updateSession(new NextRequest('https://playza.test/dashboard',{headers:{'x-playza-path':'https://evil.test'}}));assert.equal(publicRefresh.headers.get('x-middleware-request-x-playza-path'),'/dashboard');
 refreshCookies=false;
 user={id:'member',app_metadata:{role:'member'}};
 const hash='/dashboard?focus=abc#game-abc';const loggedIn=await updateSession(new NextRequest('https://playza.test/login?redirectedFrom='+encodeURIComponent(hash)));const continued=new URL(loggedIn.headers.get('location'));assert.equal(continued.pathname,'/auth/continue');assert.equal(continued.searchParams.get('next'),hash);user=null;
 const route=load('src/app/auth/continue/route.ts');
 let response=await route.GET(new Request('https://playza.test/auth/continue?next='+encodeURIComponent(hash)));assert.equal(new URL(response.headers.get('location')).searchParams.get('redirectedFrom'),hash);
 session={profile:{role:'member',phone:null,gender:null,birth_date:null}};response=await route.GET(new Request('https://playza.test/auth/continue?next='+encodeURIComponent(hash)));assert.equal(new URL(response.headers.get('location')).pathname,'/complete-profile');assert.equal(new URL(response.headers.get('location')).searchParams.get('next'),hash);
 session={profile:{role:'member',phone:'123',gender:'male',birth_date:'2000-01-01'}};response=await route.GET(new Request('https://playza.test/auth/continue?next='+encodeURIComponent(hash)));assert.equal(response.headers.get('location'),'https://playza.test'+hash);
 response=await route.GET(new Request('https://playza.test/auth/continue?next=https://evil.test'));assert.equal(response.headers.get('location'),'https://playza.test/dashboard');
 const {guestGameCard}=load('src/lib/guest-games.ts');const safe=guestGameCard({id:'abc',title:'Public tennis',sport:'Tennis',status:'open',gender:'female',game_date:'2099-01-01',start_time:'18:00',max_players:4,min_players:2,joined:2,share_price:100,min_age:18,max_age:40,participants:[{member_id:'SECRET'}],invite_code:'SECRET',host_total:123});assert.deepEqual(safe.participants,[]);assert.equal(safe.invite_code,null);assert.equal(safe.host_total,null);assert.equal(safe.min_age,18);assert.equal(safe.participants_count,2);
 const {venueCardPhoto}=load('src/lib/venue-media.ts');
 const gallery={name:'Gallery court',photos:['https://example.invalid/court-gallery.jpg'],cover_url:null};
 const galleryCard=guestGameCard({...safe,joined:2,playground:gallery});assert.deepEqual(galleryCard.playground.photos,gallery.photos);assert.equal(venueCardPhoto(galleryCard.playground.photos,galleryCard.playground.cover_url),gallery.photos[0]);
 const coveredCard=guestGameCard({...safe,joined:2,playground:{...gallery,cover_url:'https://example.invalid/cover.jpg'}});assert.equal(venueCardPhoto(coveredCard.playground.photos,coveredCard.playground.cover_url),'https://example.invalid/cover.jpg');
 const noPhoto=guestGameCard({...safe,joined:2,playground:{name:'No photos'}});assert.equal(venueCardPhoto(noPhoto.playground.photos,noPhoto.playground.cover_url),null);
 assert.ok(fs.readFileSync('src/lib/public-games.ts','utf8').includes('playground:venues(name, area, governorate, country, location_link, cover_url, photos)'));
 const {GuestGameList}=load('src/components/dashboard/guest-game-list.tsx');for(lang of ['en','ar']){const html=renderToStaticMarkup(React.createElement(GuestGameList,{games:[safe]}));assert.ok(html.includes('Public tennis'));assert.ok(!html.includes('SECRET'));assert.ok(html.includes('/login?redirectedFrom=%2Fdashboard%3Fsport%3Dtennis%26focus%3Dabc%23game-abc'));assert.ok(!html.includes('href="/dashboard/games"'));}
 let pushed=null;
 mocks.react={...React,useState:initial=>[initial,()=>{}]};
 mocks['next/navigation'].useRouter=()=>({push:value=>{pushed=value},refresh(){}});
 mocks['@/lib/supabase/client']={createClient:()=>({auth:{getUser:async()=>({data:{user:null}})},from(){throw Error('guest must not query a participant or join')}})};
 mocks['./join-game-dialog']={JoinGameDialog:()=>null};
 mocks.sonner={toast:{error(){}}};
 const {PublicGameJoin}=load('src/components/games/public-game-join.tsx');
 const joinTree=PublicGameJoin({game:{id:'abc',title:'A game',share_price:100},returnTo:'/games/abc'});
 const joinButton=React.Children.toArray(joinTree.props.children)[0];joinButton.props.onClick();await new Promise(setImmediate);
 assert.equal(pushed,'/login?redirectedFrom=%2Fgames%2Fabc');
 console.log('PASS: anonymous browse allowlist, protected personal routes, landing destinations, safe public DTOs, sign-in-only joining and complete auth/profile return URLs');
})().catch(e=>{console.error(e);process.exit(1)});
