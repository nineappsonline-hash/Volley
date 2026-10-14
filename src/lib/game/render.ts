import { armPose } from "./arm-pose";
import { drawCourtEnvironment } from "./environment";
import { PLAYER, WORLD } from "./config";
import type { GameState, PlayerState } from "./types";

const NAVY = "#14213D";
const LIME = "#C7F23D";

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number) {
  const shadow = ctx.createRadialGradient(x, y + 3, 1, x, y + 3, rx);
  shadow.addColorStop(0, "rgba(39,40,35,0.3)");
  shadow.addColorStop(1, "rgba(39,40,35,0)");
  ctx.save();ctx.translate(x, y + 3);ctx.scale(1, 0.28);ctx.translate(-x, -y - 3);
  ctx.fillStyle = shadow;ctx.beginPath();ctx.arc(x,y+3,rx,0,Math.PI*2);ctx.fill();ctx.restore();
}

function drawNetDepth(ctx: CanvasRenderingContext2D) {
  const x = WORLD.netX, top = WORLD.netTop, ground = WORLD.groundY;
  const depthX = 30, depthY = 72;
  ctx.fillStyle = "rgba(50,64,60,0.12)";
  ctx.beginPath();ctx.moveTo(x,ground);ctx.lineTo(x+depthX,ground-depthY);ctx.lineTo(x+95,ground-depthY+14);ctx.lineTo(x+65,ground+14);ctx.closePath();ctx.fill();
  ctx.strokeStyle = "#5B7076";ctx.lineWidth = 5;
  ctx.beginPath();ctx.moveTo(x+depthX,top-depthY-10);ctx.lineTo(x+depthX,ground-depthY);ctx.stroke();
  ctx.fillStyle = "rgba(225,237,230,0.1)";
  ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x+depthX,top-depthY);ctx.lineTo(x+depthX,ground-depthY);ctx.lineTo(x,ground);ctx.closePath();ctx.fill();
  ctx.strokeStyle = "rgba(39,58,65,0.32)";ctx.lineWidth=1;
  for(let y=top;y<=ground;y+=13){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+depthX,y-depthY);ctx.stroke();}
  for(let t=0;t<=1;t+=0.25){ctx.beginPath();ctx.moveTo(x+depthX*t,top-depthY*t);ctx.lineTo(x+depthX*t,ground-depthY*t);ctx.stroke();}
  ctx.strokeStyle = "#E8F0E4";ctx.lineWidth=6;
  ctx.beginPath();ctx.moveTo(x,top-2);ctx.lineTo(x+depthX,top-depthY-2);ctx.stroke();
}

function drawNet(ctx: CanvasRenderingContext2D) {
  // The near post marks the exact collision plane; the mesh recedes behind it.
  const x = WORLD.netX, top = WORLD.netTop;
  const metal = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
  metal.addColorStop(0, "#0E182D");metal.addColorStop(0.35, "#617487");metal.addColorStop(0.6, "#293E57");metal.addColorStop(1, "#0E182D");
  ctx.fillStyle = metal;ctx.beginPath();ctx.roundRect(x-8,top-12,16,WORLD.groundY-top+14,5);ctx.fill();
  ctx.fillStyle = "#E8F0E4";ctx.fillRect(x-8,top-3,16,6);
  ctx.fillStyle = "rgba(255,255,255,0.23)";ctx.fillRect(x-4,top+7,2,WORLD.groundY-top-12);
  ctx.fillStyle = "#304155";ctx.beginPath();ctx.ellipse(x,WORLD.groundY+2,12,4,0,0,Math.PI*2);ctx.fill();
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

  drawShadow(ctx, x, WORLD.groundY, Math.max(16, 34 - (WORLD.groundY - y) * 0.045));

  const runPhase = p.stride;

  // Legs
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  const legSwing = anim === "run" ? Math.sin(runPhase) * 15 : 0;
  const jumpTuck = !p.onGround ? 6 + Math.min(7, Math.abs(p.vy) * 0.01) : anim === "land" ? 6 * Math.max(0, p.animTime / 0.15) : 0;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 46 + jumpTuck);
  ctx.lineTo(x - 12 + legSwing * 0.55, y - 24 + jumpTuck);
  ctx.lineTo(x - 14 + legSwing, y - (!p.onGround ? 14 : Math.max(0, Math.sin(runPhase)) * 7));
  ctx.moveTo(x + 10, y - 46 + jumpTuck);
  ctx.lineTo(x + 12 - legSwing * 0.55, y - 24 + jumpTuck);
  ctx.lineTo(x + 14 - legSwing, y - (!p.onGround ? 10 : Math.max(0, -Math.sin(runPhase)) * 7));
  ctx.stroke();

  // Shorts
  const shorts = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
  shorts.addColorStop(0, "#354767");shorts.addColorStop(1, "#0E182D");
  ctx.fillStyle = shorts;
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 60 + jumpTuck, 36, 24, 6);
  ctx.fill();

  // Torso
  const jersey = ctx.createLinearGradient(x - 18, 0, x + 20, 0);
  jersey.addColorStop(0, "#FFFFFF");jersey.addColorStop(0.18, palette.shirt);jersey.addColorStop(0.7, palette.shirt);jersey.addColorStop(1, "#435168");
  ctx.fillStyle = jersey;
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - 18, y - h + 26 + jumpTuck, 36, 48, 10);
  ctx.fill();
  ctx.stroke();

  // Jersey trim and number stay readable as the character moves.
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(x - 15, y - h + 32 + jumpTuck, 30, 4);
  ctx.fillStyle = NAVY;
  ctx.font = "800 17px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(isHuman ? "1" : "2", x, y - 45 + jumpTuck);

  // Head
  const skin = ctx.createRadialGradient(x - 6, y - h + 8 + jumpTuck, 1, x, y - h + 14 + jumpTuck, 19);
  skin.addColorStop(0, "#FFE7CC");skin.addColorStop(0.5, palette.skin);skin.addColorStop(1, "#936B55");
  ctx.fillStyle = skin;
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

  ctx.strokeStyle = "rgba(255,255,255,0.2)";ctx.lineWidth = 2;
  ctx.beginPath();ctx.arc(x - 2, y - h + 10 + jumpTuck, 11, Math.PI * 1.15, Math.PI * 1.7);ctx.stroke();

  // Face looks toward the net.
  ctx.fillStyle = NAVY;
  ctx.beginPath();
  ctx.arc(x + facing * 6, y - h + 14 + jumpTuck, 2, 0, Math.PI * 2);
  ctx.fill();

  // Separate shoulder joints and fixed-length bones avoid stretching elbows.
  const armY = y - h + 36 + jumpTuck;
  const pose = (front: boolean) => {
    const shoulder = x + facing * (front ? 12 : -12);
    let tx = shoulder + facing * (front ? 6 : -5);
    let ty = armY + 34;
    if (anim === "hit") {
      const progress = Math.max(0, Math.min(1, 1 - p.animTime / 0.25));
      // Cock behind the head, extend toward contact, then follow through.
      const t = progress < 0.4 ? progress / 0.4 : (progress - 0.4) / 0.6;
      if (front) {
        tx = shoulder + facing * (progress < 0.4 ? lerp(-14, 22, t) : lerp(22, 24, t));
        ty = armY + (progress < 0.4 ? lerp(-30, -40, t) : lerp(-40, 12, t));
      } else { tx = shoulder - facing * 22; ty = armY + 12; }
    } else if (anim === "celebrate") { tx = shoulder + facing * (front ? 13 : -13); ty = armY - 40; }
    else if (!p.onGround) { tx = shoulder + facing * (front ? 15 : -15); ty = armY - (p.vy < 0 ? 22 : 10); }
    else if (anim === "run") { tx = shoulder + Math.sin(runPhase + (front ? Math.PI : 0)) * 18; ty = armY + 29; }
    else if (anim === "losePoint") { tx = shoulder + facing * (front ? 9 : -9); ty = armY + 39; }
    const joint = armPose(shoulder, armY, tx, ty, front ? facing : -facing);
    const limb = ctx.createLinearGradient(shoulder - 8, 0, shoulder + 10, 0);
    limb.addColorStop(0,"#FFE7CC");limb.addColorStop(0.5,palette.skin);limb.addColorStop(1,"#936B55");
    ctx.lineCap = "round";ctx.lineJoin = "round";ctx.strokeStyle = limb;ctx.lineWidth = 8;
    ctx.beginPath();ctx.moveTo(shoulder,armY);ctx.lineTo(joint.ex,joint.ey);ctx.lineTo(joint.wx,joint.wy);ctx.stroke();
    ctx.fillStyle = palette.skin;ctx.beginPath();ctx.arc(joint.wx,joint.wy,4.5,0,Math.PI*2);ctx.fill();
  };
  pose(false);pose(true);

  // Label
  ctx.font = "700 15px Manrope, Alexandria, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(20,33,61,0.65)";
  ctx.fillText(label, x, WORLD.groundY + 32);
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

  ctx.save();ctx.beginPath();ctx.arc(0,0,r-1,0,Math.PI*2);ctx.clip();
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
  ctx.restore();ctx.rotate(-spin);
  const light = ctx.createRadialGradient(-6,-7,1,1,3,r+3);
  light.addColorStop(0,"rgba(255,255,255,0.8)");light.addColorStop(0.45,"rgba(255,255,255,0)");light.addColorStop(1,"rgba(14,24,45,0.48)");
  ctx.fillStyle=light;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
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

  drawCourtEnvironment(ctx, options.reducedMotion ? 0 : Math.max(-4, Math.min(4, (state.ball.x - WORLD.width / 2) * 0.006)));

  drawNetDepth(ctx);

  const hx = lerp(state.human.prevX, state.human.x, alpha);
  const hy = lerp(state.human.prevY, state.human.y, alpha);
  const ax = lerp(state.ai.prevX, state.ai.x, alpha);
  const ay = lerp(state.ai.prevY, state.ai.y, alpha);

  drawPlayer(ctx, state.human, hx, hy, options, options.humanLook, options.humanName, true);
  drawPlayer(ctx, state.ai, ax, ay, options, options.aiLook, options.aiName, false);

  const bx = lerp(state.ball.prevX, state.ball.x, alpha);
  const by = lerp(state.ball.prevY, state.ball.y, alpha);
  drawShadow(ctx, bx, WORLD.groundY, Math.max(9, 22 - (WORLD.groundY - by) * 0.025));
  drawBall(ctx, bx, by, state.ball.spin);

  drawNet(ctx);
  drawParticles(ctx, state, options);

  ctx.restore();
}
