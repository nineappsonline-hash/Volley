import {test} from 'node:test';import assert from 'node:assert/strict';import {assistedPitch} from '../public/beach-challenge/game/camera.js';
const player={x:0,y:0,z:5.5};
test('assist stays within speed bound for an incoming high ball',()=>{let pitch=0;const dt=1/60;for(let i=0;i<100;i++){let next=assistedPitch(pitch,0,player,{x:0,y:7,z:0},dt);assert.ok(Math.abs(next-pitch)<=.45*dt+1e-9);pitch=next}assert.ok(pitch>0)});
test('ball behind or beside the player does not yank camera pitch',()=>{assert.equal(assistedPitch(.2,0,player,{x:0,y:0,z:7},1/60),.2);assert.equal(assistedPitch(.2,0,player,{x:4,y:0,z:5.5},1/60),.2)});
test('ball passing close to the head leaves camera steady',()=>{assert.equal(assistedPitch(.2,0,player,{x:0,y:1.5,z:5.3},1/60),.2)});
