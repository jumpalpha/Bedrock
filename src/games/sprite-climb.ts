import type { Api, GameModule } from "./engine/types";

const W = 420, H = 640;
const P = [
  { x0: 0, x1: 420, yL: 612, yR: 612 },
  { x0: 40, x1: 420, yL: 534, yR: 516 },
  { x0: 0, x1: 380, yL: 432, yR: 450 },
  { x0: 40, x1: 420, yL: 350, yR: 332 },
  { x0: 0, x1: 380, yL: 248, yR: 266 },
  { x0: 0, x1: 300, yL: 168, yR: 168 },
];
type Ladder = { x: number; a: number; b: number; broken?: boolean };
const LADDERS: Ladder[] = [{ x: 370, a: 0, b: 1 }, { x: 80, a: 1, b: 2 }, { x: 330, a: 2, b: 3 }, { x: 200, a: 2, b: 3, broken: true }, { x: 90, a: 3, b: 4 }, { x: 250, a: 4, b: 5 }];
const GOAL_X = 262;
const ROCKS = ["boulder", "lava-bomb", "boulder", "meteor"];
const TIPS = [
  "Rockfalls happen when freezing water wedges cracks open on steep cliffs.", "Talus is the pile of broken rock at the bottom of a cliff.",
  "Geodes form when minerals crystallize inside hollow pockets in rock.", "Gravity pulls loose rock downhill in mass movement.",
  "Idaho's Sawtooth Mountains were carved by glaciers.",
]
const GRAV = 1500, JUMP_V = 410, WALK = 112, CLIMB = 90, SAFE_FALL = 64, COYOTE = 0.07, JUMP_BUF = 0.12;
const HB = { w: 7, top: 28, bot: 2 }, BR = 11;
const py = (p: (typeof P)[number], x: number) => p.yL + ((p.yR - p.yL) * (x - p.x0)) / (p.x1 - p.x0);
const on = (p: (typeof P)[number], x: number) => x >= p.x0 && x <= p.x1;

export const spriteClimb: GameModule = {
  config: {
    key: "bedrock_sprite_climb",
    title: "Sprite Climb",
    subtitle: "Grab the Golden Geode from the Magma King!",
    W, H,
    winText: "You grabbed the Golden Geode!",
    deathDelay: 900,
    overTitle: "Rockslide!",
    accent: "#FFD166",
    medals: [
      { at: 3000, name: "Bronze", icon: "🥉" },
      { at: 6000, name: "Silver", icon: "🥈" },
      { at: 10000, name: "Gold", icon: "🥇" },
      { at: 15000, name: "Legend", icon: "💎" },
    ],
    howTo: "Climb the ledges and ladders to the <b>Golden Geode</b> before the <b>bonus</b> runs out. <b>Jump</b> over rolling rocks (+100) — jumps can't change direction mid-air. <b>Falling too far knocks you out</b>, so use the ladders! ⛏ The pickaxe lets you <b>smash</b> rocks, but you can't jump or climb while holding it.",
    controls: "← → walk · ↑ ↓ climb ladders · Space jump · P pause",
    pad: [
      { label: "◀", type: "left" },
      { label: "▲", type: "up" },
      { label: "▼", type: "down" },
      { label: "▶", type: "right" },
      { label: "JUMP", type: "tap", wide: true },
    ],
    sprites: [...ROCKS, "golden-geode", "magma-king", "pickaxe", "heart"],
    facts: [
      "Mass movement is when gravity moves rock and soil downhill: rockfalls, slides, slumps and creep.",
      "A landslide can move faster than 160 km/h.",
      "Geodes look like plain round rocks until you crack them open.",
      "Ice wedging splits rock because water expands about 9% when it freezes.",
      "Steep slopes, heavy rain and earthquakes all make landslides more likely.",
    ],
  },
  create() {
    type Me = { x: number; y: number; vx: number; vy: number; plat: number; ground: boolean; ladder: Ladder | null; face: number; walk: number; inv: number; coyote: number; jumpBuf: number; peakY: number; airVx: number };
    type Barrel = { x: number; y: number; vx: number; vy: number; plat: number | null; dir: number; kind: string; rot: number; ladder: Ladder | null; scored: boolean; wild: boolean; triedL?: boolean };
    let me: Me, barrels: Barrel[] = [], throwT = 0, level = 1, lives = 3, keys: Record<string, boolean> = {}, power = 0;
    let powerUp = { x: 200, plat: 2, got: false, t: 0 }, banner = 0, t = 0, deadT = 0, deathMsg = "", bonus = 5000, bonusT = 0, throwAnim = 0;

    function respawn() {
      me = { x: 30, y: P[0].yL, vx: 0, vy: 0, plat: 0, ground: true, ladder: null, face: 1, walk: 0, inv: 1.2, coyote: 0, jumpBuf: 0, peakY: P[0].yL, airVx: 0 };
      barrels = []; throwT = 1.2; power = 0; deadT = 0; deathMsg = "";
      powerUp = { x: 200, plat: 2, got: false, t: 0 };
      bonus = 5000; bonusT = 0;
    }
    respawn();
    const nearLadder = (x: number) => LADDERS.find((l) => !l.broken && Math.abs(l.x - x) < 7);
    function die(A: Api, why: string) {
      if (deadT > 0) return;
      lives--; deadT = 1.6; deathMsg = why; me.ladder = null;
      A.sfx("hit"); A.shake(10, 0.3); A.flash(0.15);
      A.particles.burst(me.x, me.y - 16, "#FF8FA3", 22, 220, 4);
      if (lives <= 0) { A.gameOver(); return; }
      A.toast(`💔 ${why} — ${lives} ${lives === 1 ? "life" : "lives"} left`, 2000);
    }
    function levelClear(A: Api) {
      const pts = 1000 * level + bonus;
      A.addScore(pts); A.sfx("win");
      A.float(`Golden Geode! +${pts}`, W / 2, 300, "#FFD166");
      A.particles.burst(GOAL_X, P[5].yL - 20, "#FFD166", 40, 300, 5);
      if (level === 1) A.win("You grabbed the Golden Geode!");
      else A.toast("💡 " + TIPS[level % TIPS.length], 2400);
      level++; banner = 2; respawn();
    }
    const hitsMe = (b: Barrel) => {
      const cx = Math.max(me.x - HB.w, Math.min(b.x, me.x + HB.w)), cy = Math.max(me.y - HB.top, Math.min(b.y, me.y - HB.bot));
      return (b.x - cx) ** 2 + (b.y - cy) ** 2 < (BR - 1) ** 2;
    };
    function land(A: Api, i: number, gy: number) {
      const fall = gy - me.peakY;
      me.y = gy; me.vy = 0; me.ground = true; me.plat = i; me.peakY = gy; me.airVx = 0;
      if (fall > SAFE_FALL) die(A, "Fell too far");
    }

    return {
      reset() { level = 1; lives = 3; keys = {}; t = 0; throwAnim = 0; banner = 2; respawn(); },
      input(type) {
        if (type.startsWith("release-")) { keys[type.slice(8)] = false; return; }
        keys[type] = true;
        if (type === "tap") me.jumpBuf = JUMP_BUF;
      },
      update(dt0, A) {
        t += dt0;
        throwAnim = Math.max(0, throwAnim - dt0 * 2);
        if (A.state !== "play") return;
        const dt = Math.min(dt0, 1 / 30);
        banner = Math.max(0, banner - dt);
        if (deadT > 0) { deadT -= dt; if (deadT <= 0 && A.state === "play") respawn(); return; }
        power = Math.max(0, power - dt);
        me.inv = Math.max(0, me.inv - dt);
        me.jumpBuf = Math.max(0, me.jumpBuf - dt);
        bonusT += dt;
        if (bonusT >= 1.2) { bonusT -= 1.2; bonus = Math.max(0, bonus - 100); if (bonus === 0) { die(A, "Out of time"); return; } }

        const smashing = power > 0;
        if (me.ladder) {
          const l = me.ladder, top = py(P[l.b], l.x), bot = py(P[l.a], l.x);
          me.x = l.x; me.vx = 0;
          if (keys.up) me.y -= CLIMB * dt; else if (keys.down) me.y += CLIMB * dt;
          me.walk += keys.up || keys.down ? dt * 10 : 0;
          me.jumpBuf = 0;
          if (me.y <= top) { me.y = top; me.ladder = null; me.plat = l.b; me.ground = true; me.peakY = top; }
          if (me.y >= bot) { me.y = bot; me.ladder = null; me.plat = l.a; me.ground = true; me.peakY = bot; }
        } else {
          if (me.ground) {
            me.vx = (keys.right ? WALK : 0) - (keys.left ? WALK : 0);
            if (me.vx) { me.face = Math.sign(me.vx); me.walk += dt * 12; }
            const l = !smashing && nearLadder(me.x);
            if (l && ((keys.up && Math.abs(me.y - py(P[l.a], l.x)) < 4) || (keys.down && Math.abs(me.y - py(P[l.b], l.x)) < 4))) { me.ladder = l; me.ground = false; me.x = l.x; return; }
            if (me.jumpBuf > 0 && !smashing) { me.jumpBuf = 0; me.vy = -JUMP_V; me.ground = false; me.airVx = me.vx; me.coyote = 0; me.peakY = me.y; A.sfx("jump"); }
          } else {
            me.vx = me.airVx;
            if (me.coyote > 0 && me.jumpBuf > 0 && !smashing) { me.jumpBuf = 0; me.vy = -JUMP_V; me.coyote = 0; me.peakY = me.y; A.sfx("jump"); }
          }
          me.coyote = Math.max(0, me.coyote - dt);
          const nx = me.x + me.vx * dt;
          if (nx < 9 || nx > W - 9) { me.x = Math.max(9, Math.min(W - 9, nx)); if (!me.ground) me.airVx = 0; } else me.x = nx;
          if (!me.ground) { me.vy += GRAV * dt; me.y += me.vy * dt; me.peakY = Math.min(me.peakY, me.y); }
          const p = P[me.plat];
          if (me.ground) {
            if (!on(p, me.x)) { me.ground = false; me.vy = 0; me.airVx = me.vx * 0.5; me.coyote = COYOTE; me.peakY = me.y; }
            else me.y = py(p, me.x);
          }
          if (!me.ground && me.vy >= 0) {
            for (let i = P.length - 1; i >= 0; i--) {
              const q = P[i];
              if (!on(q, me.x)) continue;
              const gy = py(q, me.x);
              if (me.y >= gy - 1 && me.y - me.vy * dt <= gy + 2) { land(A, i, gy); if (deadT > 0) return; break; }
            }
          }
          if (me.y > H + 40) { die(A, "Fell off"); return; }
        }
        if (me.plat === 5 && me.ground && Math.abs(me.x - GOAL_X) < 16) { levelClear(A); return; }
        if (!powerUp.got && me.plat === powerUp.plat && me.ground && Math.abs(me.x - powerUp.x) < 14) {
          powerUp.got = true; power = 7;
          A.sfx("medal");
          A.toast("⛏ Pickaxe power! Smash rocks for 7 seconds — no jumping or climbing");
        }
        powerUp.t += dt;

        throwT -= dt;
        if (throwT <= 0 && banner < 1.2) {
          throwAnim = 1;
          const wild = level >= 2 && Math.random() < 0.12 * (level - 1);
          barrels.push({ x: 86, y: P[5].yL - BR, vx: 0, vy: 0, plat: 5, dir: 1, kind: ROCKS[Math.floor(Math.random() * ROCKS.length)], rot: 0, ladder: null, scored: false, wild });
          throwT = Math.max(1.0, 2.5 - level * 0.35) + Math.random();
        }
        const speed = 118 + level * 20, ladderOdds = Math.min(0.55, 0.25 + level * 0.08);
        for (let i = barrels.length - 1; i >= 0; i--) {
          const b = barrels[i];
          if (b.ladder) {
            b.y += 150 * dt;
            if (b.y >= py(P[b.ladder.a], b.ladder.x) - BR) { b.plat = b.ladder.a; b.ladder = null; }
          } else if (b.plat != null) {
            const p = P[b.plat];
            b.dir = b.plat === 5 ? 1 : p.yL > p.yR ? -1 : 1;
            b.x += b.dir * speed * dt;
            b.rot += (b.dir * speed * dt) / BR;
            if (!on(p, b.x)) { b.plat = null; b.vy = 0; b.vx = b.dir * speed * 0.5; }
            else {
              b.y = py(p, b.x) - BR;
              const l = LADDERS.find((l2) => l2.b === b.plat && !l2.broken && Math.abs(l2.x - b.x) < 4);
              if (l && !b.triedL) { b.triedL = true; if (Math.random() < ladderOdds) { b.ladder = l; b.x = l.x; } }
              if (!l) b.triedL = false;
            }
            if (b.wild && b.plat != null && b.plat !== 5 && Math.random() < dt * 0.9) { b.plat = null; b.vy = -220; b.vx = (Math.random() < 0.5 ? -1 : 1) * 90; }
          } else {
            b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
            for (let k = P.length - 1; k >= 0; k--) {
              const q = P[k];
              if (on(q, b.x) && b.vy > 0 && b.y + BR >= py(q, b.x) && b.y + BR <= py(q, b.x) + 16) { b.plat = k; b.y = py(q, b.x) - BR; A.sfx("point"); break; }
            }
          }
          if (b.y > H + 40 || b.x < -30 || b.x > W + 30 || (b.plat === 0 && b.x < 6)) { barrels.splice(i, 1); continue; }
          if (hitsMe(b)) {
            if (power > 0 && Math.abs(b.y - (me.y - 16)) < 30) {
              A.addScore(300); A.sfx("coin"); A.float("SMASH +300", b.x, b.y - 10, "#7CFFB2");
              A.particles.burst(b.x, b.y, "#FFD23F", 16, 220, 4);
              barrels.splice(i, 1);
              continue;
            }
            if (me.inv <= 0) { die(A, "Hit by a rock"); return; }
          }
          if (!b.scored && !me.ground && !me.ladder && Math.abs(b.x - me.x) < 10 && me.y < b.y - BR && b.y - me.y < 70) {
            b.scored = true; A.addScore(100); A.sfx("coin"); A.float("+100", me.x, me.y - 50, "#FFD166");
          }
        }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#0d0a1e");
        g.addColorStop(1, "#3a2030");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const moon = ctx.createRadialGradient(360, 90, 4, 360, 90, 90);
        moon.addColorStop(0, "rgba(255,240,200,.35)");
        moon.addColorStop(1, "rgba(255,240,200,0)");
        ctx.fillStyle = moon;
        ctx.fillRect(260, 0, 200, 200);
        ctx.fillStyle = "#24161c";
        ([[0, 90], [40, 140], [90, 70], [140, 160], [200, 110], [250, 180], [310, 90], [360, 150]] as const).forEach(([x, h]) => { ctx.beginPath(); ctx.moveTo(x - 10, H - 40); ctx.lineTo(x + 8, H - 40 - h); ctx.lineTo(x + 40, H - 40 - h * 0.85); ctx.lineTo(x + 58, H - 40); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = "rgba(255,240,210,.55)";
        for (let i = 0; i < 40; i++) ctx.fillRect(((i * 53) % 400) + 6, 20 + ((i * 37) % 260), 2, 2);

        LADDERS.forEach((l) => {
          const top = py(P[l.b], l.x), bot = py(P[l.a], l.x);
          ctx.strokeStyle = l.broken ? "rgba(222,170,110,.45)" : "#deaa6e";
          ctx.lineWidth = 3;
          const gapTop = l.broken ? top + 24 : top, gapBot = l.broken ? bot - 18 : bot;
          [-8, 8].forEach((dx) => {
            ctx.beginPath();
            ctx.moveTo(l.x + dx, top); ctx.lineTo(l.x + dx, gapTop);
            ctx.moveTo(l.x + dx, gapBot); ctx.lineTo(l.x + dx, bot);
            ctx.stroke();
          });
          for (let y = top + 8; y < bot; y += 12) {
            if (l.broken && y > gapTop && y < gapBot) continue;
            ctx.beginPath(); ctx.moveTo(l.x - 8, y); ctx.lineTo(l.x + 8, y); ctx.stroke();
          }
        });
        P.forEach((p, i) => {
          const gg = ctx.createLinearGradient(0, Math.min(p.yL, p.yR), 0, Math.max(p.yL, p.yR) + 12);
          if (i === 5) { gg.addColorStop(0, "#ffe08a"); gg.addColorStop(1, "#c98a00"); }
          else { gg.addColorStop(0, "#b08a6a"); gg.addColorStop(1, "#6a4a36"); }
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.moveTo(p.x0, p.yL); ctx.lineTo(p.x1, p.yR); ctx.lineTo(p.x1, p.yR + 12); ctx.lineTo(p.x0, p.yL + 12);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(26,16,48,.45)";
          ctx.lineWidth = 1.5;
          for (let x = p.x0 + 10; x < p.x1; x += 22) {
            const y = py(p, x);
            ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + 11, py(p, x + 11) + 11); ctx.lineTo(x + 22, py(p, x + 22) + 1); ctx.stroke();
          }
          ctx.fillStyle = "rgba(255,255,255,.35)";
          ctx.beginPath();
          ctx.moveTo(p.x0, p.yL); ctx.lineTo(p.x1, p.yR); ctx.lineTo(p.x1, p.yR + 2); ctx.lineTo(p.x0, p.yL + 2);
          ctx.closePath();
          ctx.fill();
        });
        const gy = P[5].yL;
        A.rr(GOAL_X - 15, gy - 14, 30, 14, 4);
        ctx.fillStyle = "#c9c4e8";
        ctx.fill();
        const ag = ctx.createRadialGradient(GOAL_X, gy - 34, 4, GOAL_X, gy - 34, 34);
        ag.addColorStop(0, "rgba(255,215,0,.55)");
        ag.addColorStop(1, "rgba(255,215,0,0)");
        ctx.fillStyle = ag;
        ctx.fillRect(GOAL_X - 34, gy - 68, 68, 68);
        A.drawSprite("golden-geode", GOAL_X, gy - 34 + Math.sin(t * 3) * 3, 40);
        ctx.save();
        ctx.translate(56, gy - 38 + Math.sin(t * 3) * 3);
        ctx.rotate(throwAnim * 0.3);
        A.drawSprite("magma-king", 0, 0, 78);
        ctx.restore();
        ctx.fillStyle = "#FF8FA3";
        ctx.font = A.font(11, 700);
        ctx.textAlign = "center";
        ctx.fillText("MAGMA KING", 56, gy + 28);
        if (!powerUp.got) {
          const x = powerUp.x, y = py(P[powerUp.plat], x) - 18 + Math.sin(powerUp.t * 4) * 3;
          const bg = ctx.createRadialGradient(x, y, 2, x, y, 22);
          bg.addColorStop(0, "rgba(124,255,178,.5)");
          bg.addColorStop(1, "rgba(124,255,178,0)");
          ctx.fillStyle = bg;
          ctx.fillRect(x - 22, y - 22, 44, 44);
          A.drawSprite("pickaxe", x, y, 32);
        }
        barrels.forEach((b) => A.drawSprite(b.kind, b.x, b.y, 30, b.ladder ? 0 : b.rot * 0.3));
        if (!(deadT <= 0 && me.inv > 0 && Math.floor(me.inv * 10) % 2)) {
          const bob = me.ground && me.vx ? Math.abs(Math.sin(me.walk)) * 2 : 0;
          ctx.save();
          ctx.translate(me.x, me.y - 18 - bob);
          ctx.scale(me.face, 1);
          A.drawHero(0, 0, 42, deadT > 0 ? 1.4 : me.ladder ? Math.sin(me.walk) * 0.1 : 0, deadT > 0 ? "hurt" : me.ground && me.vx ? "run" : "happy");
          ctx.restore();
          if (power > 0) {
            ctx.strokeStyle = `rgba(124,255,178,${0.5 + Math.sin(t * 12) * 0.3})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(me.x, me.y - 18, 24, 0, 7); ctx.stroke();
          }
        }
        for (let i = 0; i < Math.max(0, lives); i++) A.drawSprite("heart", 66 + i * 22, 76, 20);
        ctx.font = A.font(15, 700);
        ctx.textAlign = "right";
        ctx.fillStyle = "#a3a6c8";
        ctx.fillText(`Level ${level}`, W - 62, 81);
        ctx.textAlign = "center";
        ctx.fillStyle = bonus <= 1000 ? "#FF5C77" : "#FFD166";
        ctx.fillText(`BONUS ${bonus}`, W / 2, 81);
        if (deadT > 0 && deathMsg) {
          ctx.font = A.font(24);
          ctx.lineWidth = 5;
          ctx.strokeStyle = "rgba(7,7,26,.85)";
          ctx.strokeText(deathMsg + "!", W / 2, 300);
          ctx.fillStyle = "#FF8FA3";
          ctx.fillText(deathMsg + "!", W / 2, 300);
        }
        if (power > 0) { ctx.fillStyle = "#7CFFB2"; ctx.font = A.font(14, 700); ctx.fillText(`⛏ SMASH ${Math.ceil(power)}s`, W / 2, 102); }
        if (banner > 0 && A.state === "play") {
          ctx.globalAlpha = Math.min(1, banner);
          ctx.font = A.font(28);
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(7,7,26,.85)";
          const txt = level === 1 ? "Climb to the Golden Geode!" : `Level ${level}!`;
          ctx.strokeText(txt, W / 2, 330);
          ctx.fillStyle = "#FFD166";
          ctx.fillText(txt, W / 2, 330);
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
