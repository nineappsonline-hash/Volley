import {test} from 'node:test';import assert from 'node:assert/strict';import {Match,inCourt,integrate,trajectory,shotFlightTime} from '../public/beach-challenge/game/simulation.js';
test('sphere footprint: lines count in, rounded corners stay exact',()=>{assert.ok(inCourt(4.105,0));assert.ok(!inCourt(4.106,0));assert.ok(inCourt(4.07,8.07));assert.ok(!inCourt(4.1,8.1))});
test('fast net collision cannot tunnel',()=>{let b={x:0,y:1,z:.15,vx:0,vy:0,vz:-18};assert.equal(integrate(b,1/60),'net');assert.ok(b.z>0);assert.ok(b.vz>0)});
test('low ball cannot pass underneath net',()=>{let b={x:0,y:.4,z:.1,vx:0,vy:0,vz:-18};assert.equal(integrate(b,1/60),'net')});
test('serve arc clears net',()=>{let b={x:0,y:2.2,z:5.2};let v=trajectory(b,{x:0,z:-5},1.65);Object.assign(b,{vx:v.x,vy:v.y,vz:v.z});for(let i=0;i<100;i++)assert.notEqual(integrate(b,1/180),'net')});
test('fourth touch awards only one point',()=>{let m=new Match();m.serve();for(let i=0;i<4;i++)m.contact(0);assert.deepEqual(m.points,[0,1]);m.point(1,'again');assert.deepEqual(m.points,[0,1])});
test('distant action misses and held windows expire',()=>{let m=new Match();m.serve();m.ball={x:3,y:4,z:2,vx:0,vy:0,vz:0};m.action();for(let i=0;i<15;i++)m.step();assert.equal(m.last,0);assert.equal(m.touches,0);assert.equal(m.window,0)});
test('movement boundaries and diagonal normalization',()=>{let a=new Match(),b=new Match();a.step({x:1});b.step({x:1,z:1});assert.ok(Math.abs(Math.hypot(a.player.vx,a.player.vz)-Math.hypot(b.player.vx,b.player.vz))<.2);for(let i=0;i<1000;i++)a.step({x:1,z:1,jump:true});assert.ok(a.player.x<=4.8&&a.player.z>=.45)});
test('unfinished rally ends after ten-second cap',()=>{let m=new Match();m.serve();m.time=0;m.overtime=9.999;m.step();assert.equal(m.phase,'result');assert.deepEqual(m.points,[0,0])});
test('timer does not run during serve or celebration',()=>{let m=new Match();m.step();assert.equal(m.time,90);m.serve();m.point(0,'test');m.step();assert.equal(m.time,90)});
test('same seeded normalized inputs yield identical state',()=>{let a=new Match(),b=new Match();for(let i=0;i<3000;i++){let input={x:Math.sin(i/80),z:Math.cos(i/100),yaw:.2,pitch:.3};a.step(input);b.step(input)}assert.deepEqual(a,b)});

test('CPU short return cannot strike its outgoing ball a second time',()=>{const m=new Match({seed:1});m.serve();m.ai={x:0,z:-.6,y:0,vy:0};m.ball={x:0,y:.6,z:-.6,vx:0,vy:-1,vz:0};m.contact(1,true);m.aiCooldown=.25;const first=m.hitEvent.at;for(let i=0;i<36;i++)m.step();assert.equal(m.hitEvent.at,first);assert.equal(m.touches<=1,true)});
test('normal receive and tip arcs clear the net from low near-net contacts',()=>{for(const z of [-.6,-2,-5])for(const y of [.6,1.45,2])for(const tip of [false,true]){const m=new Match();m.serve();m.ball={x:0,y,z,vx:0,vy:-1,vz:0};m.contact(1,tip);let crossed=false;for(let i=0;i<500;i++){const e=integrate(m.ball,1/180);assert.notEqual(e,'net',`z=${z}, y=${y}, tip=${tip}`);if(m.ball.z>0){crossed=true;break}if(e==='ground')break}assert.ok(crossed)}});
test('rally reset clears impulses, jumps, contact latches and stale animation',()=>{const m=new Match();m.player.y=1;m.player.vy=4;m.player.vx=3;m.ai.y=.5;m.ai.vy=2;m.contactLatched=[true,true];m.aiTarget={x:3,z:-1};m.hitEvent={at:0};m.reset(1);assert.equal(m.player.y,0);assert.equal(m.player.vx,0);assert.equal(m.ai.y,0);assert.deepEqual(m.contactLatched,[false,false]);assert.equal(m.aiTarget,null);assert.equal(m.hitEvent,null)});

test('ball snapshots follow physics and reset without cross-rally interpolation',()=>{const m=new Match();m.serve();const before={...m.ball};m.step();assert.equal(m.previousBall.z,before.z);assert.notEqual(m.ball.z,before.z);m.reset(1);assert.equal(m.previousBall,null)});

function incomingBall(){const m=new Match();m.phase='rally';m.side=0;m.last=1;m.ball={x:0,y:1.5,z:4.7,vx:0,vy:-1,vz:1};return m}
test('auto hit receives a reachable ball without a manual action',()=>{const m=incomingBall();m.step({autoHit:true});assert.equal(m.hitEvent?.side,0);assert.equal(m.hitEvent?.type,'receive');assert.equal(m.touches,1);assert.equal(m.perfect,0)});
test('auto hit stays optional and respects reach and facing',()=>{for(const input of [{},{autoHit:false},{autoHit:true,yaw:Math.PI}]){const m=incomingBall();m.step(input);assert.equal(m.hitEvent,null)}const far=incomingBall();far.ball.x=3;far.step({autoHit:true});assert.equal(far.hitEvent,null)});
test('auto hit respects cooldown and does not repeatedly contact an outgoing ball',()=>{const m=incomingBall();m.cooldown=.2;m.step({autoHit:true});assert.equal(m.hitEvent,null);m.cooldown=0;m.step({autoHit:true});const hit=m.hitEvent;for(let i=0;i<10;i++)m.step({autoHit:true});assert.equal(m.hitEvent,hit);assert.equal(m.touches,1)});
test('manual tip overrides auto receive while the hit window is active',()=>{const m=incomingBall();m.action(true);m.step({autoHit:true});assert.equal(m.hitEvent?.type,'tip')});

test('easy CPU leaves scoring opportunities and difficulties have distinct return rates',()=>{
 const returns={};for(const difficulty of ['easy','medium','hard']){let saved=0;for(let seed=1;seed<=120;seed++){
  const m=new Match({difficulty,seed});m.phase='rally';m.last=0;m.hitEvent={side:0,at:0,type:'receive'};m.ball={x:0,y:2,z:4,vx:0,vy:0,vz:0};
  const target={x:[-3,0,3][seed%3],z:[-3,-5.5,-7][Math.floor(seed/3)%3]};m.launch(target,shotFlightTime(m.ball,target,1.45));
  for(let i=0;i<300&&m.phase==='rally'&&m.hitEvent?.side!==1;i++)m.step();if(m.hitEvent?.side===1)saved++;
 }returns[difficulty]=saved;}
 assert.ok(returns.easy>=24&&returns.easy<=72,JSON.stringify(returns));assert.ok(returns.medium>returns.easy,JSON.stringify(returns));assert.ok(returns.hard>returns.medium&&returns.hard<114,JSON.stringify(returns));
});
test('easy CPU waits to read an incoming ball and stays still during its reaction delay',()=>{const m=new Match({difficulty:'easy'});m.serve();const before={...m.ai};for(let i=0;i<20;i++)m.step();assert.equal(m.ai.x,before.x);assert.equal(m.ai.z,before.z);assert.equal(m.hitEvent.side,0)});
