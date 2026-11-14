"use client";

// Procedural stand-ins for the sprites the wave-B arcade games added (Meteor Invaders, Rock Breaker,
// Mineral 2048, Strata Stack, Quake Sweeper, Lava Snipes, Planet Defense). Same contract as
// fallback-sprites.ts: each draws once on a 256px square canvas and is used only while /sprites/<name>.png is missing.

type Ctx = CanvasRenderingContext2D;

function rand(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
function blob(x: Ctx, cx: number, cy: number, r: number, bumps: number[], rot = 0) {
  x.beginPath();
  const n = bumps.length;
  for (let i = 0; i <= n; i++) {
    const a = rot + (i / n) * Math.PI * 2, k = bumps[i % n];
    const px = cx + Math.cos(a) * r * k, py = cy + Math.sin(a) * r * k;
    if (i === 0) x.moveTo(px, py);
    else {
      const pa = rot + ((i - 0.5) / n) * Math.PI * 2, pk = (k + bumps[(i - 1) % n]) / 2 + 0.06;
      x.quadraticCurveTo(cx + Math.cos(pa) * r * pk, cy + Math.sin(pa) * r * pk, px, py);
    }
  }
  x.closePath();
}
function glow(x: Ctx, cx: number, cy: number, r: number, color: string) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(cx - r, cy - r, r * 2, r * 2);
}
function outline(x: Ctx, w = 6, c = "rgba(20,12,8,.55)") {
  x.lineWidth = w;
  x.lineJoin = "round";
  x.strokeStyle = c;
  x.stroke();
}
function shine(x: Ctx, cx = 96, cy = 90, rx = 22, ry = 11) {
  x.fillStyle = "rgba(255,255,255,.22)";
  x.beginPath();
  x.ellipse(cx, cy, rx, ry, -0.6, 0, 7);
  x.fill();
}

// ---------- rocks: one chunky rock shape, textured per type ----------
type RockStyle = { top: string; bot: string; tex: "speckle" | "vesicle" | "layers" | "veins" | "glass" | "pebbles" | "fine"; dots?: string[]; seed: number };
const ROCKS: Record<string, RockStyle> = {
  "rock-granite": { top: "#f0b9a8", bot: "#b97a6a", tex: "speckle", dots: ["#2a2420", "#ffffff", "#d0d0d0"], seed: 3 },
  "rock-basalt": { top: "#5a6270", bot: "#2a2f38", tex: "vesicle", seed: 5 },
  "rock-obsidian": { top: "#4a4458", bot: "#0f0c16", tex: "glass", seed: 7 },
  "rock-sandstone": { top: "#f2cf8a", bot: "#c08a44", tex: "layers", dots: ["#e0a85a", "#fbe3b0"], seed: 11 },
  "rock-shale": { top: "#a8b098", bot: "#5e6656", tex: "layers", dots: ["#4a5244", "#c0c8b0"], seed: 13 },
  "rock-marble": { top: "#f4f0f8", bot: "#c8bcd8", tex: "veins", seed: 17 },
  "rock-limestone": { top: "#d6e2ea", bot: "#94a8b6", tex: "fine", dots: ["#7a8e9c", "#f4fbff"], seed: 19 },
  "rock-greensand": { top: "#a8d890", bot: "#4e8a3e", tex: "speckle", dots: ["#2e5a24", "#d8f0c8"], seed: 23 },
  "rock-mudstone": { top: "#f09070", bot: "#a8442a", tex: "fine", dots: ["#7a2a18", "#ffc0a0"], seed: 29 },
  "rock-conglomerate": { top: "#e8b878", bot: "#a8743a", tex: "pebbles", dots: ["#8a8a8a", "#c0a080", "#6a5a4a", "#e0d0c0"], seed: 31 },
};
function rock(x: Ctx, st: RockStyle) {
  const R = rand(st.seed);
  const bumps = [1, 0.9, 0.97, 0.86, 1.02, 0.92, 0.98, 0.88];
  blob(x, 128, 136, 96, bumps, 0.3);
  const g = x.createLinearGradient(0, 40, 0, 236);
  g.addColorStop(0, st.top);
  g.addColorStop(1, st.bot);
  x.fillStyle = g;
  x.fill();
  x.save();
  x.clip();
  if (st.tex === "speckle") for (let i = 0; i < 160; i++) { x.fillStyle = st.dots![i % st.dots!.length]; x.globalAlpha = 0.8; x.beginPath(); x.ellipse(30 + R() * 196, 40 + R() * 196, 3 + R() * 6, 2 + R() * 5, R() * 3, 0, 7); x.fill(); }
  if (st.tex === "vesicle") for (let i = 0; i < 36; i++) { x.fillStyle = "rgba(10,10,14,.65)"; x.beginPath(); x.arc(40 + R() * 176, 50 + R() * 176, 3 + R() * 7, 0, 7); x.fill(); }
  if (st.tex === "layers") for (let i = 0; i < 9; i++) { x.fillStyle = st.dots![i % 2]; x.globalAlpha = 0.55; x.fillRect(0, 50 + i * 22 + R() * 6, 256, 8 + R() * 6); }
  if (st.tex === "fine") for (let i = 0; i < 260; i++) { x.fillStyle = st.dots![i % 2]; x.globalAlpha = 0.45; x.fillRect(30 + R() * 196, 40 + R() * 196, 3, 3); }
  if (st.tex === "pebbles") for (let i = 0; i < 22; i++) { x.fillStyle = st.dots![i % st.dots!.length]; x.globalAlpha = 1; x.beginPath(); x.ellipse(40 + R() * 176, 50 + R() * 176, 8 + R() * 12, 6 + R() * 9, R() * 3, 0, 7); x.fill(); x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 2; x.stroke(); }
  if (st.tex === "veins") {
    x.strokeStyle = "rgba(120,100,150,.55)"; x.lineCap = "round";
    for (let i = 0; i < 5; i++) { x.lineWidth = 2 + R() * 4; x.beginPath(); let px = 20 + R() * 60, py = 40 + R() * 180; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += 30 + R() * 10; py += (R() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); }
  }
  if (st.tex === "glass") {
    x.globalAlpha = 1;
    const sg = x.createLinearGradient(60, 50, 180, 200);
    sg.addColorStop(0, "rgba(255,255,255,.35)"); sg.addColorStop(0.4, "rgba(255,255,255,0)"); sg.addColorStop(0.7, "rgba(160,140,220,.25)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = sg; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 3;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(90 + i * 8, 110 + i * 6, 30 + i * 14, 3.6, 5.2); x.stroke(); }
  }
  x.restore();
  x.globalAlpha = 1;
  blob(x, 128, 136, 96, bumps, 0.3);
  outline(x, 7);
  shine(x, 92, 84);
}

// ---------- minerals: one crystal habit per mineral ----------
type MinStyle = { c1: string; c2: string; shape: "plates" | "blade" | "rhomb" | "cube" | "hex" | "block" | "point" | "prism" | "barrel" | "octa" };
const MINERALS: Record<string, MinStyle> = {
  "mineral-talc": { c1: "#eef4f0", c2: "#9ab8a8", shape: "plates" },
  "mineral-gypsum": { c1: "#fbf6ee", c2: "#c8b89a", shape: "blade" },
  "mineral-calcite": { c1: "#fff2cf", c2: "#e0a848", shape: "rhomb" },
  "mineral-fluorite": { c1: "#e0c8ff", c2: "#7a3ad8", shape: "cube" },
  "mineral-apatite": { c1: "#b8f4e8", c2: "#1f9a88", shape: "hex" },
  "mineral-feldspar": { c1: "#ffd2c4", c2: "#c8604a", shape: "block" },
  "mineral-quartz": { c1: "#ffffff", c2: "#b8c8e8", shape: "point" },
  "mineral-topaz": { c1: "#ffe6a8", c2: "#e08a18", shape: "prism" },
  "mineral-corundum": { c1: "#ff9aa8", c2: "#b01a34", shape: "barrel" },
  "mineral-diamond": { c1: "#f4ffff", c2: "#7ad0f0", shape: "octa" },
};
function mix(a: string, b: string) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round((v + B[i]) / 2)).join(",")})`;
}
function poly(x: Ctx, pts: number[][]) { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); }
function facet(x: Ctx, pts: number[][], fill: string) { poly(x, pts); x.fillStyle = fill; x.fill(); x.lineWidth = 4; x.lineJoin = "round"; x.strokeStyle = "rgba(30,20,40,.45)"; x.stroke(); }
function mineral(x: Ctx, m: MinStyle) {
  glow(x, 128, 132, 120, "rgba(255,255,255,.18)");
  const L = m.c1, D = m.c2, Mx = mix(m.c1, m.c2);
  switch (m.shape) {
    case "plates":
      [[60, 150], [90, 120], [120, 160], [150, 110], [100, 180]].forEach(([a, b], i) => facet(x, [[a, b], [a + 70, b - 20], [a + 90, b + 10], [a + 20, b + 30]], i % 2 ? L : Mx));
      break;
    case "blade":
      facet(x, [[110, 30], [146, 40], [150, 226], [114, 230]], L);
      facet(x, [[146, 40], [168, 60], [170, 216], [150, 226]], D);
      facet(x, [[70, 70], [98, 76], [104, 212], [76, 214]], Mx);
      break;
    case "rhomb":
      facet(x, [[70, 90], [170, 60], [200, 160], [100, 190]], L);
      facet(x, [[100, 190], [200, 160], [206, 196], [104, 226]], D);
      facet(x, [[70, 90], [100, 190], [104, 226], [56, 124]], Mx);
      break;
    case "cube":
      facet(x, [[70, 96], [150, 70], [206, 100], [126, 128]], L);
      facet(x, [[70, 96], [126, 128], [126, 216], [70, 184]], Mx);
      facet(x, [[126, 128], [206, 100], [206, 188], [126, 216]], D);
      break;
    case "hex":
      facet(x, [[96, 60], [128, 36], [160, 60], [160, 200], [128, 224], [96, 200]], Mx);
      facet(x, [[128, 36], [160, 60], [160, 200], [128, 224]], D);
      facet(x, [[96, 60], [128, 36], [128, 224], [96, 200]], L);
      break;
    case "block":
      facet(x, [[56, 100], [150, 76], [200, 104], [106, 130]], L);
      facet(x, [[56, 100], [106, 130], [106, 210], [56, 180]], Mx);
      facet(x, [[106, 130], [200, 104], [200, 182], [106, 210]], D);
      x.strokeStyle = "rgba(255,255,255,.4)"; x.lineWidth = 3; x.beginPath(); x.moveTo(120, 150); x.lineTo(190, 130); x.stroke();
      break;
    case "point":
      facet(x, [[96, 96], [128, 20], [128, 230], [96, 210]], L);
      facet(x, [[128, 20], [160, 96], [160, 210], [128, 230]], D);
      facet(x, [[60, 130], [80, 84], [92, 214], [64, 206]], Mx);
      facet(x, [[166, 140], [186, 100], [200, 212], [172, 218]], Mx);
      break;
    case "prism":
      facet(x, [[90, 80], [128, 40], [166, 80], [166, 220], [90, 220]], Mx);
      facet(x, [[128, 40], [166, 80], [166, 220], [128, 220]], D);
      facet(x, [[90, 80], [128, 40], [128, 220], [90, 220]], L);
      break;
    case "barrel":
      facet(x, [[84, 70], [128, 46], [172, 70], [182, 186], [128, 214], [74, 186]], Mx);
      facet(x, [[128, 46], [172, 70], [182, 186], [128, 214]], D);
      facet(x, [[84, 70], [128, 46], [128, 214], [74, 186]], L);
      x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 3;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(80, 100 + i * 34); x.lineTo(178, 100 + i * 34); x.stroke(); }
      break;
    case "octa":
      facet(x, [[128, 26], [206, 128], [128, 128]], L);
      facet(x, [[128, 26], [50, 128], [128, 128]], Mx);
      facet(x, [[50, 128], [128, 230], [128, 128]], D);
      facet(x, [[206, 128], [128, 230], [128, 128]], Mx);
      x.fillStyle = "#fff";
      [[96, 80], [170, 150]].forEach(([a, b]) => { x.beginPath(); x.moveTo(a, b - 14); x.lineTo(a + 4, b); x.lineTo(a, b + 14); x.lineTo(a - 4, b); x.closePath(); x.fill(); x.beginPath(); x.moveTo(a - 14, b); x.lineTo(a, b - 4); x.lineTo(a + 14, b); x.lineTo(a, b + 4); x.closePath(); x.fill(); });
      break;
  }
}

export const DRAW_B: Record<string, (x: Ctx) => void> = {
  ...Object.fromEntries(Object.entries(ROCKS).map(([k, st]) => [k, (x: Ctx) => rock(x, st)])),
  ...Object.fromEntries(Object.entries(MINERALS).map(([k, m]) => [k, (x: Ctx) => mineral(x, m)])),

  comet(x) {
    // icy nucleus with a blue-white tail pointing up (comets fall toward the player)
    x.save();
    x.translate(128, 150);
    const tg = x.createLinearGradient(0, -130, 0, 0);
    tg.addColorStop(0, "rgba(160,230,255,0)");
    tg.addColorStop(1, "rgba(190,240,255,.85)");
    x.fillStyle = tg;
    x.beginPath(); x.moveTo(-52, -10); x.quadraticCurveTo(-40, -90, -10, -146); x.lineTo(14, -146); x.quadraticCurveTo(40, -90, 52, -10); x.closePath(); x.fill();
    x.restore();
    glow(x, 128, 158, 90, "rgba(160,230,255,.6)");
    blob(x, 128, 160, 58, [1, 0.92, 1.04, 0.95, 1, 0.9, 1.02]);
    const g = x.createRadialGradient(108, 140, 6, 128, 160, 64);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#bfe8f8"); g.addColorStop(1, "#5a8aa8");
    x.fillStyle = g; x.fill(); outline(x, 6, "rgba(20,40,60,.5)");
    x.fillStyle = "rgba(60,80,100,.5)";
    [[146, 172, 10], [112, 182, 7], [140, 140, 6]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
  },

  "space-rock"(x) {
    blob(x, 128, 130, 92, [1, 0.86, 0.98, 0.9, 1.04, 0.84, 0.96, 0.92, 1], 0.2);
    const g = x.createRadialGradient(100, 96, 10, 128, 130, 100);
    g.addColorStop(0, "#b8a596"); g.addColorStop(0.7, "#6e5e52"); g.addColorStop(1, "#3e342e");
    x.fillStyle = g; x.fill(); outline(x, 7);
    x.save(); x.clip();
    [[150, 160, 22], [94, 158, 14], [160, 96, 12], [110, 112, 9], [186, 136, 8]].forEach(([a, b, r]) => {
      x.fillStyle = "rgba(40,30,24,.45)"; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill();
      x.strokeStyle = "rgba(230,215,200,.35)"; x.lineWidth = 3; x.beginPath(); x.arc(a, b, r, 3.6, 5.6); x.stroke();
    });
    x.restore();
    shine(x, 92, 84);
  },

  "laser-bolt"(x) {
    glow(x, 128, 128, 90, "rgba(255,190,80,.55)");
    x.lineCap = "round";
    x.strokeStyle = "#ff8a1c"; x.lineWidth = 46; x.beginPath(); x.moveTo(128, 40); x.lineTo(128, 216); x.stroke();
    x.strokeStyle = "#ffe08a"; x.lineWidth = 24; x.stroke();
    x.strokeStyle = "#ffffff"; x.lineWidth = 10; x.stroke();
  },

  shield(x) {
    glow(x, 128, 128, 120, "rgba(120,200,255,.35)");
    x.beginPath();
    x.moveTo(128, 30); x.quadraticCurveTo(180, 52, 212, 52); x.quadraticCurveTo(214, 170, 128, 228); x.quadraticCurveTo(42, 170, 44, 52); x.quadraticCurveTo(76, 52, 128, 30);
    x.closePath();
    const g = x.createLinearGradient(0, 30, 0, 228);
    g.addColorStop(0, "#9fe0ff"); g.addColorStop(1, "#2a7ab8");
    x.fillStyle = g; x.fill(); outline(x, 8, "rgba(10,30,60,.6)");
    // a little Earth in the middle
    x.beginPath(); x.arc(128, 122, 46, 0, 7); x.fillStyle = "#2f8fe0"; x.fill();
    x.save(); x.clip();
    x.fillStyle = "#3fbf6a";
    blob(x, 112, 108, 26, [1, 0.7, 1.1, 0.8, 1, 0.9]); x.fill();
    blob(x, 150, 146, 18, [1, 0.8, 1.1, 0.9, 1]); x.fill();
    x.restore();
    x.lineWidth = 5; x.strokeStyle = "rgba(255,255,255,.7)"; x.beginPath(); x.arc(128, 122, 46, 0, 7); x.stroke();
  },

  heart(x) {
    x.beginPath();
    x.moveTo(128, 214);
    x.bezierCurveTo(30, 150, 28, 70, 84, 58);
    x.bezierCurveTo(108, 52, 124, 70, 128, 88);
    x.bezierCurveTo(132, 70, 148, 52, 172, 58);
    x.bezierCurveTo(228, 70, 226, 150, 128, 214);
    x.closePath();
    const g = x.createLinearGradient(0, 56, 0, 214);
    g.addColorStop(0, "#ff7a6a"); g.addColorStop(1, "#c8322a");
    x.fillStyle = g; x.fill(); outline(x, 8, "rgba(70,10,10,.55)");
    shine(x, 88, 92, 18, 10);
  },

  "quake-crack"(x) {
    // ground block split by a glowing fault crack
    x.fillStyle = "#8a6a4a";
    x.beginPath(); x.moveTo(24, 70); x.lineTo(232, 70); x.lineTo(232, 200); x.lineTo(24, 200); x.closePath(); x.fill();
    x.fillStyle = "#6a8a4a"; x.fillRect(24, 70, 208, 18);
    x.save();
    x.shadowColor = "#ff6a1c"; x.shadowBlur = 18;
    x.fillStyle = "#2a1408";
    x.beginPath(); x.moveTo(110, 66); x.lineTo(140, 66); x.lineTo(126, 104); x.lineTo(150, 132); x.lineTo(124, 168); x.lineTo(138, 204); x.lineTo(104, 204); x.lineTo(112, 168); x.lineTo(96, 132); x.lineTo(116, 104); x.closePath(); x.fill();
    x.restore();
    x.strokeStyle = "#ffb341"; x.lineWidth = 4; x.lineJoin = "round";
    x.beginPath(); x.moveTo(125, 70); x.lineTo(118, 104); x.lineTo(136, 132); x.lineTo(118, 168); x.lineTo(122, 200); x.stroke();
    // shake lines
    x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 6; x.lineCap = "round";
    [[40, 40, 60, 30], [70, 30, 82, 16], [216, 40, 196, 30], [186, 30, 174, 16]].forEach(([a, b, c, d]) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); });
    x.beginPath(); x.rect(24, 70, 208, 130); outline(x, 6);
  },

  "survey-flag"(x) {
    x.fillStyle = "#5a4632"; x.fillRect(80, 40, 12, 190);
    x.beginPath(); x.ellipse(86, 228, 34, 9, 0, 0, 7); x.fillStyle = "rgba(0,0,0,.3)"; x.fill();
    x.beginPath(); x.moveTo(92, 44); x.quadraticCurveTo(150, 30, 200, 60); x.quadraticCurveTo(160, 90, 200, 120); x.quadraticCurveTo(150, 100, 92, 118); x.closePath();
    const g = x.createLinearGradient(92, 40, 200, 120);
    g.addColorStop(0, "#ff7a3a"); g.addColorStop(1, "#d8401a");
    x.fillStyle = g; x.fill(); outline(x, 6);
    x.fillStyle = "#fff"; x.fillRect(120, 70, 46, 10);
  },

  "lava-blob"(x) {
    glow(x, 128, 132, 120, "rgba(255,110,20,.55)");
    blob(x, 128, 136, 80, [1, 0.9, 1.08, 0.94, 1.04, 0.88, 1.02], 0.4);
    const g = x.createRadialGradient(104, 104, 6, 128, 136, 90);
    g.addColorStop(0, "#fff4b0"); g.addColorStop(0.35, "#ffb341"); g.addColorStop(0.75, "#e0521a"); g.addColorStop(1, "#7a1a08");
    x.fillStyle = g; x.fill(); outline(x, 6, "rgba(60,10,0,.6)");
    // crust plates
    x.save(); x.clip();
    x.fillStyle = "rgba(50,20,14,.55)";
    [[170, 170, 26], [80, 180, 18], [176, 96, 14]].forEach(([a, b, r]) => { blob(x, a, b, r, [1, 0.8, 1.1, 0.9, 1]); x.fill(); });
    x.restore();
    // angry little eyes so it reads as an enemy
    x.fillStyle = "#2a0a04";
    [[108, 130], [150, 130]].forEach(([a, b]) => { x.beginPath(); x.ellipse(a, b, 9, 12, 0, 0, 7); x.fill(); });
    x.strokeStyle = "#2a0a04"; x.lineWidth = 6; x.lineCap = "round";
    x.beginPath(); x.moveTo(96, 110); x.lineTo(118, 118); x.moveTo(162, 110); x.lineTo(140, 118); x.stroke();
  },

  "solar-wind"(x) {
    glow(x, 128, 128, 124, "rgba(255,200,60,.6)");
    x.save(); x.translate(128, 128);
    for (let i = 0; i < 10; i++) {
      x.rotate((Math.PI * 2) / 10);
      x.fillStyle = i % 2 ? "#ffcf3a" : "#ff8a1c";
      x.beginPath(); x.moveTo(-14, -40); x.quadraticCurveTo(0, -112, 18, -96); x.quadraticCurveTo(10, -60, 14, -40); x.closePath(); x.fill();
    }
    x.restore();
    x.beginPath(); x.arc(128, 128, 52, 0, 7);
    const g = x.createRadialGradient(112, 110, 4, 128, 128, 56);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#ffe680"); g.addColorStop(1, "#ff9a1c");
    x.fillStyle = g; x.fill(); outline(x, 5, "rgba(120,50,0,.5)");
    x.fillStyle = "rgba(120,50,0,.65)";
    x.font = "bold 44px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("+", 128, 130);
  },

  earth(x) {
    glow(x, 128, 128, 126, "rgba(90,180,255,.55)");
    x.beginPath(); x.arc(128, 128, 96, 0, 7);
    const g = x.createRadialGradient(96, 92, 10, 128, 128, 100);
    g.addColorStop(0, "#7ad0ff"); g.addColorStop(0.7, "#2a78c8"); g.addColorStop(1, "#163e7a");
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    x.fillStyle = "#3fae5a";
    blob(x, 96, 96, 44, [1, 0.7, 1.15, 0.8, 1.05, 0.75, 1]); x.fill();
    blob(x, 168, 160, 40, [1, 0.8, 1.1, 0.7, 1.05, 0.9]); x.fill();
    blob(x, 80, 186, 22, [1, 0.8, 1.1, 0.9]); x.fill();
    x.fillStyle = "#c8a46a";
    blob(x, 104, 104, 16, [1, 0.8, 1.1, 0.9]); x.fill();
    x.fillStyle = "rgba(255,255,255,.75)";
    x.fillRect(30, 40, 196, 10); x.fillRect(30, 206, 196, 10);
    x.fillStyle = "rgba(255,255,255,.35)";
    [[150, 80, 40, 10], [60, 140, 46, 9], [170, 196, 34, 8]].forEach(([a, b, w, h]) => { x.beginPath(); x.ellipse(a, b, w, h, -0.2, 0, 7); x.fill(); });
    x.restore();
    x.beginPath(); x.arc(128, 128, 96, 0, 7); outline(x, 6, "rgba(10,30,70,.6)");
  },
};
