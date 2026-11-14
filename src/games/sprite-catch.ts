import type { GameModule } from "./engine/types";
import { GOOD, GOOD_FACTS as FACTS, HAZARD } from "./engine/earth-art";

const W = 420, H = 640, FLOOR = 590;

export const spriteCatch: GameModule = {
  config: {
    key: "bedrock_sprite_catch",
    title: "Sprite Catch",
    subtitle: "Catch the crystals, dodge the meteors!",
    W, H,
    winAt: 1000,
    winText: "You hauled in 1,000 points of treasure!",
    deathDelay: 800,
    overTitle: "Rocked!",
    accent: "#00E5A0",
    medals: [
      { at: 400, name: "Bronze", icon: "🥉" },
      { at: 1000, name: "Silver", icon: "🥈" },
      { at: 2200, name: "Gold", icon: "🥇" },
      { at: 4000, name: "Legend", icon: "💎" },
    ],
    howTo: "Catch falling <b>crystals, gems and fossils</b> in your basket. Catch in a row for combos! Lava bombs, meteors and boulders cost a heart. ⭐ = gem magnet. <b>1,000 points</b> wins.",
    controls: "Move mouse / drag finger · or ← → · P pause",
    pad: [
      { label: "◀", type: "left", wide: true },
      { label: "▶", type: "right", wide: true },
    ],
    sprites: [...GOOD, ...HAZARD, "star", "heart"],
    facts: [
      "Idaho is the Gem State, with more than 70 kinds of gems.",
      "A mineral is natural, inorganic, solid, has a set chemical makeup, and has atoms in a repeating pattern.",
      "Gold is about 19 times denser than water, so it sinks to the bottom of a gold pan.",
      "Lava bombs are blobs of lava thrown from a volcano that cool in the air before they land.",
      "Most meteors burn up in the atmosphere about 50–80 km above the ground.",
    ],
  },
  create() {
    type Item = { x: number; y: number; vy: number; kind: string; bad: boolean; power: boolean; rot: number; spin: number };
    const me = { x: W / 2, squash: 0, hurtT: 0 };
    let items: Item[] = [], spawnT = 0.6, lives = 3, combo = 0, keys: Record<string, boolean> = {}, aimX: number | null = null, magnetT = 0, t = 0, caught = 0;

    return {
      reset() { me.x = W / 2; me.squash = 0; me.hurtT = 0; items = []; spawnT = 0.6; lives = 3; combo = 0; keys = {}; aimX = null; magnetT = 0; t = 0; caught = 0; },
      input(type) {
        if (type === "left" || type === "right") { keys[type] = true; aimX = null; }
        else if (type === "release-left" || type === "release-right") keys[type.slice(8)] = false;
      },
      pointer(_t, x) { aimX = x; },
      update(dt, A) {
        t += dt;
        me.squash = Math.max(0, me.squash - dt * 4);
        me.hurtT = Math.max(0, me.hurtT - dt);
        items.forEach((it) => (it.rot += it.spin * dt));
        if (A.state !== "play") { if (A.state === "menu") me.x = W / 2 + Math.sin(t) * 100; return; }
        magnetT = Math.max(0, magnetT - dt);
        const level = Math.min(10, A.time / 12);
        if (keys.left) me.x -= 360 * dt;
        if (keys.right) me.x += 360 * dt;
        if (aimX != null) me.x += (aimX - me.x) * Math.min(1, dt * 16);
        me.x = Math.max(30, Math.min(W - 30, me.x));
        spawnT -= dt;
        if (spawnT <= 0) {
          const bad = Math.random() < Math.min(0.42, 0.18 + level * 0.025), power = !bad && Math.random() < 0.035;
          items.push({
            x: 30 + Math.random() * (W - 60), y: 40, vy: 150 + level * 26 + Math.random() * 50,
            kind: power ? "star" : bad ? HAZARD[Math.floor(Math.random() * HAZARD.length)] : GOOD[Math.floor(Math.random() * GOOD.length)],
            bad, power, rot: 0, spin: (Math.random() - 0.5) * 3,
          });
          spawnT = Math.max(0.32, 0.85 - level * 0.05) * (0.7 + Math.random() * 0.6);
        }
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (magnetT > 0 && !it.bad && it.y > 200) it.x += (me.x - it.x) * Math.min(1, dt * 3);
          it.y += it.vy * dt;
          if (it.y > FLOOR - 60 && it.y < FLOOR - 20 && Math.abs(it.x - me.x) < 38) {
            items.splice(i, 1);
            me.squash = 1;
            if (it.bad) {
              lives--; combo = 0;
              A.sfx("hit"); A.shake(8, 0.25); me.hurtT = 1.2;
              A.particles.burst(it.x, FLOOR - 50, "#FF8FA3", 16, 200, 4);
              A.float("Ouch! −1 ❤", it.x, FLOOR - 60, "#FF8FA3");
              if (lives <= 0) { A.gameOver(); return; }
            } else if (it.power) {
              magnetT = 8; A.sfx("medal"); A.toast("🧲 Gem magnet! Treasure flies to you for 8s");
            } else {
              combo++; caught++;
              const mult = combo >= 20 ? 4 : combo >= 10 ? 3 : combo >= 5 ? 2 : 1, pts = 10 * mult;
              A.addScore(pts); A.sfx(mult > 1 ? "coin" : "point");
              A.particles.burst(it.x, FLOOR - 50, "#7CFFB2", 10, 150, 3);
              A.float("+" + pts, it.x, FLOOR - 60, mult > 1 ? "#FFD166" : "#7CFFB2");
              if (combo === 5 || combo === 10 || combo === 20) A.toast(`🔥 ${combo} combo! ×${mult}`);
              if (caught % 15 === 0) A.toast("💡 " + FACTS[it.kind], 2200);
            }
            continue;
          }
          if (it.y > H + 30) {
            items.splice(i, 1);
            if (!it.bad && !it.power && combo > 0) { combo = 0; A.float("combo lost", it.x, FLOOR - 20, "#e0dcff"); }
          }
        }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, 480);
        g.addColorStop(0, "#3d7fd8");
        g.addColorStop(1, "#ffd8a8");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const sun = ctx.createRadialGradient(340, 110, 6, 340, 110, 120);
        sun.addColorStop(0, "rgba(255,248,200,.95)");
        sun.addColorStop(0.3, "rgba(255,235,150,.4)");
        sun.addColorStop(1, "rgba(255,235,150,0)");
        ctx.fillStyle = sun;
        ctx.fillRect(220, 0, 240, 240);
        // red-rock mesas with crystal outcrops
        ([[-20, 300, 150, "#b5623a"], [150, 340, 120, "#9c4f2e"], [300, 290, 170, "#b5623a"]] as const).forEach(([x, top, w, c]) => {
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.moveTo(x, 480); ctx.lineTo(x + 18, top); ctx.lineTo(x + w - 18, top); ctx.lineTo(x + w, 480); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "rgba(255,210,170,.18)";
          for (let k = 0; k < 4; k++) ctx.fillRect(x + 10, top + 24 + k * 38, w - 20, 6);
          A.drawSprite("crystal", x + w / 2, top - 6, 26);
        });
        const gg = ctx.createLinearGradient(0, 480, 0, H);
        gg.addColorStop(0, "#e2b27a");
        gg.addColorStop(1, "#a86a3a");
        ctx.fillStyle = gg;
        ctx.fillRect(0, 480, W, H - 480);
        items.forEach((it) => {
          ctx.save();
          ctx.translate(it.x, it.y);
          if (it.bad || it.power) {
            const hg = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
            hg.addColorStop(0, it.bad ? "rgba(255,59,92,.45)" : "rgba(255,215,0,.6)");
            hg.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = hg;
            ctx.fillRect(-28, -28, 56, 56);
          }
          ctx.rotate(it.rot);
          A.drawSprite(it.kind, 0, 0, 44);
          ctx.restore();
        });
        const sq = me.squash;
        ctx.fillStyle = "rgba(0,0,0,.2)";
        ctx.beginPath(); ctx.ellipse(me.x, FLOOR + 14, 30, 6, 0, 0, 7); ctx.fill();
        ctx.save();
        ctx.translate(me.x, FLOOR);
        ctx.scale(1 + sq * 0.12, 1 - sq * 0.12);
        A.drawHero(0, -12, 96, 0, me.hurtT > 0 ? "hurt" : "happy");
        const bg = ctx.createLinearGradient(0, -60, 0, -36);
        bg.addColorStop(0, "#e5a868");
        bg.addColorStop(1, "#9a6232");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.moveTo(-36, -60); ctx.lineTo(36, -60); ctx.lineTo(28, -36); ctx.lineTo(-28, -36); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#7a4a22";
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 16, -60); ctx.lineTo(i * 13, -36); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-34, -52); ctx.lineTo(34, -52); ctx.stroke();
        ctx.fillStyle = "#c9894e";
        A.rr(-38, -64, 76, 6, 3);
        ctx.fill();
        ctx.restore();
        if (magnetT > 0) {
          ctx.strokeStyle = `rgba(255,215,0,${0.4 + Math.sin(t * 12) * 0.3})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(me.x, FLOOR - 30, 56, 0, 7); ctx.stroke();
        }
        for (let i = 0; i < Math.max(0, lives); i++) A.drawSprite("heart", 66 + i * 24, 76, 22);
        if (combo >= 2) {
          ctx.font = A.font(15);
          ctx.textAlign = "right";
          ctx.fillStyle = "#1a1030";
          ctx.fillText(`🔥 ${combo} combo`, W - 62, 82);
        }
      },
    };
  },
};
