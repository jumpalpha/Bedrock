import type { Api, GameModule } from "./engine/types";
import { GOOD } from "./engine/earth-art";

const W = 900, H = 480;
const GRAVITY = 0.42, WHEEL_R = 13, WHEELBASE = 50, CHASSIS_H = 24, THROTTLE = 0.36, BRAKE_F = 0.26, LEAN_F = 0.09, FRICTION = 0.89, AIR_DRAG = 0.998, BOUNCE = 0.13, MAX_SPD = 12;
type Pt = [number, number];
const TRACKS: { name: string; raw: Pt[]; finish: number; cps: number[]; gems: Pt[] }[] = [
  { name: "Boise Foothills", raw: [[0,355],[160,352],[210,332],[270,295],[325,318],[390,358],[530,368],[590,322],[645,258],[690,225],[740,215],[800,375],[870,378],[940,370],[1000,388],[1060,398],[1120,372],[1190,360],[1250,338],[1310,308],[1370,282],[1420,278],[1475,288],[1530,325],[1595,372],[1660,392],[1720,396],[1780,368],[1840,338],[1900,298],[1960,278],[2010,270],[2060,288],[2120,325],[2180,355],[2240,366],[2400,364],[2700,364]],
    finish: 2480, cps: [1180, 1880], gems: [[300, 60], [470, 40], [700, 120], [760, 140], [1000, 40], [1300, 50], [1450, 40], [1700, 40], [1980, 70], [2300, 40]] },
  { name: "Palouse Hills", raw: [[0,360],[200,360],[300,330],[380,280],[440,250],[500,262],[560,330],[640,380],[720,390],[800,350],[880,280],[940,230],[990,210],[1060,265],[1140,340],[1220,385],[1300,392],[1380,340],[1440,270],[1500,240],[1560,245],[1620,300],[1700,370],[1780,395],[1860,360],[1940,300],[2000,250],[2050,215],[2100,208],[2170,262],[2250,330],[2320,375],[2420,365],[2520,320],[2600,300],[2680,320],[2760,360],[2900,362],[3200,362]],
    finish: 2960, cps: [1220, 2240], gems: [[420, 60], [660, 40], [960, 80], [1060, 150], [1160, 40], [1480, 60], [1740, 40], [2080, 80], [2200, 150], [2560, 50], [2800, 40]] },
  { name: "Craters of the Moon", raw: [[0,370],[180,370],[260,330],[330,260],[380,215],[420,200],[470,240],[540,330],[620,380],[700,350],[760,290],[810,230],[850,190],[880,180],[960,330],[1020,410],[1100,420],[1180,380],[1240,320],[1300,250],[1350,205],[1400,190],[1460,250],[1520,340],[1600,400],[1700,405],[1780,360],[1840,300],[1900,240],[1950,200],[2000,185],[2060,240],[2140,350],[2220,400],[2300,390],[2380,330],[2440,260],[2500,215],[2540,205],[2620,330],[2700,390],[2800,385],[3000,380],[3300,380]],
    finish: 3050, cps: [1100, 2220], gems: [[400, 70], [600, 40], [870, 90], [980, 160], [1380, 70], [1650, 40], [1980, 80], [2100, 150], [2520, 80], [2700, 40], [2900, 40]] },
];
const HAZARDS = [[], [{ x: 1150, kind: "boulder" }, { x: 2300, kind: "lava-bomb" }], [{ x: 640, kind: "boulder" }, { x: 1650, kind: "lava-bomb" }, { x: 2760, kind: "boulder" }]];
const TIPS = ["The Palouse hills are made of loess, fine dust blown in by the wind.", "Craters of the Moon's lava fields came from cracks called the Great Rift.", "The Boise foothills are made of granite and old lake sediments."];
const cmr = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

export const spriteRider: GameModule = {
  config: {
    key: "bedrock_sprite_rider",
    title: "Sprite Rider",
    subtitle: "Ride Idaho's hills, ramps and lava fields!",
    W, H,
    winText: "You finished the Boise Foothills!",
    deathDelay: 900,
    overTitle: "Wipeout!",
    accent: "#FF8C00",
    medals: [
      { at: 2500, name: "Bronze", icon: "🥉" },
      { at: 5000, name: "Silver", icon: "🥈" },
      { at: 8500, name: "Gold", icon: "🥇" },
      { at: 12000, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>→</b> gas, <b>←</b> brake, <b>↑ ↓</b> lean back / forward. Grab gems, land flips for +300, and reach the 🏁. <b>Finish track 1</b> to win!",
    controls: "Arrow keys or WASD · on-screen buttons on phones · P pause",
    pad: [
      { label: "◀", type: "left" },
      { label: "⟲", type: "up" },
      { label: "⟳", type: "down" },
      { label: "▶ GAS", type: "right", wide: true },
    ],
    sprites: [...GOOD, "boulder", "lava-bomb", "heart"],
    facts: [
      "The Palouse in north Idaho is built from loess: wind-blown silt piled up into rolling dunes.",
      "Loess soil is some of the best farmland in the world.",
      "Craters of the Moon has lava tubes, cinder cones and spatter cones you can hike.",
      "Steep hillsides are where landslides and soil creep happen most.",
      "Plant roots hold hillside soil in place and slow erosion.",
    ],
  },
  create() {
    type Wheel = { x: number; y: number; vx: number; vy: number };
    type Hz = { x: number; y: number; kind: string; vx: number; vy: number; rot: number; dead?: boolean };
    let tr = TRACKS[0], terrain: Pt[] = [], rw: Wheel = { x: 0, y: 0, vx: 0, vy: 0 }, fw: Wheel = { x: 0, y: 0, vx: 0, vy: 0 };
    let camX = 0, totalRot = 0, lastAngle = 0, airborne = false, keys: Record<string, boolean> = {}, level = 0, lives = 3, cp = 80;
    let gems: { x: number; y: number; h: number; got: boolean; kind: string }[] = [], hazards: Hz[] = [];
    let crashT = 0, startT = 0, finishedT = 0, wheelSpin = 0, msgs: { text: string; color: string; t: number }[] = [], acc = 0;

    function buildTerrain(raw: Pt[]) {
      const T: Pt[] = [];
      for (let i = 0; i < raw.length - 1; i++) {
        const a = raw[Math.max(0, i - 1)], b = raw[i], c = raw[Math.min(raw.length - 1, i + 1)], d = raw[Math.min(raw.length - 1, i + 2)];
        for (let s = 0; s < 18; s++) { const t = s / 18; T.push([cmr(a[0], b[0], c[0], d[0], t), cmr(a[1], b[1], c[1], d[1], t)]); }
      }
      T.push(raw[raw.length - 1]);
      return T;
    }
    function gy(x: number) {
      if (x <= terrain[0][0]) return terrain[0][1];
      const last = terrain[terrain.length - 1];
      if (x >= last[0]) return last[1];
      let lo = 0, hi = terrain.length - 1;
      while (lo < hi - 1) { const m = (lo + hi) >> 1; if (terrain[m][0] <= x) lo = m; else hi = m; }
      const [x0, y0] = terrain[lo], [x1, y1] = terrain[hi];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    function placeBike(x: number) {
      rw = { x, y: gy(x) - WHEEL_R, vx: 0, vy: 0 };
      fw = { x: x + WHEELBASE, y: gy(x + WHEELBASE) - WHEEL_R, vx: 0, vy: 0 };
      totalRot = 0; lastAngle = Math.atan2(fw.y - rw.y, fw.x - rw.x); airborne = false; camX = Math.max(0, x - W * 0.3);
    }
    function loadTrack(n: number) {
      tr = TRACKS[n % TRACKS.length];
      terrain = buildTerrain(tr.raw);
      cp = 80;
      gems = tr.gems.map(([x, h], i) => ({ x, y: 0, h, got: false, kind: GOOD[i % GOOD.length] }));
      gems.forEach((f) => (f.y = gy(f.x) - f.h - 20));
      hazards = (HAZARDS[n % HAZARDS.length] || []).map((h) => ({ ...h, y: gy(h.x) - 18, vx: -1.2, vy: 0, rot: 0 }));
      placeBike(80);
      startT = 0; finishedT = 0; crashT = 0;
    }
    const say = (text: string, color = "#FFD166") => msgs.push({ text, color, t: 0 });
    const mid = () => ({ x: (rw.x + fw.x) / 2, y: (rw.y + fw.y) / 2 });
    function crash(A: Api) {
      if (crashT > 0) return;
      crashT = 1.6; lives--;
      A.sfx("hit"); A.shake(10, 0.35);
      const m = mid();
      A.particles.burst(m.x - camX, m.y, "#FFD23F", 24, 260, 5);
      if (lives <= 0) { A.gameOver(); return; }
      say(`${lives} ${lives === 1 ? "life" : "lives"} left`, "#FF8FA3");
    }
    function finish(A: Api) {
      finishedT = 0.01;
      const bonus = Math.max(0, Math.round(2000 - startT * 40));
      A.addScore(1000 + bonus); A.sfx("win");
      say(`${tr.name} complete! +${1000 + bonus}`);
      A.particles.burst(W / 2, 200, "#FFD166", 40, 320, 5);
      if (level === 0) A.win("You finished Green Valley!");
    }
    function step(A: Api) {
      rw.vy += GRAVITY; fw.vy += GRAVITY;
      const dx = fw.x - rw.x, dy = fw.y - rw.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, upX = uy, upY = -ux;
      const rwGnd = rw.y + WHEEL_R >= gy(rw.x) - 0.5, fwGnd = fw.y + WHEEL_R >= gy(fw.x) - 0.5;
      if (keys.right) { const f = rwGnd ? THROTTLE : THROTTLE * 0.08; rw.vx += ux * f; rw.vy += uy * f; }
      if (keys.left) { rw.vx -= ux * BRAKE_F; rw.vy -= uy * BRAKE_F; }
      const sp = Math.hypot(rw.vx, rw.vy);
      if (sp > MAX_SPD) { rw.vx *= MAX_SPD / sp; rw.vy *= MAX_SPD / sp; }
      const lean = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      if (lean) {
        const k = LEAN_F * (rwGnd && fwGnd ? 0.7 : 1);
        fw.vx += lean * k * upX; fw.vy += lean * k * upY; rw.vx -= lean * k * upX; rw.vy -= lean * k * upY;
      }
      rw.x += rw.vx; rw.y += rw.vy; fw.x += fw.vx; fw.y += fw.vy;
      for (let i = 0; i < 5; i++) {
        const cx = fw.x - rw.x, cy = fw.y - rw.y, cd = Math.hypot(cx, cy) || 1, corr = ((cd - WHEELBASE) / cd) * 0.5;
        rw.x += cx * corr; rw.y += cy * corr; fw.x -= cx * corr; fw.y -= cy * corr;
      }
      let grounded = 0;
      for (const w of [rw, fw]) {
        const g = gy(w.x);
        if (w.y + WHEEL_R > g) { w.y = g - WHEEL_R; if (w.vy > 0) w.vy *= -BOUNCE; w.vx *= FRICTION; grounded++; }
        else { w.vx *= AIR_DRAG; w.vy *= AIR_DRAG; }
      }
      if (rw.x < 20) { rw.x = 20; rw.vx = Math.max(0, rw.vx); }
      const dx2 = fw.x - rw.x, dy2 = fw.y - rw.y, l2 = Math.hypot(dx2, dy2) || 1, uX = dy2 / l2, uY = -dx2 / l2, m = mid();
      const riderX = m.x + uX * CHASSIS_H, riderY = m.y + uY * CHASSIS_H, headX = m.x + uX * (CHASSIS_H + 18), headY = m.y + uY * (CHASSIS_H + 18);
      if (headY + 8 > gy(headX) || riderY + 6 > gy(riderX) || rw.y > H + 200) { crash(A); return; }
      const ang = Math.atan2(fw.y - rw.y, fw.x - rw.x);
      let dA = ang - lastAngle;
      while (dA > Math.PI) dA -= 2 * Math.PI;
      while (dA < -Math.PI) dA += 2 * Math.PI;
      lastAngle = ang;
      if (!grounded) { airborne = true; totalRot += dA; }
      else if (airborne) {
        const flips = Math.floor(Math.abs(totalRot) / (2 * Math.PI) + 0.15);
        if (flips > 0) { A.addScore(300 * flips); A.sfx("medal"); say(`${flips > 1 ? flips + "x " : ""}${totalRot < 0 ? "BACKFLIP" : "FRONTFLIP"}! +${300 * flips}`, "#7CFFB2"); }
        airborne = false; totalRot = 0;
      }
      wheelSpin += rw.vx * 0.08;
      gems.forEach((f) => {
        if (!f.got && Math.hypot(riderX - f.x, riderY - f.y) < 32) {
          f.got = true; A.addScore(50); A.sfx("coin");
          A.particles.burst(f.x - camX, f.y, "#7CFFB2", 12, 160, 4);
        }
      });
      hazards.forEach((h) => {
        if (h.dead) return;
        h.vy += GRAVITY * 0.75; h.x += h.vx; h.y += h.vy; h.rot += h.vx * 0.05;
        const g = gy(h.x);
        if (h.y + 18 > g) { h.y = g - 18; h.vy *= -0.4; const slope = (gy(h.x + 4) - gy(h.x - 4)) / 8; h.vx = h.vx * 0.99 + slope * 0.18; }
        if (Math.hypot(rw.x - h.x, rw.y - h.y) < WHEEL_R + 18 || Math.hypot(fw.x - h.x, fw.y - h.y) < WHEEL_R + 18 || Math.hypot(riderX - h.x, riderY - h.y) < 28) {
          h.dead = true; rw.vx *= 0.5; fw.vx *= 0.5;
          A.addScore(-Math.min(A.score, 100)); A.sfx("hit"); A.shake(5, 0.15);
          say("Rockfall! −100", "#FF8FA3");
          A.particles.burst(h.x - camX, h.y, "#FF8FC7", 18, 200, 4);
        }
      });
      tr.cps.forEach((c) => { if (m.x > c && cp < c) { cp = c; A.sfx("point"); say("Checkpoint!", "#4CC4FF"); } });
      if (rw.x > tr.finish && !finishedT) finish(A);
    }
    function flag(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, finishFlag: boolean) {
      if (x < -40 || x > W + 40) return;
      ctx.fillStyle = "#5a3d2a";
      ctx.fillRect(x - 2, y - 70, 4, 70);
      if (finishFlag) {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? "#1A1030" : "#fff"; ctx.fillRect(x + 2 + i * 9, y - 70 + j * 9, 9, 9); }
      } else {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(x + 2, y - 70); ctx.lineTo(x + 30, y - 60); ctx.lineTo(x + 2, y - 50); ctx.closePath(); ctx.fill();
      }
    }
    function drawBike(ctx: CanvasRenderingContext2D, A: Api) {
      const r = { x: rw.x - camX, y: rw.y }, f = { x: fw.x - camX, y: fw.y };
      const ang = Math.atan2(f.y - r.y, f.x - r.x), m = { x: (r.x + f.x) / 2, y: (r.y + f.y) / 2 };
      [r, f].forEach((w) => {
        const tg = ctx.createRadialGradient(w.x - 3, w.y - 3, 2, w.x, w.y, WHEEL_R);
        tg.addColorStop(0, "#4a4466"); tg.addColorStop(0.7, "#1c1830"); tg.addColorStop(1, "#0a0816");
        ctx.fillStyle = tg;
        ctx.beginPath(); ctx.arc(w.x, w.y, WHEEL_R, 0, 7); ctx.fill();
        ctx.strokeStyle = "#c9c4e8"; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const a = wheelSpin + (i * Math.PI) / 3;
          ctx.beginPath(); ctx.moveTo(w.x - Math.cos(a) * 8, w.y - Math.sin(a) * 8); ctx.lineTo(w.x + Math.cos(a) * 8, w.y + Math.sin(a) * 8); ctx.stroke();
        }
        ctx.fillStyle = "#FFD166"; ctx.beginPath(); ctx.arc(w.x, w.y, 3, 0, 7); ctx.fill();
      });
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(ang);
      const fg = ctx.createLinearGradient(0, -16, 0, 0);
      fg.addColorStop(0, "#ff8fa3"); fg.addColorStop(1, "#c41f45");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-25, 0); ctx.lineTo(-6, -16); ctx.lineTo(16, -16); ctx.lineTo(25, 0); ctx.lineTo(8, -4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#1a1030"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(18, -16); ctx.lineTo(22, -26); ctx.lineTo(28, -27); ctx.stroke();
      ctx.fillStyle = "#1a1030"; A.rr(-14, -22, 20, 7, 3); ctx.fill();
      A.drawHero(-2, -38, 52, 0, crashT > 0 ? "hurt" : "happy");
      ctx.restore();
    }

    return {
      reset() { level = 0; lives = 3; keys = {}; wheelSpin = 0; msgs = []; acc = 0; loadTrack(0); },
      input(type) {
        if (type.startsWith("release-")) keys[type.slice(8)] = false;
        else keys[type] = true;
      },
      update(dt, A) {
        msgs.forEach((m) => (m.t += dt));
        msgs = msgs.filter((m) => m.t < 1.8);
        if (A.state !== "play") return;
        if (finishedT) {
          finishedT += dt;
          if (finishedT > 2.4) {
            level++;
            if (level >= TRACKS.length) { A.gameOver(true); return; }
            A.toast("💡 " + TIPS[level % TIPS.length], 2600);
            loadTrack(level);
            say(`Track ${level + 1}: ${tr.name}`);
          }
          return;
        }
        if (crashT > 0) { crashT -= dt; if (crashT <= 0 && A.state === "play") placeBike(cp); return; }
        startT += dt;
        acc += dt;
        let n = 0;
        while (acc >= 1 / 60 && n < 4) {
          step(A);
          acc -= 1 / 60;
          n++;
          if (crashT > 0 || finishedT || A.state !== "play") { acc = 0; break; }
        }
        camX += (mid().x - W * 0.3 - camX) * Math.min(1, dt * 5);
        if (camX < 0) camX = 0;
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#ff8a7a"); g.addColorStop(0.55, "#ffc98a"); g.addColorStop(1, "#ffe6b0");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const sun = ctx.createRadialGradient(760, 90, 6, 760, 90, 130);
        sun.addColorStop(0, "rgba(255,250,210,.95)"); sun.addColorStop(0.3, "rgba(255,230,140,.5)"); sun.addColorStop(1, "rgba(255,230,140,0)");
        ctx.fillStyle = sun;
        ctx.fillRect(600, 0, 300, 260);
        ([[0.15, "#8a7a9a", "#5a4a6a", 230, 90], [0.35, "#6a7a6a", "#3a4a3a", 280, 60]] as const).forEach(([p, c1, c2, base, amp]) => {
          const mg = ctx.createLinearGradient(0, base - amp, 0, H);
          mg.addColorStop(0, c1); mg.addColorStop(1, c2);
          ctx.fillStyle = mg;
          ctx.beginPath(); ctx.moveTo(0, H);
          for (let x = 0; x <= W; x += 12) { const wx = x + camX * p; ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(wx * 0.006) * Math.cos(wx * 0.0023))); }
          ctx.lineTo(W, H); ctx.fill();
        });
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 6) ctx.lineTo(x, gy(x + camX));
        ctx.lineTo(W, H); ctx.closePath();
        const dg = ctx.createLinearGradient(0, 200, 0, H);
        dg.addColorStop(0, "#c9894e"); dg.addColorStop(1, "#7a4a22");
        ctx.fillStyle = dg; ctx.fill();
        ctx.strokeStyle = "#8a9a5a"; ctx.lineWidth = 10;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) { const y = gy(x + camX) + 4; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
        ctx.strokeStyle = "#c8d89a"; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) { const y = gy(x + camX); if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke();
        tr.cps.forEach((c) => flag(ctx, c - camX, gy(c), cp >= c ? "#4CC4FF" : "#c9c4e8", false));
        flag(ctx, tr.finish - camX, gy(tr.finish), "#fff", true);
        gems.forEach((f) => { if (!f.got) { const x = f.x - camX; if (x > -30 && x < W + 30) A.drawSprite(f.kind, x, f.y + Math.sin(startT * 3 + f.x) * 3, 34); } });
        hazards.forEach((h) => { if (!h.dead) { const x = h.x - camX; if (x > -40 && x < W + 40) A.drawSprite(h.kind, x, h.y, 44, h.rot); } });
        if (!(crashT > 0 && Math.floor(crashT * 10) % 2)) drawBike(ctx, A);
        const prog = Math.min(1, Math.max(0, mid().x / tr.finish));
        A.rr(W / 2 - 160, 66, 320, 12, 6); ctx.fillStyle = "rgba(7,7,26,.6)"; ctx.fill();
        A.rr(W / 2 - 160, 66, Math.max(12, 320 * prog), 12, 6); ctx.fillStyle = "#7CFFB2"; ctx.fill();
        ctx.font = A.font(14, 700); ctx.textAlign = "left"; ctx.fillStyle = "#2a1530";
        ctx.fillText(`Track ${level + 1}/3 · ${tr.name}`, 62, 30);
        for (let i = 0; i < Math.max(0, lives); i++) A.drawSprite("heart", 72 + i * 22, 46, 20);
        ctx.textAlign = "right"; ctx.fillText(startT.toFixed(1) + " s", W - 62, 30);
        ctx.textAlign = "center";
        msgs.forEach((m, i) => {
          ctx.globalAlpha = Math.min(1, (1.8 - m.t) * 2);
          ctx.font = A.font(30); ctx.lineWidth = 6; ctx.strokeStyle = "rgba(7,7,26,.85)";
          const y = 150 + i * 38 - m.t * 10;
          ctx.strokeText(m.text, W / 2, y); ctx.fillStyle = m.color; ctx.fillText(m.text, W / 2, y);
          ctx.globalAlpha = 1;
        });
        if (A.state === "play" && startT < 4 && level === 0) {
          ctx.font = A.font(15, 600); ctx.fillStyle = "#2a1530"; ctx.globalAlpha = 0.85;
          ctx.fillText("→ gas · ← brake · ↑ lean back · ↓ lean forward · land on both wheels!", W / 2, 110);
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
