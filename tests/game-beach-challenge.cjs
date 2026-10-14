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

const config = load(path.join(root, 'src/lib/game/config.ts'));
const sim = load(path.join(root, 'src/lib/game/simulation.ts'));
const score = load(path.join(root, 'src/lib/game/score.ts'));
const types = load(path.join(root, 'src/lib/game/types.ts'));
const FIXED_DT = 1 / 60;

// --- Score formula is explicit and versioned ---
const won = score.calculateScore({ playerPoints: 6, opponentPoints: 3, perfectHits: 2, longestWinningStreak: 3 });
assert.equal(won.score, 100 * 6 + 20 * 2 + 30 * 3 + 150, 'win bonus applied');
assert.equal(won.won, true);
const draw = score.calculateScore({ playerPoints: 4, opponentPoints: 4, perfectHits: 0, longestWinningStreak: 1 });
assert.equal(draw.score, 400 + 30, 'no win bonus on a draw');
assert.equal(draw.draw, true);
assert.equal(score.betterBest({ score: 100, playerPoints: 1, opponentPoints: 0, perfectHits: 0, longestWinningStreak: 0, achievedAt: 10 }, { score: 100, playerPoints: 1, opponentPoints: 0, perfectHits: 0, longestWinningStreak: 0, achievedAt: 5 }).achievedAt, 5, 'ties prefer the earlier result');

// --- A ball dropping on the AI side awards the human a ground point ---
{
  const state = sim.createGameState({ mode: 'match', difficulty: 'easy', seed: 7 });
  sim.beginCountdown(state);
  state.phase = 'rally';
  state.ai.x = 1180; state.ai.prevX = 1180;
  state.ball.active = true;
  state.ball.x = 700; state.ball.prevX = 700;
  state.ball.y = 120; state.ball.prevY = 120;
  state.ball.vx = 0; state.ball.vy = 60;
  state.lastToucher = 'human';
  state.ballSide = 'ai';
  let guard = 0;
  while (state.phase === 'rally' && guard < 600) { sim.stepGame(state, types.emptyInput(), FIXED_DT); guard += 1; }
  assert.equal(state.phase, 'pointResult');
  assert.equal(state.pointReason, 'ground');
  assert.equal(state.humanPoints, 1, 'human scores when the ball lands on the AI side');
}

// --- A fourth touch is a fault that gives the point away ---
{
  const state = sim.createGameState({ mode: 'match', difficulty: 'easy', seed: 11 });
  sim.beginCountdown(state);
  state.phase = 'rally';
  state.ball.active = true;
  state.ball.x = state.human.x + 24; state.ball.prevX = state.ball.x;
  state.ball.y = state.human.y - 120; state.ball.prevY = state.ball.y;
  state.ball.vx = 0; state.ball.vy = 0;
  state.touches = { human: config.MAX_TOUCHES, ai: 0 };
  sim.stepGame(state, { ...types.emptyInput(), hit: true }, FIXED_DT);
  assert.equal(state.pointReason, 'fourTouches');
  assert.equal(state.aiPoints, 1, 'over-touching gives the point to the opponent');
}

// --- A full 90-second match always reaches a decided result ---
{
  const state = sim.createGameState({ mode: 'match', difficulty: 'medium', seed: 2026 });
  sim.beginCountdown(state);
  let guard = 0;
  const limit = 60 * 400;
  while (state.phase !== 'matchResult' && guard < limit) { sim.stepGame(state, types.emptyInput(), FIXED_DT); guard += 1; }
  assert.equal(state.phase, 'matchResult', 'match must finish within the time budget');
  assert.ok(state.winner === 'human' || state.winner === 'ai' || state.winner === 'draw');
  assert.ok(state.humanPoints + state.aiPoints > 0, 'points are awarded during a match');
  assert.ok(state.activeTime >= config.TIMING.activeMatch, 'at least 90 active seconds are played');
  const stats = sim.currentStats(state);
  assert.equal(
    stats.score,
    100 * state.humanPoints + 20 * state.perfectHits + 30 * state.longestStreak + (state.humanPoints > state.aiPoints ? 150 : 0),
    'final score matches the versioned formula',
  );
}

// --- The same seed and inputs replay identically ---
{
  const run = seed => {
    const state = sim.createGameState({ mode: 'match', difficulty: 'hard', seed });
    sim.beginCountdown(state);
    for (let i = 0; i < 1200; i += 1) sim.stepGame(state, types.emptyInput(), FIXED_DT);
    return [state.humanPoints, state.aiPoints, Math.round(state.ball.x * 100), Math.round(state.ball.y * 100)].join(',');
  };
  assert.equal(run(42), run(42), 'seeded matches are reproducible');
}

// --- Tough practice controls mark tutorial progress ---
{
  const state = sim.createGameState({ mode: 'tutorial', difficulty: 'easy', seed: 3 });
  sim.beginTutorial(state);
  let guard = 0;
  while (!(state.tutorialTasks.moved && state.tutorialTasks.jumped && state.tutorialTasks.hit) && guard < 900) {
    const input = { ...types.emptyInput(), right: guard % 30 < 12, jump: guard % 90 === 0, hit: guard % 45 === 0 };
    sim.stepGame(state, input, FIXED_DT);
    guard += 1;
  }
  assert.equal(state.mode, 'tutorial');
  assert.ok(state.tutorialTasks.moved, 'moving is tracked');
  assert.ok(state.tutorialTasks.jumped, 'jumping is tracked');
  assert.ok(state.tutorialTasks.hit, 'hitting/serving is tracked');
}

assert.equal(config.bucketId('hard'), `beach-volleyball:hard:v${config.RULES_VERSION}`, 'best-score bucket is versioned');

console.log('PASS: beach volleyball simulation awards points, faults over-touches, finishes the match, is seed-reproducible and tracks tutorial progress');

// A swing pressed just before contact stays active briefly, but never repeats while held.
{
 const state = sim.createGameState({mode:'match', difficulty:'easy', seed:41});
 sim.beginCountdown(state);state.phase='rally';state.ball.active=true;
 state.ball.x=state.human.x+115;state.ball.y=state.human.y-130;
 state.ball.vx=-200;state.ball.vy=0;
 sim.stepGame(state,{...types.emptyInput(),hit:true},FIXED_DT);
 assert.equal(state.touches.human,0);
 state.ball.x=state.human.x+65;state.ball.y=state.human.y-130;
 sim.stepGame(state,types.emptyInput(),FIXED_DT);
 assert.equal(state.touches.human,1,'buffered swing connects after key release');
 assert.equal(state.human.hitBuffer,0,'swing consumed exactly once');
}
// Running cycles advance with travelled distance rather than reverse with world position.
{
 const state=sim.createGameState({mode:'tutorial', difficulty:'easy',seed:9});sim.beginTutorial(state);
 for(let i=0;i<20;i++) sim.stepGame(state,{...types.emptyInput(),right:true},FIXED_DT);
 const stride=state.human.stride;
 for(let i=0;i<30;i++) sim.stepGame(state,{...types.emptyInput(),left:true},FIXED_DT);
 assert.ok(state.human.stride>stride);
 sim.beginCountdown(state);
 assert.equal(state.human.hitBuffer,0);assert.equal(state.human.jumpBuffer,0);assert.equal(state.human.prevJump,false);
}
console.log('PASS: forgiving single-use swings, continuous stride and round input reset');
{
 function peak(holdFrames) {
  const state=sim.createGameState({mode:'tutorial',difficulty:'easy',seed:10});sim.beginTutorial(state);
  let y=state.human.y;
  for(let i=0;i<35;i++){sim.stepGame(state,{...types.emptyInput(),jump:i<holdFrames},FIXED_DT);y=Math.min(y,state.human.y);}
  return y;
 }
 assert.ok(peak(30)<peak(2)-30,'holding jump gives a meaningfully higher jump than tapping');
}
console.log('PASS: tap and held jumps produce distinct controllable heights');

{
 const state=sim.createGameState({mode:'match',difficulty:'easy',seed:21});sim.beginCountdown(state);state.phase='rally';state.ball.active=true;
 state.human.armed=false;state.human.contactCooldown=0.15;
 state.ball.x=state.human.x+50;state.ball.y=state.human.y-130;
 sim.stepGame(state,{...types.emptyInput(),hit:true},FIXED_DT);
 assert.equal(state.touches.human,0,'a buffered swing cannot count a second contact before separation');
}
