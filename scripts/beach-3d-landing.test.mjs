import {test} from 'node:test';
import assert from 'node:assert/strict';
import {integrate,predictBallLanding,RULES} from '../public/beach-challenge/game/simulation.js';
function actual(ball){const b={...ball};for(let i=0;i<3000;i++)if(integrate(b,RULES.step/3*RULES.ballTimeScale)==='ground')return {x:b.x,z:b.z};throw Error('ball did not land');}
const basic={x:0,y:3,z:5,vx:1,vy:3,vz:-4};
test('landing preview follows actual slower ball flight without mutating the rally',()=>{const input={...basic},before={...input},p=predictBallLanding(input),land=actual(input);assert.deepEqual(input,before);assert.ok(Math.hypot(p.x-land.x,p.z-land.z)<.03);});
test('preview includes a low-shot net rebound instead of pointing through the net',()=>{const b={x:0,y:1.5,z:1,vx:0,vy:0,vz:-5},p=predictBallLanding(b),land=actual(b);assert.ok(p.z>0);assert.ok(Math.abs(p.z-land.z)<.03);});
test('preview accounts for lateral curve instead of a straight extrapolation',()=>{const p=predictBallLanding({...basic,spin:4}),straight=predictBallLanding(basic),land=actual({...basic,spin:4});assert.ok(p.x>straight.x+.5);assert.ok(Math.hypot(p.x-land.x,p.z-land.z)<.04);});
test('invalid physics does not produce a false landing cue',()=>{assert.equal(predictBallLanding({...basic,vx:NaN}),null);assert.equal(predictBallLanding({...basic,spin:Infinity}),null);});
