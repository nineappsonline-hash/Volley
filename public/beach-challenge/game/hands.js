import * as THREE from '../vendor/three.module.js';
// Anatomical palm masses, tapered forearms and jointed fingers. Repeated finger
// sections are instanced so extra detail does not create a draw call per joint.
export function createHands(camera,skin,jersey){
 const root=new THREE.Group();camera.add(root);
 const dorsal=skin.clone();dorsal.color.setHex(0xc48d6c);dorsal.roughness=.68;
 const palmMat=skin.clone();palmMat.color.setHex(0xd5a282);palmMat.roughness=.8;
 const nailMat=new THREE.MeshStandardMaterial({color:0xe0b79f,roughness:.55});
 const wristMat=skin.clone();wristMat.roughness=.72;
 const sphere=new THREE.SphereGeometry(1,24,16),jointGeo=new THREE.CapsuleGeometry(.016,.04,4,12);
 const armGeo=new THREE.CylinderGeometry(.033,.052,1,24,8);
 const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
 const rigs=[];
 function add(parent,g,m,x,y,z,scale){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);if(scale)o.scale.set(...scale);parent.add(o);return o}
 for(const side of [-1,1]){
  const forearm=add(root,armGeo,wristMat,0,0,0);
  const hand=new THREE.Group();root.add(hand);
  // The palm narrows at the wrist, with separate thenar/hypothenar masses.
  add(hand,sphere,dorsal,0,0,-.048,[.047,.023,.075]);
  add(hand,sphere,palmMat,-side*.026,-.014,-.048,[.026,.018,.050]);
  add(hand,sphere,palmMat,side*.032,-.006,-.060,[.019,.02,.042]);
  add(hand,sphere,wristMat,0,0,.014,[.036,.027,.034]);
  const fingers=new THREE.InstancedMesh(jointGeo,dorsal,15);hand.add(fingers);
  const nails=new THREE.InstancedMesh(sphere,nailMat,5);hand.add(nails);
  const knuckles=new THREE.InstancedMesh(sphere,dorsal,4);hand.add(knuckles);
  const cuff=add(root,new THREE.CylinderGeometry(.053,.053,.035,20),jersey,0,0,0);
  rigs.push({hand,forearm,fingers,nails,knuckles,cuff,side});
 }
 root.traverse(o=>{o.castShadow=false;o.receiveShadow=false});
 function setInstance(mesh,index,pos,rotation,scale){dummy.position.copy(pos);dummy.quaternion.copy(rotation);dummy.scale.set(...scale);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix)}
 const point=new THREE.Vector3(),previous=new THREE.Vector3(),end=new THREE.Vector3(),rotation=new THREE.Quaternion();
 function update(poses){rigs.forEach((r,i)=>{
  const pose=poses[i];r.hand.position.set(...pose.position);r.hand.rotation.set(...pose.rotation);
  const wrist=r.hand.position,raise=THREE.MathUtils.clamp((wrist.y+.15)/.42,0,1);const elbow=new THREE.Vector3(r.side*(.33+.11*raise),-.58+.48*raise,-.28-.12*raise);
  direction.subVectors(wrist,elbow);r.forearm.position.copy(elbow).add(wrist).multiplyScalar(.5);r.forearm.quaternion.setFromUnitVectors(up,direction.clone().normalize());r.forearm.scale.set(1,direction.length(),1);
  r.cuff.position.copy(elbow).lerp(wrist,.1);r.cuff.quaternion.copy(r.forearm.quaternion);
  for(let f=0;f<5;f++){
   const thumb=f===4;
   const lengths=thumb?[.041,.031,.024]:[[.043,.027,.022],[.048,.031,.025],[.045,.030,.024],[.036,.024,.020]][f];
   previous.set(thumb?-r.side*.047:(f-1.5)*.026,thumb?-.004:0,thumb?-.025:-.097);
   const splay=thumb?-r.side*.9:(f-1.5)*pose.spread;
   for(let j=0;j<3;j++){
    const bend=thumb?(pose.curl>.9?.25:.38)+j*.25:pose.curl*(.55+j*.45);
    end.copy(previous).add(new THREE.Vector3(Math.sin(splay)*lengths[j],-Math.sin(bend)*lengths[j],-Math.cos(splay)*Math.cos(bend)*lengths[j]));
    direction.subVectors(end,previous);rotation.setFromUnitVectors(up,direction.clone().normalize());point.copy(previous).add(end).multiplyScalar(.5);
    const thickness=thumb?.90:.78-f*.045-j*.10;setInstance(r.fingers,f*3+j,point,rotation,[thickness,(direction.length()+.018)/.072,thickness]);
    if(j===2){point.copy(previous).lerp(end,.65);point.y+=.010*thickness;setInstance(r.nails,f,point,rotation,[.010*thickness,.015,.0025])}
    if(!thumb&&j===0){point.copy(previous);point.y+=.013;setInstance(r.knuckles,f,point,new THREE.Quaternion(),[.012,.010,.013])}
    previous.copy(end);
   }
  }
  r.fingers.instanceMatrix.needsUpdate=true;r.nails.instanceMatrix.needsUpdate=true;r.knuckles.instanceMatrix.needsUpdate=true;
  r.fingers.frustumCulled=false;r.nails.frustumCulled=false;r.knuckles.frustumCulled=false;
 })}
 return {root,update};
}
