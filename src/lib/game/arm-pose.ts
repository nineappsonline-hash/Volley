/** Two-bone arm: fixed lengths, clamped reach, stable elbow bend. Rendering only. */
export function armPose(sx: number, sy: number, tx: number, ty: number, bend: number) {
  const upper = 23, forearm = 24;
  const dx = tx - sx, dy = ty - sy;
  const distance = Math.max(1.01, Math.min(upper + forearm - 0.01, Math.hypot(dx, dy)));
  const angle = Math.atan2(dy, dx);
  const elbowAngle = angle + bend * Math.acos(Math.max(-1, Math.min(1, (upper * upper + distance * distance - forearm * forearm) / (2 * upper * distance))));
  return { ex: sx + Math.cos(elbowAngle) * upper, ey: sy + Math.sin(elbowAngle) * upper, wx: sx + Math.cos(angle) * distance, wy: sy + Math.sin(angle) * distance };
}
