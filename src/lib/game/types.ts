/**
 * Shared types for the Playza Beach Challenge arcade game.
 * The simulation is deliberately DOM-free so it can be unit tested and, later,
 * replayed on the server. See `simulation.ts` for the rules.
 */

export type Side = "human" | "ai";
export type Difficulty = "easy" | "medium" | "hard";
export type GameMode = "tutorial" | "match";

export type GamePhase =
  | "idle"
  | "ready"
  | "countdown"
  | "serve"
  | "rally"
  | "pointResult"
  | "matchResult"
  | "paused"
  | "error";

export type PlayerAnim =
  | "idle"
  | "run"
  | "jump"
  | "hit"
  | "land"
  | "celebrate"
  | "losePoint";

export type PointReason =
  | "ground"
  | "out"
  | "fourTouches"
  | "netTouch"
  | "timeout";

export type HitKind = "set" | "spike" | "tip" | "serve" | "block";

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  hit: boolean;
  tip: boolean;
}

export function emptyInput(): InputState {
  return { left: false, right: false, jump: false, hit: false, tip: false };
}

export interface PlayerState {
  side: Side;
  /** Center x in world units. */
  x: number;
  /** Feet y in world units (ground = 610). */
  y: number;
  vx: number;
  vy: number;
  prevX: number;
  prevY: number;
  onGround: boolean;
  facing: 1 | -1;
  coyote: number;
  jumpBuffer: number;
  prevJump: boolean;
  prevHit: boolean;
  prevTip: boolean;
  hitCooldown: number;
  hitBuffer: number;
  bufferedTip: boolean;
  stride: number;
  contactCooldown: number;
  /** Ball has separated from the body since the last contact. */
  armed: boolean;
  anim: PlayerAnim;
  animTime: number;
  /** True once the ball has been hit this approach (blocks double touches). */
  perfectHits: number;
  // AI decision memory (unused for the human player).
  aiTimer: number;
  aiTargetX: number;
  aiPredictedX: number;
  aiWantJump: boolean;
  aiWantHit: boolean;
  aiWantTip: boolean;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevX: number;
  prevY: number;
  spin: number;
  /** False while the ball is held for a serve. */
  active: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: "dust" | "trail" | "spark";
}

export type GameEventType =
  | "serve"
  | "hit"
  | "perfect"
  | "bounce"
  | "point"
  | "whistle"
  | "celebrate"
  | "countdown";

export interface GameEvent {
  type: GameEventType;
  side?: Side;
  kind?: HitKind;
}

export interface GameStats {
  playerPoints: number;
  opponentPoints: number;
  perfectHits: number;
  longestWinningStreak: number;
  score: number;
  won: boolean;
  draw: boolean;
}

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  difficulty: Difficulty;
  rulesVersion: number;
  rngState: number;
  /** Monotonic simulation time in seconds (animations, cooldowns). */
  time: number;
  /** Time counted as active match play (rallies only). */
  activeTime: number;
  countdown: number;
  pointFreeze: number;
  pointReason: PointReason | null;
  pointWinner: Side | null;
  matchEndPending: boolean;
  human: PlayerState;
  ai: PlayerState;
  ball: BallState;
  touches: Record<Side, number>;
  lastToucher: Side | null;
  ballSide: Side;
  server: Side;
  humanPoints: number;
  aiPoints: number;
  humanStreak: number;
  aiStreak: number;
  longestStreak: number;
  perfectHits: number;
  winner: Side | "draw" | null;
  servePrompt: boolean;
  serveTimer: number;
  particles: Particle[];
  shake: number;
  celebrate: number;
  /** Tutorial progress flags. */
  tutorialTasks: { moved: boolean; jumped: boolean; hit: boolean };
  pendingEvents: GameEvent[];
  /** Non-fatal problem surfaced to the UI (unused in phase A). */
  error: string | null;
}
