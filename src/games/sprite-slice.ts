import type { Api, GameModule } from "./engine/types";

const W = 420, H = 640, G = 900;
const GOOD = ["meteor", "boulder", "geode", "crystal", "gold-nugget", "star-garnet"] as const;
const BAD = ["lava-bomb", "storm-cloud", "tornado"] as const;
const FACTS: Record<string, string> = {
  meteor: "Most meteorites are stony. Some are iron and nickel from the core of a broken asteroid.",
  boulder: "Geologists split rocks open to see the fresh surface inside, before weathering changed it.",
  geode: "Crack a geode and you'll find crystals that grew inward from the walls of a hollow.",
  crystal: "Some crystals split cleanly along flat planes. That's called cleavage.",
  "gold-nugget": "Gold doesn't rust or tarnish, which is why ancient gold coins still shine.",
  "star-garnet": "Star garnets show a star because of tiny needle-like crystals inside.",
};
const JUICE: Record<string, string> = {
  meteor: "#ff8a3c", boulder: "#c9c4bc", geode: "#a46bff", crystal: "#c48cff", "gold-nugget": "#ffd23f", "star-garnet": "#ff3b5c",
};

type Item = { x: number; y: number; vx: number; vy: number; kind: string; bad: boolean; power: "star" | "heart" | null; rot: number; spin: number; r: number };
type Half = { x: number; y: number; vx: number; vy: number; rot: number; spin: number; kind: string; side: number; life: number };

export const spriteSlice: GameModule = {
  config: {
    key: "bedrock_sprite_slice",
    title: "Sprite Slice",
    subtitle: "Split the space rocks!",
    W, H,
    winAt: 800,
    winText: "You split 800 points of space rock!",
    deathDelay: 800,
    overTitle: "Out of hearts!",
    medals: [
      { at: 250, name: "Bronze", icon: "🥉" },
      { at: 800, name: "Silver", icon: "🥈" },
      { at: 1600, name: "Gold", icon: "🥇" },
      { at: 3000, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Hold and swipe</b> to split the flying <b>meteors, rocks and gems</b>. Slice 3+ in one swipe for a combo! Slicing a <b>lava bomb, storm or twister</b>, or letting a rock drop, costs a heart. ⭐ = meteor shower, ❤ = extra heart. <b>800 points</b> wins.",
    controls: "Hold mouse button and swipe · or swipe your finger · P pause",
    accent: "#FF3B5C",
    sprites: [...GOOD, ...BAD, "heart", "star"],
    facts: [
      "Tens of tons of space dust and rock hit Earth's atmosphere every day.",
      "A shooting star is a meteor: a bit of space rock burning up as it hits the air.",
      "Meteor showers happen when Earth passes through dust left behind by a comet.",
      "Meteor Crater in Arizona was blasted out about 50,000 years ago by an iron meteorite.",
      "Geologists use a rock hammer to break rocks, never a kitchen knife!",
    ],
  },
  create() {
    let items: Item[] = [], halves: Half[] = [], splats: { x: number; y: number; c: string; r: number; life: number }[] = [];
    let trail: { x: number; y: number; a: number }[] = [], last: { x: number; y: number } | null = null;
    let swipeHits = 0, waveT = 0.8, lives = 3, frenzyT = 0, t = 0, sliced = 0, flash = 0;

    const spriteFor = (kind: string) => kind;

    function launch(level: number, forceGood = false) {
      const bad = !forceGood && Math.random() < Math.min(0.3, 0.1 + level * 0.02);
      const power = !bad && !forceGood && Math.random() < 0.04 ? (lives < 3 && Math.random() < 0.5 ? "heart" : "star") : null;
      const x = 50 + Math.random() * (W - 100);
      items.push({
        x, y: H + 30,
        vx: (W / 2 - x) * (0.35 + Math.random() * 0.5) + (Math.random() - 0.5) * 60,
        vy: -(760 + Math.random() * 200),
        kind: power || (bad ? BAD[Math.floor(Math.random() * BAD.length)] : GOOD[Math.floor(Math.random() * GOOD.length)]),
        bad, power, rot: 0, spin: (Math.random() - 0.5) * 6, r: power ? 26 : 28,
      });
    }
    function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      let u = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
      u = Math.max(0, Math.min(1, u));
      return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
    }
    function endSwipe(A: Api) {
      if (swipeHits >= 3) {
        const bonus = swipeHits * 10 * (frenzyT > 0 ? 2 : 1);
        A.addScore(bonus);
        A.sfx("coin");
        A.toast(`💥 ${swipeHits}-rock combo! +${bonus}`);
      }
      swipeHits = 0;
      last = null;
    }
    function slice(it: Item, ax: number, ay: number, bx: number, by: number, A: Api) {
      const ang = Math.atan2(by - ay, bx - ax);
      if (it.bad) {
        lives--;
        A.sfx("hit"); A.shake(10, 0.3); flash = 0.35;
        A.particles.burst(it.x, it.y, "#FF8FA3", 18, 220, 4);
        A.float("Ouch! −1 ❤", it.x, it.y - 20, "#FF8FA3");
        endSwipe(A);
        trail = [];
        if (lives <= 0) A.gameOver();
        return;
      }
      if (it.power === "star") {
        frenzyT = 7;
        A.sfx("medal");
        A.toast("⭐ Meteor shower! Double points for 7s");
        for (let i = 0; i < 6; i++) setTimeout(() => A.state === "play" && launch(0, true), i * 120);
        A.particles.burst(it.x, it.y, "#FFD166", 22, 240, 4);
        return;
      }
      if (it.power === "heart") {
        lives = Math.min(3, lives + 1);
        A.sfx("medal");
        A.float("+1 ❤", it.x, it.y - 20, "#FF5C77");
        A.particles.burst(it.x, it.y, "#FF5C77", 18, 200, 4);
        return;
      }
      [-1, 1].forEach((side) =>
        halves.push({
          x: it.x, y: it.y,
          vx: it.vx * 0.5 + Math.cos(ang + Math.PI / 2) * side * 120,
          vy: Math.min(it.vy, 0) * 0.3 - 80,
          rot: ang, spin: side * 4, kind: it.kind, side, life: 1.6,
        })
      );
      sliced++;
      swipeHits++;
      const pts = 10 * (frenzyT > 0 ? 2 : 1);
      A.addScore(pts);
      A.sfx("swipe");
      const c = JUICE[it.kind] || "#7CFFB2";
      splats.push({ x: it.x, y: it.y, c, r: 18 + Math.random() * 12, life: 2.5 });
      A.particles.burst(it.x, it.y, c, 12, 200, 3.5);
      A.float("+" + pts, it.x, it.y - 24, frenzyT > 0 ? "#FFD166" : "#ffffff");
      if (sliced % 20 === 0) A.toast("💡 " + FACTS[it.kind], 2400);
    }
    function star(ctx: CanvasRenderingContext2D, r: number) {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
      g.addColorStop(0, "#fff6c0");
      g.addColorStop(0.5, "#ffd166");
      g.addColorStop(1, "#e08a00");
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }

    return {
      reset() {
        items = []; halves = []; splats = []; trail = []; last = null;
        swipeHits = 0; waveT = 0.8; lives = 3; frenzyT = 0; t = 0; sliced = 0; flash = 0;
      },
      pointer(type, x, y, A) {
        if (type === "down") { last = { x, y }; trail = [{ x, y, a: 1 }]; swipeHits = 0; return; }
        if (type === "up") { endSwipe(A); return; }
        if (type !== "drag" || !last) return;
        const ax = last.x, ay = last.y;
        if (Math.hypot(x - ax, y - ay) < 3) return;
        trail.push({ x, y, a: 1 });
        if (trail.length > 14) trail.shift();
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (segDist(it.x, it.y, ax, ay, x, y) < it.r) {
            items.splice(i, 1);
            slice(it, ax, ay, x, y, A);
            if (A.state !== "play" || !last) return;
          }
        }
        last = { x, y };
      },
      update(dt, A) {
        t += dt;
        flash = Math.max(0, flash - dt);
        trail.forEach((p) => (p.a -= dt * 5));
        trail = trail.filter((p) => p.a > 0);
        halves.forEach((h) => { h.vy += G * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt; h.life -= dt; });
        halves = halves.filter((h) => h.life > 0 && h.y < H + 60);
        splats.forEach((s) => (s.life -= dt));
        splats = splats.filter((s) => s.life > 0);
        if (A.state === "menu") { if (items.length < 3 && Math.random() < dt * 1.5) launch(0, true); }
        else if (A.state !== "play") return;
        const level = A.state === "play" ? Math.min(10, A.time / 10) : 0;
        if (A.state === "play") {
          frenzyT = Math.max(0, frenzyT - dt);
          waveT -= dt;
          if (waveT <= 0) {
            const n = frenzyT > 0 ? 2 : 1 + Math.floor(Math.random() * (1 + level * 0.4));
            for (let i = 0; i < n; i++) setTimeout(() => A.state === "play" && launch(level), i * 160);
            waveT = frenzyT > 0 ? 0.45 : Math.max(0.75, 1.7 - level * 0.09) * (0.8 + Math.random() * 0.4);
          }
        }
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.vy += G * dt * (frenzyT > 0 ? 0.8 : 1);
          it.x += it.vx * dt;
          it.y += it.vy * dt;
          it.rot += it.spin * dt;
          if (it.x < 24 || it.x > W - 24) { it.vx *= -0.6; it.x = Math.max(24, Math.min(W - 24, it.x)); }
          if (it.vy > 0 && it.y > H + 40) {
            items.splice(i, 1);
            if (A.state === "play" && !it.bad && !it.power) {
              lives--;
              A.sfx("hit");
              A.float("Dropped! −1 ❤", it.x, H - 40, "#FF8FA3");
              if (lives <= 0) { A.gameOver(); return; }
            }
          }
        }
      },
      draw(ctx, A) {
        // night sky over the desert
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#070a24");
        bg.addColorStop(0.7, "#2a1f4e");
        bg.addColorStop(1, "#6a3a3a");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255,.7)";
        for (let i = 0; i < 60; i++) { const s = (i * 7) % 3 ? 1.5 : 2.5; ctx.fillRect((i * 89) % W, (i * 53) % (H * 0.7), s, s); }
        ctx.fillStyle = "#2a1a1e";
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 70 - Math.sin(x * 0.02) * 18 - Math.sin(x * 0.051) * 10);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        const vg = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 420);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,.35)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);

        splats.forEach((s) => {
          ctx.globalAlpha = Math.min(0.55, (s.life / 2.5) * 0.55);
          ctx.fillStyle = s.c;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
          for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(s.x + Math.cos(k * 1.3) * s.r * 1.25, s.y + Math.sin(k * 1.3) * s.r * 1.25, 4, 0, 7); ctx.fill(); }
        });
        ctx.globalAlpha = 1;
        A.drawHero(W - 46, H - 44, 76, 0, flash > 0 ? "hurt" : "happy");

        halves.forEach((h) => {
          ctx.save();
          ctx.translate(h.x, h.y);
          ctx.rotate(h.rot);
          ctx.beginPath();
          ctx.rect(-32, h.side < 0 ? -32 : 0, 64, 32);
          ctx.clip();
          ctx.globalAlpha = Math.min(1, h.life);
          A.drawSprite(h.kind, 0, 0, 58, 0);
          ctx.restore();
          ctx.save();
          ctx.translate(h.x, h.y);
          ctx.rotate(h.rot);
          ctx.globalAlpha = Math.min(0.9, h.life);
          ctx.fillStyle = JUICE[h.kind] || "#fff";
          ctx.fillRect(-22, -1.5, 44, 3);
          ctx.restore();
        });

        items.forEach((it) => {
          ctx.save();
          ctx.translate(it.x, it.y);
          if (it.bad) {
            const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 36);
            g.addColorStop(0, "rgba(255,59,92,.45)");
            g.addColorStop(1, "rgba(255,59,92,0)");
            ctx.fillStyle = g;
            ctx.fillRect(-36, -36, 72, 72);
          }
          if (it.power) {
            const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 38 + Math.sin(t * 10) * 3);
            g.addColorStop(0, "rgba(255,215,0,.55)");
            g.addColorStop(1, "rgba(255,215,0,0)");
            ctx.fillStyle = g;
            ctx.fillRect(-42, -42, 84, 84);
          }
          ctx.rotate(it.rot);
          if (it.power === "star") star(ctx, 24);
          else A.drawSprite(spriteFor(it.kind), 0, 0, 60);
          ctx.restore();
        });

        if (trail.length > 1) {
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          for (let i = 1; i < trail.length; i++) {
            const p = trail[i], q = trail[i - 1], w = 2 + (i / trail.length) * 10;
            ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, p.a)})`;
            ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.strokeStyle = `rgba(124,255,178,${Math.max(0, p.a) * 0.6})`;
            ctx.lineWidth = w * 0.4;
            ctx.stroke();
          }
        }
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.8})`; ctx.fillRect(0, 0, W, H); }

        if (A.state === "play" || A.state === "dying") {
          for (let i = 0; i < 3; i++) A.drawSprite("heart", 76 + i * 28, 82, 28, 0, i < lives ? 1 : 0.2);
          if (frenzyT > 0) {
            ctx.font = A.font(15);
            ctx.textAlign = "right";
            ctx.fillStyle = "#FFD166";
            ctx.fillText(`⭐ SHOWER ×2  ${Math.ceil(frenzyT)}`, W - 62, 88);
          }
        }
      },
    };
  },
};
