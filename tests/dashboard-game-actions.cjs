const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');const cache=new Map();let open=false,params=new URLSearchParams(),lang='en';
const fakeDialog=()=>null;
const mocks={
 react:{...React,useState:initial=>[open,value=>{open=value}],useEffect:()=>{},useId:()=> 'game-details'},
 'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
 'next/navigation':{useSearchParams:()=>params},
 '@/lib/i18n':{useI18n:()=>({lang,locale:undefined,t:key=>key})},
 '@/components/ui/button':{Button:({children,asChild,...props})=>asChild?React.cloneElement(children,props):React.createElement('button',props,children)},
 '@/components/games/create-game-dialog':{CreateGameDialog:fakeDialog},
 '@/lib/analytics/events':{trackView(){}},
 './game-share-actions':{GameShareActions:()=>React.createElement('button',{'data-share':true},'Share')},
 '@/lib/game-costs':{gameBookingPayment:()=>null},
 './game-card-background':{GameCardBackground:()=>null},
 '@/lib/constants':{formatMoney:n=>`EGP ${n}`,formatTime12h:v=>v},
};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('exports','require',code)(out,id=>{if(id in mocks)return mocks[id];if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?path.resolve('src',id.slice(2)):path.resolve(path.dirname(file),id);for(const ext of ['.ts','.tsx'])if(fs.existsSync(base+ext))return load(base+ext);}return require(id)});return out;}
const {gameCreationSport,dashboardCreateGamePath}=load('src/lib/game-creation.ts');
for(const [input,expected] of [['Tennis','Tennis'],['padel','Padel'],['Basketball','Basketball'],['volleyball','Volleyball'],['beach-volleyball','Beach Volleyball'],['Beach Volleyball','Beach Volleyball'],['all',undefined],['Archery',undefined],['unknown',undefined]])assert.equal(gameCreationSport(input),expected);
const {DashboardCreateGameButton}=load('src/components/dashboard/create-game-button.tsx');
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);React.Children.forEach(tree.props?.children,child=>nodes(child,predicate,result));return result;}
for(lang of ['en','ar']){
 for(const sport of ['Tennis','Padel','Basketball','Volleyball','Beach Volleyball','all']){
  params=new URLSearchParams();open=false;const guest=DashboardCreateGameButton({sport});const html=renderToStaticMarkup(guest);const expected=encodeURIComponent(dashboardCreateGamePath(sport));assert.ok(html.includes(expected.replace(/&/g,'&amp;')),`guest keeps ${sport} through login`);
  let tree=DashboardCreateGameButton({sport,profile:{member_plan:'free'}});nodes(tree,n=>n.type==='button'||n.props?.onClick)[0].props.onClick();assert.equal(open,true);tree=DashboardCreateGameButton({sport,profile:{member_plan:'free'}});let dialog=nodes(tree,n=>n.type===fakeDialog)[0];assert.equal(dialog.props.open,true);assert.equal(dialog.props.initialSport,gameCreationSport(sport));dialog.props.onOpenChange(false);assert.equal(open,false);
 }
 params=new URLSearchParams('create=1&sport=beach-volleyball');open=true;let resumed=DashboardCreateGameButton({sport:'Beach Volleyball',profile:{member_plan:'free'}});assert.equal(nodes(resumed,n=>n.type===fakeDialog)[0].props.initialSport,'Beach Volleyball');
 assert.equal(DashboardCreateGameButton({sport:'Archery'}).props.disabled,true);
}
const {GameCardShell}=load('src/components/games/game-card-shell.tsx');const game={id:'g',title:'Game',sport:'Tennis',game_date:'2026-12-01',start_time:'18:00',status:'open',max_players:4,participants_count:1,share_price:100,is_public:true,participants:[]};
open=false;
for(const layout of ['list','card']){
 const tree=GameCardShell({game,layout,joined:false,children:React.createElement('p',null,'Private detail content')});
 const hidden=nodes(tree,n=>n.props?.id==='game-details')[0];assert.equal(hidden.props.hidden,true);assert.equal(nodes(hidden,n=>n.type===mocks['./game-share-actions'].GameShareActions).length,0);
 assert.equal(nodes(tree,n=>n.type===mocks['./game-share-actions'].GameShareActions).length,1);
 for(const clickable of nodes(tree,n=>n.type==='button'||n.type==='a'))assert.equal(nodes(clickable,n=>n.type===mocks['./game-share-actions'].GameShareActions).length,0,'share is not nested in the expand/navigation button');
}
for (const layout of ['list','card']) {
 const mappedGame={...game,playground:{name:'Court',location_link:'https://www.google.com/maps/search/?api=1&query=30.01,31.02'}};
 const tree=GameCardShell({game:mappedGame,layout,joined:false});
 const markup=renderToStaticMarkup(tree);
 assert.ok(markup.includes('https://www.google.com/maps/dir/'), 'saved venue maps link is available while collapsed');
 assert.ok(markup.includes('destination=30.01%2C31.02'));
 for(const clickable of nodes(tree,n=>n.type==='button')) assert.equal(nodes(clickable,n=>n.props?.href?.includes('maps/dir')).length,0,'directions is outside expansion buttons');
 const unsafe=GameCardShell({game:{...mappedGame,playground:{...mappedGame.playground,location_link:'javascript:alert(1)'}},layout,joined:false});
 assert.ok(!renderToStaticMarkup(unsafe).includes('javascript:'), 'unsafe directions are not rendered');
}
console.log('PASS: collapsed list/card share controls, no nested actions, five sport defaults, all-sports behavior, guest auth return, reopen/resume and unsupported-sport guard in both languages');

// Exercise the real dialog's opening/reset effects, without sending any booking request.
let values=[],effectDeps=[],pendingEffects=[],stateIndex=0,effectIndex=0,dirty=false;
mocks.react={...React,useMemo:fn=>fn(),useState:initial=>{const i=stateIndex++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],next=>{const value=typeof next==='function'?next(values[i]):next;if(!Object.is(values[i],value)){values[i]=value;dirty=true;}}]},useEffect:(effect,deps)=>{const i=effectIndex++;if(!effectDeps[i]||deps.some((v,j)=>!Object.is(v,effectDeps[i][j]))){effectDeps[i]=deps;pendingEffects.push(effect);}}};
const empty=[];const mutation={isPending:false,mutateAsync:async()=>{throw Error('Booking writes must not run in this test');}};
mocks['@/lib/queries']={useCreateFriendlyGame:()=>mutation,usePayGameShare:()=>mutation,usePayRentRemaining:()=>mutation,usePlaygrounds:()=>({data:empty}),useFriendlyGames:()=>({data:empty}),useSportSettings:()=>({data:undefined})};
mocks['@/lib/supabase/client']={createClient:()=>({auth:{getUser:async()=>({data:{user:null}})}})};
delete mocks['@/lib/constants'];
const RealDialog=load('src/components/games/create-game-dialog.tsx').CreateGameDialog;
function renderDialog(props){let tree;for(let pass=0;pass<8;pass++){dirty=false;stateIndex=0;effectIndex=0;pendingEffects=[];tree=RealDialog(props);for(const effect of pendingEffects)effect();if(!dirty)return tree;}throw Error('Dialog state did not settle');}
function selectedSport(tree){return nodes(tree,n=>!!n.props?.onValueChange&&nodes(n,c=>c.props?.['aria-label']==='community_sport').length)[0];}
const onOpenChange=()=>{};
let dialogTree=renderDialog({open:true,onOpenChange,initialSport:'Tennis'});assert.equal(selectedSport(dialogTree).props.value,'Tennis');
selectedSport(dialogTree).props.onValueChange('Padel');dialogTree=renderDialog({open:true,onOpenChange,initialSport:'Tennis'});assert.equal(selectedSport(dialogTree).props.value,'Padel','the user can override the default');
renderDialog({open:false,onOpenChange,initialSport:'Tennis'});dialogTree=renderDialog({open:true,onOpenChange,initialSport:'beach-volleyball'});assert.equal(selectedSport(dialogTree).props.value,'Beach Volleyball','reopening uses the latest tab');
renderDialog({open:false,onOpenChange});dialogTree=renderDialog({open:true,onOpenChange});assert.equal(selectedSport(dialogTree).props.value,'','All sports leaves the sport available to choose');
const venue={id:'court',sport:{name:'Volleyball'}};renderDialog({open:false,onOpenChange,initialPlayground:venue});dialogTree=renderDialog({open:true,onOpenChange,initialSport:'Tennis',initialPlayground:venue});assert.equal(selectedSport(dialogTree).props.value,'Volleyball','an explicit court keeps its own sport');
console.log('PASS: real create dialog prefills the selected sport, allows edits, resets on reopen, and preserves court-specific defaults');
