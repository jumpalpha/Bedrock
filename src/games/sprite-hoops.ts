import type { Api, GameModule } from "./engine/types";

const W = 420, H = 640, FLOOR = 596, BR = 16, G = 900, SHOTS = 10, NEED = 7;
const HOME = { x: 104, y: 528 };
const SAMPLES = [
  { name: "Granite", tip: "Granite cooled slowly deep underground, so its crystals grew big enough to see. Idaho Batholith granite is all over central Idaho." },
  { name: "Basalt", tip: "Basalt is dark lava rock that cooled fast at the surface. The Snake River Plain is paved with it." },
  { name: "Obsidian", tip: "Obsidian is volcanic glass. It cooled so fast that no crystals had time to form." },
  { name: "Pumice", tip: "Pumice is so full of gas bubbles that it can float on water." },
  { name: "Sandstone", tip: "Sandstone is sand grains cemented together. Feel it and it's gritty like sandpaper." },
  { name: "Shale", tip: "Shale forms from mud and clay in quiet water. It's the most common sedimentary rock." },
  { name: "Limestone", tip: "Limestone is mostly calcite, often from shells. It fizzes in weak acid." },
  { name: "Marble", tip: "Marble is limestone that was changed by heat and pressure into a metamorphic rock." },
  { name: "Slate", tip: "Slate is metamorphosed shale. It splits into flat sheets, which is why it was used for chalkboards." },
  { name: "Gneiss", tip: "Gneiss (say \"nice\") has light and dark bands made by intense heat and pressure." },
  { name: "Quartz", tip: "Quartz is a 7 on the Mohs scale. It scratches glass." },
  { name: "Star Garnet", tip: "Idaho's state gem, the star garnet, shows a 4- or 6-ray star of light." },
  { name: "Conglomerate", tip: "Conglomerate is made of rounded pebbles cemented together, a sign of fast-moving water." },
  { name: "Coal", tip: "Coal formed from swamp plants buried and squeezed for millions of years." },
  { name: "Rhyolite", tip: "Rhyolite is light-colored, sticky lava rock. Its eruptions are often explosive." },
  { name: "Schist", tip: "Schist sparkles because its flat mica crystals line up under pressure." },
]

export const spriteHoops: GameModule = {
  config: {
    key: "bedrock_sprite_hoops",
    title: "Sprite Hoops",
    subtitle: "Toss rock samples in the bucket!",
    W, H,
    winText: "You bagged 7 rock samples!",
    deathDelay: 600,
    overTitle: "Field Day Over!",
    accent: "#FF8C00",
    medals: [
      { at: 300, name: "Bronze", icon: "🥉" },
      { at: 700, name: "Silver", icon: "🥈" },
      { at: 1100, name: "Gold", icon: "🥇" },
      { at: 1600, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Pull back</b> anywhere and let go to toss each rock sample into the sample bucket. No rim = <b>Swish +50</b>. Dunks in a row earn a streak bonus. 10 shots — <b>dunk 7</b> to win. The bucket starts moving later!",
    controls: "Drag back & release · or ← → aim, ↑ ↓ power, Space shoot · P pause",
    sprites: ["geode"],
    facts: [
      "Geologists label every rock sample with where it was found, so others can check their work.",
      "The three rock types are igneous, sedimentary and metamorphic.",
      "The rock cycle shows how any rock can become any other rock over time.",
      "A streak test rubs a mineral on tile to see the color of its powder.",
      "Idaho has rocks more than 2.5 billion years old.",
    ],
  },
  create() {
    const results: boolean[] = [];
    let shot = 0, made = 0, streak = 0, t = 0, msg = "", msgT = 0, endT = 0, touched = false, ptrTap = false, spin = 0;
    let pool = SAMPLES.slice(0, SHOTS), phase: "aim" | "fly" | "done" | "over" = "aim";
    let ball = { x: HOME.x, y: HOME.y, vx: 0, vy: 0 };
    let bin = { x0: 300, y: 380, amp: 0, spd: 1, ph: 0, x: 300, half: 36 };
    let drag: { sx: number; sy: number; x: number; y: number } | null = null, aim = { a: -0.95, p: 640 };
    let trail: { x: number; y: number }[] = [];

    function newBin(i: number) {
      const hard = i >= 7, med = i >= 3;
      return { x0: 250 + Math.random() * 90, y: 300 + Math.random() * 150, amp: hard ? 70 : med ? 40 : 0, spd: hard ? 1.6 : 1.1, ph: Math.random() * 6, x: 0, half: 36 };
    }
    function nextShot(first = false) {
      if (!first) shot++;
      ball = { x: HOME.x, y: HOME.y, vx: 0, vy: 0 };
      phase = "aim"; touched = false; endT = 0; trail = [];
      bin = newBin(shot);
      bin.x = bin.x0;
    }
    function launch(vx: number, vy: number, A: Api) {
      const sp = Math.hypot(vx, vy), k = sp > 980 ? 980 / sp : 1;
      ball.vx = vx * k; ball.vy = vy * k; phase = "fly"; endT = 0;
      A.sfx("swipe");
    }
    const curVel = () => (drag ? { vx: (drag.sx - drag.x) * 4.4, vy: (drag.sy - drag.y) * 4.4 } : { vx: Math.cos(aim.a) * aim.p, vy: Math.sin(aim.a) * aim.p });
    function hitPoint(px: number, py: number, pr: number, bounce: number, A: Api) {
      const dx = ball.x - px, dy = ball.y - py, d = Math.hypot(dx, dy), m = BR + pr;
      if (d >= m || d === 0) return false;
      const nx = dx / d, ny = dy / d;
      ball.x = px + nx * m; ball.y = py + ny * m;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= (1 + bounce) * vn * nx;
        ball.vy -= (1 + bounce) * vn * ny;
        if (Math.abs(vn) > 120) A.sfx("click");
      }
      touched = true;
      return true;
    }
    function hitSeg(x1: number, y1: number, x2: number, y2: number, A: Api) {
      const lx = x2 - x1, ly = y2 - y1, L2 = lx * lx + ly * ly;
      const u = Math.max(0, Math.min(1, ((ball.x - x1) * lx + (ball.y - y1) * ly) / L2));
      return hitPoint(x1 + lx * u, y1 + ly * u, 3, 0.45, A);
    }
    function finish(A: Api, dunk: boolean) {
      phase = "done"; endT = 0; results[shot] = dunk;
      const h = pool[shot];
      if (dunk) {
        made++; streak++;
        const swish = !touched, pts = 100 + (swish ? 50 : 0) + 25 * (streak - 1);
        A.addScore(pts); A.sfx("coin");
        A.particles.burst(bin.x, bin.y, "#7CFFB2", 24, 220, 4);
        A.float(`${swish ? "Swish!" : "Dunk!"} +${pts}`, bin.x, bin.y - 30, swish ? "#FFD166" : "#7CFFB2");
        msg = `🪣 Bagged: ${h.name} — ${h.tip}`; msgT = 3.2;
        if (made === NEED) A.win(`You bagged ${NEED} rock samples!`);
      } else {
        streak = 0; A.sfx("hit");
        A.float("Miss!", ball.x < 0 ? 40 : ball.x > W ? W - 40 : ball.x, Math.min(FLOOR - 30, Math.max(200, ball.y)), "#FF8FA3");
        msg = `😬 ${h.name} rolled away. ${h.tip}`; msgT = 3.2;
      }
    }
    function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
      const words = text.split(" "), lines: string[] = [];
      let line = "";
      words.forEach((w) => { const s = line ? line + " " + w : w; if (ctx.measureText(s).width > maxW && line) { lines.push(line); line = w; } else line = s; });
      if (line) lines.push(line);
      return lines;
    }
    function drawBall(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number) {
      if (!A.drawSprite("geode", x, y, BR * 2.4, spin)) {
        ctx.fillStyle = "#FF6B3D";
        ctx.beginPath(); ctx.arc(x, y, BR, 0, 7); ctx.fill();
      }
    }

    return {
      reset() {
        results.length = 0; shot = 0; made = 0; streak = 0; t = 0; msg = ""; msgT = 0; trail = [];
        pool = SAMPLES.slice().sort(() => Math.random() - 0.5).slice(0, SHOTS);
        aim = { a: -0.95, p: 640 }; drag = null; ptrTap = false;
        nextShot(true);
      },
      input(type, A) {
        if (phase !== "aim") return;
        if (type === "tap") {
          if (ptrTap) { ptrTap = false; return; }
          launch(Math.cos(aim.a) * aim.p, Math.sin(aim.a) * aim.p, A);
          return;
        }
        if (type === "left") aim.a = Math.max(-1.45, aim.a - 0.06);
        if (type === "right") aim.a = Math.min(-0.15, aim.a + 0.06);
        if (type === "up") aim.p = Math.min(980, aim.p + 25);
        if (type === "down") aim.p = Math.max(300, aim.p - 25);
        if (type === "left" || type === "right" || type === "up" || type === "down") drag = null;
      },
      pointer(type, x, y, A) {
        if (type === "down") { ptrTap = true; if (phase === "aim") drag = { sx: x, sy: y, x, y }; }
        else if (type === "drag" && drag) { drag.x = x; drag.y = y; }
        else if (type === "up" && drag) {
          const dx = drag.sx - drag.x, dy = drag.sy - drag.y;
          drag = null;
          if (Math.hypot(dx, dy) > 18 && phase === "aim") launch(dx * 4.4, dy * 4.4, A);
        }
      },
      update(dt, A) {
        t += dt;
        msgT = Math.max(0, msgT - dt);
        if (bin.amp) bin.x = bin.x0 + Math.sin(t * bin.spd + bin.ph) * bin.amp;
        bin.x = Math.max(bin.half + 12, Math.min(W - bin.half - 12, bin.x));
        if (A.state !== "play") return;
        if (phase === "fly") {
          spin += (ball.vx / 160) * dt;
          const steps = 4, h = dt / steps;
          for (let s = 0; s < steps && phase === "fly"; s++) {
            ball.vy += G * h; ball.x += ball.vx * h; ball.y += ball.vy * h;
            const b = bin;
            hitPoint(b.x - b.half, b.y, 5, 0.55, A);
            hitPoint(b.x + b.half, b.y, 5, 0.55, A);
            hitSeg(b.x - b.half, b.y, b.x - b.half + 6, b.y + 92, A);
            hitSeg(b.x + b.half, b.y, b.x + b.half - 6, b.y + 92, A);
            if (Math.abs(ball.x - b.x) < b.half - 8 && ball.y > b.y + 14 && ball.y < b.y + 92 && ball.vy > 0) { finish(A, true); break; }
            if (ball.y + BR > b.y + 98 && ball.y < b.y + 112 && Math.abs(ball.x - b.x) < b.half + 22 && ball.vy > 0) { ball.y = b.y + 98 - BR; ball.vy *= -0.45; ball.vx *= 0.8; touched = true; }
            if (ball.y + BR > FLOOR) { ball.y = FLOOR - BR; ball.vy *= -0.5; ball.vx *= 0.75; }
            if (ball.x - BR < 0 && ball.vx < 0) { ball.x = BR; ball.vx *= -0.6; touched = true; }
          }
          if (phase === "fly") {
            trail.push({ x: ball.x, y: ball.y });
            if (trail.length > 14) trail.shift();
            endT += dt;
            const resting = ball.y > FLOOR - BR - 2 && Math.abs(ball.vy) < 60 && Math.abs(ball.vx) < 40;
            if (ball.x > W + 40 || endT > 4.5 || resting) finish(A, false);
          }
        } else if (phase === "done") {
          endT += dt;
          if (endT > 1.1) {
            if (shot + 1 >= SHOTS) { phase = "over"; A.gameOver(true); }
            else nextShot();
          }
        }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#1c2450");
        g.addColorStop(1, "#c46a4a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // canyon walls
        ctx.fillStyle = "#7a3a26";
        ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(0, 260); ctx.lineTo(60, 250); ctx.lineTo(80, 330); ctx.lineTo(140, 340); ctx.lineTo(170, FLOOR); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(W, FLOOR); ctx.lineTo(W, 220); ctx.lineTo(W - 70, 230); ctx.lineTo(W - 90, 300); ctx.lineTo(W - 150, 320); ctx.lineTo(W - 180, FLOOR); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,200,150,.12)";
        for (let y = 270; y < FLOOR; y += 34) { ctx.fillRect(0, y, 150, 5); ctx.fillRect(W - 170, y - 12, 170, 5); }
        const fg = ctx.createLinearGradient(0, FLOOR, 0, H);
        fg.addColorStop(0, "#d9a066");
        fg.addColorStop(1, "#8a5530");
        ctx.fillStyle = fg;
        ctx.fillRect(0, FLOOR, W, H - FLOOR);
        ctx.fillStyle = "rgba(0,0,0,.12)";
        for (let x = 0; x < W; x += 42) ctx.fillRect(x, FLOOR, 2, H - FLOOR);
        ctx.fillStyle = "#FFD166";
        ctx.fillRect(0, FLOOR, W, 3);

        for (let i = 0; i < SHOTS; i++) {
          const x = W / 2 - (SHOTS - 1) * 13 + i * 26, y = 94;
          ctx.fillStyle = results[i] === true ? "#00E5A0" : results[i] === false ? "#FF3B5C" : i === shot ? "#FFD166" : "rgba(255,255,255,.15)";
          ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
        }
        ctx.font = A.font(14, 700);
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.fillText(`Dunked ${made} / ${NEED} to win`, W / 2, 124);

        const b = bin;
        A.rr(b.x - b.half - 22, b.y + 98, (b.half + 22) * 2, 12, 5);
        ctx.fillStyle = "#8a5a2b";
        ctx.fill();
        if (b.y + 110 < FLOOR) { ctx.fillStyle = "#5a3a20"; ctx.fillRect(b.x - 3, b.y + 110, 6, FLOOR - b.y - 110); }
        const cg = ctx.createLinearGradient(b.x - b.half, 0, b.x + b.half, 0);
        cg.addColorStop(0, "#a8460e");
        cg.addColorStop(0.35, "#ff9a3c");
        cg.addColorStop(0.6, "#e0701c");
        cg.addColorStop(1, "#8a3a0a");
        ctx.beginPath();
        ctx.moveTo(b.x - b.half, b.y); ctx.lineTo(b.x + b.half, b.y); ctx.lineTo(b.x + b.half - 6, b.y + 98); ctx.lineTo(b.x - b.half + 6, b.y + 98);
        ctx.closePath();
        ctx.fillStyle = cg;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.25)";
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(b.x + i * 14, b.y + 14); ctx.lineTo(b.x + i * 12, b.y + 88); ctx.stroke(); }
        A.rr(b.x - b.half - 6, b.y - 6, (b.half + 6) * 2, 10, 5);
        const rg = ctx.createLinearGradient(0, b.y - 6, 0, b.y + 4);
        rg.addColorStop(0, "#ffd0a0");
        rg.addColorStop(1, "#b0500e");
        ctx.fillStyle = rg;
        ctx.fill();
        if (b.amp) { ctx.fillStyle = "#FFD166"; ctx.font = A.font(12, 700); ctx.fillText("◀ moving ▶", b.x, b.y + 128 > FLOOR - 8 ? b.y - 16 : b.y + 128); }

        if (phase === "aim" && A.state === "play") {
          const v = curVel(), sp = Math.hypot(v.vx, v.vy), k = sp > 980 ? 980 / sp : 1;
          if (!drag || Math.hypot(drag.sx - drag.x, drag.sy - drag.y) > 18) {
            ctx.fillStyle = "rgba(255,255,255,.85)";
            for (let i = 1; i <= 9; i++) {
              const tt = i * 0.045;
              ctx.beginPath();
              ctx.arc(ball.x + v.vx * k * tt, ball.y + v.vy * k * tt + 0.5 * G * tt * tt, 4 - i * 0.25, 0, 7);
              ctx.fill();
            }
          }
          if (drag) {
            ctx.strokeStyle = "rgba(255,255,255,.4)";
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(drag.sx, drag.sy); ctx.lineTo(drag.x, drag.y); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.beginPath(); ctx.ellipse(70, FLOOR - 2, 30, 6, 0, 0, 7); ctx.fill();
        A.drawHero(70, FLOOR - 44, 104, 0, phase === "done" && !results[shot] ? "hurt" : "happy");
        trail.forEach((p, i) => {
          ctx.fillStyle = `rgba(255,140,90,${(i / trail.length) * 0.35})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, (BR * i) / trail.length, 0, 7); ctx.fill();
        });
        if (!((phase === "done" || phase === "over") && results[shot])) drawBall(ctx, A, ball.x, ball.y);
        if (phase === "aim" || phase === "fly") {
          const text = pool[shot].name;
          ctx.font = A.font(13, 700);
          const w = ctx.measureText(text).width + 18;
          const x = Math.min(W - 60, Math.max(60, ball.x)), y = Math.max(150, ball.y - 36);
          const bx = Math.max(6, Math.min(W - w - 6, x - w / 2));
          A.rr(bx, y - 12, w, 24, 12);
          ctx.fillStyle = "#f3e2c0";
          ctx.fill();
          ctx.fillStyle = "#2a1a0d";
          ctx.textAlign = "center";
          ctx.fillText(text, bx + w / 2, y + 5);
        }
        if (msgT > 0) {
          ctx.font = A.font(14, 600);
          const lines = wrap(ctx, msg, W - 64), hh = lines.length * 20 + 18;
          ctx.globalAlpha = Math.min(1, msgT * 2);
          A.rr(16, 146, W - 32, hh, 14);
          ctx.fillStyle = "rgba(12,8,32,.93)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.14)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.textAlign = "left";
          lines.forEach((l, i) => ctx.fillText(l, 32, 170 + i * 20));
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
