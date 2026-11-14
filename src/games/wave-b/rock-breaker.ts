import type { Api, GameModule } from "../engine/types";
import { shade } from "../engine/color";

const W = 420, H = 640, PY = 586, BR = 8;
const COLS = 8, BW = 48, BH = 26, GAP = 3, TOP = 96, LEFT = (W - (COLS * BW + (COLS - 1) * GAP)) / 2;
const ROWS_STYLE = [
  { rock: "rock-obsidian", color: "#5B5470", habit: "Obsidian weathers to sediment" },
  { rock: "rock-granite", color: "#E58C7A", habit: "Granite weathers to sand" },
  { rock: "rock-basalt", color: "#6B7A8F", habit: "Basalt erodes away" },
  { rock: "rock-sandstone", color: "#E8B45A", habit: "Sandstone breaks down" },
  { rock: "rock-shale", color: "#8FA37A", habit: "Shale becomes slate" },
  { rock: "rock-marble", color: "#C9B8E8", habit: "Marble melts to magma" },
];
const TIPS = [
  "Igneous rock forms when magma or lava cools and hardens.", "Weathering breaks rock into sediment; erosion carries it away.", "Sediment pressed and cemented together becomes sedimentary rock.",
  "Heat and pressure turn rock into metamorphic rock without melting it.", "Shale becomes slate, and limestone becomes marble.", "Any rock can become any other kind of rock in the rock cycle.",
];
const POWERS = {
  wide: { art: "crystal", name: "Crystal growth: wide paddle!" },
  multi: { art: "water-drop", name: "Rainstorm: 3 balls!" },
  slow: { art: "fossil", name: "Deep time: slower ball!" },
  life: { art: "heart", name: "Extra life!" },
} as const;
type PK = keyof typeof POWERS;

export const rockBreaker: GameModule = {
  config: {
    key: "bedrock_rock_breaker",
    title: "Rock Breaker",
    subtitle: "Smash your way around the rock cycle!",
    W, H,
    winText: "You broke two walls of rock!",
    deathDelay: 900,
    overTitle: "Out of lives!",
    accent: "#E8A33D",
    medals: [
      { at: 400, name: "Bronze", icon: "🥉" },
      { at: 1000, name: "Silver", icon: "🥈" },
      { at: 2000, name: "Gold", icon: "🥇" },
      { at: 3500, name: "Legend", icon: "💎" },
    ],
    howTo: "Bounce the magma ball to break every rock block. Gold ⭐ blocks drop power-ups. <b>Clear 2 walls</b> to win!",
    controls: "Move mouse / drag finger · or ← → · Space or tap to launch · P pause",
    pad: [
      { label: "◀", type: "left", wide: true },
      { label: "🚀", type: "up" },
      { label: "▶", type: "right", wide: true },
    ],
    sprites: [...ROWS_STYLE.map((r) => r.rock), "star-garnet", "heart", "lava-bomb", "crystal", "water-drop", "fossil"],
    facts: [
      "The rock cycle has no start or end: igneous, sedimentary, and metamorphic rocks keep changing into each other.",
      "Granite cools slowly underground, so it has big crystals; basalt cools fast at the surface, so its crystals are tiny.",
      "Obsidian is volcanic glass. It cooled so fast that no crystals formed at all.",
      "Idaho's Snake River Plain is covered in basalt lava flows, like the ones at Craters of the Moon.",
      "Marble is metamorphic rock made when limestone is squeezed and heated deep underground.",
    ],
  },
  create() {
    type Brick = { x: number; y: number; w: number; h: number; hp: number; max: number; gold: boolean; rock: string; color: string; habit: string; hit: number };
    type Ball = { x: number; y: number; vx: number; vy: number; stuck: boolean; trail: [number, number][] };
    let api: Api;
    const paddle = { x: W / 2, w: 86, t: 0, bump: 0 };
    let balls: Ball[] = [], bricks: Brick[] = [], drops: { x: number; y: number; k: PK; t: number }[] = [];
    let lives = 3, level = 1, keys = { l: false, r: false }, launchHint = 1, slowT = 0, wideT = 0, aimX: number | null = null, bricksLeft = 0, newLevel = false;

    function buildLevel(n: number) {
      bricks = [];
      const rows = Math.min(6, 4 + n);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < COLS; c++) {
          if (n % 3 === 2 && (r + c) % 4 === 0 && r > 0) continue;
          if (n % 3 === 0 && n > 0 && Math.abs(c - 3.5) < 1 && r < 2) continue;
          const st = ROWS_STYLE[r % ROWS_STYLE.length];
          const tough = n >= 2 && r < 2;
          bricks.push({ x: LEFT + c * (BW + GAP), y: TOP + r * (BH + GAP), w: BW, h: BH, hp: tough ? 2 : 1, max: tough ? 2 : 1, gold: Math.random() < 0.12, rock: st.rock, color: st.color, habit: st.habit, hit: 0 });
        }
      bricksLeft = bricks.length;
    }
    const newBall = (stuck: boolean): Ball => ({ x: paddle.x, y: PY - 14 - BR, vx: 0, vy: 0, stuck, trail: [] });
    const speed = () => Math.min(560, 340 + level * 30 + Math.min(60, api?.time ?? 0) * 2) * (slowT > 0 ? 0.7 : 1);
    function launch(A: Api) {
      balls.forEach((b) => {
        if (!b.stuck) return;
        b.stuck = false;
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        b.vx = Math.cos(a) * speed();
        b.vy = Math.sin(a) * speed();
        A.sfx("jump");
      });
      launchHint = 0;
    }
    function hitBrick(br: Brick, A: Api) {
      br.hp--;
      br.hit = 0.15;
      if (br.hp > 0) { A.sfx("point"); return; }
      const cx = br.x + br.w / 2, cy = br.y + br.h / 2;
      A.addScore(br.gold ? 50 : 10 * level);
      A.sfx("coin");
      A.particles.burst(cx, cy, br.color, 14, 200, 4);
      if (Math.random() < 0.18) A.float(br.habit + "!", cx, cy, "#fff");
      if (br.gold) {
        const ks = Object.keys(POWERS) as PK[];
        let k = ks[Math.floor(Math.random() * ks.length)];
        if (k === "life" && lives >= 5) k = "wide";
        drops.push({ x: cx, y: cy, k, t: 0 });
        A.toast("💡 " + TIPS[Math.floor(Math.random() * TIPS.length)], 2200);
      }
      bricksLeft = bricks.filter((x) => x.hp > 0).length;
      if (bricksLeft <= 0) levelClear(A);
    }
    function levelClear(A: Api) {
      A.addScore(100 * level);
      A.sfx("win");
      A.float(`Level ${level} clear! +${100 * level}`, W / 2, 320, "#FFD166");
      if (level === 2) A.win("You broke two walls of rock!");
      level++;
      buildLevel(level);
      drops = [];
      newLevel = true;
      balls = [newBall(true)];
      launchHint = 1;
    }
    function lose(A: Api) {
      lives--;
      A.sfx("hit");
      A.shake(8, 0.25);
      if (lives <= 0) { A.gameOver(); return; }
      A.toast(`💔 ${lives} ${lives === 1 ? "life" : "lives"} left`);
      balls = [newBall(true)];
      launchHint = 1;
      wideT = 0;
    }

    return {
      reset(A) {
        api = A;
        paddle.x = W / 2; paddle.w = 86; level = 1; lives = 3; keys = { l: false, r: false };
        drops = []; slowT = 0; wideT = 0; aimX = null; launchHint = 1;
        buildLevel(level);
        balls = [newBall(true)];
      },
      input(type, A) {
        if (type === "left") keys.l = true;
        else if (type === "release-left") keys.l = false;
        else if (type === "right") keys.r = true;
        else if (type === "release-right") keys.r = false;
        else if (type === "tap" || type === "up") launch(A);
      },
      pointer(type, x, _y, A) {
        aimX = x;
        if (type === "up") launch(A);
      },
      update(dt, A) {
        api = A;
        paddle.t += dt;
        paddle.bump = Math.max(0, paddle.bump - dt * 5);
        if (A.state !== "play") {
          if (A.state === "menu") paddle.x = W / 2 + Math.sin(paddle.t) * 80;
          balls.forEach((b) => { if (b.stuck) b.x = paddle.x; });
          return;
        }
        slowT = Math.max(0, slowT - dt);
        wideT = Math.max(0, wideT - dt);
        bricksLeft = bricks.filter((x) => x.hp > 0).length;
        const tw = wideT > 0 ? 130 : 86;
        paddle.w += (tw - paddle.w) * Math.min(1, dt * 8);
        if (keys.l) { paddle.x -= 480 * dt; aimX = null; }
        if (keys.r) { paddle.x += 480 * dt; aimX = null; }
        if (aimX != null) paddle.x += (aimX - paddle.x) * Math.min(1, dt * 18);
        paddle.x = Math.max(paddle.w / 2 + 4, Math.min(W - paddle.w / 2 - 4, paddle.x));

        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          if (b.stuck) { b.x = paddle.x; b.y = PY - 14 - BR; continue; }
          if (bricksLeft <= 3 && b.vy < 0) {
            let tgt: Brick | null = null, bd = 1e9;
            bricks.forEach((br) => { if (br.hp > 0) { const d = Math.abs(br.x + br.w / 2 - b.x); if (d < bd) { bd = d; tgt = br; } } });
            if (tgt) b.vx += Math.sign((tgt as Brick).x + (tgt as Brick).w / 2 - b.x) * 260 * dt;
          }
          const sp = speed(), cur = Math.hypot(b.vx, b.vy) || 1;
          b.vx *= sp / cur;
          b.vy *= sp / cur;
          if (Math.abs(b.vy) < sp * 0.3) { b.vy = Math.sign(b.vy || -1) * sp * 0.3; b.vx = Math.sign(b.vx) * Math.sqrt(sp * sp - b.vy * b.vy); }
          const steps = Math.ceil((sp * dt) / 4);
          for (let s = 0; s < steps; s++) {
            b.x += (b.vx * dt) / steps;
            b.y += (b.vy * dt) / steps;
            if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); }
            if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx); }
            if (b.y < 64 + BR) { b.y = 64 + BR; b.vy = Math.abs(b.vy); }
            if (b.vy > 0 && b.y + BR >= PY - 8 && b.y < PY + 6 && Math.abs(b.x - paddle.x) < paddle.w / 2 + BR) {
              const a = -Math.PI / 2 + ((b.x - paddle.x) / (paddle.w / 2)) * 1.05;
              b.vx = Math.cos(a) * sp;
              b.vy = Math.sin(a) * sp;
              b.y = PY - 8 - BR;
              A.sfx("flap");
              paddle.bump = 1;
            }
            for (const br of bricks) {
              if (br.hp <= 0) continue;
              const nx = Math.max(br.x, Math.min(b.x, br.x + br.w)), ny = Math.max(br.y, Math.min(b.y, br.y + br.h));
              const dx = b.x - nx, dy = b.y - ny;
              if (dx * dx + dy * dy <= BR * BR) {
                if (Math.abs(dx) > Math.abs(dy)) b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
                else b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
                if (dx === 0 && dy === 0) b.vy = -b.vy;
                hitBrick(br, A);
                break;
              }
            }
            if (A.state !== "play" || newLevel) { newLevel = false; return; }
          }
          b.trail.push([b.x, b.y]);
          if (b.trail.length > 10) b.trail.shift();
          if (b.y > H + 20) balls.splice(i, 1);
        }
        if (!balls.length) { lose(A); return; }
        bricks.forEach((br) => { if (br.hit > 0) br.hit -= dt; });

        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.y += 150 * dt;
          d.t += dt;
          if (d.y > H + 20) { drops.splice(i, 1); continue; }
          if (d.y > PY - 20 && d.y < PY + 14 && Math.abs(d.x - paddle.x) < paddle.w / 2 + 12) {
            drops.splice(i, 1);
            A.sfx("medal");
            A.toast(POWERS[d.k].name);
            A.particles.burst(d.x, PY, "#7CFFB2", 16, 200, 4);
            if (d.k === "wide") wideT = 12;
            if (d.k === "slow") slowT = 8;
            if (d.k === "life") lives++;
            if (d.k === "multi") {
              const src = balls.find((b) => !b.stuck) || balls[0];
              if (src.stuck) launch(A);
              [-0.5, 0.5].forEach((da) => {
                const a = Math.atan2(src.vy, src.vx) + da;
                balls.push({ x: src.x, y: src.y, stuck: false, trail: [], vx: Math.cos(a) * speed(), vy: Math.sin(a) * speed() });
              });
            }
          }
        }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#1a1020");
        g.addColorStop(0.6, "#2a1a1a");
        g.addColorStop(1, "#4a2412");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255,.5)";
        for (let i = 0; i < 46; i++) { ctx.beginPath(); ctx.arc((i * 97) % W, ((i * 53) % 560) + 60, (i % 3) * 0.5 + 0.5, 0, 7); ctx.fill(); }
        for (let i = 0; i < lives; i++) A.drawSprite("heart", 70 + i * 24, 76, 22);
        ctx.font = A.font(14, 700);
        ctx.textAlign = "right";
        ctx.fillStyle = "#a3a6c8";
        ctx.fillText("Level " + level, W - 64, 81);

        bricks.forEach((br) => {
          if (br.hp <= 0) return;
          const j = br.hit > 0 ? 2 : 0;
          if (bricksLeft <= 3) {
            ctx.fillStyle = `rgba(255,240,150,${0.25 + Math.sin(paddle.t * 6) * 0.15})`;
            A.rr(br.x - 6, br.y - 6, br.w + 12, br.h + 12, 10);
            ctx.fill();
          }
          const col = br.gold ? "#FFB300" : br.color;
          const bg = ctx.createLinearGradient(0, br.y, 0, br.y + br.h);
          bg.addColorStop(0, shade(col, 0.35));
          bg.addColorStop(1, shade(col, -0.35));
          A.rr(br.x - j / 2, br.y - j / 2, br.w + j, br.h + j, 8);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.3)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,.3)";
          A.rr(br.x + 5, br.y + 3, br.w - 10, 4, 2);
          ctx.fill();
          if (br.max > 1 && br.hp === 2) { ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5; A.rr(br.x + 3, br.y + 3, br.w - 6, br.h - 6, 5); ctx.stroke(); }
          if (br.max > 1 && br.hp === 1) {
            ctx.strokeStyle = "rgba(26,16,48,.6)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(br.x + 10, br.y + 4); ctx.lineTo(br.x + 20, br.y + 14); ctx.lineTo(br.x + 16, br.y + 22); ctx.stroke();
          }
          if (br.gold) A.drawSprite("star-garnet", br.x + br.w / 2, br.y + br.h / 2, 26 + Math.sin(paddle.t * 6 + br.x) * 2);
          else A.drawSprite(br.rock, br.x + br.w / 2, br.y + br.h / 2 + 1, 28);
        });
        drops.forEach((d) => {
          const dg = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, 24);
          dg.addColorStop(0, "rgba(124,255,178,.5)");
          dg.addColorStop(1, "rgba(124,255,178,0)");
          ctx.fillStyle = dg;
          ctx.fillRect(d.x - 24, d.y - 24, 48, 48);
          A.drawSprite(POWERS[d.k].art, d.x, d.y, 32, Math.sin(d.t * 4) * 0.2);
        });
        balls.forEach((b) => {
          b.trail.forEach(([x, y], i) => {
            ctx.globalAlpha = (i / b.trail.length) * 0.45;
            ctx.fillStyle = "#FFB341";
            ctx.beginPath();
            ctx.arc(x, y, (BR * i) / b.trail.length, 0, 7);
            ctx.fill();
          });
          ctx.globalAlpha = 1;
          const og = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, BR + 10);
          og.addColorStop(0, "rgba(255,150,50,.6)");
          og.addColorStop(1, "rgba(255,150,50,0)");
          ctx.fillStyle = og;
          ctx.fillRect(b.x - 20, b.y - 20, 40, 40);
          if (!A.drawSprite("lava-bomb", b.x, b.y, BR * 3.2)) {
            ctx.fillStyle = "#ffb341";
            ctx.beginPath(); ctx.arc(b.x, b.y, BR, 0, 7); ctx.fill();
          }
        });
        const pw = paddle.w;
        ctx.fillStyle = "rgba(0,0,0,.3)";
        ctx.beginPath(); ctx.ellipse(paddle.x, PY + 18, pw / 2, 5, 0, 0, 7); ctx.fill();
        const pg = ctx.createLinearGradient(0, PY - 8, 0, PY + 6);
        const pc = wideT > 0 ? "#3FCB6B" : "#FFD166";
        pg.addColorStop(0, shade(pc, 0.4));
        pg.addColorStop(1, shade(pc, -0.3));
        A.rr(paddle.x - pw / 2, PY - 8, pw, 14, 7);
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.fillStyle = "#1A1030";
        [-pw / 2 + 14, pw / 2 - 14].forEach((dx) => { ctx.beginPath(); ctx.arc(paddle.x + dx, PY + 9, 5, 0, 7); ctx.fill(); });
        A.drawHero(paddle.x, PY - 32 + paddle.bump * 4, 52, 0, A.state === "dying" || A.state === "over" ? "hurt" : "happy");
        if (launchHint && A.state === "play" && balls.some((b) => b.stuck)) {
          ctx.fillStyle = "#fff";
          ctx.font = A.font(16, 700);
          ctx.textAlign = "center";
          ctx.globalAlpha = 0.6 + Math.sin(paddle.t * 5) * 0.4;
          ctx.fillText("Tap or press Space to launch", W / 2, PY - 76);
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
