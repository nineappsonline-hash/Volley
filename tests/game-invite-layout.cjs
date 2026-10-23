const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
let lang='en';
const block=({children})=>React.createElement('div',null,children);
const mocks={
 '@/components/analytics/business-analytics':{AnalyticsView:()=>null},
 './game-share-actions':{GameShareActions:({compact,game})=>React.createElement('button',{'data-compact':String(compact),'data-invite':game.invite_code},'Share')},
 'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
 '@/components/shared/directions-links':{DirectionsLinks:()=>React.createElement('a',{href:'https://maps.google.com'},'Directions')},
 '@/components/shared/app-logo':{AppLogo:()=>null},
 '@/components/ui/card':{Card:block,CardHeader:block,CardTitle:block,CardContent:block},
 '@/components/layout/language-toggle':{LanguageToggle:()=>null},
 '@/lib/i18n':{useI18n:()=>({lang,dir:lang==='ar'?'rtl':'ltr',t:key=>key})},
 '@/lib/constants':{addHoursToTime:()=> '22:00',formatMoney:()=> 'EGP 75',formatTime12h:value=>value.slice(0,5),AR_NUMERIC_LOCALE:'ar-EG-u-nu-latn'},
 '@/lib/venue-media':{venueCardPhoto:()=>null},
 './game-participant-names':{GameParticipantNames:()=>React.createElement('div',null,'Participants'),SignedInGameParticipantNames:()=>React.createElement('div',null,'Participants')},
 './public-game-join':{PublicGameJoin:()=>React.createElement('button',null,'Join')},
 '@/lib/game-discovery':{gameIsJoinable:game=>game.status==='open',publicGamePath:id=>`/games/${id}`},
 './shared-game-page.module.css':new Proxy({},{get:(_,key)=>key==='__esModule'?false:key==='default'?{}:String(key)}),
};
const exportsObject={};const code=ts.transpileModule(fs.readFileSync('src/components/games/shared-game-page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
new Function('exports','require',code)(exportsObject,id=>mocks[id]??require(id));
const game={id:'game',title:'Outdoor Volleyball',sport:'Volleyball',start_time:'20:00',duration_hours:2,game_date:'2026-10-26',gender:'mixed',map_label:'Qaitbay, New Cairo, Cairo',joined:2,status:'open',share_price:75,participants:[]};
for(lang of ['en','ar'])for(const inviteCode of [undefined,'PRIVATE']){
 const html=renderToStaticMarkup(exportsObject.SharedGamePage({game,inviteCode}));
 assert.equal((html.match(/>Share<\/button>/g)||[]).length,1,'one compact share action');
 assert.ok(html.includes('data-compact="true"'));
 if(inviteCode)assert.ok(html.includes('data-invite="PRIVATE"'),'private sharing retains invitation code');
 assert.ok(!html.includes('\\n'),'no escaped newlines rendered as text');
 assert.ok(!html.includes('Copy link')&&!html.includes('wa.me')&&!html.includes('Game link'),'no duplicate legacy sharing controls or raw URL field');
 assert.ok(html.indexOf('Directions')<html.indexOf('Participants')&&html.indexOf('Participants')<html.indexOf('>Join<'),'directions, participants and join stay ordered');
 assert.ok(html.includes('20:00')&&html.includes('22:00'),'start and end times remain');
 assert.equal((html.match(/Qaitbay, New Cairo, Cairo/g)||[]).length,1);
}
console.log('PASS: bilingual public/private invitations have one share action, no escaped markup, correct action order, location and start/end time');
