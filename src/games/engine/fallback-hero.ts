"use client";
// ── wave-pet2: drawn stand-in for the rock-alien hero (used only when /sprites/hero*.png is missing) ──
// Round sandy-gray geode body, purple amethyst belly window, big cyan crystal eyes, teal crystal crown,
// two stubby arms and feet. Faces right, like the PNGs. 256px square canvas.
type Ctx = CanvasRenderingContext2D;
const STONE = "#b8b0a6", STONE_D = "#7d756c", INK = "#3b342e";

function crown(x: Ctx, cx: number, top: number) {
  const pts: [number, number, number][] = [[-16, 22, 9], [0, 34, 11], [16, 24, 9]];
  for (const [dx, h, w] of pts) {
    x.fillStyle = "#2dd4bf"; x.strokeStyle = "#0f766e"; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx + dx - w, top); x.lineTo(cx + dx - w * 0.6, top - h); x.lineTo(cx + dx, top - h - 8);
    x.lineTo(cx + dx + w * 0.6, top - h); x.lineTo(cx + dx + w, top); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(cx + dx - 2, top - h + 2, 3, h - 6);
  }
}
function limb(x: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0) {
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.fillStyle = STONE; x.strokeStyle = INK; x.lineWidth = 4;
  x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fill(); x.stroke(); x.restore();
}
function body(x: Ctx, cx: number, cy: number, r: number) {
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, "#ddd6cc"); g.addColorStop(0.7, STONE); g.addColorStop(1, STONE_D);
  x.fillStyle = g; x.strokeStyle = INK; x.lineWidth = 5;
  x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.stroke();
  x.strokeStyle = "rgba(59,52,46,.45)"; x.lineWidth = 2.5;   // cracks
  x.beginPath(); x.moveTo(cx - r * 0.75, cy - r * 0.2); x.lineTo(cx - r * 0.55, cy - r * 0.05); x.lineTo(cx - r * 0.62, cy + r * 0.2);
  x.moveTo(cx + r * 0.45, cy - r * 0.75); x.lineTo(cx + r * 0.35, cy - r * 0.55); x.stroke();
}
function belly(x: Ctx, cx: number, cy: number, r: number) {
  x.fillStyle = "#4c1d95"; x.strokeStyle = INK; x.lineWidth = 3;
  x.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, k = i % 2 ? 0.78 : 1; x[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * 0.7 * k); }
  x.closePath(); x.fill(); x.stroke();
  for (const [dx, dy, s] of [[-0.4, 0.1, 0.32], [0.05, -0.1, 0.42], [0.42, 0.12, 0.3], [-0.05, 0.3, 0.28]]) {
    x.fillStyle = "#a78bfa"; x.beginPath();
    x.moveTo(cx + dx * r, cy + dy * r - s * r); x.lineTo(cx + dx * r + s * r * 0.5, cy + dy * r); x.lineTo(cx + dx * r, cy + dy * r + s * r * 0.5); x.lineTo(cx + dx * r - s * r * 0.5, cy + dy * r);
    x.closePath(); x.fill();
    x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(cx + dx * r - 2, cy + dy * r - s * r * 0.6, 3, 6);
  }
}
function eye(x: Ctx, cx: number, cy: number, r: number, shut = false) {
  if (shut) { x.strokeStyle = INK; x.lineWidth = 5; x.beginPath(); x.moveTo(cx - r, cy - 3); x.lineTo(cx, cy + 4); x.lineTo(cx + r, cy - 3); x.stroke(); return; }
  x.fillStyle = INK; x.beginPath(); x.arc(cx, cy, r + 3, 0, 7); x.fill();
  const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
  g.addColorStop(0, "#a5f3fc"); g.addColorStop(1, "#0891b2");
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  x.fillStyle = "#fff"; x.beginPath(); x.arc(cx + r * 0.3, cy - r * 0.35, r * 0.3, 0, 7); x.fill();
}
function alien(x: Ctx, pose: "happy" | "wings" | "run" | "hurt" | "back") {
  const cx = 128, cy = 136, r = 74;
  if (pose === "wings") {
    x.fillStyle = "rgba(94,234,212,.75)"; x.strokeStyle = "#0f766e"; x.lineWidth = 3;
    x.beginPath(); x.moveTo(cx - 40, cy - 30); x.quadraticCurveTo(cx - 120, cy - 110, cx - 118, cy - 40); x.quadraticCurveTo(cx - 100, cy - 10, cx - 40, cy - 6); x.closePath(); x.fill(); x.stroke();
  }
  const run = pose === "run";
  limb(x, cx - 30, cy + r - 6, 20, 13, run ? -0.5 : 0);   // feet
  limb(x, cx + 30, cy + r - 6, 20, 13, run ? 0.5 : 0);
  limb(x, cx - r + 4, cy + 12, 14, 24, run ? 0.8 : 0.3);   // arms
  limb(x, cx + r - 4, cy + (pose === "hurt" ? -26 : 12), 14, 24, pose === "hurt" ? -0.6 : run ? -0.8 : -0.3);
  body(x, cx, cy, r);
  crown(x, cx + (pose === "back" ? 0 : 6), cy - r + 6);
  if (pose === "back") return;
  belly(x, cx + 10, cy + 26, 34);
  const hurt = pose === "hurt";
  eye(x, cx - 4, cy - 22, 15, hurt); eye(x, cx + 40, cy - 22, 13, hurt);
  x.strokeStyle = INK; x.lineWidth = 4; x.beginPath();
  if (hurt) { x.moveTo(cx + 8, cy + 2); x.quadraticCurveTo(cx + 18, cy - 4, cx + 28, cy + 2); }
  else { x.moveTo(cx + 8, cy); x.quadraticCurveTo(cx + 18, cy + 8, cx + 28, cy); }
  x.stroke();
  if (hurt) { x.fillStyle = "#facc15"; for (const [sx, sy] of [[60, 50], [196, 46], [210, 92]]) { x.beginPath(); x.arc(sx, sy, 6, 0, 7); x.fill(); } }
}
export const HERO_DRAW: Record<string, (x: Ctx) => void> = {
  hero: (x) => alien(x, "happy"),
  "hero-wings": (x) => alien(x, "wings"),
  "hero-run": (x) => alien(x, "run"),
  "hero-hurt": (x) => alien(x, "hurt"),
  "hero-back": (x) => alien(x, "back"),
};
// ── end wave-pet2 ──
