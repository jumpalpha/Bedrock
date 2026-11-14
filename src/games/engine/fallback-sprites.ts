"use client";

// Procedural stand-ins for Earth science sprites. The engine uses one automatically whenever
// /sprites/<name>.png is missing, so every game looks intentional before the real art exists.
// Each is drawn once on a 256px canvas (same square framing as the PNGs) and cached.

const S = 256;
const cache = new Map<string, HTMLCanvasElement | null>();

type Ctx = CanvasRenderingContext2D;

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

const DRAW: Record<string, (x: Ctx) => void> = {
  "lava-bomb"(x) {
    glow(x, 128, 132, 124, "rgba(255,120,30,.55)");
    blob(x, 128, 132, 82, [1, 0.94, 1.03, 0.97, 1.02, 0.95, 1, 0.96]);
    const g = x.createRadialGradient(100, 100, 8, 128, 132, 90);
    g.addColorStop(0, "#5a3a30");
    g.addColorStop(0.7, "#2b1712");
    g.addColorStop(1, "#160a07");
    x.fillStyle = g;
    x.fill();
    outline(x);
    x.save();
    x.clip();
    // glowing cracks
    x.shadowColor = "#ff8a1c";
    x.shadowBlur = 16;
    x.strokeStyle = "#ffb341";
    x.lineCap = "round";
    x.lineWidth = 7;
    [[[70, 110], [104, 128], [96, 168], [120, 196]], [[104, 128], [146, 120], [176, 92]], [[146, 120], [160, 160], [196, 170]], [[120, 70], [134, 96], [146, 120]]].forEach((pts) => {
      x.beginPath();
      pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
      x.stroke();
    });
    x.lineWidth = 3;
    x.strokeStyle = "#fff1b0";
    x.stroke();
    x.restore();
    x.fillStyle = "rgba(255,255,255,.18)";
    x.beginPath();
    x.ellipse(98, 92, 22, 12, -0.6, 0, 7);
    x.fill();
  },

  meteor(x) {
    // flame trail toward the upper right (meteors fly left in the games)
    x.save();
    x.translate(108, 148);
    x.rotate(-0.62);
    for (const [len, wid, col] of [[150, 58, "rgba(255,90,30,.55)"], [124, 42, "rgba(255,160,40,.8)"], [96, 24, "rgba(255,240,170,.95)"]] as const) {
      const g = x.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(255,120,40,0)");
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(0, -wid / 2);
      x.quadraticCurveTo(len * 0.6, -wid * 0.3, len, 0);
      x.quadraticCurveTo(len * 0.6, wid * 0.3, 0, wid / 2);
      x.closePath();
      x.fill();
    }
    x.restore();
    glow(x, 104, 152, 80, "rgba(255,140,60,.45)");
    blob(x, 100, 154, 54, [1, 0.88, 1.05, 0.92, 1, 0.86, 1.04, 0.95, 0.9]);
    const g = x.createRadialGradient(84, 136, 6, 100, 154, 62);
    g.addColorStop(0, "#7a6a78");
    g.addColorStop(0.6, "#3d3240");
    g.addColorStop(1, "#1c1520");
    x.fillStyle = g;
    x.fill();
    outline(x, 5);
    x.fillStyle = "rgba(0,0,0,.35)";
    [[86, 166, 10], [116, 140, 8], [108, 178, 6]].forEach(([cx, cy, r]) => {
      x.beginPath();
      x.arc(cx, cy, r, 0, 7);
      x.fill();
    });
    x.strokeStyle = "rgba(255,170,80,.9)";
    x.lineWidth = 4;
    x.beginPath();
    x.arc(100, 154, 52, -1.4, 0.2);
    x.stroke();
  },

  boulder(x) {
    x.fillStyle = "rgba(0,0,0,.25)";
    x.beginPath();
    x.ellipse(128, 214, 92, 16, 0, 0, 7);
    x.fill();
    blob(x, 128, 138, 90, [1, 0.9, 0.98, 0.84, 0.95, 1.04, 0.9, 1.02, 0.94], 0.3);
    const g = x.createRadialGradient(96, 96, 10, 128, 138, 104);
    g.addColorStop(0, "#c9c4bc");
    g.addColorStop(0.55, "#8a847b");
    g.addColorStop(1, "#4a453f");
    x.fillStyle = g;
    x.fill();
    outline(x, 6, "rgba(30,26,22,.6)");
    x.save();
    x.clip();
    x.strokeStyle = "rgba(40,34,30,.45)";
    x.lineWidth = 4;
    x.lineCap = "round";
    x.beginPath();
    x.moveTo(150, 60); x.lineTo(138, 104); x.lineTo(160, 138);
    x.moveTo(70, 150); x.lineTo(106, 166);
    x.stroke();
    x.fillStyle = "rgba(255,255,255,.22)";
    [[90, 90, 9], [176, 150, 6], [120, 190, 7], [70, 128, 5]].forEach(([cx, cy, r]) => {
      x.beginPath();
      x.arc(cx, cy, r, 0, 7);
      x.fill();
    });
    x.fillStyle = "rgba(0,0,0,.18)";
    x.beginPath();
    x.ellipse(150, 196, 80, 34, -0.2, 0, 7);
    x.fill();
    x.restore();
  },

  "storm-cloud"(x) {
    // lightning bolt
    x.save();
    x.shadowColor = "#ffe066";
    x.shadowBlur = 18;
    x.fillStyle = "#ffe14d";
    x.beginPath();
    x.moveTo(128, 140); x.lineTo(98, 200); x.lineTo(124, 198); x.lineTo(108, 246);
    x.lineTo(162, 178); x.lineTo(134, 180); x.lineTo(152, 140);
    x.closePath();
    x.fill();
    x.restore();
    const puffs: [number, number, number][] = [[70, 128, 44], [112, 98, 54], [162, 104, 48], [196, 134, 38], [128, 142, 50]];
    x.fillStyle = "rgba(20,24,36,.35)";
    puffs.forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx + 4, cy + 8, r, 0, 7); x.fill(); });
    const g = x.createLinearGradient(0, 50, 0, 180);
    g.addColorStop(0, "#9aa3b5");
    g.addColorStop(1, "#4a5266");
    x.fillStyle = g;
    puffs.forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); });
    x.fillStyle = "rgba(255,255,255,.22)";
    [[100, 80, 26], [150, 86, 22]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, Math.PI, Math.PI * 2); x.fill(); });
  },

  tornado(x) {
    for (let i = 0; i < 9; i++) {
      const t = i / 8, y = 42 + t * 176, w = 104 * (1 - t) + 12, off = Math.sin(t * 5) * 14 * t;
      x.fillStyle = i % 2 ? "#8b93a3" : "#a7aebb";
      x.beginPath();
      x.ellipse(128 + off, y, w, 13 + 6 * (1 - t), 0, 0, 7);
      x.fill();
      x.strokeStyle = "rgba(40,46,60,.45)";
      x.lineWidth = 3;
      x.stroke();
    }
    x.strokeStyle = "rgba(255,255,255,.55)";
    x.lineWidth = 4;
    x.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const y = 60 + i * 40, w = 80 * (1 - i / 5);
      x.beginPath();
      x.ellipse(128 + Math.sin(i) * 6, y, w, 8, 0, 0.3, 2.2);
      x.stroke();
    }
    x.fillStyle = "rgba(120,90,60,.6)";
    [[100, 228, 7], [156, 222, 5], [128, 238, 6], [86, 214, 4]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); });
  },

  crystal(x) {
    glow(x, 128, 140, 120, "rgba(190,120,255,.5)");
    const prism = (cx: number, base: number, w: number, h: number, tilt: number, c1: string, c2: string) => {
      x.save();
      x.translate(cx, base);
      x.rotate(tilt);
      x.beginPath();
      x.moveTo(-w / 2, 0); x.lineTo(-w / 2, -h); x.lineTo(0, -h - w * 0.8); x.lineTo(w / 2, -h); x.lineTo(w / 2, 0);
      x.closePath();
      const g = x.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, c2); g.addColorStop(0.45, c1); g.addColorStop(0.5, "#f3e2ff"); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
      x.fillStyle = g;
      x.fill();
      outline(x, 4, "rgba(50,20,80,.6)");
      x.fillStyle = "rgba(255,255,255,.35)";
      x.beginPath();
      x.moveTo(-w / 2, -h); x.lineTo(0, -h - w * 0.8); x.lineTo(0, -h);
      x.closePath();
      x.fill();
      x.restore();
    };
    prism(84, 214, 40, 70, -0.42, "#a564f0", "#5a2a9a");
    prism(176, 214, 40, 64, 0.45, "#a564f0", "#5a2a9a");
    prism(128, 220, 56, 110, 0, "#c48cff", "#6a32b4");
    x.fillStyle = "#5b4a5e";
    x.beginPath();
    x.ellipse(128, 218, 84, 16, 0, 0, 7);
    x.fill();
  },

  "star-garnet"(x) {
    glow(x, 128, 128, 120, "rgba(255,60,90,.45)");
    x.beginPath();
    x.ellipse(128, 132, 84, 74, 0, 0, 7);
    const g = x.createRadialGradient(104, 102, 6, 128, 132, 92);
    g.addColorStop(0, "#ff7a8e");
    g.addColorStop(0.45, "#b3122f");
    g.addColorStop(1, "#4a0414");
    x.fillStyle = g;
    x.fill();
    outline(x, 5, "rgba(40,0,10,.65)");
    // four-ray star (asterism)
    x.save();
    x.globalCompositeOperation = "lighter";
    for (const a of [0.25, 0.25 + Math.PI / 2]) {
      x.save();
      x.translate(124, 122);
      x.rotate(a);
      const sg = x.createLinearGradient(-70, 0, 70, 0);
      sg.addColorStop(0, "rgba(255,230,235,0)");
      sg.addColorStop(0.5, "rgba(255,240,245,.95)");
      sg.addColorStop(1, "rgba(255,230,235,0)");
      x.fillStyle = sg;
      x.beginPath();
      x.ellipse(0, 0, 70, 4, 0, 0, 7);
      x.fill();
      x.restore();
    }
    glow(x, 124, 122, 22, "rgba(255,255,255,.9)");
    x.restore();
  },

  fossil(x) {
    x.beginPath();
    x.ellipse(128, 130, 96, 88, 0, 0, 7);
    const g = x.createRadialGradient(100, 100, 10, 128, 130, 100);
    g.addColorStop(0, "#efe0bf");
    g.addColorStop(1, "#b39668");
    x.fillStyle = g;
    x.fill();
    outline(x, 6, "rgba(70,50,25,.55)");
    // ammonite spiral
    x.save();
    x.translate(132, 132);
    x.strokeStyle = "#6e5232";
    x.lineCap = "round";
    x.lineWidth = 9;
    x.beginPath();
    for (let t = 0; t < Math.PI * 5.2; t += 0.08) {
      const r = 6 + t * 4.3;
      const px = Math.cos(t) * r, py = Math.sin(t) * r;
      if (t === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.stroke();
    x.lineWidth = 3;
    x.strokeStyle = "rgba(110,82,50,.7)";
    for (let t = 1.2; t < Math.PI * 5.2; t += 0.45) {
      const r1 = 6 + t * 4.3, r2 = 6 + (t + Math.PI * 2) * 4.3;
      if (r2 > 76) continue;
      x.beginPath();
      x.moveTo(Math.cos(t) * r1, Math.sin(t) * r1);
      x.lineTo(Math.cos(t) * (r2 - 4), Math.sin(t) * (r2 - 4));
      x.stroke();
    }
    x.restore();
    x.fillStyle = "rgba(255,255,255,.25)";
    x.beginPath();
    x.ellipse(96, 84, 26, 12, -0.6, 0, 7);
    x.fill();
  },

  "water-drop"(x) {
    glow(x, 128, 150, 110, "rgba(80,180,255,.45)");
    x.beginPath();
    x.moveTo(128, 34);
    x.bezierCurveTo(150, 84, 202, 124, 202, 164);
    x.arc(128, 164, 74, 0, Math.PI, false);
    x.bezierCurveTo(54, 124, 106, 84, 128, 34);
    x.closePath();
    const g = x.createRadialGradient(108, 140, 8, 128, 160, 96);
    g.addColorStop(0, "#c8f0ff");
    g.addColorStop(0.45, "#3fb0ff");
    g.addColorStop(1, "#155fbf");
    x.fillStyle = g;
    x.fill();
    outline(x, 5, "rgba(10,40,90,.55)");
    x.fillStyle = "rgba(255,255,255,.75)";
    x.beginPath();
    x.ellipse(96, 150, 12, 26, 0.35, 0, 7);
    x.fill();
    x.beginPath();
    x.arc(104, 196, 6, 0, 7);
    x.fill();
  },

  "gold-nugget"(x) {
    glow(x, 128, 136, 116, "rgba(255,200,60,.45)");
    blob(x, 128, 140, 80, [1, 0.82, 0.96, 0.78, 1.05, 0.88, 0.94, 0.8, 1.02, 0.86], 0.2);
    const g = x.createRadialGradient(100, 108, 6, 128, 140, 92);
    g.addColorStop(0, "#fff3b0");
    g.addColorStop(0.35, "#ffd23f");
    g.addColorStop(0.75, "#d49a12");
    g.addColorStop(1, "#8a5a06");
    x.fillStyle = g;
    x.fill();
    outline(x, 5, "rgba(80,48,0,.6)");
    x.save();
    x.clip();
    x.fillStyle = "rgba(140,90,10,.35)";
    [[150, 160, 16], [98, 170, 12], [170, 116, 10], [120, 130, 8]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); });
    x.restore();
    x.fillStyle = "rgba(255,255,255,.85)";
    x.beginPath();
    x.ellipse(104, 104, 16, 8, -0.6, 0, 7);
    x.fill();
    x.beginPath();
    x.arc(152, 126, 4, 0, 7);
    x.fill();
  },
};

export function hasFallback(name: string) {
  return name in DRAW;
}

export function fallbackSprite(name: string): HTMLCanvasElement | null {
  if (cache.has(name)) return cache.get(name)!;
  const draw = DRAW[name];
  let c: HTMLCanvasElement | null = null;
  if (draw && typeof document !== "undefined") {
    c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    if (x) draw(x);
    else c = null;
  }
  cache.set(name, c);
  return c;
}
