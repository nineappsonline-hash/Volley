// Local teammates use the same gravity, touch budget and collision rules as the player.
import {clamp,RULES,shotFlightTime} from './simulation.js';
const homes=[[-2.5,2.3],[2.5,2.3],[0,4]];
export function createTeam(side){return homes.map(([x,z],i)=>({id:`${side}-${i}`,x,z:side?-z:z,y:0,vy:0,homeX:x,homeZ:side?-z:z,cooldown:0}))}
export function stepTeam(match,side,dt){
 const team=side?match.opponents:match.teammates;if(!team?.length||match.phase!=='rally'||match.pendingToss)return;
 const b=match.ball,sign=side?-1:1,incoming=b.z*sign>0;
 const t=clamp((b.vy+Math.sqrt(Math.max(0,b.vy*b.vy+2*RULES.gravity*(b.y-1.6))))/RULES.gravity,0,1.8);
 const target={x:clamp(b.x+b.vx*t,-3.7,3.7),z:clamp(b.z+b.vz*t,side?-7.7:.6,side?-.6:7.7)};
 const eligible=team.filter(a=>a.id!==match.lastTeamActor||match.side!==side);
 let receiver=incoming?eligible.reduce((best,a)=>!best||Math.hypot(a.x-target.x,a.z-target.z)<Math.hypot(best.x-target.x,best.z-target.z)?a:best,null):null;
 // Leave the controlled athlete a fair opportunity to receive nearby balls.
 if(side===0&&receiver&&Math.hypot(match.player.x-target.x,match.player.z-target.z)<Math.hypot(receiver.x-target.x,receiver.z-target.z)+.4)receiver=null;
 for(const a of team){a.cooldown=Math.max(0,a.cooldown-dt);const tx=a===receiver?target.x:a.homeX,tz=a===receiver?target.z:a.homeZ,dist=Math.hypot(tx-a.x,tz-a.z),move=Math.min(dist,dt*(match.config.difficulty==='hard'?4.5:3.8));if(dist){a.x+=(tx-a.x)/dist*move;a.z+=(tz-a.z)/dist*move}a.vy-=RULES.gravity*dt;a.y=Math.max(0,a.y+a.vy*dt);if(!a.y)a.vy=0;
 if(a===receiver&&match.touches>=2&&b.y>2.7&&b.vy<0&&Math.hypot(b.x-a.x,b.z-a.z)<.9&&a.y===0)a.vy=7.4;
 if(a!==receiver||a.cooldown>0||match.contactLatched[side]||Math.hypot(b.x-a.x,b.z-a.z,b.y-a.y-1.6)>.95||b.vy>1)continue;
 if(match.side!==side){match.side=side;match.touches=0}if(match.touches>=3){match.point(1-side,'Four touches');return}match.lastTeamActor=a.id;match.last=side;match.touches++;match.contactLatched[side]=true;a.cooldown=.65;
 const attack=match.touches>=3,shot=attack?{x:clamp(-b.x*.7,-3.3,3.3),z:-sign*5.6}:{x:0,z:sign*(match.touches===1?2.2:1.1)};
 match.launch(shot,shotFlightTime(b,shot,attack?1:1.35,!attack));match.hitEvent={side,type:attack?'spike':'set',height:b.y,playerY:a.y,actor:a.id,at:match.clock};match.feedback=attack?'TEAM SPIKE!':'TEAM SET';
 }
}
