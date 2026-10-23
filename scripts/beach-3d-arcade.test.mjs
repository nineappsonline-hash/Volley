import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../public/beach-challenge/game/simulation.js';
import {thirdPersonPose} from '../public/beach-challenge/game/camera.js';
const match=options=>new Match({arcade:true,...options});
function receive(){const m=match();m.phase='rally';m.last=1;m.ball={x:0,y:1.55,z:5.1,vx:0,vy:-1,vz:1};return m}
test('manual serve waits for two clicks, then tosses before a fallback bump serve',()=>{const m=match();for(let i=0;i<180;i++)m.step();assert.equal(m.phase,'serve');m.action();m.step();assert.ok(m.serveMeter>=.35&&m.serveMeter<=1);m.action();assert.equal(m.phase,'rally');assert.ok(m.pendingToss);assert.ok(m.ball.vy>0);for(let i=0;i<180&&m.pendingToss;i++)m.step();assert.equal(m.pendingToss,false);assert.equal(m.hitEvent.type,'serve');assert.ok(m.ball.vz<0)});
test('Q on the ground sets on the player side instead of sending a receive over the net',()=>{const m=receive();m.secondary();m.step();assert.equal(m.hitEvent?.type,'set');assert.ok(m.ball.vy>0);assert.equal(m.last,0);assert.equal(m.touches,1)});
test('airborne Q at the net blocks without charging a team touch',()=>{const m=receive();Object.assign(m.player,{z:.65,y:.8,vy:0});Object.assign(m.ball,{z:.6,y:2.8,vz:2,vy:-1});m.secondary();m.step();assert.equal(m.hitEvent?.type,'block');assert.ok(m.ball.vz<0);assert.equal(m.touches,0)});
test('a block attempt away from the net cannot hit the ball',()=>{const m=receive();m.player.y=.8;m.ball.y=2.8;m.secondary();m.step();assert.equal(m.hitEvent,null)});
test('dives are directional, bounded and cannot be spammed',()=>{const m=receive();assert.ok(m.dive(1,0,0));assert.equal(m.dive(1,0,0),false);const old=m.player.x;for(let i=0;i<20;i++)m.step();assert.ok(m.player.x>old);assert.ok(m.player.x<=4.8);assert.ok(m.diveCooldown>0)});
test('low balls outside standing reach can be saved by a timed dive',()=>{const m=receive();Object.assign(m.ball,{x:1.1,y:.45,z:5.5,vz:0,vy:0});m.dive(1,0,0);m.step();assert.equal(m.hitEvent?.type,'dive');assert.ok(m.ball.vy>0)});
test('abilities have a shared cooldown and expire without use',()=>{for(const ability of ['power','shield','dash']){const m=receive();m.config.ability=ability;assert.ok(m.ability());assert.equal(m.ability(),false);assert.equal(m.abilityCooldown,12);for(let i=0;i<300;i++)m.step();assert.ok(m.abilityUntil<m.clock);assert.ok(m.abilityCooldown>0)}});
test('power strike consumes boost only on a spike',()=>{const m=receive();m.config.ability='power';m.ability();m.contact(0);assert.ok(m.abilityUntil>m.clock);m.contactLatched[0]=false;Object.assign(m.player,{y:1});Object.assign(m.ball,{y:3.2,z:1});m.actionKind='hit';m.contact(0);assert.equal(m.hitEvent.type,'spike');assert.equal(m.abilityUntil,0)});
test('third person camera stays behind the athlete and honors orbit direction',()=>{const p={x:0,y:0,z:5};let c=thirdPersonPose(p);assert.ok(c.z>p.z);assert.ok(c.y>1.65);assert.ok(c.lookZ<p.z);c=thirdPersonPose(p,Math.PI/2);assert.ok(c.x>p.x);assert.ok(c.lookX<p.x);for(const v of Object.values(c))assert.ok(Number.isFinite(v))});
test('arcade replay is deterministic and resets pending action state',()=>{const a=match(),b=match();for(let i=0;i<1200;i++){if(i===0||i===35){a.action();b.action()}if(i%80===0){a.secondary();b.secondary()}const input={x:Math.sin(i/70),z:Math.cos(i/100),jump:i%90===0};a.step(input);b.step(input)}assert.deepEqual(a,b);a.reset(0);assert.equal(a.serveCharge,null);assert.equal(a.pendingToss,false);assert.equal(a.diveTime,0)});
test('4v4 creates three allies and three additional opponents and remains finite under long play',()=>{const m=match({teamSize:4});assert.equal(m.teammates.length,3);assert.equal(m.opponents.length,3);m.serve();for(let i=0;i<6000;i++){if(m.phase==='serve'&&m.server===0)m.serve();m.step({x:Math.sin(i/70),z:Math.cos(i/100),autoHit:true});for(const actor of [m.player,m.ai,...m.teammates,...m.opponents]){assert.ok(Number.isFinite(actor.x)&&Number.isFinite(actor.z));assert.ok(Math.abs(actor.x)<=4.8)}assert.ok(Object.values(m.ball).every(Number.isFinite));assert.ok(m.touches<=3)}});
test('air tilt gives a spike lateral curve without affecting a grounded receive',()=>{const m=receive();m.shotTilt=1;m.player.y=1;m.ball.y=3.2;m.contact(0);assert.equal(m.ball.spin,2.4);const n=receive();n.shotTilt=1;n.contact(0);assert.equal(n.ball.spin,undefined)});
test('locked serve power changes an airborne serve impulse',()=>{const velocities=[];for(const power of [.35,1]){const m=receive();m.pendingToss=true;m.servePower=power;m.player.y=1;m.ball.y=3.2;m.contact(0);velocities.push(Math.abs(m.ball.vz))}assert.ok(velocities[1]>velocities[0])});
test('Sky Wall consumes its activation only on a successful block',()=>{const m=receive();m.config.ability='shield';m.ability();m.actionKind='block';m.contact(0);assert.ok(m.abilityUntil>m.clock);Object.assign(m.player,{z:.6,y:1});Object.assign(m.ball,{z:.7,y:3,vz:3});m.contact(0);assert.equal(m.hitEvent.type,'block');assert.equal(m.abilityUntil,0);assert.ok(m.ball.vy<0)});
test('a fourth player set awards exactly one fault',()=>{const m=receive();m.actionKind='set';for(let i=0;i<4;i++)m.contact(0);assert.equal(m.phase,'point');assert.deepEqual(m.points,[0,1]);m.point(1,'again');assert.deepEqual(m.points,[0,1])});
test('old six-player settings normalize to four, with a distinct duel mode',()=>{
 assert.equal(match({teamSize:6}).config.teamSize,4);
 assert.equal(match({teamSize:6}).teammates.length,3);
 assert.equal(match({teamSize:1}).teammates.length,0);
});
test('slower arcade ball time preserves the flight path without slowing athletes',()=>{
 const m=match();m.phase='rally';m.last=0;m.side=0;
 m.ball={x:0,y:5,z:3,vx:1,vy:0,vz:-2};const before={...m.ball};
 m.step({x:1});const dt=1/60;
 assert.ok(Math.abs((m.ball.z-before.z)-before.vz*dt*.78)<1e-9);
 assert.ok(Math.abs((m.ball.x-before.x)-before.vx*dt*.78)<1e-9);
 assert.ok(m.player.x>0,'athlete movement is still active at normal time');
 assert.ok(m.ball.y<before.y,'gravity still acts on the slowed ball');
 assert.ok(Math.abs(m.time-(90-dt))<1e-9,'match clock stays at normal speed');
});
