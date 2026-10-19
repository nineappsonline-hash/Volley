const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
globalThis.React=React;
globalThis.crypto??=require('node:crypto').webcrypto;
let lang='en',data;
const element=tag=>({children,...props})=>React.createElement(tag,Object.fromEntries(Object.entries(props).filter(([key])=>!['variant','queries','onClick','isPending'].includes(key))),children);
const mocks={react:React,
 'next/link':{default:element('a')},
 '@/lib/i18n':{useI18n:()=>({lang})},
 '@/lib/academy-workspace':{useAcademyWorkspace:()=>({data}),useAcademyAction:()=>({isPending:false})},
 '@/lib/academy-csv':{},
 '@/components/super-admin/academy-training-manager':{AcademyTrainingManager:()=>React.createElement('p',null,'group editor')},
 '@/components/academies/training-booking':{TrainingBookingCard:({admin})=>React.createElement('p',null,admin?'finance controls':'booking details')},
 '@/lib/academy-training':{useTrainingPrograms:()=>({data:[]})},
 '@/components/shared/query-state':{QueryState:({children})=>children},
 '@/components/ui/button':{Button:element('button')},
 '@/components/ui/input':{Input:element('input')},
 '@/components/ui/textarea':{Textarea:element('textarea')},
 '@/lib/constants':{formatMoney:value=>String(value)},
 '@/lib/utils':{todayInput:()=> '2026-10-19'},
 sonner:{toast:{}}
};
const exportsObject={};
new Function('require','exports',ts.transpileModule(fs.readFileSync('src/components/academy-workspace/workspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText)(name=>{assert.ok(name in mocks,name);return mocks[name];},exportsObject);
function render(caps){data={academy:{id:'academy',name:'Own academy',slug:'own',is_public:true},capabilities:Object.fromEntries(caps.map(cap=>[cap,true])),setup:{},credit_balance:0,branches:[],members:[{id:'member',name:'Player',has_account:false,details:{emergency_name:'Parent',emergency_phone:'0123'}}],programs:[],sessions:[],bookings:[{id:'booking',member_id:'member',details:{member:'Player',sessions:[]}}],agenda:[{booking_id:'booking',member_id:'member',member:'Player',program:'Group',date:'2026-10-19',time:'18:00',end:'19:00',present:null}],ledger:[],payments:[],renewal_requests:[],staff:[],leads:[],renewals:[{member_id:'member',name:'Player',remaining:1,has_account:false}],audit:[]};return renderToStaticMarkup(React.createElement(exportsObject.AcademyWorkspace));}
const coach=render(['read','attendance']);assert.match(coach,/id="attendance"/);assert.match(coach,/Emergency contact/);assert.match(coach,/Parent/);for(const id of ['members','ledger','team','import','training','pipeline'])assert.ok(!coach.includes(`id="${id}"`),id);
const receptionist=render(['read','bookings','attendance','members','leads']);assert.match(receptionist,/booking details/);assert.doesNotMatch(receptionist,/finance controls/);assert.match(receptionist,/needs a login account/);assert.doesNotMatch(receptionist,/id="team"/);
const finance=render(['read','finance']);assert.match(finance,/finance controls/);assert.match(finance,/id="ledger"/);assert.doesNotMatch(finance,/id="attendance"/);
const owner=render(['read','owner','training','bookings','attendance','members','finance','leads','audit']);for(const id of ['setup','training','bookings','attendance','members','import','ledger','pipeline','team','branches','audit'])assert.ok(owner.includes(`id="${id}"`),id);assert.match(owner,/\/a\/own/);
lang='ar';assert.match(render(['read','attendance']),/جهة اتصال الطوارئ/);
console.log('PASS: owner, finance, receptionist and coach section visibility, emergency contact access, account-only reminders and Arabic rendering');
