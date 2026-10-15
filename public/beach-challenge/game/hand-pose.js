const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function contactPose(type,height,playerY=0){
 if(type==='spike')return 'spike';if(type==='tip')return 'tip';if(type==='serve')return 'serve';
 return height-playerY>1.85?'set':'receive';
}
export function handPose(kind='ready',weight=1){
 const ready=[{position:[-.27,-.43,-.56],rotation:[.1,0,-.15],curl:.35,spread:.08},{position:[.27,-.43,-.56],rotation:[.1,0,.15],curl:.35,spread:.08}];
 const poses={
 receive:[{position:[-.053,-.18,-.83],rotation:[.08,-.08,-.62],curl:1.25,spread:0},{position:[.053,-.155,-.83],rotation:[.08,.08,.62],curl:1.25,spread:0}],
 set:[{position:[-.23,.12,-.72],rotation:[1.12,-.3,-.35],curl:.48,spread:.22},{position:[.23,.12,-.72],rotation:[1.12,.3,.35],curl:.48,spread:.22}],
 spike:[{position:[-.29,-.30,-.48],rotation:[.2,-.1,-.2],curl:.4,spread:.1},{position:[.23,.17,-.66],rotation:[1.35,.08,.15],curl:.08,spread:.14}],
 tip:[{position:[-.26,-.32,-.54],rotation:[0,0,-.15],curl:.3,spread:.1},{position:[.10,.14,-.74],rotation:[1.05,0,.1],curl:.12,spread:.12}],
 serve:[{position:[-.16,-.1,-.69],rotation:[.05,0,-.25],curl:.12,spread:.12},{position:[.26,.05,-.51],rotation:[-.5,0,.15],curl:.2,spread:.14}]
 };
 const target=poses[kind]||ready,w=clamp(weight,0,1),mix=(a,b)=>a+(b-a)*w;
 return ready.map((a,i)=>({position:a.position.map((v,j)=>mix(v,target[i].position[j])),rotation:a.rotation.map((v,j)=>mix(v,target[i].rotation[j])),curl:mix(a.curl,target[i].curl),spread:mix(a.spread,target[i].spread)}));
}
export function animationWeight(age){if(age<0||age>.65)return 0;return age<.08?1:Math.pow(1-(age-.08)/.57,2)}
