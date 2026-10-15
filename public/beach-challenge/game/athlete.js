import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {clone} from '../vendor/SkeletonUtils.js';

export async function loadAthlete(){return new GLTFLoader().loadAsync(new URL('../assets/playza-athlete.glb',import.meta.url).href)}
const clamp=THREE.MathUtils.clamp;
const worldPosition=o=>o.getWorldPosition(new THREE.Vector3());
function aimBone(bone,child,target){
 const origin=worldPosition(bone),current=worldPosition(child).sub(origin).normalize(),desired=target.clone().sub(origin).normalize();
 const rotation=new THREE.Quaternion().setFromUnitVectors(current,desired),world=bone.getWorldQuaternion(new THREE.Quaternion());
 bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation.multiply(world)));bone.updateWorldMatrix(false,true);
}
// Two-bone IK keeps the elbow bent and the forearm length constant during contact.
function solveArm(bones,side,target,pole){
 const upper=bones[`upperarm_${side}`],lower=bones[`lowerarm_${side}`],hand=bones[`hand_${side}`];if(!upper||!lower||!hand)return;
 const origin=worldPosition(upper),mid=worldPosition(lower),end=worldPosition(hand),a=origin.distanceTo(mid),b=mid.distanceTo(end);
 const dir=target.clone().sub(origin),distance=clamp(dir.length(),Math.abs(a-b)+.005,a+b-.008);dir.normalize();
 const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
 const bend=pole.clone().sub(origin);bend.addScaledVector(dir,-bend.dot(dir)).normalize();
 const elbow=origin.clone().addScaledVector(dir,along).addScaledVector(bend,height);
 aimBone(upper,lower,elbow);aimBone(lower,hand,origin.addScaledVector(dir,distance));
}
function rig(root){const bones={};root.traverse(o=>{if(o.isBone)bones[o.name]=o});return bones}
function prepareMaterials(root,low){root.traverse(o=>{if(!o.isMesh)return;o.castShadow=!low;o.receiveShadow=!low;o.frustumCulled=false;
 if(low){const old=o.material;o.material=new THREE.MeshLambertMaterial({name:old.name,color:old.color,map:old.map,alphaMap:old.alphaMap,transparent:old.transparent,opacity:old.opacity,alphaTest:old.alphaTest,side:old.side});}
})}
function logoPatch(logo){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,512,256);ctx.drawImage(logo,16,8,480,240);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(.25,.125),new THREE.MeshLambertMaterial({map,side:THREE.DoubleSide}));}
export function createAthlete(parent,asset,logo,low){
 const root=clone(asset.scene);root.name='Playza realistic athlete';parent.add(root);prepareMaterials(root,low);root.updateWorldMatrix(true,true);
 const bones=rig(root),mixer=new THREE.AnimationMixer(root);
 const idle=mixer.clipAction(asset.animations.find(c=>/idle/i.test(c.name))||asset.animations[0]).play();
 const run=mixer.clipAction(asset.animations.find(c=>/run/i.test(c.name))||asset.animations[0]).play();run.setEffectiveWeight(0);
 const crest=logoPatch(logo);root.add(crest);crest.position.set(0,1.32,.158);root.updateWorldMatrix(true,true);bones.spine_03?.attach(crest);
 let previous={x:0,z:-5.5},last=0,weight=0,heading=0;
 const target=new THREE.Vector3(),pole=new THREE.Vector3();
 return {root,update(m){
  const dt=clamp(m.clock-last,0,.06),dx=m.ai.x-previous.x,dz=m.ai.z-previous.z,speed=dt>0?Math.hypot(dx,dz)/dt:0;
  const moving=m.phase==='rally'&&speed>.15;weight=THREE.MathUtils.damp(weight,moving?1:0,10,dt);
  idle.setEffectiveWeight(1-weight);run.setEffectiveWeight(weight);run.setEffectiveTimeScale(clamp(speed/2.8,.5,1.45));mixer.update(dt);
  const desired=moving?Math.atan2(dx,dz):Math.atan2(m.player.x-m.ai.x,m.player.z-m.ai.z);
  heading+=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading))*(1-Math.exp(-10*dt));root.position.set(m.ai.x,m.ai.y,m.ai.z);root.rotation.y=heading;root.updateWorldMatrix(true,true);
  const age=m.clock-(m.hitEvent?.at??-10),contact=m.hitEvent?.side===1&&age>=0&&age<.6;
  const incoming=m.last===0&&m.ball.z<1&&m.phase==='rally',ready=incoming&&!moving;
  const pulse=contact?Math.sin(Math.PI*clamp(age/.6,0,1)):ready?.35:0;
  if(pulse>0){for(const [side,sign] of [['l',1],['r',-1]]){
   const high=contact&&(m.hitEvent.type==='spike'||m.hitEvent.height>1.85);
   target.set(sign*(high?.14:.10),high?1.98:1.10,high?.24:.46);target.applyMatrix4(root.matrixWorld);
   pole.set(sign*.48,high?1.62:1.25,.15).applyMatrix4(root.matrixWorld);
   const hand=bones[`hand_${side}`];target.lerp(worldPosition(hand),1-pulse);solveArm(bones,side,target,pole);
  }}
  previous={x:m.ai.x,z:m.ai.z};last=m.clock;
 }};
}

export function createAthleteHands(camera,asset,low=false){
 const root=clone(asset.scene);root.name='Playza textured first-person arms';root.position.set(0,-1.9,-.4);root.scale.setScalar(1.1);root.rotation.y=Math.PI;camera.add(root);
 prepareMaterials(root,low);const bones=rig(root),body=[];
 root.traverse(o=>{if(o.isMesh){if(o.geometry.getAttribute('skinIndex')&&(/anatomical.body/.test(o.name)||o.material.name==='Playza coral performance jersey'))body.push(o);else o.visible=false}});
 const boneNames=asset.parser.json.skins[0].joints.map(i=>asset.parser.json.nodes[i].name);
 const armJoint=new Set(boneNames.flatMap((n,i)=>/^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/.test(n)?[i]:[]));
 for(const mesh of body){const geo=mesh.geometry.clone(),weights=geo.getAttribute('skinWeight'),joints=geo.getAttribute('skinIndex'),index=geo.index,kept=[];
  const selected=i=>{let sum=0;for(let k=0;k<4;k++)if(armJoint.has(joints.getComponent(i,k)))sum+=weights.getComponent(i,k);return sum>.7};
  for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(selected(a)&&selected(b)&&selected(c))kept.push(a,b,c)}geo.setIndex(kept);mesh.geometry=geo;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;mesh.material=mesh.material.clone();mesh.material.depthTest=true;mesh.renderOrder=5;
 }
 const rest=new Map();for(const bone of Object.values(bones))rest.set(bone,bone.quaternion.clone());
 const target=new THREE.Vector3(),pole=new THREE.Vector3(),forward=new THREE.Vector3();
 return {root,update(poses){
  for(const [bone,q]of rest)bone.quaternion.copy(q);root.updateWorldMatrix(true,true);
  poses.forEach((pose,i)=>{const side=i===0?'l':'r',sign=i===0?-1:1;target.set(...pose.position);camera.localToWorld(target);pole.set(sign*.48,-.42,-.15);camera.localToWorld(pole);solveArm(bones,side,target,pole);
   const hand=bones[`hand_${side}`],finger=bones[`middle_01_${side}`];if(hand&&finger){forward.set(0,0,-1).applyEuler(new THREE.Euler(...pose.rotation)).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())).add(worldPosition(hand));aimBone(hand,finger,forward)}
   for(const bone of Object.values(bones)){if(new RegExp(`^(index|middle|ring|pinky|thumb)_0[123]_${side}$`).test(bone.name)){const curl=bone.name.startsWith('thumb')?pose.curl*.25:Math.max(0,pose.curl-.2)*.65;bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),curl))}}
  });
 }};
}
