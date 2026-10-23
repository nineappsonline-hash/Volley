import {test} from 'node:test';import assert from 'node:assert/strict';import {assistedPitch} from '../public/beach-challenge/game/camera.js';
const player={x:0,y:0,z:5.5};
test('assist stays within speed bound for an incoming high ball',()=>{let pitch=0;const dt=1/60;for(let i=0;i<100;i++){let next=assistedPitch(pitch,0,player,{x:0,y:7,z:0},dt);assert.ok(Math.abs(next-pitch)<=.45*dt+1e-9);pitch=next}assert.ok(pitch>0)});
test('ball behind or beside the player does not yank camera pitch',()=>{assert.equal(assistedPitch(.2,0,player,{x:0,y:0,z:7},1/60),.2);assert.equal(assistedPitch(.2,0,player,{x:4,y:0,z:5.5},1/60),.2)});
test('ball passing close to the head leaves camera steady',()=>{assert.equal(assistedPitch(.2,0,player,{x:0,y:1.5,z:5.3},1/60),.2)});

import {desktopPointerAction,zoomDistance,thirdPersonPose} from '../public/beach-challenge/game/camera.js';
test('third person separates immediate primary attack from right-drag orbit',()=>{
 assert.equal(desktopPointerAction('third',0),'hit');
 assert.equal(desktopPointerAction('third',2),'look');
 assert.equal(desktopPointerAction('third',1),'ignore');
 assert.equal(desktopPointerAction('third',3),'ignore');
 assert.equal(desktopPointerAction('first',0,true),'hit');
 assert.equal(desktopPointerAction('first',0,false),'look');
 assert.equal(desktopPointerAction('first',2,true),'ignore');
});
test('orbit zoom is bounded and consistent across wheel delta units',()=>{
 assert.ok(zoomDistance(6,100)>6);
 assert.ok(zoomDistance(6,-100)<6);
 assert.equal(zoomDistance(6,100000),12);
 assert.equal(zoomDistance(6,-100000),2.8);
 assert.equal(zoomDistance(6,1,1),zoomDistance(6,16,0));
 assert.equal(zoomDistance(6,1,2),zoomDistance(6,600,0));
 const near=thirdPersonPose(player,0,0,2.8),far=thirdPersonPose(player,0,0,12);
 assert.ok(far.z>near.z);
 assert.equal(near.lookZ,far.lookZ,'zoom does not alter shot aim');
});
