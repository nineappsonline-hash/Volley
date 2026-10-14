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

const sim = load(path.join(root, 'src/lib/game/simulation.ts'));
let allocations = 0;
let grainDraws = 0;
const context = new Proxy({}, { get: (_, key) => {
 if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({addColorStop() {}});
 if (key === 'fillRect') return () => {grainDraws += 1;};
 return () => {};
}});
global.document = {createElement: () => {allocations += 1; return {width:0,height:0,getContext: () => context};}};
const render = load(path.join(root, 'src/lib/game/render.ts'));
const state = sim.createGameState({mode:'match',difficulty:'medium',seed:22});
const before = JSON.stringify(state);
function freeze(value) { if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);} }
freeze(state);
const options = {reducedMotion:false,humanName:'You',aiName:'Rival',humanLook:render.HUMAN_LOOKS[0],aiLook:render.AI_LOOK};
render.renderGame(context,state,0.5,options);
const first = grainDraws;
const layers = allocations;
render.renderGame(context,state,0.5,{...options,reducedMotion:true});
assert.equal(JSON.stringify(state),before,'decorative perspective must not mutate gameplay state');
assert.equal(allocations,layers,'reuse scene buffers rather than allocate canvases per frame');
assert.ok(first > 2000 && grainDraws-first < 30,'sand grain is generated once, not on every animation frame');
delete global.document;
console.log('PASS: 2.5D rendering preserves simulation state and caches scenery/texture work across frames');
