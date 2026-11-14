import type { Api, GameModule } from "./engine/types";

const W = 400, H = 640, GROUND = 560;
const HAZARDS = ["lava-bomb", "boulder", "meteor", "storm-cloud"] as const;
// Vent pillars: molten lava, grey basalt, scorched iron, and storm-dark rock.
const TOWER_TINT: Record<string, [string, string]> = {
  "lava-bomb": ["#ff6a2b", "#8a1e0a"],
  boulder: ["#8f8a83", "#3e3a35"],
  meteor: ["#7a5a6e", "#2c1a26"],
  "storm-cloud": ["#5f6f8a", "#232b3b"],
};

export const spriteFlap: GameModule = {
  config: {
    key: "bedrock_sprite_flap",
    title: "Sprite Flap",
    subtitle: "Fly through the volcanic vents!",
    W, H,
    winAt: 15,
    winText: "You cleared the vents!",
    medals: [
      { at: 5, name: "Bronze", icon: "🥉" },
      { at: 15, name: "Silver", icon: "🥈" },
      { at: 30, name: "Gold", icon: "🥇" },
      { at: 50, name: "Legend", icon: "💎" },
    ],
    howTo: "Tap or press <b>Space</b> to flap. Fly through the gaps and grab 💧 water drops and 💎 crystals for bonus points.",
    controls: "Tap · Space · ↑ to flap · P to pause",
    overTitle: "Bonk!",
    accent: "#38BFFF",
    sprites: [...HAZARDS, "water-drop", "crystal"],
    facts: [
      "Magma is melted rock underground. Once it reaches the surface, it's called lava.",
      "Magma forms where it's roughly 700 °C to 1,300 °C. It's lighter than the rock around it, so it rises.",
      "Runny, low-silica magma oozes out calmly. Thick, high-silica magma traps gas and explodes.",
      "Volcanic bombs are huge chunks of tephra blasted into the air during an eruption.",
      "Craters of the Moon in Idaho last erupted only about 2,000 years ago.",
      "About 75% of Earth's active volcanoes sit on the Ring of Fire around the Pacific Ocean.",
      "Volcanic gas is mostly water vapor, plus carbon dioxide and sulfur dioxide.",
    ],
  },
  create() {
    type Pillar = { x: number; top: number; g: number; w: number; type: (typeof HAZARDS)[number]; passed: boolean };
    type Drop = { x: number; y: number; t: number; kind: "water" | "crystal" };
    let hero = { x: 110, y: 290, vy: 0, rot: 0, dead: false };
    let pillars: Pillar[] = [], drops: Drop[] = [];
    let spawnT = 0.9, speed = 150, scrollX = 0, wingT = 0, clock = 0;
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * 330, r: Math.random() * 1.5 + 0.3, tw: Math.random() * 6 }));
    const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 110 + Math.random() * 40, y: 70 + Math.random() * 170, s: 0.7 + Math.random() * 0.7 }));

    const gap = (A: Api) => Math.max(140, 178 - A.score * 1.3);

    function die(A: Api) {
      if (hero.dead) return;
      hero.dead = true;
      hero.vy = -250;
      A.particles.burst(hero.x, hero.y, "#FFD166", 26, 260, 5);
      A.gameOver();
    }

    function ridge(ctx: CanvasRenderingContext2D, off: number, base: number, amp: number, period: number, top: string, bottom: string) {
      const g = ctx.createLinearGradient(0, base - amp, 0, GROUND);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      for (let x = 0; x <= W; x += 8) {
        const t = (x + off) / period;
        ctx.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(t) * Math.cos(t * 0.37)));
      }
      ctx.lineTo(W, GROUND);
      ctx.closePath();
      ctx.fill();
    }

    function tower(ctx: CanvasRenderingContext2D, A: Api, p: Pillar, y: number, h: number, top: boolean) {
      if (h <= 0) return;
      const [c1, c2] = TOWER_TINT[p.type];
      const x = p.x, w = p.w;
      // body
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, c2);
      g.addColorStop(0.35, c1);
      g.addColorStop(0.7, c1);
      g.addColorStop(1, c2);
      ctx.save();
      A.rr(x, y - (top ? 20 : 0), w, h + 20, 14);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();
      // sheen
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(x + 8, y - 20, 7, h + 40);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(x + w - 12, y - 20, 12, h + 40);
      // stacked hazards on the face
      const step = 58;
      const sz = 54;
      if (top) {
        for (let yy = y + h - 40; yy > y - step; yy -= step) A.drawSprite(p.type, x + w / 2, yy, sz, 0, 0.95);
      } else {
        for (let yy = y + 40; yy < y + h + step; yy += step) A.drawSprite(p.type, x + w / 2, yy, sz, 0, 0.95);
      }
      ctx.restore();
      // cap
      const capY = top ? y + h - 16 : y;
      A.rr(x - 7, capY, w + 14, 16, 8);
      const cg = ctx.createLinearGradient(0, capY, 0, capY + 16);
      cg.addColorStop(0, "#ffffff");
      cg.addColorStop(0.15, c1);
      cg.addColorStop(1, c2);
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    return {
      reset() {
        hero = { x: 110, y: 290, vy: 0, rot: 0, dead: false };
        pillars = [];
        drops = [];
        spawnT = 0.9;
        speed = 150;
        scrollX = 0;
        wingT = 0;
      },

      input(type, A) {
        if ((type !== "tap" && type !== "up") || hero.dead) return;
        hero.vy = -400;
        wingT = 0.18;
        A.sfx("flap");
        A.particles.burst(hero.x - 14, hero.y + 10, "rgba(255,255,255,.8)", 5, 70, 3);
      },

      update(dt, A) {
        clock += dt;
        const playing = A.state === "play" || A.state === "dying";
        scrollX += (playing && !hero.dead ? speed : 40) * dt;
        stars.forEach((s) => (s.tw += dt * 2));
        clouds.forEach((c) => {
          c.x -= (playing && !hero.dead ? 18 : 8) * c.s * dt;
          if (c.x < -90) {
            c.x = W + 40;
            c.y = 70 + Math.random() * 170;
          }
        });
        if (A.state === "menu" || A.state === "over") {
          hero.y = 290 + Math.sin(performance.now() / 300) * 10;
          hero.rot = 0;
          return;
        }

        hero.vy += 1350 * dt;
        hero.y += hero.vy * dt;
        hero.rot = Math.max(-0.45, Math.min(1.3, hero.vy / 650));
        wingT = Math.max(0, wingT - dt);
        if (hero.y < 24) {
          hero.y = 24;
          hero.vy = 0;
        }
        if (!hero.dead && hero.y > GROUND - 22) {
          hero.y = GROUND - 22;
          die(A);
        }
        if (hero.dead) {
          if (hero.y > GROUND - 22) {
            hero.y = GROUND - 22;
            hero.vy = 0;
          }
          return;
        }
        if (Math.random() < 0.5) A.particles.trail(hero.x - 18, hero.y + 6, "rgba(180,240,255,.45)");

        speed = Math.min(235, 150 + A.score * 2.2);
        spawnT -= dt;
        if (spawnT <= 0) {
          const g = gap(A), top = 70 + Math.random() * (GROUND - 140 - g);
          pillars.push({ x: W + 40, top, g, w: 70, type: HAZARDS[Math.floor(Math.random() * HAZARDS.length)], passed: false });
          if (Math.random() < 0.6) drops.push({ x: W + 75, y: top + g / 2, t: Math.random() * 6, kind: Math.random() < 0.7 ? "water" : "crystal" });
          spawnT = Math.max(1.15, 1.55 - A.score * 0.01);
        }

        const r = 17;
        for (let i = pillars.length - 1; i >= 0; i--) {
          const p = pillars[i];
          p.x -= speed * dt;
          if (p.x < -90) {
            pillars.splice(i, 1);
            continue;
          }
          if (!p.passed && p.x + p.w < hero.x - r) {
            p.passed = true;
            A.addScore(1);
            A.sfx("point");
          }
          const inX = hero.x + r > p.x + 4 && hero.x - r < p.x + p.w - 4;
          if (inX && (hero.y - r < p.top || hero.y + r > p.top + p.g)) {
            die(A);
            return;
          }
        }
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.x -= speed * dt;
          d.t += dt;
          if (d.x < -30) {
            drops.splice(i, 1);
            continue;
          }
          if (Math.hypot(d.x - hero.x, d.y - hero.y) < 30) {
            drops.splice(i, 1);
            A.addScore(1);
            A.sfx("coin");
            const c = d.kind === "water" ? "#7FD3FF" : "#C48CFF";
            A.particles.burst(d.x, d.y, c, 16, 190, 4);
            A.float(d.kind === "water" ? "+1 💧" : "+1 💎", d.x, d.y - 10, d.kind === "water" ? "#9BE0FF" : "#E2C4FF");
          }
        }
      },

      draw(ctx, A) {
        // sky
        const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
        sky.addColorStop(0, "#0d0a1c");
        sky.addColorStop(0.45, "#2e1730");
        sky.addColorStop(0.8, "#7a2e24");
        sky.addColorStop(1, "#f0803a");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        // ember glow drifting in the smoke
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 2; i++) {
          const ag = ctx.createLinearGradient(0, 80, 0, 220);
          ag.addColorStop(0, "rgba(255,120,40,0)");
          ag.addColorStop(0.5, i ? "rgba(255,80,40,.10)" : "rgba(255,150,60,.12)");
          ag.addColorStop(1, "rgba(255,120,40,0)");
          ctx.fillStyle = ag;
          ctx.beginPath();
          ctx.moveTo(0, 150);
          for (let x = 0; x <= W; x += 10) ctx.lineTo(x, 120 + i * 30 + Math.sin(x / 60 + clock * 0.6 + i) * 22);
          ctx.lineTo(W, 260);
          ctx.lineTo(0, 260);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        stars.forEach((s) => {
          ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.tw));
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, 7);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        // moon
        const mg = ctx.createRadialGradient(318, 92, 10, 318, 92, 80);
        mg.addColorStop(0, "rgba(255,240,200,.55)");
        mg.addColorStop(1, "rgba(255,240,200,0)");
        ctx.fillStyle = mg;
        ctx.fillRect(220, 0, 200, 200);
        const mb = ctx.createRadialGradient(310, 84, 4, 318, 92, 30);
        mb.addColorStop(0, "#fffaf0");
        mb.addColorStop(1, "#ffd9a0");
        ctx.fillStyle = mb;
        ctx.beginPath();
        ctx.arc(318, 92, 30, 0, 7);
        ctx.fill();

        ridge(ctx, scrollX * 0.12, 410, 100, 170, "#4a2a3a", "#1e1218");
        clouds.forEach((c) => {
          ctx.fillStyle = "rgba(200,190,190,.13)";
          [[0, 0, 24], [22, -9, 19], [42, 0, 22], [20, 7, 22]].forEach(([dx, dy, r]) => {
            ctx.beginPath();
            ctx.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, 7);
            ctx.fill();
          });
        });
        ridge(ctx, scrollX * 0.3, 470, 70, 120, "#5a4a44", "#2a201d");
        // sagebrush line
        for (let i = -1; i < 8; i++) {
          const off = scrollX * 0.3;
          const x = i * 64 - (off % 64) + 20, y = 478 + 9 * Math.sin((i + Math.floor(off / 64)) * 1.7);
          const tg = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, 18);
          tg.addColorStop(0, "#b8c48f");
          tg.addColorStop(1, "#5d6b48");
          ctx.fillStyle = "#3d2a20";
          ctx.fillRect(x - 3, y + 6, 6, 18);
          ctx.fillStyle = tg;
          ctx.beginPath();
          ctx.arc(x, y, 17, 0, 7);
          ctx.fill();
        }

        pillars.forEach((p) => {
          tower(ctx, A, p, 0, p.top, true);
          tower(ctx, A, p, p.top + p.g, GROUND - (p.top + p.g), false);
        });

        drops.forEach((d) => {
          const y = d.y + Math.sin(d.t * 3) * 6;
          const glow = ctx.createRadialGradient(d.x, y, 2, d.x, y, 30);
          glow.addColorStop(0, d.kind === "water" ? "rgba(127,211,255,.55)" : "rgba(196,140,255,.5)");
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(d.x - 30, y - 30, 60, 60);
          if (!A.drawSprite(d.kind === "water" ? "water-drop" : "crystal", d.x, y, 40, Math.sin(d.t * 2) * 0.15)) {
            ctx.fillStyle = d.kind === "water" ? "#4CC4FF" : "#A564F0";
            ctx.beginPath();
            ctx.arc(d.x, y, 12, 0, 7);
            ctx.fill();
          }
        });

        // ground
        const gg = ctx.createLinearGradient(0, GROUND, 0, H);
        gg.addColorStop(0, "#ff9a3c");
        gg.addColorStop(0.12, "#b8401a");
        gg.addColorStop(0.13, "#3a302c");
        gg.addColorStop(1, "#1a1412");
        ctx.fillStyle = gg;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        const off = scrollX % 36;
        for (let x = -off; x < W + 36; x += 36) {
          ctx.fillStyle = "rgba(255,255,255,.18)";
          ctx.fillRect(x, GROUND + 2, 18, 3);
          ctx.fillStyle = "rgba(0,0,0,.18)";
          ctx.fillRect(x + 8, GROUND + 28, 12, 6);
          ctx.fillRect(x + 24, GROUND + 50, 9, 5);
        }

        // hero
        const flap = wingT > 0 ? 1.08 : 1 + Math.sin(performance.now() / 90) * 0.03;
        A.drawHero(hero.x, hero.y, 66 * flap, hero.rot, hero.dead ? "hurt" : "wings");
      },
    };
  },
};
