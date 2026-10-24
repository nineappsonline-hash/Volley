import {clamp,RULES,shotFlightTime} from './simulation.js';
const homes=[[-2.5,2.3],[2.5,2.3],[0,4]];
export function createTeam(side){return homes.map(([x,z],i)=>({id:`${side}-${i}`,x,z:side?-z:z,y:0,vy:0,homeX:x,homeZ:side?-z:z,cooldown:0,readAt:-1}))}
function distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
export function stepTeam(match,side,dt){
 const supports=side?match.opponents:match.teammates;
 if(!supports?.length||match.phase!=='rally'||match.pendingToss)return;
 const team=side?[...supports,match.ai]:supports,b=match.ball,sign=side?-1:1;
 const onSide=b.z*sign>0;
 const flight=clamp((b.vy+Math.sqrt(Math.max(0,b.vy*b.vy+2*RULES.gravity*Math.max(0,b.y-1.7))))/RULES.gravity,0,2.2);
 const target={x:clamp(b.x+b.vx*flight,-4.5,4.5),z:clamp(b.z+b.vz*flight,side?-8.4:.5,side?-.5:8.4)};
 const eligible=team.filter(a=>match.side!==side||a.id!==match.lastTeamActor);
 let receiver=onSide?eligible.reduce((best,a)=>!best||distance(a,target)<distance(best,target)?a:best,null):null;
 // Let a positioned human take the contact instead of the CPU stealing it.
 if(match.side===side&&match.touches>=3)receiver=null;
 if(side===0&&receiver&&match.lastTeamActor!=='player'&&distance(match.player,target)<distance(receiver,target)+.5)receiver=null;
 for(const a of team){
  a.cooldown=Math.max(0,(a.cooldown||0)-dt);
  const event=match.hitEvent?.at??-1;
  if(a.readAt!==event){a.readAt=event;a.readyAt=match.clock+(match.config.difficulty==='hard'?.1:match.config.difficulty==='easy'?.3:.2);}
  const active=a===receiver&&match.clock>=(a.readyAt||0);
  const destination=active?target:{x:a.homeX,z:a.homeZ};
  const dist=distance(a,destination),speed=match.config.difficulty==='hard'?6.5:match.config.difficulty==='easy'?4.5:5.5;
  const travel=Math.min(dist,speed*dt);if(dist){a.x+=(destination.x-a.x)/dist*travel;a.z+=(destination.z-a.z)/dist*travel;}
  if(active&&match.side===side&&match.touches>=2&&b.vy<0&&b.y>2.6&&b.y<4.8&&distance(a,b)<1.4&&a.y===0)a.vy=8.2;
  a.vy-=RULES.gravity*dt;a.y=Math.max(0,a.y+a.vy*dt);if(!a.y)a.vy=0;
  const relative=b.y-a.y;
  if(!active||a.cooldown>0||match.clock-match.teamContactAt<.16||distance(a,b)>1.05||relative<.7||relative>2.8||b.vy>1.2)continue;
  if(match.side!==side){match.side=side;match.touches=0;}
  if(match.touches>=3){match.point(1-side,'Four touches');return;}
  const nextTouch=match.touches+1;
  const candidates=team.filter(other=>other.id!==a.id);
  const partner=candidates.reduce((best,other)=>!best||Math.abs(other.homeZ)<Math.abs(best.homeZ)?other:best,null);
  let type,shot,time;
  if(nextTouch===1){type='receive';shot={x:partner?.homeX??0,y:1.7,z:sign*1.8};time=1.12;}
  else if(nextTouch===2){type='set';const human=side===0&&match.player.z<3.5?match.player:null;shot={x:clamp(human?.x??partner?.homeX??0,-3.2,3.2),y:3.2,z:sign*1.1};time=1.05;}
  else {type=a.y>.35?'spike':'receive';shot={x:clamp(-b.x*.75,-3.4,3.4),z:-sign*5.8};time=type==='spike'?.7:1.5;}
  a.cooldown=.4;match.lastTeamActor=a.id;match.teamContactAt=match.clock;match.last=side;match.touches=nextTouch;
  match.launch(shot,shotFlightTime(b,shot,time,type!=='spike'));
  match.hitEvent={side,type,height:b.y,playerY:a.y,actor:a.id,at:match.clock};
  match.feedback=type==='spike'?'TEAM SPIKE!':type==='set'?'TEAM SET':'TEAM RECEIVE';
  return; // One athlete per simulation step; every next touch needs another actor.
 }
}
