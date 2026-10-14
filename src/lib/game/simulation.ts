import {
  HIT,
  MAX_TOUCHES,
  PHYSICS,
  PLAYER,
  RULES_VERSION,
  TIMING,
  WORLD,
  sideBaseDir,
  sideBounds,
} from "./config";
import { computeAiInput } from "./ai";
import { calculateScore } from "./score";
import { hashSeed } from "./rng";
import {
  emptyInput,
  type BallState,
  type Difficulty,
  type GameEvent,
  type GameMode,
  type GameState,
  type HitKind,
  type InputState,
  type Particle,
  type PlayerState,
  type PointReason,
  type Side,
} from "./types";

export function other(side: Side): Side {
  return side === "human" ? "ai" : "human";
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function createPlayer(side: Side): PlayerState {
  return {
    side,
    x: side === "human" ? WORLD.humanStartX : WORLD.aiStartX,
    y: WORLD.groundY,
    vx: 0,
    vy: 0,
    prevX: side === "human" ? WORLD.humanStartX : WORLD.aiStartX,
    prevY: WORLD.groundY,
    onGround: true,
    facing: sideBaseDir(side),
    coyote: 0,
    jumpBuffer: 0,
    prevJump: false,
    prevHit: false,
    prevTip: false,
    hitCooldown: 0,
    hitBuffer: 0,
    bufferedTip: false,
    stride: 0,
    contactCooldown: 0,
    armed: true,
    anim: "idle",
    animTime: 0,
    perfectHits: 0,
    aiTimer: 0,
    aiTargetX: side === "human" ? WORLD.humanStartX : WORLD.aiStartX,
    aiPredictedX: side === "human" ? WORLD.humanStartX : WORLD.aiStartX,
    aiWantJump: false,
    aiWantHit: false,
    aiWantTip: false,
  };
}

function createBall(): BallState {
  return {
    x: WORLD.humanStartX + 24,
    y: WORLD.groundY - 160,
    vx: 0,
    vy: 0,
    prevX: WORLD.humanStartX + 24,
    prevY: WORLD.groundY - 160,
    spin: 0,
    active: false,
  };
}

export function createGameState(opts: {
  mode: GameMode;
  difficulty: Difficulty;
  seed: number | string;
}): GameState {
  const seed =
    typeof opts.seed === "string" ? hashSeed(opts.seed) : opts.seed >>> 0;
  return {
    phase: "ready",
    mode: opts.mode,
    difficulty: opts.difficulty,
    rulesVersion: RULES_VERSION,
    rngState: seed | 0,
    time: 0,
    activeTime: 0,
    countdown: TIMING.countdown,
    pointFreeze: 0,
    pointReason: null,
    pointWinner: null,
    matchEndPending: false,
    human: createPlayer("human"),
    ai: createPlayer("ai"),
    ball: createBall(),
    touches: { human: 0, ai: 0 },
    lastToucher: null,
    ballSide: "human",
    server: "human",
    humanPoints: 0,
    aiPoints: 0,
    humanStreak: 0,
    aiStreak: 0,
    longestStreak: 0,
    perfectHits: 0,
    winner: null,
    servePrompt: false,
    serveTimer: 0,
    particles: [],
    shake: 0,
    celebrate: 0,
    tutorialTasks: { moved: false, jumped: false, hit: false },
    pendingEvents: [],
    error: null,
  };
}

export function getPlayer(state: GameState, side: Side): PlayerState {
  return side === "human" ? state.human : state.ai;
}

function resetPositions(state: GameState) {
  for (const p of [state.human, state.ai]) {
    const startX = p.side === "human" ? WORLD.humanStartX : WORLD.aiStartX;
    p.x = startX;
    p.y = WORLD.groundY;
    p.prevX = startX;
    p.prevY = WORLD.groundY;
    p.vx = 0;
    p.vy = 0;
    p.onGround = true;
    p.anim = "idle";
    p.animTime = 0;
    p.hitCooldown = 0;
    p.hitBuffer = 0;
    p.bufferedTip = false;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.prevJump = false;
    p.prevHit = false;
    p.prevTip = false;
    p.contactCooldown = 0;
    p.armed = true;
  }
}

export function beginCountdown(state: GameState) {
  state.mode = "match";
  state.phase = "countdown";
  state.countdown = TIMING.countdown;
  state.activeTime = 0;
  state.matchEndPending = false;
  resetPositions(state);
  state.pendingEvents.push({ type: "countdown" });
}

export function beginTutorial(state: GameState) {
  state.mode = "tutorial";
  state.tutorialTasks = { moved: false, jumped: false, hit: false };
  state.activeTime = 0;
  state.matchEndPending = false;
  state.server = "human";
  serveSetup(state);
}

export function serveSetup(state: GameState) {
  resetPositions(state);
  state.touches = { human: 0, ai: 0 };
  state.ballSide = state.server;
  state.lastToucher = null;
  state.ball.active = false;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.phase = "serve";
  state.servePrompt = state.server === "human";
  state.serveTimer =
    state.server === "human" ? TIMING.humanServeDelay : TIMING.aiServeDelay;
  positionBallForServe(state);
}

function serveContactPoint(state: GameState) {
  const p = getPlayer(state, state.server);
  const dir = sideBaseDir(p.side);
  return { x: p.x + dir * PLAYER.reachOffset, y: p.y - 175 };
}

function positionBallForServe(state: GameState) {
  const point = serveContactPoint(state);
  state.ball.x = point.x;
  state.ball.y = point.y;
  state.ball.prevX = point.x;
  state.ball.prevY = point.y;
}

function doServe(state: GameState) {
  const p = getPlayer(state, state.server);
  const dir = sideBaseDir(p.side);
  const point = serveContactPoint(state);
  state.ball.x = point.x;
  state.ball.y = point.y;
  state.ball.vx = dir * 360;
  state.ball.vy = -800;
  state.ball.active = true;
  state.ball.spin = dir * 4;
  state.phase = "rally";
  state.servePrompt = false;
  state.touches = { human: 0, ai: 0 };
  state.lastToucher = state.server;
  state.ballSide = state.server;
  p.anim = "hit";
  p.animTime = 0.3;
  if (state.mode === "tutorial" && state.server === "human") {
    state.tutorialTasks.hit = true;
  }
  state.pendingEvents.push({ type: "serve", side: state.server });
}

export function currentStats(state: GameState) {
  return calculateScore({
    playerPoints: state.humanPoints,
    opponentPoints: state.aiPoints,
    perfectHits: state.perfectHits,
    longestWinningStreak: state.longestStreak,
  });
}

function finishMatch(state: GameState) {
  state.phase = "matchResult";
  state.ball.active = false;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.servePrompt = false;
  if (state.humanPoints === state.aiPoints) {
    state.winner = "draw";
  } else {
    state.winner = state.humanPoints > state.aiPoints ? "human" : "ai";
  }
  const winner: Side | null = state.winner === "draw" ? null : state.winner;
  if (winner === "human") {
    state.human.anim = "celebrate";
    state.human.animTime = 2;
    state.ai.anim = "losePoint";
    state.ai.animTime = 2;
  } else if (winner === "ai") {
    state.ai.anim = "celebrate";
    state.ai.animTime = 2;
    state.human.anim = "losePoint";
    state.human.animTime = 2;
  }
  state.celebrate = 1.4;
  state.pendingEvents.push({ type: "whistle" });
  state.pendingEvents.push({ type: "point", side: winner ?? undefined });
}

function awardPoint(state: GameState, side: Side, reason: PointReason) {
  if (state.phase === "matchResult" || state.phase === "pointResult") return;
  if (side === "human") {
    state.humanPoints += 1;
    state.humanStreak += 1;
    state.aiStreak = 0;
    if (state.humanStreak > state.longestStreak) {
      state.longestStreak = state.humanStreak;
    }
    state.human.anim = "celebrate";
    state.human.animTime = 1.2;
    state.ai.anim = "losePoint";
    state.ai.animTime = 1.2;
  } else {
    state.aiPoints += 1;
    state.aiStreak += 1;
    state.humanStreak = 0;
    state.ai.anim = "celebrate";
    state.ai.animTime = 1.2;
    state.human.anim = "losePoint";
    state.human.animTime = 1.2;
  }
  state.server = side;
  state.pointReason = reason;
  state.pointWinner = side;
  state.phase = "pointResult";
  state.pointFreeze = TIMING.pointFreeze;
  state.ball.active = false;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.celebrate = 1.2;
  state.shake = reason === "ground" ? 0.35 : 0.2;
  spawnDust(state, state.ball.x, Math.min(state.ball.y + WORLD.ballRadius, WORLD.groundY), 7);
  state.pendingEvents.push({ type: "point", side });
}

function afterPoint(state: GameState) {
  if (state.mode === "tutorial") {
    serveSetup(state);
    return;
  }
  if (state.matchEndPending) {
    finishMatch(state);
    return;
  }
  serveSetup(state);
}

function spawnDust(state: GameState, x: number, y: number, count: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI + (i / Math.max(1, count - 1)) * Math.PI;
    const speed = 40 + (i % 3) * 30;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: -Math.abs(Math.sin(angle)) * speed,
      life: 0.5,
      maxLife: 0.5,
      size: 2 + (i % 3),
      kind: "dust",
    });
  }
  if (state.particles.length > 120) {
    state.particles.splice(0, state.particles.length - 120);
  }
}

function updateParticles(state: GameState, dt: number) {
  const list = state.particles;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.vy += 400 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function reachDistance(state: GameState, p: PlayerState): number {
  const baseX = p.x + p.facing * PLAYER.reachOffset;
  return distToSegment(
    state.ball.x,
    state.ball.y,
    baseX,
    p.y - PLAYER.reachLow,
    baseX,
    p.y - PLAYER.reachHigh,
  );
}

function bodyDistance(state: GameState, p: PlayerState): number {
  const left = p.x - PLAYER.halfWidth;
  const right = p.x + PLAYER.halfWidth;
  const top = p.y - PLAYER.height;
  const bottom = p.y;
  const cx = clamp(state.ball.x, left, right);
  const cy = clamp(state.ball.y, top, bottom);
  return Math.hypot(state.ball.x - cx, state.ball.y - cy);
}

function updateArmed(state: GameState, p: PlayerState) {
  if (bodyDistance(state, p) > WORLD.ballRadius + 30) {
    p.armed = true;
  }
}

function registerTouch(state: GameState, side: Side): boolean {
  if (state.touches[side] >= MAX_TOUCHES) {
    awardPoint(state, other(side), "fourTouches");
    return false;
  }
  state.touches[side] += 1;
  state.lastToucher = side;
  state.ballSide = side;
  if (state.mode === "tutorial" && side === "human") {
    state.tutorialTasks.hit = true;
  }
  return true;
}

function applyPlayerHit(
  state: GameState,
  p: PlayerState,
  input: InputState,
): void {
  if (!state.ball.active) return;
  if (p.hitBuffer <= 0 || !p.armed || p.contactCooldown > 0) return;
  if (p.hitCooldown > 0) return;
  const onOwnSide =
    p.side === "human"
      ? state.ball.x <= WORLD.netX + 40
      : state.ball.x >= WORLD.netX - 40;
  if (!onOwnSide) return;
  const dist = reachDistance(state, p);
  if (dist > HIT.radius) return;

  const dir = sideBaseDir(p.side);
  const moveInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const toward = clamp(moveInput * dir, -1, 1);

  let kind: HitKind;
  if (p.bufferedTip) {
    kind = "tip";
  } else if (!p.onGround && state.ball.y < WORLD.netTop + 40) {
    kind = "spike";
  } else {
    kind = "set";
  }

  let vx: number;
  let vy: number;
  if (kind === "tip") {
    vx = dir * (160 + (toward + 1) * 120);
    vy = -120 - toward * 40;
  } else if (kind === "spike") {
    vx = dir * (560 + (toward + 1) * 60);
    vy = 160 + (1 - toward) * 50;
  } else {
    vx = dir * (190 + (toward + 1) * 75);
    vy = -700 + toward * 60;
  }

  const speed = Math.hypot(vx, vy);
  if (speed > PHYSICS.ballMaxSpeed) {
    vx *= PHYSICS.ballMaxSpeed / speed;
    vy *= PHYSICS.ballMaxSpeed / speed;
  }

  const perfect = dist <= HIT.perfectRadius;

  const ok = registerTouch(state, p.side);
  if (!ok) return;

  state.ball.vx = vx;
  state.ball.vy = vy;
  state.ball.spin += dir * 8;
  p.hitBuffer = 0;
  p.hitCooldown = PHYSICS.hitCooldown;
  p.contactCooldown = PHYSICS.contactCooldown;
  p.armed = false;
  p.anim = "hit";
  p.animTime = 0.25;

  if (perfect) {
    p.perfectHits += 1;
    state.perfectHits += 1;
    state.pendingEvents.push({ type: "perfect", side: p.side, kind });
    spawnDust(state, state.ball.x, state.ball.y, 4);
  } else {
    state.pendingEvents.push({ type: "hit", side: p.side, kind });
  }
}

function collidePlayer(state: GameState, p: PlayerState) {
  const ball = state.ball;
  const radius = PLAYER.halfWidth;
  const cx = p.x;
  const cy = clamp(ball.y, p.y - PLAYER.height + radius, p.y - radius);
  let dx = ball.x - cx;
  let dy = ball.y - cy;
  let dist = Math.hypot(dx, dy);
  if (dist >= WORLD.ballRadius + radius) return;
  if (dist < 0.001) {
    dx = 0;
    dy = -1;
    dist = 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  ball.x = cx + nx * (WORLD.ballRadius + radius + 0.1);
  ball.y = cy + ny * (WORLD.ballRadius + radius + 0.1);

  if (p.armed && p.contactCooldown <= 0 && state.phase === "rally") {
    p.contactCooldown = PHYSICS.contactCooldown;
    p.armed = false;
    if (!registerTouch(state, p.side)) return;
    state.pendingEvents.push({ type: "hit", side: p.side, kind: "block" });
  }

  const dot = (ball.vx - p.vx) * nx + (ball.vy - p.vy) * ny;
  if (dot < 0) {
    const e = PHYSICS.ballRestitution;
    ball.vx = ball.vx - (1 + e) * dot * nx + p.vx * 0.35;
    ball.vy = ball.vy - (1 + e) * dot * ny - 30;
  }
}

function collideNet(state: GameState) {
  const ball = state.ball;
  const left = WORLD.netX - WORLD.netHalf;
  const right = WORLD.netX + WORLD.netHalf;
  const top = WORLD.netTop;
  const bottom = WORLD.groundY;
  const cx = clamp(ball.x, left, right);
  const cy = clamp(ball.y, top, bottom);
  let dx = ball.x - cx;
  let dy = ball.y - cy;
  let dist = Math.hypot(dx, dy);
  if (dist >= WORLD.ballRadius) return;
  if (dist === 0) {
    dx = ball.x < WORLD.netX ? -1 : 1;
    dy = 0;
    dist = 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  ball.x = cx + nx * WORLD.ballRadius;
  ball.y = cy + ny * WORLD.ballRadius;
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot < 0) {
    const e = PHYSICS.netRestitution;
    ball.vx -= (1 + e) * dot * nx;
    ball.vy -= (1 + e) * dot * ny;
    if (Math.abs(ny) > 0.7) {
      ball.vx *= 0.9;
    }
  }
}

function resolveGround(state: GameState) {
  const ball = state.ball;
  const inside = ball.x >= WORLD.minX && ball.x <= WORLD.maxX;
  if (!inside) {
    resolveOut(state);
    return;
  }
  if (state.mode === "tutorial") {
    state.pendingEvents.push({ type: "bounce" });
    spawnDust(state, ball.x, WORLD.groundY, 5);
    serveSetup(state);
    return;
  }
  const landingSide: Side = ball.x < WORLD.netX ? "human" : "ai";
  awardPoint(state, other(landingSide), "ground");
}

function resolveOut(state: GameState) {
  if (state.mode === "tutorial") {
    serveSetup(state);
    return;
  }
  const fallback: Side = state.ball.x < WORLD.netX ? "human" : "ai";
  const loser = state.lastToucher ?? fallback;
  awardPoint(state, other(loser), "out");
}

function updateSideCrossing(state: GameState) {
  if (state.phase !== "rally") return;
  const side: Side = state.ball.x < WORLD.netX ? "human" : "ai";
  if (side !== state.ballSide) {
    state.ballSide = side;
    state.touches[side] = 0;
  }
}

function moveBall(state: GameState, dt: number) {
  const ball = state.ball;
  if (!ball.active) return;
  ball.prevX = ball.x;
  ball.prevY = ball.y;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > PHYSICS.ballMaxSpeed) {
    ball.vx *= PHYSICS.ballMaxSpeed / speed;
    ball.vy *= PHYSICS.ballMaxSpeed / speed;
  }

  const distance = Math.hypot(ball.vx, ball.vy) * dt;
  const steps = Math.max(1, Math.ceil(distance / 6));
  const sdt = dt / steps;

  for (let i = 0; i < steps; i += 1) {
    ball.vy += PHYSICS.ballGravity * sdt;
    ball.x += ball.vx * sdt;
    ball.y += ball.vy * sdt;
    ball.spin += ball.vx * sdt * 0.02;

    collideNet(state);
    collidePlayer(state, state.human);
    collidePlayer(state, state.ai);

    if (ball.y + WORLD.ballRadius >= WORLD.groundY && ball.vy >= 0) {
      ball.y = WORLD.groundY - WORLD.ballRadius;
      resolveGround(state);
      return;
    }
    if (ball.x < -60 || ball.x > WORLD.width + 60) {
      resolveOut(state);
      return;
    }
    if (state.phase !== "rally") return;
  }
  updateSideCrossing(state);
}

function updatePlayerMovement(
  state: GameState,
  p: PlayerState,
  input: InputState,
  dt: number,
  allowControl: boolean,
) {
  p.hitCooldown = Math.max(0, p.hitCooldown - dt);
  p.hitBuffer = Math.max(0, p.hitBuffer - dt);
  if (allowControl && input.hit && !p.prevHit && p.hitCooldown <= 0) {
    p.hitBuffer = PHYSICS.hitBufferTime;
    p.bufferedTip = input.tip;
    p.anim = "hit";
    p.animTime = 0.22;
  }
  p.contactCooldown = Math.max(0, p.contactCooldown - dt);
  if (p.animTime > 0) p.animTime -= dt;
  updateArmed(state, p);

  const bounds = sideBounds(p.side);
  const control = p.onGround ? 1 : PHYSICS.airControl;

  let dir = 0;
  if (allowControl) {
    if (input.left && !input.right) dir = -1;
    else if (input.right && !input.left) dir = 1;
  }

  if (dir !== 0) {
    p.vx += dir * PHYSICS.playerAccel * (allowControl ? control : 0) * dt;
    if (Math.abs(p.vx) > PHYSICS.playerMaxSpeed) {
      p.vx = Math.sign(p.vx) * PHYSICS.playerMaxSpeed;
    }
  } else {
    const dec = PHYSICS.playerDecel * (p.onGround ? 1 : 0.35) * dt;
    if (Math.abs(p.vx) <= dec) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * dec;
  }

  if (allowControl) {
    if (input.jump && !p.prevJump) p.jumpBuffer = PHYSICS.jumpBufferTime;
    else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  } else {
    p.jumpBuffer = 0;
  }
  p.coyote = p.onGround ? PHYSICS.coyoteTime : Math.max(0, p.coyote - dt);
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = PHYSICS.jumpVelocity;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    if (state.mode === "tutorial" && p.side === "human") {
      state.tutorialTasks.jumped = true;
    }
  }
  if (!input.jump && p.prevJump && p.vy < -300) p.vy *= 0.55;
  p.prevJump = input.jump;

  p.vy += PHYSICS.gravity * dt;
  p.prevX = p.x;
  p.prevY = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.x < bounds.min) {
    p.x = bounds.min;
    if (p.vx < 0) p.vx = 0;
  }
  if (p.x > bounds.max) {
    p.x = bounds.max;
    if (p.vx > 0) p.vx = 0;
  }

  if (p.y >= WORLD.groundY) {
    if (!p.onGround) {
      p.anim = "land";
      p.animTime = 0.15;
    }
    p.y = WORLD.groundY;
    p.vy = 0;
    p.onGround = true;
  } else {
    p.onGround = false;
  }

  if (p.animTime <= 0) {
    if (!p.onGround) p.anim = "jump";
    else if (Math.abs(p.vx) > 25) p.anim = "run";
    else p.anim = "idle";
  }
  p.stride += Math.abs(p.vx) * dt * 0.035;
  p.facing = sideBaseDir(p.side);

  if (
    state.mode === "tutorial" &&
    p.side === "human" &&
    Math.abs(p.vx) > 40
  ) {
    state.tutorialTasks.moved = true;
  }
}

function updateServe(state: GameState, humanInput: InputState, dt: number) {
  state.serveTimer -= dt;
  positionBallForServe(state);

  if (state.server === "human") {
    if (humanInput.hit && !state.human.prevHit) {
      doServe(state);
      return;
    }
    if (state.serveTimer <= 0) {
      doServe(state);
      return;
    }
  } else {
    const aiInput = computeAiInput(state, dt);
    if (aiInput.hit && !state.ai.prevHit) {
      doServe(state);
      return;
    }
    if (state.serveTimer <= 0) {
      doServe(state);
    }
  }
}

function updateRally(state: GameState, humanInput: InputState, dt: number) {
  state.activeTime += dt;

  if (
    !state.matchEndPending &&
    state.mode === "match" &&
    state.activeTime >= TIMING.activeMatch
  ) {
    state.matchEndPending = true;
  }
  if (
    state.matchEndPending &&
    state.activeTime >= TIMING.activeMatch + TIMING.extraTime
  ) {
    finishMatch(state);
    return;
  }

  const aiInput = computeAiInput(state, dt);

  updatePlayerMovement(state, state.human, humanInput, dt, true);
  updatePlayerMovement(state, state.ai, aiInput, dt, true);

  applyPlayerHit(state, state.human, humanInput);
  applyPlayerHit(state, state.ai, aiInput);

  state.ai.prevHit = aiInput.hit;
  state.ai.prevTip = aiInput.tip;

  if (state.phase !== "rally") return;
  moveBall(state, dt);
}

export function stepGame(
  state: GameState,
  humanInput: InputState,
  dt: number,
): GameEvent[] {
  const events = tickGame(state, humanInput, dt);
  state.human.prevHit = humanInput.hit;
  state.human.prevTip = humanInput.tip;
  return events;
}

function tickGame(
  state: GameState,
  humanInput: InputState,
  dt: number,
): GameEvent[] {
  state.time += dt;
  state.pendingEvents.length = 0;
  state.shake = Math.max(0, state.shake - dt * 3);
  state.celebrate = Math.max(0, state.celebrate - dt);
  updateParticles(state, dt);

  switch (state.phase) {
    case "ready":
    case "idle":
    case "error":
    case "paused":
      return state.pendingEvents;
    case "countdown": {
      state.countdown -= dt;
      updatePlayerMovement(state, state.human, emptyInput(), dt, false);
      updatePlayerMovement(state, state.ai, emptyInput(), dt, false);
      if (state.countdown <= 0) {
        state.server = "human";
        serveSetup(state);
      }
      return state.pendingEvents;
    }
    case "serve": {
      updateServe(state, humanInput, dt);
      updatePlayerMovement(state, state.human, humanInput, dt, true);
      updatePlayerMovement(state, state.ai, emptyInput(), dt, false);
      if (state.phase === "serve") positionBallForServe(state);
      return state.pendingEvents;
    }
    case "rally": {
      updateRally(state, humanInput, dt);
      return state.pendingEvents;
    }
    case "pointResult": {
      state.pointFreeze -= dt;
      updatePlayerMovement(state, state.human, emptyInput(), dt, false);
      updatePlayerMovement(state, state.ai, emptyInput(), dt, false);
      if (state.pointFreeze <= 0) afterPoint(state);
      return state.pendingEvents;
    }
    case "matchResult": {
      updatePlayerMovement(state, state.human, emptyInput(), dt, false);
      updatePlayerMovement(state, state.ai, emptyInput(), dt, false);
      return state.pendingEvents;
    }
    default:
      return state.pendingEvents;
  }
}

export function predictLandingX(ball: BallState, maxTime = 2.5): number {
  let x = ball.x;
  let y = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  const dt = 1 / 120;
  let t = 0;
  while (t < maxTime) {
    vy += PHYSICS.ballGravity * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;
    if (y + WORLD.ballRadius >= WORLD.groundY && vy > 0) return x;
  }
  return x;
}
