import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=readFileSync('public/beach-challenge/assets/playza-athlete.glb');
assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.readUInt32LE(4),2);assert.equal(file.readUInt32LE(8),file.length);
const jsonLength=file.readUInt32LE(12),model=JSON.parse(file.subarray(20,20+jsonLength)),binary=file.subarray(28+jsonLength);
assert.ok(file.length<5_000_000);assert.ok(model.animations.some(a=>/idle/i.test(a.name)));assert.ok(model.animations.some(a=>/run/i.test(a.name)));
assert.ok(model.materials.some(m=>m.name==='Playza coral performance jersey'));
for(const name of ['upperarm_l','lowerarm_l','hand_l','upperarm_r','lowerarm_r','hand_r','thigh_l','calf_l','spine_03'])assert.ok(model.nodes.some(n=>n.name===name),name);
for(const v of model.bufferViews)assert.ok((v.byteOffset??0)+v.byteLength<=binary.length);
const dimensions={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},bytes={5121:1,5122:2,5123:2,5125:4,5126:4};
for(const a of model.accessors){const v=model.bufferViews[a.bufferView];assert.ok((a.byteOffset??0)+a.count*dimensions[a.type]*bytes[a.componentType]<=v.byteLength);}
let triangles=0;
for(const mesh of model.meshes)for(const primitive of mesh.primitives){assert.ok(primitive.attributes.JOINTS_0!=null);assert.ok(primitive.attributes.WEIGHTS_0!=null);const weights=model.accessors[primitive.attributes.WEIGHTS_0],view=model.bufferViews[weights.bufferView];assert.equal(weights.normalized,true);for(let i=0;i<weights.count;i++){const start=(view.byteOffset??0)+i*4;assert.equal(binary[start]+binary[start+1]+binary[start+2]+binary[start+3],255);}triangles+=model.accessors[primitive.indices].count/3;}
assert.ok(triangles<100_000);console.log(`Athlete asset valid: ${(file.length/1e6).toFixed(2)} MB, ${triangles} triangles, idle/run clips, normalized skin weights and required arm/leg bones.`);
