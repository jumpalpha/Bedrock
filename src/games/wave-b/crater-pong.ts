import type { Api, GameModule } from "../engine/types";

const W = 420, H = 640, G = 9.8;
const TW = 0.76, TL = 2.4, CUP_R = 0.09, CUP_H = 0.12, BR = 0.022;
const F = 680, CAM_Z = -1.8, CAM_H = 1.5, HORIZON = 110;
const START = { x: 0, y: 0.32, z: 0.05 }, ELEV = 0.85;
const P_MIN = 3.2, P_MAX = 5.0, YAW_MAX = 0.3, BALLS = 16, BONUS_BALL_AT = 3;
const proj = (x: number, y: number, z: number) => { const d = Math.max(0.3, z - CAM_Z), s = F / d; return { x: W / 2 + x * s, y: HORIZON + (CAM_H - y) * s, s }; };

// Each cup is a crater. Sink a meteorite in it to learn how it formed.
const CRATERS = [
  { name: "Meteor Crater, Arizona", liquid: "#c98a52", tip: "About 50,000 years ago an iron meteorite about 50 m wide blasted a hole 1.2 km across." },
  { name: "Chicxulub, Mexico", liquid: "#2f8fb0", tip: "A 10 km asteroid hit here 66 million years ago. The crater is about 180 km wide and the impact helped end the dinosaurs." },
  { name: "Vredefort, South Africa", liquid: "#7aa35a", tip: "About 2 billion years old, Vredefort is the largest confirmed impact structure on Earth." },
  { name: "Sudbury, Canada", liquid: "#6b6f7a", tip: "The 1.8-billion-year-old Sudbury impact left rich nickel and copper ores that are still mined today." },
  { name: "Manicouagan, Quebec", liquid: "#3a7fd0", tip: "This 214-million-year-old crater is now a ring-shaped lake you can see from space." },
  { name: "Ries Crater, Germany", liquid: "#8fb05a", tip: "The town of Nördlingen sits inside this 15-million-year-old crater, and its church is built of impact rock." },
  { name: "Tycho, the Moon", liquid: "#d8d8e0", tip: "Tycho's bright rays of splashed-out rock stretch across the Moon. The Moon keeps craters because it has no wind or water." },
  { name: "Copernicus, the Moon", liquid: "#b8b8c4", tip: "Copernicus is 93 km wide with mountain peaks in the middle that rebounded right after impact." },
  { name: "Wolfe Creek, Australia", liquid: "#d26a3a", tip: "Wolfe Creek in the desert is so well preserved because dry climates slow erosion." },
  { name: "Chesapeake Bay, USA", liquid: "#2a6fa0", tip: "A buried 35-million-year-old impact crater still shapes the rivers and groundwater of Chesapeake Bay." },
  { name: "Crater Lake, Oregon", liquid: "#1f5fd0", tip: "Trick crater! Crater Lake is a caldera that formed when the volcano Mount Mazama collapsed about 7,700 years ago." },
  { name: "Craters of the Moon, Idaho", liquid: "#3a3436", tip: "Trick crater! Idaho's Craters of the Moon are volcanic. Apollo astronauts trained there in 1969." },
];
type Crater = (typeof CRATERS)[number];

export const craterPong: GameModule = {
  config: {
    key: "bedrock_crater_pong",
    title: "Crater Pong",
    subtitle: "Land a meteorite in every crater!",
    W, H,
    winText: "All 10 craters hit!",
    deathDelay: 700,
    overTitle: "Game Over!",
    accent: "#FF8C42",
    medals: [
      { at: 500, name: "Bronze", icon: "🥉" },
      { at: 1200, name: "Silver", icon: "🥈" },
      { at: 2000, name: "Gold", icon: "🥇" },
      { at: 3200, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Pull down</b> for power, <b>slide sideways</b> to aim, and let go to toss. Every cup is a famous crater. Sink a meteorite in it to learn its story. <b>16 meteorites</b> to hit all <b>10 craters</b>. Swish +25, bounce shot +100. Sink 3 in a row and you're <b>on fire</b>: double points and a bonus meteorite!",
    controls: "Drag down & release · or ← → aim, ↑ ↓ power, Space toss · P pause",
    facts: [
      "Impact craters are bowl-shaped holes blasted out when a meteorite hits a planet or moon.",
      "Earth has fewer visible craters than the Moon because erosion, plate tectonics, and plants erase them.",
      "Big impact craters often have a central peak where the ground rebounded after the hit.",
      "About 200 impact craters have been confirmed on Earth.",
      "Not every crater is an impact crater: volcanoes make craters and calderas too.",
    ],
  },
  create() {
    type Cup = { x: number; z: number; crater: Crater; alive: boolean; pop: number };
    type Ball = { x: number; y: number; z: number; vx: number; vy: number; vz: number; bounced: boolean; rimmed: boolean; bounces: number };
    let cups: Cup[] = [], ball: Ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, bounced: false, rimmed: false, bounces: 0 };
    let phase: "aim" | "fly" | "done" | "over" = "aim", power = 4.1, yaw = 0, ptrTap = false, ballsLeft = BALLS, sunk = 0, streak = 0;
    let drag: { sx: number; sy: number; x: number; y: number } | null = null;
    let msg = "", msgT = 0, endT = 0, rerackedAt: Record<number, boolean> = {}, trail: { x: number; y: number; s: number }[] = [];

    function rack(n: number, craters: Crater[]): Cup[] {
      const rows = n === 10 ? 4 : n === 6 ? 3 : n === 3 ? 2 : 1, S = CUP_R * 2 + 0.008, z0 = n === 10 ? 1.8 : n === 6 ? 1.9 : n === 3 ? 2.0 : 2.05;
      const out: Cup[] = [];
      for (let k = 0; k < rows; k++) for (let i = 0; i <= k; i++) out.push({ x: (i - k / 2) * S, z: z0 + k * S * 0.866, crater: craters[out.length], alive: true, pop: 0 });
      return out;
    }
    function nextBall() {
      ball = { x: START.x, y: START.y, z: START.z, vx: 0, vy: 0, vz: 0, bounced: false, rimmed: false, bounces: 0 };
      phase = "aim"; endT = 0; trail = [];
    }
    const velFor = (p: number, w: number) => { const h = p * Math.cos(ELEV); return { vx: h * Math.sin(w), vy: p * Math.sin(ELEV), vz: h * Math.cos(w) }; };
    const current = () => {
      if (drag) {
        const pull = Math.max(0, drag.y - drag.sy), side = drag.x - drag.sx;
        return { p: Math.min(P_MAX, P_MIN + pull * 0.0075), w: Math.max(-YAW_MAX, Math.min(YAW_MAX, -side * 0.0016)) };
      }
      return { p: power, w: yaw };
    };
    function throwBall(p: number, w: number, A: Api) {
      Object.assign(ball, velFor(p, w));
      phase = "fly"; endT = 0; ballsLeft--;
      A.sfx("swipe");
    }
    const liveCups = () => cups.filter((c) => c.alive);
    function sink(A: Api, c: Cup, rattle: boolean) {
      c.alive = false; sunk++; streak++; phase = "done"; endT = 0;
      const fire = streak >= 3, base = 100 + (ball.bounced ? 100 : 0) + (ball.rimmed || rattle ? 0 : 25);
      const pts = (base + 25 * (streak - 1)) * (fire ? 2 : 1);
      A.addScore(pts); A.sfx("coin");
      const p = proj(c.x, CUP_H, c.z);
      A.particles.burst(p.x, p.y, c.crater.liquid, 20, 180, 4);
      const label = ball.bounced ? "Bounce shot! " : rattle ? "Rattled in! " : !ball.rimmed ? "Swish! " : "Sunk! ";
      A.float(label + "+" + pts, p.x, p.y - 26, fire ? "#FF8A3D" : "#7CFFB2");
      if (streak % BONUS_BALL_AT === 0) { ballsLeft++; A.toast("🔥 On fire! +1 meteorite, and hits score double", 2200); }
      msg = `☄️ ${c.crater.name}: ${c.crater.tip}`; msgT = 4;
      if (sunk === 10) { A.addScore(ballsLeft * 50); A.win("All 10 craters hit!"); }
    }
    function miss(A: Api) {
      phase = "done"; endT = 0; streak = 0;
      A.sfx("hit");
      const p = proj(Math.max(-TW, Math.min(TW, ball.x)), Math.max(0, ball.y), Math.min(TL, Math.max(0.3, ball.z)));
      A.float("Miss!", Math.max(40, Math.min(W - 40, p.x)), Math.max(200, Math.min(H - 60, p.y)), "#FF8FA3");
    }
    function maybeRerack() {
      const n = liveCups().length;
      if ((n === 6 || n === 3) && !rerackedAt[n]) { rerackedAt[n] = true; cups = rack(n, liveCups().map((c) => c.crater)); return true; }
      return false;
    }
    function stepBall(h: number, A: Api) {
      const prevY = ball.y;
      ball.vy -= G * h; ball.x += ball.vx * h; ball.y += ball.vy * h; ball.z += ball.vz * h;
      const live = liveCups();
      if (prevY >= CUP_H && ball.y < CUP_H && ball.vy < 0) {
        for (const c of live) {
          const d = Math.hypot(ball.x - c.x, ball.z - c.z);
          if (d < CUP_R - BR * 0.4) { sink(A, c, false); return; }
          if (d < CUP_R + BR) {
            if (d < CUP_R && !ball.rimmed && Math.random() < 0.45) { sink(A, c, true); return; }
            const nx = (ball.x - c.x) / (d || 1), nz = (ball.z - c.z) / (d || 1);
            ball.y = CUP_H + 0.001; ball.vy = Math.abs(ball.vy) * 0.3 + 0.5; ball.vx = ball.vx * 0.4 + nx * 0.7; ball.vz = ball.vz * 0.4 + nz * 0.7;
            ball.rimmed = true; A.sfx("click");
            return;
          }
        }
      }
      if (ball.y < CUP_H && ball.y > 0)
        for (const c of live) {
          const dx = ball.x - c.x, dz = ball.z - c.z, d = Math.hypot(dx, dz), m = CUP_R + BR;
          if (d < m && d > 0) {
            const nx = dx / d, nz = dz / d;
            ball.x = c.x + nx * m; ball.z = c.z + nz * m;
            const vn = ball.vx * nx + ball.vz * nz;
            if (vn < 0) { ball.vx -= 1.4 * vn * nx; ball.vz -= 1.4 * vn * nz; }
            ball.rimmed = true;
          }
        }
      const onTable = Math.abs(ball.x) <= TW && ball.z >= 0 && ball.z <= TL;
      if (onTable && ball.y < BR && ball.vy < 0) {
        ball.y = BR; ball.vy = -ball.vy * 0.62; ball.vx *= 0.9; ball.vz *= 0.9; ball.bounces++; ball.bounced = true;
        if (ball.vy > 0.5) A.sfx("point");
      }
    }
    function drawCup(ctx: CanvasRenderingContext2D, c: Cup) {
      const top = proj(c.x, CUP_H, c.z), bot = proj(c.x, 0, c.z);
      const rT = CUP_R * top.s, rB = CUP_R * 0.72 * bot.s, ey = rT * 0.32;
      if (!c.alive) {
        if (c.pop > 0.5) return;
        ctx.globalAlpha = 1 - c.pop * 2;
        ctx.save(); ctx.translate(bot.x, bot.y); ctx.rotate(c.pop * 3); ctx.translate(-bot.x, -bot.y);
      }
      ctx.fillStyle = "rgba(0,0,0,.3)";
      ctx.beginPath(); ctx.ellipse(bot.x, bot.y, rB * 1.15, rB * 0.35, 0, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(top.x - rT, top.y); ctx.lineTo(bot.x - rB, bot.y);
      ctx.ellipse(bot.x, bot.y, rB, rB * 0.3, 0, Math.PI, 0, true);
      ctx.lineTo(top.x + rT, top.y);
      ctx.closePath();
      const g = ctx.createLinearGradient(top.x - rT, 0, top.x + rT, 0);
      g.addColorStop(0, "#5a3a26"); g.addColorStop(0.35, "#b0825a"); g.addColorStop(0.55, "#8f6544"); g.addColorStop(1, "#3e2718");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = "rgba(255,220,170,.45)";
      ctx.fillRect(top.x - rT * 0.92, top.y + (bot.y - top.y) * 0.1, rT * 1.84, Math.max(1.5, (bot.y - top.y) * 0.06));
      ctx.beginPath(); ctx.ellipse(top.x, top.y, rT, ey, 0, 0, 7);
      ctx.fillStyle = "#d9b48a"; ctx.fill();
      ctx.beginPath(); ctx.ellipse(top.x, top.y + ey * 0.25, rT * 0.82, ey * 0.7, 0, 0, 7);
      ctx.fillStyle = c.crater.liquid; ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.beginPath(); ctx.ellipse(top.x - rT * 0.3, top.y + ey * 0.1, rT * 0.25, ey * 0.25, 0, 0, 7); ctx.fill();
      if (!c.alive) { ctx.restore(); ctx.globalAlpha = 1; }
    }
    function drawBall(ctx: CanvasRenderingContext2D) {
      const fire = streak >= 3 && phase !== "done";
      if (Math.abs(ball.x) <= TW && ball.z >= 0 && ball.z <= TL && ball.y > 0) {
        const sh = proj(ball.x, 0, ball.z), a = Math.max(0.08, 0.35 - ball.y * 0.25);
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.beginPath(); ctx.ellipse(sh.x, sh.y, BR * sh.s * 1.1, BR * sh.s * 0.4, 0, 0, 7); ctx.fill();
      }
      trail.forEach((p, i) => {
        ctx.fillStyle = fire ? `rgba(255,140,60,${(i / trail.length) * 0.5})` : `rgba(255,200,140,${(i / trail.length) * 0.3})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, (BR * p.s * i) / trail.length), 0, 7); ctx.fill();
      });
      const p = proj(ball.x, ball.y, ball.z), r = Math.max(4, BR * p.s * 1.15);
      const bg = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
      bg.addColorStop(0, fire ? "#ffd59a" : "#b9a596");
      bg.addColorStop(1, fire ? "#ff6a1d" : "#4e3f36");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
    }
    function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
      const words = text.split(" "), lines: string[] = [];
      let line = "";
      words.forEach((w) => { const s = line ? line + " " + w : w; if (ctx.measureText(s).width > maxW && line) { lines.push(line); line = w; } else line = s; });
      if (line) lines.push(line);
      return lines;
    }

    return {
      reset() {
        cups = rack(10, CRATERS.slice().sort(() => Math.random() - 0.5).slice(0, 10));
        power = 4.1; yaw = 0; drag = null; ptrTap = false; ballsLeft = BALLS; sunk = 0; streak = 0;
        msg = ""; msgT = 0; rerackedAt = {}; trail = [];
        nextBall();
      },
      input(type, A) {
        if (phase !== "aim") return;
        if (type === "tap") { if (ptrTap) { ptrTap = false; return; } throwBall(power, yaw, A); return; }
        if (type === "left") yaw = Math.max(-YAW_MAX, yaw - 0.008);
        if (type === "right") yaw = Math.min(YAW_MAX, yaw + 0.008);
        if (type === "up") power = Math.min(P_MAX, power + 0.025);
        if (type === "down") power = Math.max(P_MIN, power - 0.025);
        if (type === "left" || type === "right" || type === "up" || type === "down") drag = null;
      },
      pointer(type, x, y, A) {
        if (type === "down") { ptrTap = true; if (phase === "aim") drag = { sx: x, sy: y, x, y }; }
        else if (type === "drag" && drag) { drag.x = x; drag.y = y; }
        else if (type === "up" && drag) {
          const c = current(), pulled = drag.y - drag.sy > 14;
          drag = null;
          if (pulled && phase === "aim") { power = c.p; yaw = c.w; throwBall(c.p, c.w, A); }
        }
      },
      update(dt, A) {
        msgT = Math.max(0, msgT - dt);
        cups.forEach((c) => { if (!c.alive) c.pop += dt; });
        if (A.state !== "play") return;
        if (phase === "fly") {
          const steps = 6, h = Math.min(dt, 0.05) / steps;
          for (let s = 0; s < steps && phase === "fly"; s++) stepBall(h, A);
          if (phase === "fly") {
            trail.push(proj(ball.x, ball.y, ball.z));
            if (trail.length > 12) trail.shift();
            endT += dt;
            const rolling = ball.y <= BR + 0.002 && Math.abs(ball.vy) < 0.4;
            if (ball.y < -0.6 || ball.z > TL + 0.8 || endT > 3.5 || ball.bounces >= 3 || rolling) miss(A);
          }
        } else if (phase === "done") {
          endT += dt;
          if (endT > 1.0) {
            if (sunk === 10 || ballsLeft <= 0) { phase = "over"; A.gameOver(true); return; }
            if (maybeRerack()) A.toast(`Re-rack! ${liveCups().length} craters left`, 1600);
            nextBall();
          }
        }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#07061a"); g.addColorStop(0.53, "#1f1a3e"); g.addColorStop(0.54, "#3a2c22"); g.addColorStop(1, "#1a120d");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255,.55)";
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 61) % Math.round(H * 0.5), (i % 3) * 0.6 + 0.8, (i % 3) * 0.6 + 0.8);
        const c0 = proj(-TW, 0, 0), c1 = proj(TW, 0, 0), c2 = proj(TW, 0, TL), c3 = proj(-TW, 0, TL);
        ctx.fillStyle = "#2a1d14";
        ctx.fillRect(c3.x + 6, c3.y, 6, 60);
        ctx.fillRect(c2.x - 12, c2.y, 6, 60);
        const poly = (pts: { x: number; y: number }[]) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
        poly([c0, c1, { x: c1.x, y: c1.y + 14 }, { x: c0.x, y: c0.y + 14 }]);
        ctx.fillStyle = "#4a3424"; ctx.fill();
        poly([c0, c1, c2, c3]);
        const tg = ctx.createLinearGradient(0, c3.y, 0, c0.y);
        tg.addColorStop(0, "#6b5442"); tg.addColorStop(1, "#a08068");
        ctx.fillStyle = tg; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = "#e8d2b0"; ctx.stroke();
        const m0 = proj(0, 0, 0), m1 = proj(0, 0, TL);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();
        const items: { z: number; c?: Cup; ball?: boolean }[] = cups.map((c) => ({ z: c.z, c }));
        if (phase !== "done") items.push({ z: ball.z - CUP_R, ball: true });
        items.sort((a, b) => b.z - a.z).forEach((it) => (it.ball ? drawBall(ctx) : drawCup(ctx, it.c!)));
        if (phase === "aim" && A.state === "play") {
          const c = current(), v = velFor(c.p, c.w);
          ctx.fillStyle = "rgba(255,255,255,.85)";
          for (let i = 1; i <= 8; i++) {
            const tt = i * 0.035, p = proj(START.x + v.vx * tt, START.y + v.vy * tt - 0.5 * G * tt * tt, START.z + v.vz * tt);
            ctx.beginPath(); ctx.arc(p.x, p.y, 4 - i * 0.3, 0, 7); ctx.fill();
          }
          const f = (c.p - P_MIN) / (P_MAX - P_MIN);
          A.rr(W - 30, 360, 16, 160, 8);
          ctx.fillStyle = "rgba(7,12,30,.75)"; ctx.fill();
          const mh = 156 * f;
          A.rr(W - 28, 518 - mh, 12, mh, 6);
          ctx.fillStyle = f > 0.75 ? "#FF8A3D" : f > 0.4 ? "#FFD166" : "#00E5A0"; ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = A.font(11, 700); ctx.textAlign = "center"; ctx.fillText("PWR", W - 22, 536);
          if (drag) {
            ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(drag.sx, drag.sy); ctx.lineTo(drag.x, drag.y); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        A.drawHero(64, H - 54, 96, 0, phase === "done" && !streak ? "hurt" : "happy");
        ctx.font = A.font(15, 700);
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(`Craters left ${liveCups().length}  ·  Meteorites ${ballsLeft}${streak >= 3 ? "  ·  🔥 x2" : ""}`, W / 2, 100);
        if (msgT > 0) {
          ctx.font = A.font(14, 600);
          const lines = wrap(ctx, msg, W - 64), hh = lines.length * 20 + 18;
          ctx.globalAlpha = Math.min(1, msgT * 2);
          A.rr(16, 116, W - 32, hh, 14);
          ctx.fillStyle = "rgba(6,14,32,.93)"; ctx.fill();
          ctx.fillStyle = "#fff"; ctx.textAlign = "left";
          lines.forEach((l, i) => ctx.fillText(l, 32, 140 + i * 20));
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
