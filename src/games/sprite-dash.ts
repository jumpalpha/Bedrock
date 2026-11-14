import type { Api, GameModule } from "./engine/types";

const W = 800, H = 400, GROUND = 320;

type Kind = "rock" | "lava" | "lava2" | "twister" | "bigrock" | "meteor";
type Obs = { k: Kind; x: number; y: number; w: number; h: number; t: number };
type Item = { x: number; y: number; kind: "crystal" | "nugget" | "fossil"; t: number };

const KINDS: { k: Kind; w: number; h: number }[] = [
  { k: "rock", w: 52, h: 40 },
  { k: "lava", w: 34, h: 62 },
  { k: "lava2", w: 64, h: 62 },
  { k: "twister", w: 44, h: 54 },
  { k: "bigrock", w: 58, h: 58 },
];
const SPRITE: Record<Kind, string> = {
  rock: "boulder", lava: "lava-bomb", lava2: "lava-bomb", twister: "tornado", bigrock: "boulder", meteor: "meteor",
};
const ITEM_SPRITE = { crystal: "crystal", nugget: "gold-nugget", fossil: "fossil" } as const;
const ITEM_COLOR = { crystal: "#C48CFF", nugget: "#FFD23F", fossil: "#E6CFA0" } as const;

const hex = (h: string) => h.match(/\w\w/g)!.map((v) => parseInt(v, 16));
const lerpC = (a: string, b: string, t: number) => {
  const pa = hex(a), pb = hex(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
};

export const spriteDash: GameModule = {
  config: {
    key: "bedrock_sprite_dash",
    title: "Sprite Dash",
    subtitle: "Race across the Snake River Plain!",
    W, H,
    winAt: 1000,
    winText: "You crossed the lava fields!",
    medals: [
      { at: 300, name: "Bronze", icon: "🥉" },
      { at: 1000, name: "Silver", icon: "🥈" },
      { at: 2000, name: "Gold", icon: "🥇" },
      { at: 3500, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Jump</b> over boulders, lava bombs and twisters. <b>Duck</b> under flying meteors. Hold jump to go higher. Grab crystals, gold and fossils for +25.",
    controls: "Space / ↑ / tap = jump · ↓ = duck · P = pause",
    overTitle: "Crunch!",
    accent: "#00E5A0",
    pad: [
      { label: "⬇ Duck", type: "down" },
      { label: "⬆ Jump", type: "tap", wide: true },
    ],
    sprites: [...Object.values(SPRITE), ...Object.values(ITEM_SPRITE)],
    facts: [
      "The Snake River Plain is covered in basalt, layers of dark lava rock stacked hundreds of feet deep.",
      "The Yellowstone hotspot burned a trail of old volcanoes across southern Idaho as North America drifted over it.",
      "NASA astronauts trained at Craters of the Moon in 1969 before going to the Moon.",
      "A meteor is a space rock burning up in our atmosphere. If it hits the ground, it's a meteorite.",
      "Pahoehoe lava is smooth and ropey. A'a lava is jagged and sharp.",
      "A tornado's winds can top 300 mph. Idaho gets only a few small ones a year.",
      "Idaho is the Gem State, with over 70 kinds of gems.",
    ],
  },
  create() {
    let hero = { x: 120, y: GROUND, vy: 0, duck: false, onGround: true, runT: 0, dead: false };
    let obs: Obs[] = [], items: Item[] = [];
    let speed = 340, spawnD = 500, dist = 0, scrollX = 0, nextMilestone = 100, dayPhase = 0, holdJump = false;
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * 200, r: Math.random() * 1.5 + 0.4 }));

    const heroBox = () =>
      hero.duck && hero.onGround ? { x: hero.x - 22, y: hero.y - 30, w: 44, h: 28 } : { x: hero.x - 18, y: hero.y - 52, w: 36, h: 48 };

    function jump(A: Api) {
      if (hero.dead) return;
      holdJump = true;
      if (hero.onGround) {
        hero.vy = -760;
        hero.onGround = false;
        hero.duck = false;
        A.sfx("jump");
        A.particles.burst(hero.x, GROUND, "rgba(255,240,200,.8)", 6, 80, 3);
      }
    }
    function checkScore(A: Api) {
      if (A.score >= nextMilestone) {
        nextMilestone += 100;
        A.sfx("point");
      }
    }
    function die(A: Api) {
      hero.dead = true;
      hero.vy = -500;
      hero.onGround = false;
      A.particles.burst(hero.x, hero.y - 26, "#FFD166", 26, 260, 5);
      A.gameOver();
    }
    function hills(ctx: CanvasRenderingContext2D, off: number, base: number, amp: number, period: number, c1: string, c2: string) {
      const g = ctx.createLinearGradient(0, base - amp, 0, GROUND);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      for (let x = 0; x <= W; x += 8) {
        const t = (x + off) / period;
        ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(t) * Math.cos(t * 0.43)));
      }
      ctx.lineTo(W, GROUND);
      ctx.closePath();
      ctx.fill();
    }

    return {
      reset() {
        hero = { x: 120, y: GROUND, vy: 0, duck: false, onGround: true, runT: 0, dead: false };
        obs = [];
        items = [];
        speed = 340;
        spawnD = 500;
        dist = 0;
        scrollX = 0;
        nextMilestone = 100;
        dayPhase = 0;
        holdJump = false;
      },

      input(type, A) {
        if (type === "tap" || type === "up") jump(A);
        else if (type === "down") {
          hero.duck = true;
          if (!hero.onGround) hero.vy = Math.max(hero.vy, 700);
        } else if (type === "release-down") hero.duck = false;
        else if (type === "release-tap" || type === "release-up") holdJump = false;
      },

      update(dt, A) {
        const live = A.state === "play" || A.state === "dying";
        dayPhase = (dist / 900) % 2;
        if (!live) {
          scrollX += 60 * dt;
          hero.runT += dt;
          return;
        }
        if (hero.dead) {
          hero.vy += 2400 * dt;
          hero.y = Math.min(GROUND, hero.y + hero.vy * dt);
          return;
        }
        speed = Math.min(780, 340 + A.time * 11);
        const dx = speed * dt;
        scrollX += dx;
        dist += dx / 10;
        const pts = Math.floor(dist);
        if (pts > A.score) {
          A.setScore(pts);
          checkScore(A);
        }

        hero.runT += (dt * speed) / 340;
        if (!hero.onGround) {
          hero.vy += (holdJump && hero.vy < 0 ? 1700 : 3000) * dt;
          hero.y += hero.vy * dt;
          if (hero.y >= GROUND) {
            hero.y = GROUND;
            hero.vy = 0;
            hero.onGround = true;
            A.particles.burst(hero.x, GROUND, "rgba(255,240,200,.7)", 5, 60, 3);
          }
        } else if (Math.random() < 0.35) A.particles.trail(hero.x - 16, GROUND - 4, "rgba(255,240,200,.5)");

        spawnD -= dx;
        if (spawnD <= 0) {
          if (A.score > 250 && Math.random() < 0.28) {
            const high = Math.random() < 0.45;
            obs.push({ k: "meteor", x: W + 40, w: 54, h: 34, y: high ? GROUND - 112 : GROUND - 64, t: 0 });
          } else {
            const K = KINDS[Math.floor(Math.random() * (A.score > 120 ? KINDS.length : 2))];
            obs.push({ k: K.k, x: W + 40, w: K.w, h: K.h, y: GROUND - K.h, t: 0 });
          }
          if (Math.random() < 0.55) {
            items.push({
              x: W + 200 + Math.random() * 120,
              y: GROUND - (Math.random() < 0.5 ? 40 : 140),
              kind: (["crystal", "nugget", "fossil"] as const)[Math.floor(Math.random() * 3)],
              t: 0,
            });
          }
          spawnD = 330 + speed * 0.5 + Math.random() * (420 - Math.min(250, A.time * 6));
        }

        const hb = heroBox();
        for (let i = obs.length - 1; i >= 0; i--) {
          const o = obs[i];
          o.x -= dx;
          o.t += dt;
          if (o.x < -100) {
            obs.splice(i, 1);
            continue;
          }
          const pad = 6;
          if (hb.x < o.x + o.w - pad && hb.x + hb.w > o.x + pad && hb.y < o.y + o.h - pad && hb.y + hb.h > o.y + pad) {
            die(A);
            return;
          }
        }
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.x -= dx;
          it.t += dt;
          if (it.x < -40) {
            items.splice(i, 1);
            continue;
          }
          if (Math.abs(it.x - hero.x) < 30 && Math.abs(it.y - (hero.y - 28)) < 38) {
            items.splice(i, 1);
            dist += 25;
            A.setScore(Math.floor(dist));
            checkScore(A);
            A.sfx("coin");
            A.particles.burst(it.x, it.y, ITEM_COLOR[it.kind], 16, 190, 4);
            A.float("+25", it.x, it.y - 12, "#7CFFB2");
          }
        }
      },

      draw(ctx, A) {
        const night = dayPhase < 0.75 ? 0 : dayPhase < 1 ? (dayPhase - 0.75) * 4 : dayPhase < 1.75 ? 1 : 1 - (dayPhase - 1.75) * 4;
        const n = Math.min(1, Math.max(0, night));
        const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
        sky.addColorStop(0, lerpC("4fa3e8", "0b0a2e", n));
        sky.addColorStop(0.55, lerpC("f4b58a", "2b1f4e", n));
        sky.addColorStop(1, lerpC("ffe0b0", "3a3a5a", n));
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        if (n > 0) {
          ctx.globalAlpha = n;
          ctx.fillStyle = "#fff";
          stars.forEach((s) => {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, 7);
            ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
        // sun / moon with glow
        const cy = 80 + n * 10;
        const glow = ctx.createRadialGradient(640, cy, 10, 640, cy, 110);
        glow.addColorStop(0, n > 0.5 ? "rgba(255,240,210,.5)" : "rgba(255,230,140,.6)");
        glow.addColorStop(1, "rgba(255,230,140,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(520, 0, 240, 220);
        ctx.fillStyle = n > 0.5 ? "#fff6e0" : "#ffe27a";
        ctx.beginPath();
        ctx.arc(640, cy, 34, 0, 7);
        ctx.fill();

        hills(ctx, scrollX * 0.12, 250, 70, 220, lerpC("b98a7a", "3a2a4a", n), lerpC("8a5f55", "1c1428", n));
        hills(ctx, scrollX * 0.3, 285, 45, 150, lerpC("a9b582", "4a5a44", n), lerpC("6f7d55", "232c22", n));

        // ground
        const gg = ctx.createLinearGradient(0, GROUND, 0, H);
        gg.addColorStop(0, lerpC("c9b88a", "6a6250", n));
        gg.addColorStop(0.18, lerpC("a8956a", "4a4436", n));
        gg.addColorStop(0.19, lerpC("4a423c", "24201d", n));
        gg.addColorStop(1, lerpC("2c2622", "141110", n));
        ctx.fillStyle = gg;
        ctx.fillRect(0, GROUND, W, H - GROUND);
        const off = scrollX % 60;
        ctx.fillStyle = "rgba(0,0,0,.12)";
        for (let x = -off; x < W + 60; x += 60) {
          ctx.fillRect(x + 8, GROUND + 30, 18, 6);
          ctx.fillRect(x + 36, GROUND + 52, 12, 5);
        }
        ctx.fillStyle = "rgba(255,255,255,.18)";
        for (let x = -off; x < W + 60; x += 30) ctx.fillRect(x, GROUND + 2, 14, 2);

        // items
        items.forEach((it) => {
          const y = it.y + Math.sin(it.t * 4) * 5;
          const g = ctx.createRadialGradient(it.x, y, 2, it.x, y, 28);
          g.addColorStop(0, "rgba(255,255,255,.35)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(it.x - 28, y - 28, 56, 56);
          if (!A.drawSprite(ITEM_SPRITE[it.kind], it.x, y, 40, Math.sin(it.t * 3) * 0.15)) {
            ctx.fillStyle = ITEM_COLOR[it.kind];
            ctx.beginPath();
            ctx.arc(it.x, y, 12, 0, 7);
            ctx.fill();
          }
        });

        // obstacles
        obs.forEach((o) => {
          const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
          if (o.k !== "meteor") {
            ctx.fillStyle = "rgba(0,0,0,.22)";
            ctx.beginPath();
            ctx.ellipse(cx, GROUND + 3, o.w * 0.55, 5, 0, 0, 7);
            ctx.fill();
          }
          if (o.k === "lava2") {
            A.drawSprite("lava-bomb", o.x + 16, cy, 70) && A.drawSprite("lava-bomb", o.x + 48, cy, 70);
          } else if (o.k === "meteor") {
            const f = Math.sin(o.t * 18);
            // flickering fire trail behind the meteor
            ctx.save();
            ctx.translate(cx, cy);
            for (const [len, wid, col] of [[64, 16, "rgba(255,90,30,.55)"], [44, 10, "rgba(255,190,70,.8)"]] as const) {
              ctx.fillStyle = col;
              ctx.beginPath();
              ctx.ellipse(20 + len / 2, f * 2, len / 2 + f * 3, wid, 0, 0, 7);
              ctx.fill();
            }
            ctx.restore();
            A.drawSprite("meteor", cx, cy, 62, Math.sin(o.t * 6) * 0.15);
          } else {
            const size = Math.max(o.w, o.h) * 1.35;
            if (!A.drawSprite(SPRITE[o.k], cx, cy - 2, size)) {
              ctx.fillStyle = "#ff4d6d";
              A.rr(o.x, o.y, o.w, o.h, 8);
              ctx.fill();
            }
          }
        });

        // hero
        const sh = hero.duck && hero.onGround;
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.beginPath();
        ctx.ellipse(hero.x, GROUND + 4, 26 - (GROUND - hero.y) * 0.05, 5, 0, 0, 7);
        ctx.fill();
        const bob = hero.onGround && !hero.dead ? Math.abs(Math.sin(hero.runT * 12)) * 4 : 0;
        ctx.save();
        ctx.translate(hero.x, hero.y - 32 - bob + (sh ? 12 : 0));
        ctx.scale(sh ? 1.2 : 1, sh ? 0.68 : 1);
        A.drawHero(0, 0, 74, hero.dead ? 0.5 : hero.onGround ? 0 : -0.12, hero.dead ? "hurt" : hero.onGround ? "run" : "happy");
        ctx.restore();
      },
    };
  },
};
