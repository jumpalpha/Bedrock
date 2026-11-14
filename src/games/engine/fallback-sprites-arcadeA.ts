"use client";

// Procedural stand-ins for the sprites the wave-arcadeA games added (merged into fallback-sprites.ts).
// Same 256px square framing as the PNGs; the engine uses these until /sprites/<name>.png exists.

type Ctx = CanvasRenderingContext2D;

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

function poly(x: Ctx, pts: number[][]) {
  x.beginPath();
  pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.closePath();
}

function starPath(x: Ctx, cx: number, cy: number, r: number, inner: number, n = 5, rot = -Math.PI / 2) {
  x.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
}

function geodeBody(x: Ctx, gold: boolean) {
  // rough rock rind, cut open to show a crystal-lined hollow
  x.beginPath();
  x.ellipse(128, 134, 98, 88, -0.1, 0, 7);
  const g = x.createRadialGradient(96, 96, 10, 128, 134, 110);
  g.addColorStop(0, gold ? "#c8a36a" : "#b8aa98");
  g.addColorStop(1, gold ? "#6e4d1c" : "#5e5348");
  x.fillStyle = g;
  x.fill();
  outline(x, 6, "rgba(30,22,14,.6)");
  x.beginPath();
  x.ellipse(128, 136, 72, 62, -0.1, 0, 7);
  x.fillStyle = gold ? "#f3e2b0" : "#e9e3f2";
  x.fill();
  x.save();
  x.clip();
  const inner = x.createRadialGradient(128, 140, 4, 128, 136, 70);
  inner.addColorStop(0, gold ? "#7a4a00" : "#2b1050");
  inner.addColorStop(0.55, gold ? "#ffb81f" : "#7d3fd6");
  inner.addColorStop(1, gold ? "#ffe9a0" : "#d8b8ff");
  x.fillStyle = inner;
  x.fillRect(40, 60, 180, 160);
  // crystal points around the rim, pointing inward
  x.fillStyle = gold ? "rgba(255,250,220,.75)" : "rgba(245,235,255,.7)";
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, r1 = 70, r2 = 44 + (i % 3) * 6;
    const ax = 128 + Math.cos(a) * r1, ay = 136 + Math.sin(a) * r1 * 0.86;
    const bx = 128 + Math.cos(a) * r2, by = 136 + Math.sin(a) * r2 * 0.86;
    const nx = -Math.sin(a) * 7, ny = Math.cos(a) * 7;
    poly(x, [[ax + nx, ay + ny], [bx, by], [ax - nx, ay - ny]]);
    x.fill();
  }
  x.restore();
  x.fillStyle = "rgba(255,255,255,.3)";
  x.beginPath();
  x.ellipse(84, 78, 22, 10, -0.6, 0, 7);
  x.fill();
}

export const ARCADE_A_DRAW: Record<string, (x: Ctx) => void> = {
  heart(x) {
    glow(x, 128, 130, 120, "rgba(255,70,90,.35)");
    x.beginPath();
    x.moveTo(128, 216);
    x.bezierCurveTo(40, 160, 22, 110, 50, 74);
    x.bezierCurveTo(78, 40, 120, 52, 128, 88);
    x.bezierCurveTo(136, 52, 178, 40, 206, 74);
    x.bezierCurveTo(234, 110, 216, 160, 128, 216);
    x.closePath();
    const g = x.createRadialGradient(96, 90, 6, 128, 130, 120);
    g.addColorStop(0, "#ff9aa8");
    g.addColorStop(0.5, "#f0364f");
    g.addColorStop(1, "#9a0f26");
    x.fillStyle = g;
    x.fill();
    outline(x, 6, "rgba(70,0,14,.55)");
    x.fillStyle = "rgba(255,255,255,.55)";
    x.beginPath();
    x.ellipse(82, 92, 18, 10, -0.7, 0, 7);
    x.fill();
  },

  star(x) {
    glow(x, 128, 132, 124, "rgba(255,210,60,.5)");
    starPath(x, 128, 136, 104, 0.46);
    const g = x.createRadialGradient(100, 100, 6, 128, 136, 110);
    g.addColorStop(0, "#fff6c0");
    g.addColorStop(0.5, "#ffd23f");
    g.addColorStop(1, "#d98a00");
    x.fillStyle = g;
    x.fill();
    outline(x, 6, "rgba(110,60,0,.55)");
    x.fillStyle = "rgba(255,255,255,.45)";
    x.beginPath();
    x.ellipse(108, 104, 16, 8, -0.6, 0, 7);
    x.fill();
  },

  // hard hat on a shield: the "protection" power-up
  shield(x) {
    glow(x, 128, 128, 120, "rgba(80,190,255,.45)");
    x.beginPath();
    x.moveTo(128, 30);
    x.lineTo(212, 62);
    x.quadraticCurveTo(212, 176, 128, 228);
    x.quadraticCurveTo(44, 176, 44, 62);
    x.closePath();
    const g = x.createLinearGradient(44, 0, 212, 0);
    g.addColorStop(0, "#1f6fb8");
    g.addColorStop(0.5, "#4cc4ff");
    g.addColorStop(1, "#1a5a96");
    x.fillStyle = g;
    x.fill();
    outline(x, 7, "rgba(5,30,60,.6)");
    // hard hat
    x.beginPath();
    x.moveTo(78, 150);
    x.quadraticCurveTo(78, 82, 128, 82);
    x.quadraticCurveTo(178, 82, 178, 150);
    x.closePath();
    x.fillStyle = "#ffd23f";
    x.fill();
    outline(x, 5, "rgba(90,60,0,.6)");
    x.fillStyle = "#f2b400";
    x.fillRect(66, 146, 124, 16);
    x.fillStyle = "rgba(255,255,255,.5)";
    x.fillRect(120, 86, 16, 60);
  },

  // the Magma King: a grumpy crowned volcano boss
  "magma-king"(x) {
    glow(x, 128, 150, 126, "rgba(255,110,30,.4)");
    poly(x, [[30, 226], [96, 92], [160, 92], [226, 226]]);
    const g = x.createLinearGradient(0, 92, 0, 226);
    g.addColorStop(0, "#6a4a40");
    g.addColorStop(1, "#2a1a16");
    x.fillStyle = g;
    x.fill();
    outline(x, 6);
    // lava running down
    x.fillStyle = "#ff7a1c";
    poly(x, [[100, 92], [156, 92], [150, 120], [140, 112], [134, 150], [124, 118], [114, 134], [108, 108]]);
    x.fill();
    x.fillStyle = "#ffd36b";
    x.fillRect(100, 88, 56, 8);
    // eyes + mouth
    x.fillStyle = "#fff4d0";
    x.beginPath(); x.ellipse(104, 168, 13, 11, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(152, 168, 13, 11, 0, 0, 7); x.fill();
    x.fillStyle = "#1a0a06";
    x.beginPath(); x.arc(107, 170, 6, 0, 7); x.fill();
    x.beginPath(); x.arc(149, 170, 6, 0, 7); x.fill();
    x.strokeStyle = "#1a0a06"; x.lineWidth = 6; x.lineCap = "round";
    x.beginPath(); x.moveTo(88, 150); x.lineTo(118, 158); x.moveTo(168, 150); x.lineTo(138, 158); x.stroke();
    x.fillStyle = "#ff5a1c";
    x.beginPath(); x.moveTo(104, 198); x.quadraticCurveTo(128, 186, 152, 198); x.quadraticCurveTo(128, 214, 104, 198); x.fill();
    // crown
    poly(x, [[92, 70], [92, 36], [110, 54], [128, 26], [146, 54], [164, 36], [164, 70]]);
    const cg = x.createLinearGradient(0, 26, 0, 70);
    cg.addColorStop(0, "#fff0a0");
    cg.addColorStop(1, "#d99a00");
    x.fillStyle = cg;
    x.fill();
    outline(x, 4, "rgba(90,50,0,.7)");
    x.fillStyle = "#f0364f";
    x.beginPath(); x.arc(128, 56, 6, 0, 7); x.fill();
  },

  "golden-geode"(x) {
    glow(x, 128, 134, 126, "rgba(255,210,60,.6)");
    geodeBody(x, true);
  },

  geode(x) {
    glow(x, 128, 134, 120, "rgba(170,110,255,.4)");
    geodeBody(x, false);
  },

  pickaxe(x) {
    glow(x, 128, 128, 116, "rgba(124,255,178,.35)");
    // handle
    x.save();
    x.translate(128, 128);
    x.rotate(0.75);
    const hg = x.createLinearGradient(-10, 0, 10, 0);
    hg.addColorStop(0, "#7a4a22");
    hg.addColorStop(0.5, "#c98a4e");
    hg.addColorStop(1, "#6a3c18");
    x.fillStyle = hg;
    x.beginPath();
    x.roundRect(-11, -70, 22, 170, 8);
    x.fill();
    outline(x, 4, "rgba(40,20,5,.6)");
    // head
    x.beginPath();
    x.moveTo(-104, -50);
    x.quadraticCurveTo(0, -112, 104, -50);
    x.quadraticCurveTo(0, -80, -104, -50);
    x.closePath();
    const mg = x.createLinearGradient(0, -100, 0, -50);
    mg.addColorStop(0, "#e6edf2");
    mg.addColorStop(1, "#6b7a86");
    x.fillStyle = mg;
    x.fill();
    outline(x, 5, "rgba(20,30,40,.6)");
    x.fillStyle = "#4a5560";
    x.fillRect(-16, -88, 32, 26);
    x.restore();
  },

  volcano(x) {
    glow(x, 128, 70, 90, "rgba(255,120,30,.5)");
    poly(x, [[18, 224], [100, 86], [156, 86], [238, 224]]);
    const g = x.createLinearGradient(0, 86, 0, 224);
    g.addColorStop(0, "#7a5a48");
    g.addColorStop(1, "#3a2820");
    x.fillStyle = g;
    x.fill();
    outline(x, 6);
    x.fillStyle = "#ff6a1c";
    poly(x, [[100, 86], [156, 86], [150, 130], [138, 112], [128, 170], [118, 120], [106, 140]]);
    x.fill();
    x.fillStyle = "#ffd36b";
    x.fillRect(100, 82, 56, 8);
    // ash plume
    x.fillStyle = "rgba(90,90,100,.85)";
    [[110, 56, 22], [140, 44, 26], [120, 26, 20], [158, 20, 18]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); });
  },

  snowflake(x) {
    glow(x, 128, 128, 118, "rgba(160,220,255,.45)");
    x.strokeStyle = "#e8f7ff";
    x.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      x.save();
      x.translate(128, 128);
      x.rotate((i * Math.PI) / 3);
      x.lineWidth = 14;
      x.strokeStyle = "rgba(40,110,170,.6)";
      x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -96); x.moveTo(0, -56); x.lineTo(-26, -78); x.moveTo(0, -56); x.lineTo(26, -78); x.stroke();
      x.lineWidth = 8;
      x.strokeStyle = "#e8f7ff";
      x.stroke();
      x.restore();
    }
    x.fillStyle = "#bfe8ff";
    x.beginPath(); x.arc(128, 128, 14, 0, 7); x.fill();
  },

  compass(x) {
    x.beginPath();
    x.arc(128, 130, 96, 0, 7);
    const g = x.createRadialGradient(100, 100, 6, 128, 130, 100);
    g.addColorStop(0, "#ffe9a0");
    g.addColorStop(1, "#b07a10");
    x.fillStyle = g;
    x.fill();
    outline(x, 6, "rgba(70,40,0,.6)");
    x.beginPath();
    x.arc(128, 130, 76, 0, 7);
    x.fillStyle = "#f6f1e4";
    x.fill();
    x.fillStyle = "#3a3a3a";
    x.font = "bold 26px sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("N", 128, 72);
    x.fillStyle = "#e0362c";
    poly(x, [[128, 82], [144, 130], [112, 130]]);
    x.fill();
    x.fillStyle = "#5a6a78";
    poly(x, [[128, 178], [144, 130], [112, 130]]);
    x.fill();
    x.fillStyle = "#222";
    x.beginPath(); x.arc(128, 130, 7, 0, 7); x.fill();
  },
};
