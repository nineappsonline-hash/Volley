import { DIFFICULTIES, HIT, PHYSICS, PLAYER, WORLD, sideBounds } from "./config";
import { rand, randRange } from "./rng";
import { emptyInput, type BallState, type GameState, type InputState } from "./types";

/**
 * Limited forward simulation of the ball to guess where it will land. The AI
 * never reads player input, it only reasons about the simulated ball, and it is
 * subject to the same reaction delay and error margins as the chosen difficulty.
 */
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

function reachDistance(
  ball: BallState,
  x: number,
  y: number,
  facing: number,
): number {
  const baseX = x + facing * PLAYER.reachOffset;
  const ax = baseX;
  const ay = y - PLAYER.reachLow;
  const by = y - PLAYER.reachHigh;
  const dx = 0;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((ball.y - ay) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax;
  const cy = ay + t * dy;
  return Math.hypot(ball.x - cx, ball.y - cy);
}

export function computeAiInput(state: GameState, dt: number): InputState {
  const input = emptyInput();
  if (state.phase !== "rally") return input;

  const cfg = DIFFICULTIES[state.difficulty];
  const ai = state.ai;
  const ball = state.ball;
  const bounds = sideBounds("ai");

  ai.aiTimer -= dt;
  if (ai.aiTimer <= 0) {
    ai.aiTimer = cfg.reaction;
    const landing = predictLandingX(ball);
    // Intercept before ground contact rather than chase an unreachable landing point.
    const height = ai.y - PLAYER.height - 25;
    const disc = ball.vy * ball.vy + 2 * PHYSICS.ballGravity * (height - ball.y);
    const arrival = disc >= 0 ? (-ball.vy + Math.sqrt(disc)) / PHYSICS.ballGravity : 0;
    const intercept = arrival > 0 && arrival < 2.5 ? ball.x + ball.vx * arrival : landing;
    ai.aiPredictedX = intercept + PLAYER.reachOffset + randRange(state, -cfg.error, cfg.error);

    const headingToAi = ball.vx > 0 || ball.x > WORLD.netX;
    if (headingToAi) {
      ai.aiTargetX = ai.aiPredictedX;
    } else {
      ai.aiTargetX = (WORLD.netX + WORLD.maxX) / 2;
    }

    const near = reachDistance(ball, ai.x, ai.y, ai.facing) <= HIT.radius * 1.5;
    if (ball.x > WORLD.netX && near) {
      ai.aiWantHit = rand(state) > cfg.missChance;
    } else if (ball.x < WORLD.netX - 40) {
      ai.aiWantHit = false;
    }
  }

  const target = Math.max(bounds.min, Math.min(bounds.max, ai.aiTargetX));
  const diff = target - ai.x;
  // Brake before the target; a dead zone prevents rapid left/right oscillation.
  const stoppingDistance = ai.vx * Math.abs(ai.vx) / (2 * PHYSICS.playerDecel);
  const remaining = diff - stoppingDistance;
  if (remaining > 22) input.right = true;
  else if (remaining < -22) input.left = true;

  const onAiSide = ball.x > WORLD.netX - 30;
  const dist = reachDistance(ball, ai.x, ai.y, ai.facing);
  const closeToBall = dist <= HIT.radius;

  // Jump to attack (or block near the net) when the ball is high on our side.
  if (
    onAiSide &&
    ai.onGround &&
    ball.y < 470 &&
    Math.abs(ball.x - ai.x) < 88 &&
    ball.vx > -40
  ) {
    input.jump = true;
  }

  if (closeToBall && ai.aiWantHit && ai.hitCooldown <= 0) {
    input.hit = true;
    if (!ai.onGround && ball.y < WORLD.netTop + 30 && rand(state) < cfg.tipChance) {
      input.tip = true;
    }
    ai.aiWantHit = false;
  }

  return input;
}
