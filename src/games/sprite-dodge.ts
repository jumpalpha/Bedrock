import type { Api, GameModule } from "./engine/types";
import { GOOD, HAZARD } from "./engine/earth-art";

const W = 420, H = 620, TOP = 176, GOAL = 60, R = 14;
const TAUNTS = ["Feel the heat!", "Eruption time!", "Rock and roll!", "Hot stuff coming!", "Magma madness!", "Kaboom!"];

export const spriteDodge: GameModule = {
  config: {
    key: "bedrock_sprite_dodge",
    title: "Sprite Dodge",
    subtitle: "Out-dodge the Magma King!",
    W, H,
    winText: "You survived a full minute!",
    deathDelay: 800,
    overTitle: "Scorched!",
    accent: "#FF3B5C",
    medals: [
      { at: 300, name: "Bronze", icon: "🥉" },
      { at: 700, name: "Silver", icon: "🥈" },
      { at: 1200, name: "Gold", icon: "🥇" },
      { at: 2000, name: "Legend", icon: "💎" },
    ],
    howTo: "The Magma King hurls lava bombs and boulders at you! Dodge the flying rocks, step out of the <b style=\"color:#FF3B5C\">red warning zones</b>, and grab gems for bonus points. 🛡 = hard hat · ❤ = extra heart. <b>Survive 60 seconds</b> to win.",
    controls: "Move mouse / drag finger anywhere · or arrow keys · P pause",
    sprites: [...HAZARD, ...GOOD, "magma-king", "heart", "shield"],
    facts: [
      "A lava bomb is a blob of lava at least 64 mm across, thrown out while still molten.",
      "Pyroclastic flows of hot ash and gas can race downhill faster than 100 km/h.",
      "Geologists wear hard hats near volcanoes because falling rock is a real hazard.",
      "Volcanic ash is made of tiny, sharp bits of rock and glass, not soft ash like a campfire's.",
      "Craters of the Moon in Idaho has lava flows only about 2,000 years old.",
    ],
  },
  create() {
    type Shot = { x: number; y: number; vx: number; vy: number; kind: string; rot: number };
    type Cone = { ox: number; oy: number; a: number; half: number; warn: number; fire: number };
    type Rain = { x: number; y: number; warn: number; kind: string; rot: number };
    type Pick = { x: number; y: number; kind: string; life: number };
    const me = { x: W / 2, y: H - 90, hurtT: 0 };
    const boss = { x: W / 2, y: 128, dir: 1, talk: "", talkT: 0, mouth: 0 };
    let shots: Shot[] = [], cones: Cone[] = [], rains: Rain[] = [], pickups: Pick[] = [];
    let keys: Record<string, boolean> = {}, target: { x: number; y: number } | null = null, drag: { x: number; y: number } | null = null;
    let t = 0, attackT = 1.6, pickT = 4, lives = 3, inv = 0, shieldT = 0, bonus = 0, wonFlag = false, survived = 0;

    const say = (s: string) => { boss.talk = s; boss.talkT = 1.6; };
    function attack(A: Api) {
      const lv = Math.min(1, A.time / GOAL), r = Math.random();
      if (r < 0.45) {
        const n = 1 + Math.floor(lv * 2 + Math.random() * 1.2);
        const base = Math.atan2(me.y - boss.y, me.x - boss.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.28, sp = 130 + lv * 50;
          shots.push({ x: boss.x, y: boss.y + 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: HAZARD[Math.floor(Math.random() * HAZARD.length)], rot: 0 });
        }
        boss.mouth = 0.4;
        A.sfx("swipe");
      } else if (r < 0.75) {
        const a = Math.atan2(me.y - boss.y, me.x - boss.x) + (Math.random() - 0.5) * 0.3;
        cones.push({ ox: boss.x, oy: boss.y, a, half: 0.2 + lv * 0.06, warn: 1.35 - lv * 0.3, fire: 0.35 });
        say("Ash blast!");
      } else {
        const n = 2 + Math.floor(lv * 2), cols: number[] = [];
        for (let i = 0; i < n; i++) { let x: number; do { x = 40 + Math.random() * (W - 80); } while (cols.some((c) => Math.abs(c - x) < 70)); cols.push(x); }
        cols.forEach((x) => rains.push({ x, warn: 1.15, y: TOP - 20, kind: HAZARD[Math.floor(Math.random() * HAZARD.length)], rot: 0 }));
        say("Meteor shower!");
      }
      if (Math.random() < 0.25) say(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
      attackT = Math.max(1.3, 2.2 - lv * 0.9) * (0.8 + Math.random() * 0.4);
    }
    function hurt(A: Api) {
      if (inv > 0 || shieldT > 0) return;
      lives--; inv = 1.4; me.hurtT = 1.2;
      A.sfx("hit"); A.shake(8, 0.25);
      A.particles.burst(me.x, me.y, "#FF8FA3", 16, 200, 4);
      A.float("−1 ❤", me.x, me.y - 40, "#FF8FA3");
      if (lives <= 0) A.gameOver();
    }

    return {
      reset() {
        me.x = W / 2; me.y = H - 90; me.hurtT = 0;
        boss.x = W / 2; boss.dir = 1; boss.talk = ""; boss.talkT = 0; boss.mouth = 0;
        shots = []; cones = []; rains = []; pickups = [];
        keys = {}; target = null; drag = null; t = 0; attackT = 1.6; pickT = 4; lives = 3; inv = 0; shieldT = 0; bonus = 0; wonFlag = false; survived = 0;
      },
      input(type) {
        if (type === "left" || type === "right" || type === "up" || type === "down") { keys[type] = true; target = null; }
        else if (type.startsWith("release-")) keys[type.slice(8)] = false;
      },
      pointer(type, x, y) {
        if (type === "move") target = { x, y };
        else if (type === "down") { drag = { x, y }; target = null; }
        else if (type === "drag" && drag) { me.x += (x - drag.x) * 1.25; me.y += (y - drag.y) * 1.25; drag = { x, y }; }
        else if (type === "up") drag = null;
      },
      update(dt, A) {
        t += dt;
        if (boss.talkT > 0) boss.talkT -= dt;
        boss.mouth = Math.max(0, boss.mouth - dt);
        shots.forEach((s) => (s.rot += dt * 3));
        rains.forEach((s) => (s.rot += dt * 3));
        if (A.state !== "play") { boss.x = W / 2 + Math.sin(t * 0.8) * 120; return; }
        me.hurtT = Math.max(0, me.hurtT - dt);
        inv = Math.max(0, inv - dt);
        shieldT = Math.max(0, shieldT - dt);
        const sp = 300;
        if (keys.left) me.x -= sp * dt;
        if (keys.right) me.x += sp * dt;
        if (keys.up) me.y -= sp * dt;
        if (keys.down) me.y += sp * dt;
        if (target) {
          const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy), step = Math.min(d, 420 * dt);
          if (d > 1) { me.x += (dx / d) * step; me.y += (dy / d) * step; }
        }
        me.x = Math.max(24, Math.min(W - 24, me.x));
        me.y = Math.max(TOP + 20, Math.min(H - 34, me.y));
        if (!cones.length) boss.x += boss.dir * (50 + Math.min(1, A.time / GOAL) * 50) * dt;
        if (boss.x < 80 || boss.x > W - 80) boss.dir *= -1;

        survived = A.time;
        const s = Math.floor(survived * 10) + bonus;
        if (s !== A.score) A.setScore(s);
        if (!wonFlag && survived >= GOAL) { wonFlag = true; A.win("You out-dodged the Magma King for a full minute!"); say("Nooo! Time to cool off…"); }

        attackT -= dt;
        if (attackT <= 0) attack(A);
        for (let i = shots.length - 1; i >= 0; i--) {
          const o = shots[i];
          o.x += o.vx * dt; o.y += o.vy * dt;
          if (Math.hypot(o.x - me.x, o.y - me.y) < R + 11) { shots.splice(i, 1); hurt(A); continue; }
          if (o.x < -30 || o.x > W + 30 || o.y > H + 30 || o.y < -30) shots.splice(i, 1);
        }
        for (let i = cones.length - 1; i >= 0; i--) {
          const c = cones[i];
          if (c.warn > 0) { c.warn -= dt; if (c.warn <= 0) { A.sfx("click"); A.shake(4, 0.15); boss.mouth = 0.5; } continue; }
          c.fire -= dt;
          let da = Math.abs(Math.atan2(me.y - c.oy, me.x - c.ox) - c.a);
          if (da > Math.PI) da = 2 * Math.PI - da;
          if (da < c.half) hurt(A);
          if (c.fire <= 0) cones.splice(i, 1);
        }
        for (let i = rains.length - 1; i >= 0; i--) {
          const r = rains[i];
          if (r.warn > 0) { r.warn -= dt; continue; }
          r.y += 440 * dt;
          if (Math.abs(r.x - me.x) < R + 14 && Math.abs(r.y - me.y) < R + 14) { rains.splice(i, 1); hurt(A); continue; }
          if (r.y > H + 30) rains.splice(i, 1);
        }
        pickT -= dt;
        if (pickT <= 0) {
          const roll = Math.random(), kind = lives < 3 && roll < 0.25 ? "heart" : roll < 0.3 ? "shield" : GOOD[Math.floor(Math.random() * GOOD.length)];
          pickups.push({ x: 40 + Math.random() * (W - 80), y: TOP + 50 + Math.random() * (H - TOP - 110), kind, life: 6 });
          pickT = 2.5 + Math.random() * 2;
        }
        for (let i = pickups.length - 1; i >= 0; i--) {
          const p = pickups[i];
          p.life -= dt;
          if (Math.hypot(p.x - me.x, p.y - me.y) < R + 18) {
            pickups.splice(i, 1);
            if (p.kind === "heart") { lives = Math.min(3, lives + 1); A.sfx("medal"); A.float("+1 ❤", p.x, p.y - 20, "#FF8FA3"); }
            else if (p.kind === "shield") { shieldT = 5; A.sfx("medal"); A.toast("🛡 Hard hat on! 5 seconds of safety"); }
            else { bonus += 25; A.sfx("coin"); A.float("+25", p.x, p.y - 20, "#7CFFB2"); A.particles.burst(p.x, p.y, "#7CFFB2", 8, 140, 3); }
            continue;
          }
          if (p.life <= 0) pickups.splice(i, 1);
        }
      },
      draw(ctx, A) {
        // magma cavern
        const wall = ctx.createLinearGradient(0, 0, 0, TOP);
        wall.addColorStop(0, "#1a0f0c");
        wall.addColorStop(1, "#3a1f16");
        ctx.fillStyle = wall;
        ctx.fillRect(0, 0, W, TOP);
        ctx.fillStyle = "rgba(255,255,255,.05)";
        for (let y = 0; y < TOP; y += 26) for (let x = ((y / 26) % 2) * 26; x < W; x += 52) ctx.fillRect(x, y, 48, 22);
        ctx.fillStyle = "#ff7a1c";
        ctx.fillRect(0, TOP - 10, W, 10);
        for (let y = TOP; y < H; y += 44.4)
          for (let x = 0; x < W; x += 52.5) {
            ctx.fillStyle = ((x / 52.5 + (y - TOP) / 44.4) | 0) % 2 ? "#7a6458" : "#6a5448";
            ctx.fillRect(x, y, 52.5, 44.4);
          }
        const fl = ctx.createLinearGradient(0, TOP, 0, H);
        fl.addColorStop(0, "rgba(40,12,4,.5)");
        fl.addColorStop(1, "rgba(40,12,4,.05)");
        ctx.fillStyle = fl;
        ctx.fillRect(0, TOP, W, H - TOP);
        [40, W - 40].forEach((x) => {
          const bg = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
          bg.addColorStop(0, "#a8122f"); bg.addColorStop(0.5, "#ff3b5c"); bg.addColorStop(1, "#a8122f");
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.moveTo(x - 16, 20); ctx.lineTo(x + 16, 20); ctx.lineTo(x + 16, 96); ctx.lineTo(x, 84); ctx.lineTo(x - 16, 96); ctx.closePath(); ctx.fill();
          A.drawSprite("lava-bomb", x, 52, 30);
        });

        cones.forEach((c) => {
          ctx.beginPath(); ctx.moveTo(c.ox, c.oy); ctx.arc(c.ox, c.oy, 900, c.a - c.half, c.a + c.half); ctx.closePath();
          if (c.warn > 0) {
            ctx.fillStyle = `rgba(255,59,92,${0.12 + 0.12 * Math.sin(t * 24)})`; ctx.fill();
            ctx.strokeStyle = "rgba(255,59,92,.7)"; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
          } else {
            ctx.fillStyle = "rgba(90,84,80,.6)"; ctx.fill();
            ctx.fillStyle = "rgba(255,150,60,.75)";
            for (let i = 0; i < 14; i++) {
              const d = 60 + ((i * 53 + t * 900) % 560), a = c.a + (((i * 37) % 10) / 10 - 0.5) * c.half * 1.6;
              ctx.beginPath(); ctx.arc(c.ox + Math.cos(a) * d, c.oy + Math.sin(a) * d, 4, 0, 7); ctx.fill();
            }
          }
        });
        rains.forEach((r) => {
          if (r.warn > 0) {
            ctx.fillStyle = `rgba(255,59,92,${0.15 + 0.15 * Math.sin(t * 20)})`;
            ctx.fillRect(r.x - 22, TOP, 44, H - TOP);
            ctx.fillStyle = "#FF3B5C"; ctx.font = A.font(24); ctx.textAlign = "center"; ctx.fillText("!", r.x, TOP + 30);
          } else A.drawSprite(r.kind, r.x, r.y, 42, r.rot);
        });
        pickups.forEach((p) => {
          if (p.life < 1.5 && Math.sin(t * 20) < 0) return;
          const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 28);
          g.addColorStop(0, p.kind === "shield" ? "rgba(56,191,255,.5)" : "rgba(0,229,160,.5)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(p.x - 28, p.y - 28, 56, 56);
          A.drawSprite(p.kind, p.x, p.y + Math.sin(t * 4) * 3, 40);
        });
        // Magma King
        const bx = boss.x, by = boss.y + Math.sin(t * 3) * 3;
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.beginPath(); ctx.ellipse(bx, boss.y + 56, 46, 8, 0, 0, 7); ctx.fill();
        A.drawSprite("magma-king", bx, by, 120 + boss.mouth * 14, Math.sin(t * 2) * 0.05);
        if (boss.talkT > 0) {
          ctx.font = A.font(14, 700);
          const w = ctx.measureText(boss.talk).width + 22, sx = Math.max(8, Math.min(W - w - 8, bx + 50)), sy = by - 76;
          A.rr(sx, sy, w, 30, 15); ctx.fillStyle = "#fff"; ctx.fill();
          ctx.fillStyle = "#2a0d18"; ctx.textAlign = "left"; ctx.fillText(boss.talk, sx + 11, sy + 20);
        }
        shots.forEach((o) => {
          const g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, 24);
          g.addColorStop(0, "rgba(255,59,92,.45)"); g.addColorStop(1, "rgba(255,59,92,0)");
          ctx.fillStyle = g; ctx.fillRect(o.x - 24, o.y - 24, 48, 48);
          A.drawSprite(o.kind, o.x, o.y, 38, o.rot);
        });
        ctx.fillStyle = "rgba(0,0,0,.2)";
        ctx.beginPath(); ctx.ellipse(me.x, me.y + 28, 22, 6, 0, 0, 7); ctx.fill();
        if (!(inv > 0 && Math.sin(t * 30) < 0)) A.drawHero(me.x, me.y, 84, 0, me.hurtT > 0 ? "hurt" : "happy");
        if (shieldT > 0) {
          ctx.strokeStyle = `rgba(56,191,255,${shieldT < 1.5 && Math.sin(t * 20) < 0 ? 0.2 : 0.85})`;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(me.x, me.y, 36, 0, 7); ctx.stroke();
        }
        for (let i = 0; i < Math.max(0, lives); i++) A.drawSprite("heart", 22 + i * 26, H - 18, 24);
        const left = Math.max(0, GOAL - survived);
        const label = wonFlag ? `🏆 ${Math.floor(survived)}s` : `⏱ ${Math.ceil(left)}s to win`;
        ctx.font = A.font(15);
        ctx.textAlign = "right";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(7,7,26,.85)";
        ctx.strokeText(label, W - 14, H - 12);
        ctx.fillStyle = "#FFD166";
        ctx.fillText(label, W - 14, H - 12);
      },
    };
  },
};
