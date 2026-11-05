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
 'next/navigation':{usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams()},
 '@/lib/i18n':{useI18n:()=>({lang,t:key=>key})},
 '@/lib/queries':{useCurrentProfile:()=>({data:{role:'member'}})},
 '@/lib/utils':{cn:(...values)=>values.filter(Boolean).join(' ')},
 '@/lib/constants':{formatMoney:n=>`EGP ${Number(n).toFixed(2)}`,formatTime12h:v=>v},
 '@/lib/game-costs':{gameBookingPayment:()=>({confirmed:true})},
 './game-card-background':{GameCardBackground:()=>React.createElement('span',{'data-fallback-art':true})},
 sonner:{toast:{success(){},error(){}}},
};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);if(file.endsWith('.css'))return {default:styles};const exports={};cache.set(file,exports);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','exports',source)(id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/'))return load(resolve(path.join('src',id.slice(2))));if(id.startsWith('.'))return load(resolve(path.join(path.dirname(file),id)));return require(id);},exports);return exports;}
function resolve(file){for(const ext of ['', '.tsx','.ts','.css'])if(fs.existsSync(file+ext)&&fs.statSync(file+ext).isFile())return file+ext;throw Error(file);}

mocks['./create-game-button']={DashboardCreateGameButton:()=>React.createElement('button',{type:'button'},'Create a Game')};
mocks['@/components/shared/query-state']={QueryState:({children})=>children};
let upcoming=[];
mocks['@/lib/queries'].useMyUpcomingGames=()=>({data:upcoming,isPending:false,isError:false});
const {MemberHomeHeader}=load('src/components/dashboard/member-home-header.tsx');
const {MemberBottomNavigation}=load('src/components/layout/member-bottom-navigation.tsx');
const {DesktopNextGame}=load('src/components/dashboard/desktop-next-game.tsx');
for(lang of ['en','ar']){
 const header=renderToStaticMarkup(React.createElement(MemberHomeHeader,{selectedSport:'Volleyball'}));
 assert.ok(header.includes('type="search"'));assert.ok(header.includes('name="search"'));
 assert.ok(header.includes('type="submit"'));assert.ok(header.includes('Create a Game'));
 for(pathname of ['/dashboard','/dashboard/my-games','/academies','/profile']){
  const nav=renderToStaticMarkup(React.createElement(MemberBottomNavigation));
  assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
  assert.equal((nav.match(/<a /g)||[]).length,4);
  for(const href of ['/dashboard','/dashboard/my-games','/academies','/profile'])assert.ok(nav.includes(`href="${href}"`));
 }
 upcoming=[];
 let card=renderToStaticMarkup(React.createElement(DesktopNextGame,{memberId:'member'}));
 assert.ok(card.includes(lang==='ar'?'اكتشف الماتشات':'Explore games'));
 upcoming=[
  {id:'later',game:{id:'later',title:'Later game',status:'open',game_date:'2099-02-02',start_time:'20:00'}},
  {id:'wait',is_waitlisted:true,game:{id:'wait',title:'Waitlisted game',status:'open',game_date:'2099-01-01',start_time:'18:00'}},
  {id:'next',game:{id:'next',title:'Next booked game',status:'full',game_date:'2099-02-01',start_time:'18:00',playground:{name:'Gateway'}}},
 ];
 card=renderToStaticMarkup(React.createElement(DesktopNextGame,{memberId:'member'}));
 assert.ok(card.includes('Next booked game'));assert.ok(card.includes('Gateway'));
 assert.ok(card.includes('focus=next'));assert.ok(!card.includes('Later game'));assert.ok(!card.includes('Waitlisted game'));
}
console.log('PASS: bilingual mobile search/actions, four navigation destinations and active states, earliest confirmed booking and empty booking state');

// Exercise the real shared form handlers used on desktop and mobile.
function findNode(node, predicate) {
 if (!node || typeof node !== 'object') return;
 if (predicate(node)) return node;
 for (const child of React.Children.toArray(node.props?.children)) {
  const found = findNode(child, predicate);
  if (found) return found;
 }
}
const OriginalFormData = global.FormData;
const originalDocument = global.document;
let searchValue = '', scrolled = false, prevented = false;
try {
 global.FormData = class { constructor(form) { this.form = form; } get() { return this.form.search; } };
 global.document = { getElementById: id => { assert.equal(id, 'member-live-games'); return { scrollIntoView() { scrolled = true; } }; } };
 const tree = MemberHomeHeader({ onSearchChange: value => { searchValue = value; } });
 const input = findNode(tree, node => node.type === 'input' && node.props.name === 'search');
 const form = findNode(tree, node => node.type === 'form');
 input.props.onChange({ currentTarget: { value: 'Gateway' } });
 assert.equal(searchValue, 'Gateway', 'typing updates the results');
 input.props.onChange({ currentTarget: { value: '' } });
 assert.equal(searchValue, '', 'clearing the input resets the results');
 form.props.onSubmit({ preventDefault() { prevented = true; }, currentTarget: { search: 'volleyball Cairo' } });
 assert.equal(searchValue, 'volleyball Cairo');
 assert.equal(prevented, true, 'submission stays on the dashboard');
 assert.equal(scrolled, true, 'submission reveals the results');
} finally {
 global.FormData = OriginalFormData;
 global.document = originalDocument;
}
console.log('PASS: shared search typing, clear/reset and form submission update results without navigating away');

// Guests must use the same full-width results region and photo-card grid as members.
mocks['next/navigation'].useRouter = () => ({ refresh() {} });
mocks['./member-discovery-cards'] = { MemberDiscoveryCards: () => React.createElement('div', { 'data-guest-results': true }) };
const { GuestDashboard } = load('src/components/dashboard/guest-dashboard.tsx');
const guestDashboard = renderToStaticMarkup(React.createElement(GuestDashboard, { games: [] }));
assert.match(guestDashboard, /<section id="activity" class="min-w-0 scroll-mt-24"><div data-guest-results="true"/);
mocks['@/components/shared/directions-links'] = { DirectionsLinks: () => null };
const { GuestGameList } = load('src/components/dashboard/guest-game-list.tsx');
const guestCards = renderToStaticMarkup(React.createElement(GuestGameList, { games: [{
 id: 'guest-grid', title: 'Guest volleyball', sport: 'Volleyball', game_date: '2099-01-01',
 start_time: '18:00', status: 'open', max_players: 12, participants_count: 4, share_price: 100,
 is_public: true, playground: { name: 'Gateway' },
}] }));
assert.match(guestCards, /class="flex flex-col gap-3 desktopGames"/);
assert.ok(guestCards.includes('data-game-overview=""'));
assert.ok(guestCards.includes('Guest volleyball'));
assert.ok(guestCards.includes('data-game-photo=""'));
console.log('PASS: guest discovery spans the dashboard grid and uses shared responsive photo-card styling');
