import {thirdPersonPose} from './camera.js';
import {createAthlete,createAthleteHands} from './athlete.js';
import {predictBallLanding} from './simulation.js';
import {createHands} from './hands.js';
import {handPose,contactPose,animationWeight} from './hand-pose.js';
import * as THREE from '../vendor/three.module.js';
export {THREE};
export function loadBrandLogo(){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Playza logo could not load'));image.src=new URL('/logo.png',import.meta.url).href})}

// All textures are purpose-created here; no model or texture network downloads.
function paintedTexture(width,height,paint){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 paint(canvas.getContext('2d'),width,height);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
function sandTexture(){
 return paintedTexture(512,512,(ctx,w,h)=>{
  ctx.fillStyle='#e2c392';ctx.fillRect(0,0,w,h);let seed=214;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<28000;i++){const light=random()>.5;ctx.fillStyle=light?'rgba(255,248,224,.22)':'rgba(105,75,45,.10)';const r=.3+random()*1.2;ctx.fillRect(random()*w,random()*h,r,r)}
  for(let i=0;i<90;i++){const x=random()*w,y=random()*h;ctx.strokeStyle='rgba(104,72,38,.055)';ctx.lineWidth=2+random()*3;ctx.beginPath();ctx.ellipse(x,y,3+random()*6,1.5+random()*2,random()*Math.PI,0,Math.PI*2);ctx.stroke()}
  for(let i=0;i<14;i++){ctx.beginPath();ctx.strokeStyle='rgba(159,125,78,.045)';ctx.lineWidth=3;ctx.moveTo(0,i*42);for(let x=0;x<=w;x+=8)ctx.lineTo(x,i*42+Math.sin(x*.032+i)*5);ctx.stroke()}
 });
}
function jerseyTexture(){
 return paintedTexture(128,128,(ctx,w,h)=>{
  ctx.fillStyle='#ff795b';ctx.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=3){ctx.fillStyle=y%2?'rgba(255,255,255,.07)':'rgba(106,33,33,.07)';ctx.fillRect(0,y,w,1)}
  for(let x=0;x<w;x+=3){ctx.fillStyle='rgba(255,233,213,.06)';ctx.fillRect(x,0,1,h)}
 });
}
function ballTexture(logo){
 return paintedTexture(512,256,(ctx,w,h)=>{
  ctx.fillStyle='#fff9e8';ctx.fillRect(0,0,w,h);
  for(let i=-1;i<7;i++){ctx.fillStyle=i%2===0?'#14213D':'#C7F23D';ctx.beginPath();ctx.moveTo(i*100,-20);ctx.bezierCurveTo(i*100+100,70,i*100-30,160,i*100+100,280);ctx.lineTo(i*100+154,280);ctx.bezierCurveTo(i*100+26,160,i*100+154,70,i*100+54,-20);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(19,65,64,.22)';ctx.lineWidth=2;ctx.stroke()}
  for(const x of [58,314]){ctx.fillStyle='#ffffff';ctx.fillRect(x,89,140,78);ctx.drawImage(logo,x+4,93,132,66)}
 });
}
export function createWorld(canvas,settings,logo,athleteAsset=null){
 const mobileAuto=settings.touch&&settings.quality!=='high',low=settings.quality==='low'||mobileAuto;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:!low});
 renderer.setPixelRatio(Math.min(devicePixelRatio,low?Math.min(1,Math.sqrt(650000/(innerWidth*innerHeight))):1.5));
 renderer.shadowMap.enabled=!low&&!mobileAuto;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xdce4df,38,100);
 scene.background=paintedTexture(16,256,(ctx,w,h)=>{const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#86b8cd');g.addColorStop(.62,'#d2e3df');g.addColorStop(1,'#f2e9d1');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)});
 const camera=new THREE.PerspectiveCamera(settings.fov,1,.05,100);camera.rotation.order='YXZ';scene.add(camera);
 scene.add(new THREE.HemisphereLight(0xe8f3ff,0xb59568,1.75));
 const sun=new THREE.DirectionalLight(0xffe4c2,2.8);sun.position.set(-15,22,12);sun.castShadow=true;
 sun.shadow.mapSize.set(settings.quality==='high'?2048:1024,settings.quality==='high'?2048:1024);
 Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.5,far:60});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun);
 const mat=(c,extra={})=>{
  if(!low)return new THREE.MeshStandardMaterial({color:c,roughness:.85,...extra});
  const options={color:c};for(const key of ['map','side','transparent','opacity','emissive','emissiveIntensity'])if(extra[key]!==undefined)options[key]=extra[key];
  return new THREE.MeshLambertMaterial(options);
 };
 const teal=mat(0x14213d),dark=mat(0x253e44),skin=mat(0xc89270),cream=mat(0xf4f0df),green=mat(0x658854),metal=mat(0x52676c,{roughness:.4,metalness:.35});
 function mesh(geometry,material,x=0,y=0,z=0,parent=scene){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const box=(w,h,d,m,x=0,y=0,z=0,parent=scene)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
 const sphere=(r,m,x=0,y=0,z=0,parent=scene)=>mesh(new THREE.SphereGeometry(r,low?12:20,low?8:14),m,x,y,z,parent);
 const capsule=(r,l,m,x,y,z,parent)=>mesh(new THREE.CapsuleGeometry(r,l,low?3:5,low?8:12),m,x,y,z,parent);
 function batch(geometry,material,items,cast=true){const o=new THREE.InstancedMesh(geometry,material,items.length),dummy=new THREE.Object3D();items.forEach((v,i)=>{dummy.position.set(...v.position);dummy.scale.set(...(v.scale||[1,1,1]));dummy.rotation.set(...(v.rotation||[0,0,0]));dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix)});o.castShadow=cast;o.receiveShadow=true;scene.add(o);return o}
 const sandMap=sandTexture();sandMap.wrapS=sandMap.wrapT=THREE.RepeatWrapping;sandMap.repeat.set(8,12);sandMap.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const sand=mat(0xffffff,{map:sandMap,bumpMap:sandMap,bumpScale:low?0:.025,roughness:1});
 box(120,.12,120,mat(0x98aa83),0,-.18,0);box(14,.12,22,mat(0xc0b7a1),0,-.10,0);box(12,.10,20,sand,0,-.035,0);
 for(let x of [-4,4])box(.055,.012,16,cream,x,.025,0);
 for(let z of [-8,8])box(8,.012,.055,cream,0,.025,z);
 for(let x of [-4.35,4.35]){
  mesh(new THREE.CylinderGeometry(.075,.075,2.7,12),teal,x,1.35,0);
  box(.16,.28,.16,cream,x,2.65,0);
  const antenna=mesh(new THREE.CylinderGeometry(.018,.018,.8,8),cream,x,2.9,0);antenna.castShadow=false;
  for(let y=2.58;y<3.3;y+=.18)box(.04,.075,.04,mat(0xd66852),x,y,0);
 }
 box(8.7,.09,.06,cream,0,2.35,0);box(8.7,.04,.035,cream,0,1.35,0);
 const netPoints=[];for(let x=-4.3;x<=4.3;x+=.18)netPoints.push(x,1.35,0,x,2.35,0);for(let y=1.35;y<2.35;y+=.12)netPoints.push(-4.3,y,0,4.3,y,0);
 const netGeometry=new THREE.BufferGeometry();netGeometry.setAttribute('position',new THREE.Float32BufferAttribute(netPoints,3));scene.add(new THREE.LineSegments(netGeometry,new THREE.LineBasicMaterial({color:0x2d4548,transparent:true,opacity:.68})));
 // Instanced landscaping and buildings keep the compound inexpensive to draw.
 const trunks=[],foliage=[],buildings=[],windows=[],planters=[];
 for(let i=0;i<16;i++){const x=i%2===0?-11-(i%3):11+(i%3),z=-22+i*3;
  trunks.push({position:[x,1.15,z],scale:[.24,2.3,.24]});foliage.push({position:[x,3.2,z],scale:[1.2,1.7,1.2]},{position:[x+.5,4,z],scale:[1,1.1,1]});
  planters.push({position:[x,.2,z],scale:[2.1,.4,2.1]});
 }
 batch(new THREE.BoxGeometry(1,1,1),mat(0x7e6b51),trunks);batch(new THREE.IcosahedronGeometry(1,low?1:2),green,foliage);batch(new THREE.BoxGeometry(1,1,1),mat(0xbaa98e),planters);
 for(let i=0;i<10;i++){const x=(i-5)*7,z=-34-(i%3)*6,h=5+(i%4)*1.5;buildings.push({position:[x,h/2,z],scale:[6,h,5]});for(let y=1.5;y<h;y+=1.65)windows.push({position:[x,y,z+2.52],scale:[4.8,.85,.025]})}
 batch(new THREE.BoxGeometry(1,1,1),mat(0xd9d9ca),buildings);batch(new THREE.BoxGeometry(1,1,1),mat(0x7a9ea6,{roughness:.3,metalness:.25}),windows);
 const fencePosts=[],fenceBars=[];for(let x=-10;x<=10;x+=2){fencePosts.push({position:[x,.8,-13],scale:[.065,1.6,.065]})}for(let y of [.35,.85,1.35])fenceBars.push({position:[0,y,-13],scale:[20,.025,.025]});batch(new THREE.BoxGeometry(1,1,1),metal,fencePosts);batch(new THREE.BoxGeometry(1,1,1),metal,fenceBars);
 for(let x of [-8,8])for(let z of [-11,11]){mesh(new THREE.CylinderGeometry(.055,.08,6.8,10),metal,x,3.4,z);box(1.1,.16,.32,metal,x,6.8,z);box(.9,.035,.25,mat(0xfff6d5,{emissive:0xffe7ac,emissiveIntensity:.15}),x,6.7,z)}
 const wood=mat(0xb58a58),slats=[];for(let x of [-7,7]){for(let i=0;i<4;i++)slats.push({position:[x+(i-1.5)*.14,.58,4],scale:[.12,.08,3]});box(.08,.5,2.4,metal,x,.27,4);box(.1,.8,3,wood,x+Math.sign(x)*.35,.8,4)}batch(new THREE.BoxGeometry(1,1,1),wood,slats);
 const bannerMap=paintedTexture(1024,256,(ctx,w,h)=>{ctx.fillStyle='#14213D';ctx.fillRect(0,0,w,h);ctx.fillStyle='#C7F23D';ctx.fillStyle='#ffffff';ctx.fillRect(44,40,280,140);ctx.drawImage(logo,54,45,260,130);ctx.fillStyle='#C7F23D';ctx.font='24px sans-serif';ctx.fillStyle='#f4f0df';ctx.fillText('BEACH CHALLENGE  /  NEW CAIRO',365,140);ctx.strokeStyle='#d5ef67';ctx.lineWidth=3;ctx.strokeRect(22,22,w-44,h-44)});
 const banner=mesh(new THREE.PlaneGeometry(4.5,1.15),mat(0xffffff,{map:bannerMap,side:THREE.DoubleSide}),0,1.5,-13);banner.castShadow=false;
 // Instanced palms: all leaf blades share one geometry and one material.
 const palmTrunks=[],palmLeaves=[];
 for(const x of [-7,7])for(const z of [-10,10]){palmTrunks.push({position:[x,2.05,z]});for(let i=0;i<8;i++)palmLeaves.push({position:[x,4.1,z],rotation:[0,i*Math.PI/4,0]})}
 batch(new THREE.CylinderGeometry(.10,.17,4.1,8),mat(0x907253),palmTrunks);
 const bladePositions=[],bladeIndices=[];
 for(let i=0;i<=10;i++){const t=i/10,width=Math.sin(Math.PI*t)*.29;for(const side of [-1,1])bladePositions.push(t*2.5,Math.sin(t*Math.PI)*.55-t*t*.75,side*width)}
 for(let i=0;i<10;i++){const v=i*2;bladeIndices.push(v,v+1,v+2,v+1,v+3,v+2)}
 const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bladePositions,3));bladeGeometry.setIndex(bladeIndices);bladeGeometry.computeVertexNormals();
 batch(bladeGeometry,mat(0x476b3c,{side:THREE.DoubleSide}),palmLeaves);
 const sunDisc=mesh(new THREE.SphereGeometry(2.8,12,8),new THREE.MeshBasicMaterial({color:0xfff1d1,fog:false}),-30,35,-70);sunDisc.position.copy(sun.position).normalize().multiplyScalar(80);sunDisc.castShadow=false;sunDisc.receiveShadow=false;
 // Articulated adult sports character: limbs pivot at joints instead of their centres.
 const opponent=new THREE.Group();scene.add(opponent);
 const jerseyMap=jerseyTexture();jerseyMap.wrapS=jerseyMap.wrapT=THREE.RepeatWrapping;jerseyMap.repeat.set(4,2);
 const jersey=mat(0xffffff,{map:jerseyMap,roughness:1,bumpMap:jerseyMap,bumpScale:.003});
 const shirt=mesh(new THREE.CylinderGeometry(.23,.19,.58,low?16:24),jersey,0,1.2,0,opponent);shirt.scale.z=.72;
 const chestMap=paintedTexture(512,256,(ctx,w,h)=>{ctx.fillStyle='#ff795b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(20,22,w-40,h-44,18);ctx.fill();ctx.drawImage(logo,36,30,w-72,h-60)});
 const crest=mesh(new THREE.CylinderGeometry(.223,.208,.22,16,1,true,-.82,1.64),mat(0xffffff,{map:chestMap,roughness:.95}),0,1.25,0,opponent);crest.scale.z=.72;crest.castShadow=false;
 const collar=mesh(new THREE.TorusGeometry(.10,.025,6,16),teal,0,1.5,0,opponent);collar.rotation.x=Math.PI/2;
 const shorts=box(.40,.17,.25,dark,0,.85,0,opponent);
 const head=new THREE.Group();head.position.y=1.70;opponent.add(head);
 const face=sphere(.175,skin,0,0,0,head);face.scale.set(.86,1.12,.88);
 const hair=sphere(.18,mat(0x2c302e),0,.105,-.015,head);hair.scale.set(.88,.60,.85);
 for(let x of [-.057,.057]){sphere(.014,cream,x,.014,.147,head);sphere(.007,dark,x,.014,.160,head);box(.034,.008,.009,mat(0x47372e),x,.046,.145,head)}
 const nose=sphere(.03,skin,0,-.025,.15,head);nose.scale.set(.65,1,1);
 const mouth=box(.065,.012,.008,mat(0x915947),0,-.075,.145,head);
 const legs=[],cpuArms=[];
 for(let side of [-1,1]){
  const hip=new THREE.Group();hip.position.set(side*.13,.85,0);opponent.add(hip);legs.push(hip);
  capsule(.09,.11,dark,0,-.10,0,hip);capsule(.077,.17,skin,0,-.28,0,hip);capsule(.064,.22,skin,0,-.51,.005,hip);
  const shoe=box(.15,.11,.29,cream,0,-.74,.065,hip);box(.15,.03,.30,mat(0xddb43f),0,-.79,.065,hip);
  const shoulder=new THREE.Group();shoulder.position.set(side*.27,1.43,0);opponent.add(shoulder);cpuArms.push(shoulder);
  capsule(.085,.11,jersey,0,-.095,0,shoulder);capsule(.065,.18,skin,0,-.245,0,shoulder);
  const forearm=new THREE.Group();forearm.position.set(0,-.37,0);shoulder.add(forearm);capsule(.054,.15,skin,0,-.095,0,forearm);sphere(.061,skin,0,-.23,0,forearm);
 }
 const athlete=athleteAsset?createAthlete(scene,athleteAsset,logo,low):null;if(athlete)opponent.visible=false;
 const localAthlete=athleteAsset?createAthlete(scene,athleteAsset,logo,low):null;
 const localFallback=localAthlete?null:opponent.clone(true);if(localFallback)scene.add(localFallback);
 const supportCount=settings.teamSize===2?1:[4,6].includes(settings.teamSize)?3:0;const teamVisuals=Array.from({length:supportCount*2},(_,i)=>{const actor=athleteAsset?createAthlete(scene,athleteAsset,logo,low):null;const fallback=actor?null:opponent.clone(true);if(fallback)scene.add(fallback);const marker=mesh(new THREE.RingGeometry(.30,.36,20),new THREE.MeshBasicMaterial({color:i<supportCount?0xc7f23d:0xff795b,side:THREE.DoubleSide}),0,.04,0);marker.rotation.x=-Math.PI/2;marker.castShadow=false;return {actor,fallback,marker}});
 const thirdPerson=settings.camera!=='first';
 const hands=athleteAsset?createAthleteHands(camera,athleteAsset,low):createHands(camera,skin,teal,low);
 hands.root ? hands.root.visible=!thirdPerson : null;
 let displayedPose=handPose();
 const ballMaterial=mat(0xffffff,{map:ballTexture(logo),roughness:.55});const ball=mesh(new THREE.SphereGeometry(.105,low?16:28,low?10:20),ballMaterial);
 const trackingTexture=paintedTexture(64,64,(ctx)=>{ctx.strokeStyle='#ffffff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(32,32,25,0,Math.PI*2);ctx.stroke()});
 const ballCue=new THREE.Sprite(new THREE.SpriteMaterial({map:trackingTexture,color:0xd4ff00,transparent:true,depthWrite:false,depthTest:false,opacity:.85}));ballCue.name='ball-tracking-ring';ballCue.renderOrder=5;scene.add(ballCue);
 const contactCue=new THREE.Sprite(new THREE.SpriteMaterial({map:trackingTexture,color:0xd4ff00,transparent:true,depthWrite:false,opacity:0}));contactCue.name='confirmed-contact-ring';scene.add(contactCue);
 let cueHit=-1,landingAt=-1,landingHit=-1,predictedLanding=null;
 const shadowMap=paintedTexture(64,64,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(55,47,34,.45)');g.addColorStop(.4,'rgba(55,47,34,.22)');g.addColorStop(1,'rgba(55,47,34,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)});
 const cpuShadow=mesh(new THREE.PlaneGeometry(.9,1.1),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.75}),0,.027,-5.5);cpuShadow.rotation.x=-Math.PI/2;cpuShadow.castShadow=false;cpuShadow.receiveShadow=false;
 const shadow=mesh(new THREE.PlaneGeometry(.65,.65),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}),0,.026,0);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;shadow.receiveShadow=false;
 const landing=mesh(new THREE.RingGeometry(.30,.35,40),new THREE.MeshBasicMaterial({color:0xf5fdc4,side:THREE.DoubleSide,transparent:true,opacity:.7}),0,.03,0);landing.name='ball-landing-preview';landing.rotation.x=-Math.PI/2;landing.castShadow=false;
 const target=mesh(new THREE.RingGeometry(.14,.17,24),new THREE.MeshBasicMaterial({color:0xd5ef67,side:THREE.DoubleSide}),0,.035,-5.5);target.name='shot-aim-marker';target.rotation.x=-Math.PI/2;target.castShadow=false;
 // A short history line helps assisted players read fast returns. It never spans contacts or resets.
 const trailCount=11,trailPoints=new Float32Array(trailCount*3),trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPoints,3));
 const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:0xf5ffd0,transparent:true,opacity:.45,depthWrite:false}));trail.name='assisted-ball-trail';trail.frustumCulled=false;scene.add(trail);
 let trailClock=-1,trailHit=-1;
 let previousAI={x:0,z:-5.5},previousClock=0,walkPhase=0,lastHands=-1;
 function resize(){if(low)renderer.setPixelRatio(Math.min(renderer.getPixelRatio(),devicePixelRatio,1,Math.sqrt(650000/(innerWidth*innerHeight))));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}resize();
 return {scene,camera,renderer,resize,
  lowerQuality(){renderer.setPixelRatio(Math.max(.5,renderer.getPixelRatio()*.8));renderer.shadowMap.enabled=false;resize()},
  render(m,yaw,pitch,alpha=1,cameraDistance=4.2){
   const p=m.player,b=m.ball,old=m.previousBall;
   if(thirdPerson){const c=thirdPersonPose(p,yaw,pitch,cameraDistance);const follow=m.previousBall?1-Math.exp(-14*Math.max(1/120,Math.min(.05,m.clock-previousClock))):1;camera.position.lerp(new THREE.Vector3(c.x,c.y,c.z),follow);camera.lookAt(c.lookX,c.lookY,c.lookZ)}else{camera.position.set(p.x,p.y+1.7,p.z);camera.rotation.set(pitch,yaw,0)}
   if(localAthlete){localAthlete.root.visible=thirdPerson;localAthlete.update({...m,ai:p,player:m.ai,last:1-m.last,hitEvent:m.hitEvent&&(!m.hitEvent.actor||m.hitEvent.actor==='player')?{...m.hitEvent,side:1-m.hitEvent.side}:null});localAthlete.root.rotation.x=m.diveTime>0?-1.1:0}
   if(localFallback){localFallback.visible=thirdPerson;localFallback.position.set(p.x,p.y,p.z);localFallback.rotation.set(m.diveTime>0?-.7:0,yaw+Math.PI,0)}
   // Never interpolate across a scored rally/reset or a confirmed contact impulse.
   const blend=old&&old.phase===m.phase&&old.hitAt===(m.hitEvent?.at??-1);
   ball.position.set(blend?THREE.MathUtils.lerp(old.x,b.x,alpha):b.x,blend?THREE.MathUtils.lerp(old.y,b.y,alpha):b.y,blend?THREE.MathUtils.lerp(old.z,b.z,alpha):b.z);
   ball.rotation.set(m.clock*2.4,m.clock*1.1,m.clock*1.7);
   ballCue.visible=settings.assist&&['serve','rally'].includes(m.phase);ballCue.position.copy(ball.position);ballCue.scale.setScalar(THREE.MathUtils.clamp(camera.position.distanceTo(ball.position)*.045,.4,.85));
   const contactReady=m.phase==='rally'&&!m.contactLatched[0]&&m.contactState(yaw,pitch).withinReach;
   ballCue.material.color.setHex(contactReady?0xd4ff00:0xffffff);
   if(m.hitEvent&&m.hitEvent.at!==cueHit){cueHit=m.hitEvent.at;contactCue.position.copy(ball.position);}
   const contactAge=m.clock-cueHit;contactCue.visible=settings.assist&&m.phase==='rally'&&cueHit>=0&&contactAge>=0&&contactAge<.25;
   if(contactCue.visible){contactCue.scale.setScalar(.3+contactAge*3);contactCue.material.opacity=(1-contactAge/.25)*.85;}

   const newTrail=m.phase!=='rally'||m.clock<trailClock||trailHit!==(m.hitEvent?.at??-1);
   if(newTrail){for(let i=0;i<trailCount;i++)trailPoints.set([ball.position.x,ball.position.y,ball.position.z],i*3);trailClock=m.clock;trailHit=m.hitEvent?.at??-1;trailGeometry.attributes.position.needsUpdate=true}
   else if(m.clock-trailClock>=1/40){trailPoints.copyWithin(3,0,trailPoints.length-3);trailPoints.set([ball.position.x,ball.position.y,ball.position.z]);trailClock=m.clock;trailGeometry.attributes.position.needsUpdate=true}
   trail.visible=settings.assist&&m.phase==='rally'&&Math.hypot(b.vx,b.vy,b.vz)>2;

   athlete?.update({...m,hitEvent:m.hitEvent?.actor&&m.hitEvent.actor!=='cpu'?null:m.hitEvent});
   [...(m.teammates||[]),...(m.opponents||[])].forEach((a,i)=>{const visual=teamVisuals[i];if(!visual)return;const side=i<supportCount?0:1;visual.marker.position.set(a.x,.04,a.z);if(visual.actor)visual.actor.update({...m,ai:a,player:side?m.player:m.ai,last:side?m.last:1-m.last,hitEvent:m.hitEvent?.actor===a.id?{...m.hitEvent,side:1}:null});if(visual.fallback){visual.fallback.position.set(a.x,a.y,a.z);visual.fallback.rotation.y=side?0:Math.PI}});
   cpuShadow.position.set(m.ai.x,.027,m.ai.z);cpuShadow.material.opacity=Math.max(.25,.75-m.ai.y*.25);
   opponent.position.set(m.ai.x,m.ai.y,m.ai.z);opponent.rotation.y=Math.atan2(p.x-m.ai.x,p.z-m.ai.z)*.5;
   const delta=Math.max(0,m.clock-previousClock),distance=Math.hypot(m.ai.x-previousAI.x,m.ai.z-previousAI.z);
   const moving=delta>0&&distance/delta>.15&&m.phase==='rally';if(moving)walkPhase+=distance*7;
   const stride=moving?Math.sin(walkPhase)*.35:0;legs[0].rotation.x=stride;legs[1].rotation.x=-stride;
   previousAI={x:m.ai.x,z:m.ai.z};previousClock=m.clock;
   const age=m.clock-(m.hitEvent?.at??-10),cpuContact=m.hitEvent?.side===1&&age<.42,playerContact=m.hitEvent?.side===0&&age<.36;
   const pulse=cpuContact?Math.sin(Math.min(1,age/.42)*Math.PI):0;
   cpuArms.forEach((a,i)=>{a.rotation.x=cpuContact?(m.hitEvent.type==='spike'?2.6:-1.2)*pulse:(moving?stride*(i?-1:1)*.65:-.08);a.rotation.z=(i?-.08:.08)});
   const hit=m.hitEvent;
   const confirmed=hit?.side===0&&(!hit.actor||hit.actor==='player')&&age>=0&&age<.65;
   // Anticipation poses follow ball height; only a confirmed contact plays the strike.
   const near=m.phase==='rally'&&b.z>0&&Math.hypot(b.x-p.x,b.z-p.z)<2.2;
   const height=b.y-p.y;
   const anticipating=near?(height>2.55&&p.y>.45?'spike':height>1.85?'set':'receive'):'ready';
   const pose=confirmed?(hit.pose||contactPose(hit.type,hit.height??1.45,hit.playerY??0)):anticipating;
   const weight=confirmed?animationWeight(age):near?.65:0;
   const targetPose=handPose(pose,weight),blendPose=1-Math.exp(-18*Math.min(.05,delta||1/60));
   displayedPose=displayedPose.map((v,i)=>({position:v.position.map((x,j)=>THREE.MathUtils.lerp(x,targetPose[i].position[j],blendPose)),rotation:v.rotation.map((x,j)=>THREE.MathUtils.lerp(x,targetPose[i].rotation[j],blendPose)),curl:THREE.MathUtils.lerp(v.curl,targetPose[i].curl,blendPose),spread:THREE.MathUtils.lerp(v.spread,targetPose[i].spread,blendPose)}));
   if(!thirdPerson&&(!low||m.clock-lastHands>=1/30||lastHands<0)){hands.update(displayedPose);lastHands=m.clock}
   shadow.position.set(ball.position.x,.026,ball.position.z);shadow.visible=Math.abs(b.x)<6&&Math.abs(b.z)<10;shadow.scale.setScalar(1+Math.max(0,b.y)*.08);shadow.material.opacity=Math.max(.25,1-b.y*.1);
   landing.visible=settings.assist&&m.phase==='rally';
   if(landing.visible&&(m.clock<landingAt||m.clock-landingAt>=.1||landingHit!==(m.hitEvent?.at??-1))){predictedLanding=predictBallLanding(b);landingAt=m.clock;landingHit=m.hitEvent?.at??-1;}
   landing.visible=landing.visible&&!!predictedLanding;
   if(predictedLanding)landing.position.set(predictedLanding.x,.03,predictedLanding.z);
   target.visible=settings.assist&&m.phase==='rally';const aim=m.shotPreview(yaw,pitch);target.position.set(aim.x,.035,aim.z);
   renderer.render(scene,camera);
  },
  dispose(){const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();scene.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);for(const material of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value)}});textures.add(scene.background);for(const s of skeletons)s.dispose();for(const t of textures)t?.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();renderer.dispose()}
 };
}
