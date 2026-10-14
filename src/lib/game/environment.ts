import { WORLD } from "./config";

// Original procedural artwork, cached once. No downloaded textures or per-frame
// sand generation. The perspective is decorative; the playable baseline is fixed.
let skyLayer: HTMLCanvasElement | null = null;
let sceneryLayer: HTMLCanvasElement | null = null;
let floorLayer: HTMLCanvasElement | null = null;
function layer(draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD.width; canvas.height = WORLD.height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  return canvas;
}
function polygon(ctx: CanvasRenderingContext2D, points: number[][], fill: string | CanvasGradient) {
  ctx.fillStyle = fill; ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill();
}
function sky(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 520);
  gradient.addColorStop(0, "#78A8CA"); gradient.addColorStop(0.55, "#C9DFE1"); gradient.addColorStop(1, "#F5DBB5");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  const glow = ctx.createRadialGradient(990, 115, 8, 990, 115, 290);
  glow.addColorStop(0, "rgba(255,249,218,0.95)"); glow.addColorStop(0.18, "rgba(255,237,191,0.5)"); glow.addColorStop(1, "rgba(255,237,191,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, WORLD.width, 470);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  for (const [x,y,w] of [[160,110,130],[430,170,170],[780,65,100]]) {
    ctx.beginPath(); ctx.ellipse(x,y,w,9,-0.04,0,Math.PI*2);ctx.fill();
  }
}
function scenery(ctx: CanvasRenderingContext2D) {
  // Low-rise sports complex with shaded walls, windows and roof depth.
  for (const [x,y,w,h] of [[25,334,190,118],[238,356,130,96],[835,343,150,109],[1010,318,240,134]]) {
    polygon(ctx, [[x,y],[x+w,y],[x+w+18,y-12],[x+18,y-12]], "#B3C6C9");
    ctx.fillStyle = "#D6DAD1";ctx.fillRect(x,y,w,h);
    polygon(ctx, [[x+w,y],[x+w+18,y-12],[x+w+18,y+h],[x+w,y+h]], "#9AACAE");
    for(let wx=x+14;wx<x+w-10;wx+=26) {
      ctx.fillStyle = "#839DA7";ctx.fillRect(wx,y+25,14,26);
      ctx.fillStyle = "rgba(255,255,255,0.35)";ctx.fillRect(wx,y+25,14,3);
    }
  }
  ctx.fillStyle = "#526F62";ctx.fillRect(0,420,WORLD.width,32);
  for(let x=0;x<WORLD.width;x+=18){ctx.fillStyle=x%36?"#6F8C6B":"#829873";ctx.beginPath();ctx.arc(x,423,19,Math.PI,Math.PI*2);ctx.fill();}
  // Open fence panels, kept low enough to leave the ball silhouette clear.
  ctx.strokeStyle = "rgba(40,67,74,0.3)";ctx.lineWidth=1;
  for(let x=-80;x<WORLD.width;x+=24){ctx.beginPath();ctx.moveTo(x,388);ctx.lineTo(x+60,456);ctx.moveTo(x,456);ctx.lineTo(x+60,388);ctx.stroke();}
  ctx.strokeStyle = "#748984";ctx.lineWidth=4;
  for(let x=18;x<WORLD.width;x+=155){ctx.beginPath();ctx.moveTo(x,385);ctx.lineTo(x,455);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(0,388);ctx.lineTo(WORLD.width,388);ctx.stroke();
  // Floodlights with lit faces and cast depth.
  for(const x of [160,1130]) {
    const metal=ctx.createLinearGradient(x-5,0,x+7,0);metal.addColorStop(0,"#526571");metal.addColorStop(0.45,"#CBD8D9");metal.addColorStop(1,"#647B85");
    ctx.fillStyle=metal;ctx.fillRect(x-4,205,8,250);
    polygon(ctx,[[x-34,180],[x+34,180],[x+42,188],[x-26,188]],"#72838A");
    ctx.fillStyle="#3B5160";ctx.fillRect(x-34,188,68,23);
    for(let i=0;i<3;i++){ctx.fillStyle="#FFF5CC";ctx.fillRect(x-30+i*22,192,17,14);}
  }
  for(const [x,scale] of [[58,1.1],[1200,1.05],[1070,0.7]]) {
    ctx.save();ctx.translate(x,455);ctx.scale(scale,scale);
    ctx.strokeStyle="#866B49";ctx.lineWidth=9;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(15,-95,5,-167);ctx.stroke();
    ctx.strokeStyle="#CAB28A";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-2,0);ctx.quadraticCurveTo(9,-100,2,-162);ctx.stroke();
    for(let i=0;i<7;i++) {
      const a=-Math.PI+i*Math.PI/6;
      const ex=Math.cos(a)*69,ey=-156+Math.sin(a)*38+23;
      ctx.strokeStyle=i%2?"#3D725E":"#608967";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(5,-167);ctx.quadraticCurveTo(ex*0.6,-205,ex,ey);ctx.stroke();
      ctx.strokeStyle="rgba(195,211,154,0.45)";ctx.lineWidth=1.5;ctx.stroke();
    }
    ctx.restore();
  }
}
function floor(ctx: CanvasRenderingContext2D) {
  const sand=ctx.createLinearGradient(0,452,0,WORLD.height);sand.addColorStop(0,"#F0DFC0");sand.addColorStop(1,"#CDB38A");
  ctx.fillStyle=sand;ctx.fillRect(0,452,WORLD.width,WORLD.height-452);
  const court=ctx.createLinearGradient(0,480,0,690);court.addColorStop(0,"#E8D4AC");court.addColorStop(0.7,"#F2E2C3");court.addColorStop(1,"#D6BD94");
  polygon(ctx,[[155,480],[1125,480],[1237,675],[43,675]],court);
  // Deterministic fine grain and rake marks, generated once.
  let seed=127;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<2800;i++){const x=random()*WORLD.width,y=454+random()*266;ctx.fillStyle=i%3?"rgba(124,92,52,0.09)":"rgba(255,251,227,0.3)";ctx.fillRect(x,y,1+random()*2,0.8);}
  ctx.strokeStyle="rgba(122,97,57,0.07)";ctx.lineWidth=1;
  for(let y=490;y<710;y+=13){ctx.beginPath();ctx.moveTo(20,y);ctx.quadraticCurveTo(620,y-8,1260,y+2);ctx.stroke();}
  // Court lines use a trapezoid, intersecting the true play baseline at min/max X.
  ctx.strokeStyle="rgba(113,88,48,0.19)";ctx.lineWidth=7;
  ctx.beginPath();ctx.moveTo(155,480);ctx.lineTo(1125,480);ctx.lineTo(1237,675);ctx.lineTo(43,675);ctx.closePath();ctx.stroke();
  ctx.strokeStyle="#FFF6DE";ctx.lineWidth=4;ctx.stroke();
  const shade=ctx.createLinearGradient(0,650,0,720);shade.addColorStop(0,"rgba(41,43,34,0)");shade.addColorStop(1,"rgba(41,43,34,0.13)");ctx.fillStyle=shade;ctx.fillRect(0,650,WORLD.width,70);
}
export function drawCourtEnvironment(ctx: CanvasRenderingContext2D, offset: number) {
  skyLayer ??= layer(sky);sceneryLayer ??= layer(scenery);floorLayer ??= layer(floor);
  ctx.drawImage(skyLayer,0,0);ctx.drawImage(sceneryLayer,offset,0);ctx.drawImage(floorLayer,0,0);
}
