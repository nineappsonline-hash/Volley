const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
let lang='en',pathname='/dashboard';
const cache=new Map();
const styles=new Proxy({}, {get:(_,key)=>String(key)});
const mocks={
 'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
 'next/navigation':{usePathname:()=>pathname},
 '@/lib/i18n':{useI18n:()=>({lang,t:key=>key})},
 '@/lib/queries':{useCurrentProfile:()=>({data:{role:'member'}})},
 '@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')},
 '@/lib/constants':{formatMoney:n=>`EGP ${Number(n).toFixed(2)}`,formatTime12h:v=>v},
 '@/lib/venue-media':{venueCardPhoto:(photos,cover)=>photos?.[0]??cover},
 '@/lib/game-costs':{gameBookingPayment:()=>({confirmed:true})},
 './game-card-background':{GameCardBackground:()=>React.createElement('span',{'data-fallback-art':true})},
 sonner:{toast:{success(){},error(){}}},
};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('.css'))return {default:styles};const exports={};cache.set(file,exports);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','exports',source)(id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/'))return load(resolve(path.join('src',id.slice(2))));if(id.startsWith('.'))return load(resolve(path.join(path.dirname(file),id)));return require(id);},exports);return exports;}
function resolve(file){for(const ext of ['', '.tsx','.ts','.css'])if(fs.existsSync(file+ext)&&fs.statSync(file+ext).isFile())return file+ext;throw Error(file);}
const {MemberHomeHeader}=load('src/components/dashboard/member-home-header.tsx');
const {GameCardShell}=load('src/components/games/game-card-shell.tsx');
const {MemberBottomNavigation}=load('src/components/layout/member-bottom-navigation.tsx');
const {SportIcon}=load('src/components/marketing/sport-icons.tsx');
assert.match(renderToStaticMarkup(React.createElement(SportIcon,{id:'beach-volleyball'})),/<path/);
for(lang of ['en','ar']){
 let html=renderToStaticMarkup(React.createElement(MemberHomeHeader,{name:'Player One',children:React.createElement('section',{id:'member-live-games'},'Live game results')}));
 for(const href of ['/dashboard/games','/academies','/playgrounds','/dashboard/tournaments','/academy-bookings','/profile#evaluations'])assert.ok(html.includes(`href="${href}"`),href);
 assert.ok(html.includes('aria-controls="member-live-games"'));
 assert.ok(!html.includes('/dashboard/games?sport='));
 assert.ok(html.includes(lang==='en'?'Invite a friend':'اعزم صاحبك'));
 assert.ok(html.includes(lang==='en'?'Archery':'رماية بالقوس'));
 assert.ok(!html.includes('href="/parent"'));assert.ok(!html.includes('href="/sports/archery"'));assert.ok(!html.includes('href="#checkin"'));assert.ok(!html.includes('href="#training"'));
 assert.ok(html.indexOf('Live game results') < html.indexOf('href="/academies"'));
 assert.ok(html.indexOf('aria-controls="member-live-games"') < html.indexOf('Live game results'));
 html=renderToStaticMarkup(React.createElement(GameCardShell,{layout:'list',game:{id:'game',title:'Gateway game',sport:'Volleyball',game_date:'2026-10-23',start_time:'20:00',status:'open',max_players:18,participants_count:12,share_price:100,is_public:true,playground:{name:'Gateway',photos:['https://example.invalid/court.jpg']},participants:[]},joined:true},React.createElement('button',null,'Join existing game')));
 for(const text of ['Gateway game','Gateway','12/18','EGP 100.00','Join existing game','aria-expanded="false"','hidden=""','background-color:#C7F23D'])assert.ok(html.includes(text),text);
 assert.match(html,/src="https:\/\/example.invalid\/court.jpg"/);
 assert.ok(html.includes(lang==='en'?"You&#x27;re participating":'أنت مشارك'));
 assert.ok(html.includes(lang==='en'?'Booking confirmed':'الحجز مؤكد'));
 for(pathname of ['/dashboard','/dashboard/games','/playgrounds','/dashboard/tournaments','/academies']){const nav=renderToStaticMarkup(React.createElement(MemberBottomNavigation));assert.equal((nav.match(/aria-current="page"/g)||[]).length,1,pathname);assert.ok(nav.includes('href="/dashboard"'));assert.ok(nav.includes('href="/academies"'));}
}
console.log('PASS: bilingual photo dashboard destinations, local sport controls, games-first ordering, compact game price/capacity/details/booking state and active bottom navigation');

function findElements(node,predicate,found=[]){if(!node||typeof node!=='object')return found;if(predicate(node))found.push(node);React.Children.forEach(node.props?.children,child=>findElements(child,predicate,found));return found;}
let selected='all';lang='en';
let selector=MemberHomeHeader({hasQr:false,sections:[],selectedSport:selected,onSportChange:sport=>{selected=sport;}});
const buttons=findElements(selector,node=>node.type==='button'&&node.props['aria-controls']==='member-live-games');
assert.equal(buttons.length,5);
buttons.find(button=>renderToStaticMarkup(button).includes('Archery')).props.onClick();
assert.equal(selected,'Archery');
selector=MemberHomeHeader({hasQr:false,sections:[],selectedSport:selected,onSportChange:sport=>{selected=sport;}});
const archery=findElements(selector,node=>node.type==='button'&&node.props['aria-controls']==='member-live-games').find(button=>renderToStaticMarkup(button).includes('Archery'));
assert.equal(archery.props['aria-pressed'],true);assert.equal(archery.props.href,undefined);
console.log('PASS: selecting Archery changes local controlled state and selected styling without a link or navigation');
