const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();

function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  new Function('require', 'exports', output)(id => {
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(file), id);
      const resolved = ['', '.tsx', '.ts'].map(ext => base + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (resolved) return load(resolved);
    }
    return require(id);
  }, exports);
  return exports;
}

const {GameInputController,gameKeyInput}=load(path.join(root,'src/lib/game/input-controller.ts'));
const {armPose}=load(path.join(root,'src/lib/game/arm-pose.ts'));
const input=new GameInputController();
input.set('pointer:1',{left:true});input.set('pointer:2',{jump:true});
assert.equal(input.release('pointer:2').left,true,'releasing jump cannot cancel movement');
input.set('pointer:3',{hit:true});input.set('pointer:4',{tip:true,hit:true});
const result=input.release('pointer:4');assert.equal(result.hit,true);assert.equal(result.tip,false);
input.set('keyboard:A',gameKeyInput('a'));input.set('keyboard:Left',gameKeyInput('ArrowLeft'));input.release('pointer:1');
assert.equal(input.release('keyboard:A').left,true,'keyboard aliases are independently owned');
assert.deepEqual(input.clear(),{left:false,right:false,jump:false,hit:false,tip:false});
assert.equal(input.release('pointer:4').hit,false,'late capture loss cannot reactivate inputs');
for(const [tx,ty] of [[0,0],[20,-40],[500,-300],[-20,35]]){
 const p=armPose(0,0,tx,ty,1);
 assert.ok(Object.values(p).every(Number.isFinite));
 assert.ok(Math.abs(Math.hypot(p.ex,p.ey)-23)<1e-7);
 assert.ok(Math.abs(Math.hypot(p.wx-p.ex,p.wy-p.ey)-24)<1e-7);
}
const a=armPose(0,0,20,-25,1),b=armPose(0,0,-20,-25,-1);
assert.ok(Math.abs(a.ex+b.ex)<1e-7&&Math.abs(a.ey-b.ey)<1e-7,'arm bends mirror across sides');
console.log('PASS: independent touch/key holds, cancellation and fixed-length mirrored arm joints');
