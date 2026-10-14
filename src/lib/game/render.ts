import { PLAYER, WORLD } from "./config";
import type { GameState, PlayerState } from "./types";

const NAVY = "#14213D";
const LIME = "#C7F23D";
const SAND_LIGHT = "#F5EAD3";
const SAND_DARK = "#E4D3AD";
const LINE = "#FBF8EF";

export interface HumanLook {
  shirt: string;
  hair: string;
  skin: string;
}

export const HUMAN_LOOKS: HumanLook[] = [
  { shirt: "#C7F23D", hair: "#3B2A20", skin: "#E2B79C" },
  { shirt: "#728DFA", hair: "#1F2937", skin: "#C58C6D" },
];

export const AI_LOOK: HumanLook = { shirt: "#F4A17E", hair: "#1F2937", skin: "#C58C6D" };

export interface RenderOptions {
  reducedMotion: boolean;
  humanName: string;
  aiName: string;
  humanLook: HumanLook;
  aiLook: HumanLook;
}

let bgCanvas: HTMLCanvasElement | null = null;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawBackground(): HTMLCanvasElement {
  if (bgCanvas) return bgCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const sky = ctx.createLinearGradient(0, 0, 0, 470);
  sky.addColorStop(0, "#BEE0F0");
  sky.addColorStop(0.6, "#E7E7D8");
  sky.addColorStop(1, "#F4E4C6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, 470);

  // Sun haze
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#FFF3D0";
  ctx.beginPath();
  ctx.arc(1050, 130, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Distant skyline
  ctx.fillStyle = "#C9D3D8";
  const buildings = [
    [40, 330, 90, 130],
    [140, 300, 70, 160],
    [220, 350, 110, 110],
    [350, 320, 80, 140],
    [900, 340, 100, 120],
    [1010, 300, 90, 160],
    [1120, 350, 120, 110],
  ];
  for (const [x, y, w, h] of buildings) ctx.fillRect(x, y, w, h);

  // Trees / palms
  const palm = (x: number, baseY: number, scale: number) => {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);
    ctx.strokeStyle = "#8A6B45";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(10, -70, 4, -140);
    ctx.stroke();
    ctx.fillStyle = "#4E8B57";
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(4 + Math.cos(a) * 34, -140 + Math.sin(a) * 16, 40, 12, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  palm(120, 470, 1.05);
  palm(1160, 470, 1.15);
  palm(1010, 470, 0.85);

  // Floodlight poles
  for (const x of [180, 1100]) {
    ctx.strokeStyle = "#9AA3AA";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, 470);
    ctx.lineTo(x, 210);
    ctx.stroke();
    ctx.fillStyle = "#B9C2C8";
    ctx.fillRect(x - 34, 190, 68, 22);
    ctx.fillStyle = "#FFF6D8";
    for (let i = 0; i < 3; i += 1) ctx.fillRect(x - 30 + i * 22, 193, 16, 16);
  }

  // Back wall / fence
  ctx.fillStyle = "#DCE7DF";
  ctx.fillRect(0, 440, WORLD.width, 30);
  ctx.strokeStyle = "#B9C9C0";
  ctx.lineWidth = 2;
  for (let x = 0; x < WORLD.width; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 440);
    ctx.lineTo(x, 470);
    ctx.stroke();
  }

  // Sand
  const sand = ctx.createLinearGradient(0, 470, 0, WORLD.height);
  sand.addColorStop(0, SAND_LIGHT);
  sand.addColorStop(1, SAND_DARK);
  ctx.fillStyle = sand;
  ctx.fillRect(0, 470, WORLD.width, WORLD.height - 470);

  // Gentle court floor shading
  ctx.fillStyle = "#EADFC2";
  ctx.beginPath();
  ctx.moveTo(60, 470);
  ctx.lineTo(1220, 470);
  ctx.lineTo(1260, WORLD.height);
  ctx.lineTo(20, WORLD.height);
  ctx.closePath();
  ctx.fill();

  bgCanvas = canvas;
  return canvas;
}

function drawCourtLines(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 5;
  ctx.setLineDash([]);

  // Side lines / baselines (vertical markers in a side-view court).
  const topY = WORLD.groundY - 2;
  ctx.beginPath();
  ctx.moveTo(WORLD.minX, topY - 8);
  ctx.lineTo(WORLD.minX, topY + 60);
  ctx.moveTo(WORLD.maxX, topY - 8);
  ctx.lineTo(WORLD.maxX, topY + 60);
  ctx.stroke();

  // Ground line
  ctx.strokeStyle = "#D8C79E";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, WORLD.groundY + 2);
  ctx.lineTo(WORLD.width - 20, WORLD.groundY + 2);
  ctx.stroke();
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number) {
  ctx.fillStyle = "rgba(20,33,61,0.16)";
  ctx.beginPath();
  ctx.ellipse(x, y + 2, rx, rx * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawNet(ctx: CanvasRenderingContext2D) {
  const left = WORLD.netX - WORLD.netHalf;
  const right = WORLD.netX + WORLD.netHalf;
  const top = WORLD.netTop;
  const bottom = WORLD.groundY;

  // Posts
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(left - 4, top - 16);
  ctx.lineTo(left - 4, bottom);
  ctx.moveTo(right + 4, top - 16);
  ctx.lineTo(right + 4, bottom);
  ctx.stroke();

  // Net mesh
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.strokeStyle = "rgba(20,33,61,0.45)";
  ctx.lineWidth = 1;
  for (let y = top; y <= bottom; y += 14) {
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  for (let x = left; x <= right; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  // Top band
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(left - 2, top - 6, right - left + 4, 8);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 2;
  ctx.strokeRect(left - 2, top - 6, right - left + 4, 8);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  x: number,
  y: number,
  options: RenderOptions,
  palette: HumanLook,
  label: string,
  isHuman: boolean,
) {
  const facing = p.facing;
  const h = PLAYER.height;
  const cy = y - h; // top of head area
  const anim = p.anim;

  drawShadow(ctx, x, y, 34);

  const runPhase = p.animTime;

  // Legs
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  const legSwing = anim === "run" ? Math.sin(p.x * 0.08 + runPhase) * 10 : 0;
  const jumpTuck = anim === "jump" ? 14 : 0;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 46 + jumpTuck);
  ctx.lineTo(x - 12 + legSwing, y);
  ctx.moveTo(x + 10, y - 46 + jumpTuck);
  ctx.lineTo(x + 12 - legSwing, y);
  ctx.stroke();

  // Shorts
  ctx.fillStyle = NAVY;
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 60 + jumpTuck, 36, 24, 6);
  ctx.fill();

  // Torso
  ctx.fillStyle = palette.shirt;
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - 18, y - h + 26 + jumpTuck, 36, 48, 10);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(x, y - h + 14 + jumpTuck, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair
  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.arc(x, y - h + 10 + jumpTuck, 15, Math.PI, Math.PI * 2);
  ctx.fill();
  if (isHuman) {
    ctx.beginPath();
    ctx.ellipse(x - facing * 12, y - h + 16 + jumpTuck, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Arms
  const armUp = anim === "hit" ? -1 : 0;
  ctx.strokeStyle = palette.skin;
  ctx.lineWidth = 8;
  const armY = y - h + 34 + jumpTuck;
  if (anim === "hit") {
    // Reaching arm toward the net, other arm balancing.
    ctx.beginPath();
    ctx.moveTo(x, armY);
    ctx.lineTo(x + facing * 30, armY - 34);
    ctx.moveTo(x, armY);
    ctx.lineTo(x - facing * 20, armY + 16);
    ctx.stroke();
  } else if (anim === "celebrate") {
    ctx.beginPath();
    ctx.moveTo(x, armY);
    ctx.lineTo(x - 22, armY - 30);
    ctx.moveTo(x, armY);
    ctx.lineTo(x + 22, armY - 30);
    ctx.stroke();
  } else if (anim === "losePoint") {
    ctx.beginPath();
    ctx.moveTo(x, armY);
    ctx.lineTo(x - 16, armY + 22);
    ctx.moveTo(x, armY);
    ctx.lineTo(x + 16, armY + 22);
    ctx.stroke();
  } else if (anim === "jump") {
    ctx.beginPath();
    ctx.moveTo(x, armY);
    ctx.lineTo(x - 16, armY - 26);
    ctx.moveTo(x, armY);
    ctx.lineTo(x + 16, armY - 26);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, armY);
    ctx.lineTo(x - 16, armY + 18 + armUp);
    ctx.moveTo(x, armY);
    ctx.lineTo(x + 16, armY + 18 + armUp);
    ctx.stroke();
  }

  // Label
  ctx.font = "700 15px Manrope, Alexandria, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(20,33,61,0.65)";
  ctx.fillText(label, x, y + 26);
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number) {
  const r = WORLD.ballRadius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = "#F6F8FA";
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-r, -4);
  ctx.quadraticCurveTo(0, 6, r, -4);
  ctx.moveTo(-6, -r + 2);
  ctx.quadraticCurveTo(-2, 0, -6, r - 2);
  ctx.moveTo(6, -r + 2);
  ctx.quadraticCurveTo(2, 0, 6, r - 2);
  ctx.stroke();

  ctx.fillStyle = LIME;
  ctx.beginPath();
  ctx.moveTo(-r, -4);
  ctx.quadraticCurveTo(0, 6, r, -4);
  ctx.lineTo(r, -r);
  ctx.lineTo(-r, -r);
  ctx.closePath();
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  options: RenderOptions,
) {
  if (options.reducedMotion) return;
  for (const p of state.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = p.kind === "dust" ? "#DCC9A0" : LIME;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  options: RenderOptions,
) {
  const shake = options.reducedMotion ? 0 : state.shake;
  ctx.save();
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake * 10, (Math.random() - 0.5) * shake * 10);
  }

  ctx.drawImage(drawBackground(), 0, 0);
  drawCourtLines(ctx);

  const hx = lerp(state.human.prevX, state.human.x, alpha);
  const hy = lerp(state.human.prevY, state.human.y, alpha);
  const ax = lerp(state.ai.prevX, state.ai.x, alpha);
  const ay = lerp(state.ai.prevY, state.ai.y, alpha);

  drawPlayer(ctx, state.human, hx, hy, options, options.humanLook, options.humanName, true);
  drawPlayer(ctx, state.ai, ax, ay, options, options.aiLook, options.aiName, false);

  const bx = lerp(state.ball.prevX, state.ball.x, alpha);
  const by = lerp(state.ball.prevY, state.ball.y, alpha);
  drawBall(ctx, bx, by, state.ball.spin);

  drawNet(ctx);
  drawParticles(ctx, state, options);

  ctx.restore();
}
