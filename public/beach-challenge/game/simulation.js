import {motionVelocity} from './mobile-input.js';
import {contactPose} from './hand-pose.js';
export const RULES={version:'1.4.0',step:1/60,gravity:9.81,radius:.105,net:2.35,speed:4.5,reach:.9,window:.15,cooldown:.25,duration:90};
export const CPU_LEVELS={
 easy:{speed:2.6,reaction:.48,reach:.76,error:.85,miss:.20,flight:1.9,tip:0},
 medium:{speed:3.2,reaction:.30,reach:.82,error:.70,miss:.10,flight:1.65,tip:.08},
 hard:{speed:3.8,reaction:.20,reach:.86,error:.40,miss:.08,flight:1.5,tip:.18},
};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// The aiming marker and actual shot share one target calculation.
export function shotTarget(yaw=0,pitch=0,tip=false){return {x:clamp(Math.sin(-yaw)*7,-3.6,3.6),z:tip?-1.5:clamp(-5.5-clamp(pitch,-1,1)*3,-7.4,-2.6)}}
export function playerContactState(player,ball,yaw=0,pitch=0,assist=true){
 const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=ball.x-player.x-fx*.35,ry=ball.y-player.y-1.45,rz=ball.z-player.z-fz*.35;
 const reach=assist?1.15:.9,len=Math.hypot(rx,ry,rz),dot=(rx*fx*Math.cos(pitch)+ry*Math.sin(pitch)+rz*fz*Math.cos(pitch))/Math.max(.001,len);
 return {rx,ry,rz,len,reach,withinReach:ball.z>0&&len<=reach&&dot>=Math.cos(65*Math.PI/180)};
}
export function inCourt(x,z){return Math.hypot(Math.max(Math.abs(x)-4,0),Math.max(Math.abs(z)-8,0))<=RULES.radius+1e-9}
export function trajectory(b,target,T){let v={x:(target.x-b.x)/T,y:(.105-b.y+.5*RULES.gravity*T*T)/T,z:(target.z-b.z)/T};let speed=Math.hypot(v.x,v.y,v.z);if(speed>18)for(let k of ['x','y','z'])v[k]*=18/speed;return v}
// Receives and tips need a readable, physically valid arc over the net.
// Keep spikes uncorrected: a low spike can legitimately hit the barrier.
export function shotFlightTime(ball,target,preferred,clearNet=true){
 if(!clearNet||ball.z*target.z>=0)return preferred;
 const fraction=-ball.z/(target.z-ball.z);
 const base=ball.y+(RULES.radius-ball.y)*fraction;
 const coefficient=.5*RULES.gravity*fraction*(1-fraction);
 const minimum=Math.sqrt(Math.max(0,(RULES.net+RULES.radius+.18-base)/coefficient));
 return clamp(Math.max(preferred,minimum),preferred,2.6);
}
export function integrate(b,dt){const old={...b};b.vy-=RULES.gravity*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;const dz=b.z-old.z;let t=dz? -old.z/dz: -1;if(t>=0&&t<=1){const x=old.x+(b.x-old.x)*t,y=old.y+(b.y-old.y)*t;if(Math.abs(x)<=4+RULES.radius&&y<=RULES.net+RULES.radius){b.z=Math.sign(old.z||-dz)*RULES.radius;b.vz*=-.3;b.vx*=.75;b.vy*=.8;return 'net'}}if(b.y<=RULES.radius){const t=clamp((old.y-RULES.radius)/(old.y-b.y),0,1);b.x=old.x+(b.x-old.x)*t;b.z=old.z+(b.z-old.z)*t;b.y=RULES.radius;return 'ground'}return null}
export class Match{
 constructor({difficulty='easy',assist=true,practice=false,seed=71}={}){this.config={difficulty,assist,practice};this.seed=seed;this.player={x:0,z:5.5,y:0,vy:0,vx:0,vz:0};this.ai={x:0,z:-5.5,y:0,vy:0};this.points=[0,0];this.time=90;this.overtime=0;this.perfect=0;this.streak=0;this.bestStreak=0;this.clock=0;this.feedback='HIT to serve';this.cooldown=0;this.window=0;this.aiCooldown=0;this.reset(0)}
 random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296}
 reset(server){this.previousBall=null;this.server=server;this.phase='serve';this.delay=0;this.last=server;this.side=server;this.touches=0;this.window=0;this.contactLatched=[false,false];this.passiveLatch=false;this.cooldown=0;this.aiCooldown=0;this.aiTarget=null;this.aiRead=null;this.nextThink=0;this.jumpBuffer=0;this.hitEvent=null;Object.assign(this.player,{y:0,vy:0,vx:0,vz:0});Object.assign(this.ai,{y:0,vy:0});this.player.x=0;this.player.z=5.5;this.ai.x=0;this.ai.z=-5.5;this.ball={x:0,y:1.6,z:server===0?5:-5,vx:0,vy:0,vz:0};this.feedback=server===0?'HIT to serve':'CPU serving'}
 serve(){if(this.phase!=='serve')return;const b=this.ball;Object.assign(b,{x:0,y:2.2,z:this.server===0?5.2:-5.2});this.launch({x:(this.random()-.5)*2,z:this.server===0?-5:5},1.65);this.phase='rally';this.hitEvent={side:this.server,type:'serve',at:this.clock};this.feedback='Track the ball • get under it'}
 launch(target,T){const v=trajectory(this.ball,target,T);Object.assign(this.ball,{vx:v.x,vy:v.y,vz:v.z})}
 action(tip=false){if(this.phase==='serve'&&this.server===0){this.serve();return}if(this.phase!=='rally'||this.cooldown>0)return;this.window=this.config.assist?.22:.15;this.tip=tip;this.cooldown=.25}
 point(winner,reason){if(this.phase!=='rally')return;this.points[winner]++;this.streak=winner===0?this.streak+1:0;this.bestStreak=Math.max(this.bestStreak,this.streak);this.feedback=(winner===0?'YOUR POINT':'CPU POINT')+' · '+reason;this.phase='point';this.delay=1.6;this.server=winner}
 contact(side,tip=false,aim=0,perfect=false,depth=-5.5){if(this.side!==side){this.side=side;this.touches=0}if(++this.touches>3){this.point(1-side,'Four touches');return}this.last=side;this.contactLatched[side]=true;let p=side===0?this.player:this.ai;let spike=p.y>.45&&this.ball.y>2.55&&this.ball.y-p.y>1.85;const z=side===0?(tip?-1.5:clamp(depth,-7.4,-2.6)):(tip?1.5:5.5);const cpu=CPU_LEVELS[this.config.difficulty]||CPU_LEVELS.easy;const x=side===0?clamp(aim,-3.6,3.6):clamp((this.config.difficulty==='easy'?this.player.x*.65:-this.player.x)+(this.random()-.5)*(this.config.difficulty==='easy'?1:2),-3.5,3.5);const target={x,z};this.launch(target,shotFlightTime(this.ball,target,tip?1.0:spike?.65:side===1?cpu.flight:1.5,!spike));this.feedback=tip?'SOFT TIP':spike?'SPIKE!':'GOOD RECEIVE';this.hitEvent={side,type:tip?'tip':spike?'spike':'receive',pose:contactPose(tip?'tip':spike?'spike':'receive',this.ball.y,p.y),height:this.ball.y,playerY:p.y,at:this.clock};if(side===0&&perfect){this.perfect++;this.feedback='PERFECT HIT!'}}
 step(input={},dt=RULES.step){this.previousBall={...this.ball,phase:this.phase,hitAt:this.hitEvent?.at??-1};this.clock+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.aiCooldown=Math.max(0,this.aiCooldown-dt);const p=this.player;if(this.phase==='point'){this.delay-=dt;if(this.delay<=0){if(this.time<=0)this.phase='result';else this.reset(this.server)}return}if(this.phase==='result')return;
 const yaw=input.yaw||0,velocity=motionVelocity(input.x||0,input.z||0,yaw);const vx=velocity.x,vz=velocity.z;
 const deltaX=vx-p.vx,deltaZ=vz-p.vz,deltaLength=Math.hypot(deltaX,deltaZ),limit=(vx===0&&vz===0?26:22)*dt,scale=deltaLength?Math.min(1,limit/deltaLength):0;p.vx+=deltaX*scale;p.vz+=deltaZ*scale;p.x=clamp(p.x+p.vx*dt,-4.8,4.8);p.z=clamp(p.z+p.vz*dt,.45,8.8);this.jumpBuffer=input.jump?.1:Math.max(0,(this.jumpBuffer||0)-dt);if(this.jumpBuffer>0&&p.y===0){p.vy=5.6;this.jumpBuffer=0}p.vy-=9.81*dt;p.y=Math.max(0,p.y+p.vy*dt);if(!p.y)p.vy=0;
 if(this.phase==='serve'){this.delay+=dt;if(this.delay>(this.server===0?2:.8))this.serve();return}if(this.phase!=='rally')return;
 if(!this.config.practice){this.time=Math.max(0,this.time-dt);if(this.time===0){this.overtime+=dt;if(this.overtime>=10){this.phase='result';return}}}
 const b=this.ball,cpu=CPU_LEVELS[this.config.difficulty]||CPU_LEVELS.easy,a=this.ai;
 // Read each incoming shot once: delayed decisions and stable errors avoid perfect tracking.
 const incoming=this.last===0&&b.vz<0;
 if(incoming&&(!this.aiRead||this.aiRead.hitAt!==(this.hitEvent?.at??-1))){this.aiRead={hitAt:this.hitEvent?.at??-1,readyAt:this.clock+cpu.reaction,errorX:(this.random()-.5)*cpu.error*2,errorZ:(this.random()-.5)*cpu.error,miss:this.random()<cpu.miss};this.aiTarget=null;this.nextThink=0}
 if(incoming&&this.aiRead&&this.clock>=this.aiRead.readyAt&&this.clock>=this.nextThink){
  this.nextThink=this.clock+cpu.reaction;
  const t=clamp((b.vy+Math.sqrt(Math.max(0,b.vy*b.vy+2*9.81*(b.y-1.45))))/9.81,0,2);
  this.aiTarget={x:clamp(b.x+b.vx*t+this.aiRead.errorX,-4.7,4.7),z:clamp(b.z+b.vz*t+this.aiRead.errorZ,-8.7,-.45)};
 }
 const target=incoming?(this.aiTarget||{x:a.x,z:a.z}):{x:0,z:-5.5};
 if(b.z<0&&b.y>2.6&&b.y<3.5&&b.vy<0&&Math.hypot(b.x-a.x,b.z-a.z)<.6&&a.y===0&&this.config.difficulty!=='easy')a.vy=5.6;
 a.vy-=9.81*dt;a.y=Math.max(0,a.y+a.vy*dt);if(!a.y)a.vy=0;
 const distance=Math.hypot(target.x-a.x,target.z-a.z),travel=Math.min(distance,cpu.speed*dt);if(distance){a.x+=(target.x-a.x)/distance*travel;a.z+=(target.z-a.z)/distance*travel}

 for(let i=0;i<3&&this.phase==='rally';i++){const outcome=integrate(b,dt/3);if(outcome==='net')this.feedback='NET';if(outcome==='ground'){this.point(inCourt(b.x,b.z)?(b.z>0?1:0):1-this.last,inCourt(b.x,b.z)?'Sand':'Out');break}if(Math.abs(b.z)>.15&&Math.sign(b.z)!==Math.sign(this.side===0?1:-1)){this.side=b.z>0?0:1;this.touches=0}
 const aiDistance=Math.hypot(b.x-a.x,b.z-a.z,b.y-(a.y+1.45));if(aiDistance>1.08)this.contactLatched[1]=false;const {rx,ry,rz,len,reach,withinReach}=playerContactState(p,b,yaw,input.pitch||0,this.config.assist);if(len>reach+.18)this.contactLatched[0]=false;const autoContact=input.autoHit===true&&this.cooldown===0;if((this.window>0||autoContact)&&!this.contactLatched[0]&&withinReach){const speed2=b.vx*b.vx+b.vy*b.vy+b.vz*b.vz;const ideal= speed2?-(rx*b.vx+ry*b.vy+rz*b.vz)/speed2:1;const manual=this.window>0,tip=manual&&this.tip;const perfect=manual&&len<.5&&Math.abs(ideal)<=.04;this.window=0;if(autoContact)this.cooldown=.25;this.passiveLatch=true;this.contact(0,tip,Math.sin(-yaw)*7,perfect,shotTarget(yaw,input.pitch||0,tip).z)}else if(incoming&&b.z<0&&b.vy<0&&!this.contactLatched[1]&&this.aiCooldown===0&&this.aiRead&&this.clock>=this.aiRead.readyAt&&!this.aiRead.miss&&aiDistance<=cpu.reach){this.aiCooldown=.25;this.contact(1,this.random()<cpu.tip)}else if(b.z>0&&this.cooldown===0&&!this.contactLatched[0]&&!this.passiveLatch&&Math.hypot(b.x-p.x,b.z-p.z,b.y-(p.y+1.0))<.38){this.passiveLatch=true;this.cooldown=.25;this.contact(0,false,0);b.vx*=.65;b.vz*=.65;this.feedback='BODY DEFLECTION'}if(Math.hypot(b.x-p.x,b.z-p.z,b.y-(p.y+1.0))>.6)this.passiveLatch=false}this.window=Math.max(0,this.window-dt);if(!Object.values(b).every(Number.isFinite)){this.reset(0);this.feedback='Rally reset: invalid physics state'}}
 get score(){return 100*this.points[0]+20*this.perfect+30*this.bestStreak+(this.points[0]>this.points[1]?150:0)}
}
