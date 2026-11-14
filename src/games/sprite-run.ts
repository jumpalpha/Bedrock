import type { Api, GameModule } from "./engine/types";

const W = 420, H = 680, HORIZON = 230, CX = W / 2;
const F = 200, ZN = 4, CAM = 7.4;
const LANE = 2.2, ROAD = LANE * 1.5 + 0.3;
const ZFAR = 95;
const sc = (z: number) => F / (z + ZN);
const gy = (z: number) => HORIZON + CAM * sc(z);

type Kind = "log" | "bar" | "wall";
type Row = { k: Kind; lane: number; z: number; hit: boolean };
type Gem = { lane: number; z: number; kind: "crystal" | "garnet" | "nugget" | "water"; h: number };
const GEM_SPRITE = { crystal: "crystal", garnet: "star-garnet", nugget: "gold-nugget", water: "water-drop" } as const;
const GEM_COLOR = { crystal: "#C48CFF", garnet: "#FF4D6D", nugget: "#FFD23F", water: "#38BFFF" } as const;

export const spriteRun: GameModule = {
  config: {
    key: "bedrock_sprite_run",
    title: "Sprite Run",
    subtitle: "Outrun the landslide!",
    W, H,
    winAt: 1000,
    winText: "You outran the landslide!",
    swipe: true,
    deathDelay: 900,
    medals: [
      { at: 300, name: "Bronze", icon: "🥉" },
      { at: 1000, name: "Silver", icon: "🥈" },
      { at: 2000, name: "Gold", icon: "🥇" },
      { at: 3500, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Swipe left/right</b> to change lanes. <b>Swipe up</b> to jump fallen logs, <b>swipe down</b> to slide under rock ledges. Lava walls block the lane, so dodge them! Grab gems and water for points.",
    controls: "← → change lane · ↑ / Space jump · ↓ slide · P pause",
    overTitle: "Buried!",
    accent: "#A855F7",
    sprites: ["boulder", "lava-bomb", ...Object.values(GEM_SPRITE)],
    facts: [
      "Mass movement is when rock and soil slide downhill because of gravity.",
      "A landslide is a big mass of rock and soil that suddenly breaks loose and races downhill.",
      "Creep is the slowest mass movement, maybe a few centimeters a year. Look for tilted fence posts.",
      "Water triggers landslides: it adds weight and makes soil slippery.",
      "Mudflows are common after wildfires, because there are no roots left to hold the soil.",
      "A landslide can move tons of sediment in seconds.",
      "Rockfall is why mountain roads have \"Watch for Falling Rock\" signs.",
    ],
  },
  create() {
    let hero = { lane: 1, laneF: 1, jy: 0, vy: 0, slide: 0, dead: false, runT: 0, tumble: 0 };
    let rows: Row[] = [], gems: Gem[] = [];
    let travel = 0, dist = 0, bonus = 0, speed = 16, nextRow = 40, curvePh = 0, streak = 0, nextMile = 250;
    const mountains = Array.from({ length: 14 }, (_, i) => ({ x: i * 36 - 20, h: 30 + Math.random() * 55 }));
    const curve = (z: number) => Math.sin(curvePh) * 0.0022 * z * z;
    const sx = (x: number, z: number) => CX + (x + curve(z)) * sc(z);
    const fade = (z: number) => Math.max(0, Math.min(1, (ZFAR - z) / 25));

    function spawnRow(A: Api, z: number) {
      const t = A.time;
      const types: (Kind | null)[] = [null, null, null];
      const safe = Math.floor(Math.random() * 3);
      const pickHard = (): Kind => { const r = Math.random(); return r < 0.4 ? "wall" : r < 0.7 ? "log" : "bar"; };
      if (t < 8) {
        types[Math.floor(Math.random() * 3)] = (["log", "bar", "wall"] as const)[Math.floor(Math.random() * 3)];
      } else {
        for (let l = 0; l < 3; l++) {
          if (l === safe) types[l] = Math.random() < Math.min(0.5, t * 0.008) ? (Math.random() < 0.5 ? "log" : "bar") : null;
          else types[l] = Math.random() < Math.min(0.85, 0.45 + t * 0.006) ? pickHard() : null;
        }
      }
      types.forEach((k, l) => { if (k) rows.push({ k, lane: l, z, hit: false }); });
      if (Math.random() < 0.7) {
        const fl = types[safe] ? Math.floor(Math.random() * 3) : safe;
        const kind = (["crystal", "garnet", "nugget", "water"] as const)[Math.floor(Math.random() * 4)];
        for (let i = 0; i < 4; i++) gems.push({ lane: fl, z: z + 3 + i * 2.4, kind, h: 0.6 });
      }
    }

    function die(A: Api) {
      hero.dead = true;
      hero.vy = 6;
      A.particles.burst(sx((hero.laneF - 1) * LANE, 0), gy(0) - 50, "#FFD166", 28, 280, 5);
      A.gameOver();
    }

    function quad(ctx: CanvasRenderingContext2D, xa: number, xb: number, xc: number, xd: number, y0: number, y1: number, fill: string) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(xa, y0);
      ctx.lineTo(xb, y0);
      ctx.lineTo(xc, y1);
      ctx.lineTo(xd, y1);
      ctx.closePath();
      ctx.fill();
    }

    function prop(ctx: CanvasRenderingContext2D, A: Api, x: number, z: number, id: number) {
      const s = sc(z), X = sx(x, z), Y = gy(z);
      ctx.globalAlpha = fade(z);
      if (id % 3 === 0) {
        const w = 0.9 * s, h = 3.6 * s;
        const g = ctx.createLinearGradient(X - w / 2, 0, X + w / 2, 0);
        g.addColorStop(0, "#3a3633");
        g.addColorStop(0.4, "#6e6862");
        g.addColorStop(1, "#2e2a27");
        A.rr(X - w / 2, Y - h, w, h, Math.max(1, w * 0.14));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.fillStyle = "#8f8a83";
        ctx.fillRect(X - w / 2, Y - h, w, h * 0.1);
        ctx.fillStyle = "rgba(0,0,0,.15)";
        ctx.fillRect(X - w / 2, Y - h * 0.6, w, h * 0.05);
        ctx.fillRect(X - w / 2, Y - h * 0.3, w, h * 0.05);
      } else {
        const tr = 0.35 * s, th = 2.2 * s;
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(X - tr / 2, Y - th, tr, th);
        const r = 1.2 * s;
        ([[0, -th - r * 0.4, 1], [-r * 0.7, -th, 0.8], [r * 0.7, -th, 0.8]] as const).forEach(([dx, dy, m]) => {
          const g = ctx.createRadialGradient(X + dx - r * 0.3 * m, Y + dy - r * 0.3 * m, r * 0.1, X + dx, Y + dy, r * m);
          g.addColorStop(0, id % 2 ? "#7fb08a" : "#8fbf92");
          g.addColorStop(1, id % 2 ? "#2a5a3c" : "#33664a");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(X + dx, Y + dy, r * m, 0, 7);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;
    }

    function obstacle(ctx: CanvasRenderingContext2D, A: Api, o: Row) {
      if (o.z < -ZN + 1) return;
      const s = sc(o.z), X = sx((o.lane - 1) * LANE, o.z), Y = gy(o.z), w = LANE * 0.86 * s;
      ctx.globalAlpha = fade(o.z);
      ctx.fillStyle = "rgba(0,0,0,.2)";
      ctx.beginPath();
      ctx.ellipse(X, Y, w * 0.55, w * 0.12, 0, 0, 7);
      ctx.fill();
      if (o.k === "log") {
        const h = 0.7 * s;
        const g = ctx.createLinearGradient(0, Y - h, 0, Y);
        g.addColorStop(0, "#a56a3d");
        g.addColorStop(0.5, "#7a3b1f");
        g.addColorStop(1, "#4a2412");
        A.rr(X - w / 2, Y - h, w, h, h * 0.3);
        ctx.fillStyle = g;
        ctx.fill();
        const wg = ctx.createLinearGradient(0, Y - h, 0, Y);
        wg.addColorStop(0, "#c9a27a");
        wg.addColorStop(1, "#8a6040");
        ctx.fillStyle = wg;
        ctx.fillRect(X - w * 0.24, Y - h, w * 0.48, h);
        ctx.fillStyle = "rgba(255,255,255,.3)";
        ctx.fillRect(X - w / 2 + h * 0.2, Y - h * 0.85, w - h * 0.4, h * 0.12);
        A.drawSprite("boulder", X, Y - h * 1.15, h * 1.4);
      } else if (o.k === "bar") {
        const top = 2.5 * s, bot = 1.35 * s, pw = 0.16 * s;
        ctx.fillStyle = "#6a4c30";
        ctx.fillRect(X - w / 2, Y - top, pw, top);
        ctx.fillRect(X + w / 2 - pw, Y - top, pw, top);
        const g = ctx.createLinearGradient(0, Y - top, 0, Y - bot);
        g.addColorStop(0, "#a39a90");
        g.addColorStop(1, "#5e564f");
        A.rr(X - w / 2, Y - top, w, top - bot, Math.max(2, s * 0.12));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.25)";
        ctx.fillRect(X - w / 2 + 3, Y - top + 3, w - 6, (top - bot) * 0.18);
        if (s > 10) {
          ctx.fillStyle = "#fff";
          ctx.font = A.font(Math.round((top - bot) * 0.42));
          ctx.textAlign = "center";
          ctx.fillText("DUCK!", X, Y - bot - (top - bot) * 0.3);
        }
      } else {
        const h = 2.9 * s, d = sc(o.z + 0.9), Yb = gy(o.z + 0.9), Xb = sx((o.lane - 1) * LANE, o.z + 0.9);
        ctx.fillStyle = "#2a2422";
        ctx.beginPath();
        ctx.moveTo(X - w / 2, Y - h);
        ctx.lineTo(X + w / 2, Y - h);
        ctx.lineTo(Xb + LANE * 0.43 * d, Yb - 2.9 * d);
        ctx.lineTo(Xb - LANE * 0.43 * d, Yb - 2.9 * d);
        ctx.closePath();
        ctx.fill();
        const g = ctx.createLinearGradient(X - w / 2, 0, X + w / 2, 0);
        g.addColorStop(0, "#3a3230");
        g.addColorStop(0.35, "#5e524c");
        g.addColorStop(1, "#2a2422");
        A.rr(X - w / 2, Y - h, w, h, Math.max(2, s * 0.14));
        ctx.fillStyle = g;
        ctx.fill();
        // glowing lava vent
        A.rr(X - w * 0.38, Y - h * 0.86, w * 0.76, h * 0.52, Math.max(2, s * 0.08));
        ctx.fillStyle = "#7a1e08";
        ctx.fill();
        A.drawSprite("lava-bomb", X, Y - h * 0.6, h * 0.5);
        ctx.fillStyle = "rgba(255,255,255,.2)";
        ctx.fillRect(X - w / 2 + s * 0.1, Y - h + s * 0.15, s * 0.12, h - s * 0.3);
        ctx.fillStyle = "#ff7a2b";
        ctx.fillRect(X - w * 0.25, Y - h * 0.24, w * 0.5, h * 0.08);
      }
      ctx.globalAlpha = 1;
    }

    function gemDraw(ctx: CanvasRenderingContext2D, A: Api, f: Gem) {
      if (f.z < -ZN + 1) return;
      const s = sc(f.z), X = sx((f.lane - 1) * LANE, f.z), Y = gy(f.z) - (f.h + Math.sin(travel * 0.6 + f.z) * 0.12) * s, r = 0.34 * s;
      ctx.globalAlpha = fade(f.z);
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath();
      ctx.ellipse(X, gy(f.z), r, r * 0.3, 0, 0, 7);
      ctx.fill();
      const g = ctx.createRadialGradient(X, Y, 1, X, Y, r * 2);
      g.addColorStop(0, "rgba(255,255,255,.4)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(X - r * 2, Y - r * 2, r * 4, r * 4);
      if (!A.drawSprite(GEM_SPRITE[f.kind], X, Y, r * 3)) {
        ctx.fillStyle = GEM_COLOR[f.kind];
        ctx.beginPath();
        ctx.arc(X, Y, r, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function heroDraw(ctx: CanvasRenderingContext2D, A: Api) {
      const s = sc(0), X = sx((hero.laneF - 1) * LANE, 0), Y = gy(0);
      const size = 100, sl = hero.slide > 0 && hero.jy < 0.4;
      ctx.fillStyle = "rgba(0,0,0,.3)";
      ctx.beginPath();
      ctx.ellipse(X, Y, 30 - hero.jy * 6, 8, 0, 0, 7);
      ctx.fill();
      const bob = hero.jy === 0 && !hero.dead ? Math.abs(Math.sin(hero.runT * 11)) * 5 : 0;
      const lean = (hero.lane - hero.laneF) * 0.35;
      ctx.save();
      ctx.translate(X, Y - hero.jy * s - size * 0.44 - bob + (sl ? size * 0.18 : 0));
      if (sl) ctx.scale(1.25, 0.62);
      A.drawHero(0, 0, size, hero.dead ? hero.tumble * 6 : lean, hero.dead ? "hurt" : "back");
      ctx.restore();
      if (sl && !hero.dead) for (let i = 0; i < 2; i++) A.particles.trail(X + (Math.random() - 0.5) * 50, Y - 4, "rgba(255,230,180,.7)");
    }

    function pill(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number, text: string, right = false) {
      ctx.font = A.font(14, 700);
      const w = ctx.measureText(text).width + 24;
      const left = right ? x - w : x;
      A.rr(left, y, w, 30, 15);
      ctx.fillStyle = "rgba(7,7,26,.72)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#FFD166";
      ctx.textAlign = "center";
      ctx.fillText(text, left + w / 2, y + 20);
    }

    return {
      reset() {
        hero = { lane: 1, laneF: 1, jy: 0, vy: 0, slide: 0, dead: false, runT: 0, tumble: 0 };
        rows = [];
        gems = [];
        travel = 0;
        dist = 0;
        bonus = 0;
        speed = 16;
        nextRow = 40;
        curvePh = 0;
        streak = 0;
        nextMile = 250;
      },

      input(type, A) {
        if (hero.dead || A.state !== "play") return;
        if (type === "left" && hero.lane > 0) {
          hero.lane--;
          A.sfx("swipe");
        } else if (type === "right" && hero.lane < 2) {
          hero.lane++;
          A.sfx("swipe");
        } else if (type === "up" || type === "tap") {
          if (hero.jy <= 0.001) {
            hero.vy = 9.4;
            hero.slide = 0;
            A.sfx("jump");
          }
        } else if (type === "down") {
          if (hero.jy > 0.001) hero.vy = Math.min(hero.vy, -14);
          hero.slide = 0.75;
          A.sfx("swipe");
        }
      },

      update(dt, A) {
        const live = A.state === "play" || A.state === "dying";
        curvePh += dt * 0.25;
        if (!live) {
          travel += 8 * dt;
          hero.runT += dt;
          return;
        }
        if (hero.dead) {
          hero.tumble += dt;
          hero.vy -= 22 * dt;
          hero.jy = Math.max(0, hero.jy + hero.vy * dt);
          return;
        }
        speed = Math.min(36, 16 + A.time * 0.33);
        const dz = speed * dt;
        travel += dz;
        dist += dz;
        hero.runT += (dt * speed) / 16;

        hero.laneF += Math.sign(hero.lane - hero.laneF) * Math.min(Math.abs(hero.lane - hero.laneF), dt * 11);
        if (hero.jy > 0 || hero.vy > 0) {
          hero.vy -= 26 * dt;
          hero.jy += hero.vy * dt;
          if (hero.jy <= 0) {
            hero.jy = 0;
            hero.vy = 0;
            A.particles.burst(sx((hero.laneF - 1) * LANE, 0), gy(0), "rgba(255,240,200,.8)", 6, 90, 3);
          }
        }
        if (hero.slide > 0) hero.slide = Math.max(0, hero.slide - dt);

        nextRow -= dz;
        if (nextRow <= 0) {
          spawnRow(A, ZFAR);
          nextRow = speed * Math.max(0.68, 1.25 - A.time * 0.007) + Math.random() * 6;
        }

        const myLane = Math.round(hero.laneF);
        for (let i = rows.length - 1; i >= 0; i--) {
          const o = rows[i];
          o.z -= dz;
          if (o.z < -6) {
            rows.splice(i, 1);
            continue;
          }
          if (!o.hit && o.z < 0.9 && o.z > -0.9 && o.lane === myLane) {
            const ok = (o.k === "log" && hero.jy > 0.75) || (o.k === "bar" && hero.slide > 0 && hero.jy < 0.4);
            if (!ok) {
              o.hit = true;
              die(A);
              return;
            }
          }
        }
        for (let i = gems.length - 1; i >= 0; i--) {
          const f = gems[i];
          f.z -= dz;
          if (f.z < -3) {
            gems.splice(i, 1);
            streak = 0;
            continue;
          }
          if (Math.abs(f.z) < 0.9 && f.lane === myLane && hero.jy < 2) {
            gems.splice(i, 1);
            streak++;
            const pts = streak >= 8 ? 20 : 10;
            bonus += pts;
            A.sfx("coin");
            const x = sx((hero.laneF - 1) * LANE, 0), y = gy(0) - 70;
            A.particles.burst(x, y, GEM_COLOR[f.kind], 14, 170, 4);
            A.float("+" + pts, x, y - 20, "#7CFFB2");
            if (streak === 8) A.toast("🔥 Gem streak! Double points");
          }
        }
        const total = Math.floor(dist) + bonus;
        if (total > A.score) A.setScore(total);
        if (A.score >= nextMile) {
          nextMile += 250;
          A.sfx("point");
          A.float(nextMile - 250 + "m!", CX, 170, "#FFD166");
        }
      },

      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
        g.addColorStop(0, "#1c1430");
        g.addColorStop(0.5, "#a0504a");
        g.addColorStop(1, "#ffc27a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, HORIZON + 2);
        const sun = ctx.createRadialGradient(CX + 90, HORIZON - 40, 5, CX + 90, HORIZON - 40, 90);
        sun.addColorStop(0, "rgba(255,240,170,.9)");
        sun.addColorStop(0.3, "rgba(255,220,140,.45)");
        sun.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = sun;
        ctx.fillRect(CX - 10, HORIZON - 140, 200, 140);
        ctx.fillStyle = "#fff0b8";
        ctx.beginPath();
        ctx.arc(CX + 90, HORIZON - 40, 28, 0, 7);
        ctx.fill();

        ctx.fillStyle = "#5a3a40";
        ctx.beginPath();
        ctx.moveTo(0, HORIZON);
        mountains.forEach((m) => {
          const x = m.x - ((curvePh * 40) % 36);
          ctx.lineTo(x, HORIZON - m.h);
          ctx.lineTo(x + 18, HORIZON - m.h * 0.7);
        });
        ctx.lineTo(W, HORIZON);
        ctx.closePath();
        ctx.fill();
        // smoking volcano silhouette
        const tx = CX - 20 - Math.sin(curvePh) * 30;
        ctx.fillStyle = "rgba(90,80,85,.45)";
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(tx + Math.sin(curvePh * 3 + i) * 6 + i * 5, HORIZON - 92 - i * 16, 9 + i * 4, 0, 7);
          ctx.fill();
        }
        ctx.fillStyle = "#3a2228";
        ctx.beginPath();
        ctx.moveTo(tx - 70, HORIZON);
        ctx.lineTo(tx - 12, HORIZON - 72);
        ctx.lineTo(tx + 12, HORIZON - 72);
        ctx.lineTo(tx + 70, HORIZON);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ff7a2b";
        ctx.beginPath();
        ctx.ellipse(tx, HORIZON - 72, 12, 3, 0, 0, 7);
        ctx.fill();

        const jg = ctx.createLinearGradient(0, HORIZON, 0, H);
        jg.addColorStop(0, "#3a3028");
        jg.addColorStop(1, "#6a5a3e");
        ctx.fillStyle = jg;
        ctx.fillRect(0, HORIZON, W, H - HORIZON);

        const seg = 2, off = travel % seg, ZMIN = -ZN + 0.6;
        for (let k = Math.ceil((ZFAR + off) / seg); k >= 0; k--) {
          const zb = k * seg - off, za = Math.max(ZMIN, zb - seg);
          if (zb <= ZMIN) continue;
          const y0 = gy(za), y1 = gy(zb);
          const band = (k + Math.floor(travel / seg)) % 2;
          quad(ctx, sx(-ROAD - 0.5, za), sx(ROAD + 0.5, za), sx(ROAD + 0.5, zb), sx(-ROAD - 0.5, zb), y0, y1, band ? "#7a5a3a" : "#664a2e");
          quad(ctx, sx(-ROAD, za), sx(ROAD, za), sx(ROAD, zb), sx(-ROAD, zb), y0, y1, band ? "#ecd29e" : "#dcbd85");
          if (band) [-LANE / 2, LANE / 2].forEach((x) => quad(ctx, sx(x - 0.06, za), sx(x + 0.06, za), sx(x + 0.06, zb), sx(x - 0.06, zb), y0, y1, "rgba(120,80,40,.5)"));
        }

        const list: { z: number; d: () => void }[] = [];
        const step = 7, base = travel % step;
        for (let k = 0; k * step - base < ZFAR; k++) {
          const z = k * step - base;
          if (z < -3) continue;
          const id = Math.floor(travel / step) + k;
          list.push({ z, d: () => prop(ctx, A, -ROAD - 1.6, z, id) });
          list.push({ z, d: () => prop(ctx, A, ROAD + 1.6, z, id + 1) });
        }
        rows.forEach((o) => list.push({ z: o.z, d: () => obstacle(ctx, A, o) }));
        gems.forEach((f) => list.push({ z: f.z, d: () => gemDraw(ctx, A, f) }));
        list.push({ z: 0.01, d: () => heroDraw(ctx, A) });
        list.sort((p, q) => q.z - p.z).forEach((it) => it.d());

        const hz = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 60);
        hz.addColorStop(0, "rgba(255,194,122,.7)");
        hz.addColorStop(1, "rgba(255,194,122,0)");
        ctx.fillStyle = hz;
        ctx.fillRect(0, HORIZON, W, 60);

        if (A.state === "play" || A.state === "dying") {
          pill(ctx, A, 12, H - 44, Math.floor(dist) + " m");
          if (streak >= 2) pill(ctx, A, W - 12, H - 44, "💎 x" + streak, true);
        }
      },
    };
  },
};
