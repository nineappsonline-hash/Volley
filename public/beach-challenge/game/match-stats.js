import {notifyHost} from '../bridge.js';
const endpoint='/api/game/beach-stats',queueKey='playza-completed-matches-v1';
async function request(body){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);try{return await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,signal:abort.signal})}finally{clearTimeout(timer)}}
export async function beginCountedMatch(){try{const r=await request({action:'start'});if(!r.ok)return null;const session=await r.json();return session.id&&session.token?session:null}catch{return null}}
function validResult(row){return row&&row.action==='complete'&&typeof row.id==='string'&&typeof row.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(row.token)&&[row.playerPoints,row.cpuPoints].every(n=>Number.isInteger(n)&&n>=0&&n<=999)}
function pending(){try{const value=JSON.parse(localStorage.getItem(queueKey)||'[]');return Array.isArray(value)?value.filter(validResult).slice(-10):[]}catch{return []}}
function save(rows){try{localStorage.setItem(queueKey,JSON.stringify(rows.slice(-10)))}catch{}}
let sending=false;
export async function flushMatchResults(){
 if(sending)return;sending=true;
 try{for(const entry of pending()){
  try{const r=await request(entry);if(r.ok||r.status===400||r.status===403){save(pending().filter(row=>row.id!==entry.id));if(r.ok)notifyHost('stats-updated')}else break}catch{break}
 }}finally{sending=false}
}
export async function completeCountedMatch(registration,playerPoints,cpuPoints){
 const session=await registration;if(!session)return;
 const entry={action:'complete',...session,playerPoints,cpuPoints};save([...pending().filter(row=>row.id!==session.id),entry]);
 // Try this result directly too: storage may be disabled in private browsers.
 try{const r=await request(entry);if(r.ok||r.status===400||r.status===403){save(pending().filter(row=>row.id!==session.id));if(r.ok)notifyHost('stats-updated')}}catch{}
}
export async function showCommunityStats(node,shouldShow=()=>true){
 if(!node)return;
 try{const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw Error();const t=await r.json();if(![t.totalGames,t.playerWins,t.cpuWins,t.draws].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error();
  if(!shouldShow())return;const ar=document.documentElement.lang.startsWith('ar'),format=n=>new Intl.NumberFormat(ar?'ar-EG-u-nu-latn':'en').format(n);node.replaceChildren();node.hidden=false;
  const title=document.createElement('p');title.className='community-stats-title';title.textContent=ar?'إحصائيات كل اللاعبين':'Community totals';node.append(title);
  const grid=document.createElement('div');grid.className='community-stats-grid';
  for(const [label,value]of [[ar?'مباريات':'Games played',t.totalGames],[ar?'فوز اللاعبين':'Player wins',t.playerWins],[ar?'فوز الكمبيوتر':'CPU wins',t.cpuWins]]){const cell=document.createElement('div'),number=document.createElement('strong'),caption=document.createElement('span');number.textContent=format(value);caption.textContent=label;cell.append(number,caption);grid.append(cell)}node.append(grid);
  if(t.draws){const draws=document.createElement('small');draws.textContent=`${ar?'تعادل':'Draws'}: ${format(t.draws)}`;node.append(draws)}
 }catch{node.hidden=true}
}
