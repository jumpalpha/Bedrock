import type { Api, GameModule } from "../engine/types";

const W = 420, H = 640, PY = 584, COLS = 7, ROWS = 4, SX = 50, SY = 44;
const ROW_KIND = [
  { art: "comet", pts: 30 },
  { art: "meteor", pts: 20 },
  { art: "space-rock", pts: 10 },
  { art: "space-rock", pts: 10 },
];
const TIPS = [
  "Most meteors burn up 80 to 120 km above the ground.", "A meteoroid is a meteor once it glows in the atmosphere.",
  "A space rock that lands is called a meteorite.", "Earth's atmosphere is our best meteor shield.", "Comets are dirty snowballs of ice and dust.",
];
const POWERS = { shield: { art: "shield", name: "Atmosphere shield!" }, spread: { art: "crystal", name: "Triple blast!" }, life: { art: "heart", name: "Extra life!" } } as const;
type PK = keyof typeof POWERS;

export const meteorInvaders: GameModule = {
  config: {
    key: "bedrock_meteor_invaders",
    title: "Meteor Invaders",
    subtitle: "Defend the planet!",
    W, H,
    winText: "Three meteor swarms stopped!",
    deathDelay: 900,
    overTitle: "Overrun!",
    accent: "#FF8C42",
    medals: [
      { at: 800, name: "Bronze", icon: "🥉" },
      { at: 2500, name: "Silver", icon: "🥈" },
      { at: 5000, name: "Gold", icon: "🥇" },
      { at: 9000, name: "Legend", icon: "💎" },
    ],
    howTo: "Your sprite fires laser blasts automatically. <b>Move</b> to aim and dodge. <b>Beat 3 waves</b> to win!",
    controls: "Move mouse / drag finger · or ← → · P pause",
    pad: [
      { label: "◀", type: "left", wide: true },
      { label: "▶", type: "right", wide: true },
    ],
    sprites: ["comet", "meteor", "space-rock", "shield", "crystal", "heart", "laser-bolt"],
    facts: [
      "A meteoroid becomes a meteor when it streaks through the atmosphere, and a meteorite if it reaches the ground.",
      "Most meteors burn up in the mesosphere, about 80 km above Earth's surface.",
      "Comets are balls of ice and dust; their tails always point away from the Sun.",
      "Most asteroids orbit the Sun in the asteroid belt between Mars and Jupiter.",
      "An asteroid impact about 66 million years ago helped wipe out the dinosaurs.",
    ],
  },
  create() {
    type Foe = { c: number; r: number; x: number; y: number; kind: (typeof ROW_KIND)[number]; alive: boolean; t: number };
    const hero = { x: W / 2, t: 0 };
    let foes: Foe[] = [], shots: { x: number; y: number; vx: number; vy: number }[] = [];
    let bombs: { x: number; y: number; vy: number; kind: "ice" | "rock"; t: number }[] = [];
    let drops: { x: number; y: number; k: PK; t: number }[] = [];
    let dir = 1, wave = 1, lives = 3, keys = { l: false, r: false }, aimX: number | null = null;
    let fireT = 0, spreadT = 0, shieldOn = false, invT = 0, waveBanner = 0;
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 20 + Math.random() * 60, r: Math.random() * 1.6 + 0.3 }));

    function buildWave() {
      foes = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) foes.push({ c, r, x: 50 + c * SX, y: 104 + r * SY, kind: ROW_KIND[r], alive: true, t: Math.random() * 6 });
      dir = 1;
      waveBanner = 2;
    }
    function hurt(A: Api) {
      if (invT > 0) return;
      if (shieldOn) { shieldOn = false; invT = 1; A.sfx("point"); A.toast("🛡 Shield blocked it!"); return; }
      lives--;
      invT = 1.8;
      A.sfx("hit"); A.shake(10, 0.3); A.flash(0.15);
      A.particles.burst(hero.x, PY - 10, "#FFB341", 18, 220, 4);
      if (lives <= 0) { A.gameOver(); return; }
      A.toast(`💔 ${lives} ${lives === 1 ? "life" : "lives"} left`);
    }

    return {
      reset() {
        hero.x = W / 2; shots = []; bombs = []; drops = [];
        wave = 1; lives = 3; keys = { l: false, r: false }; aimX = null; fireT = 0; spreadT = 0; shieldOn = false; invT = 0;
        buildWave();
      },
      input(type) {
        if (type === "left") keys.l = true;
        else if (type === "release-left") keys.l = false;
        else if (type === "right") keys.r = true;
        else if (type === "release-right") keys.r = false;
      },
      pointer(_type, x) { aimX = x; },
      update(dt, A) {
        hero.t += dt;
        stars.forEach((s) => { s.y += s.s * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
        foes.forEach((f) => (f.t += dt));
        if (A.state !== "play") { if (A.state === "menu") hero.x = W / 2 + Math.sin(hero.t) * 90; return; }
        invT = Math.max(0, invT - dt);
        spreadT = Math.max(0, spreadT - dt);
        waveBanner = Math.max(0, waveBanner - dt);

        if (keys.l) { hero.x -= 300 * dt; aimX = null; }
        if (keys.r) { hero.x += 300 * dt; aimX = null; }
        if (aimX != null) hero.x += (aimX - hero.x) * Math.min(1, dt * 14);
        hero.x = Math.max(24, Math.min(W - 24, hero.x));

        fireT -= dt;
        if (fireT <= 0 && waveBanner < 1.2) {
          fireT = 0.32;
          (spreadT > 0 ? [-0.22, 0, 0.22] : [0]).forEach((a) => shots.push({ x: hero.x, y: PY - 30, vx: Math.sin(a) * 520, vy: -Math.cos(a) * 520 }));
          A.sfx("flap");
        }
        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i];
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (s.y < 50 || s.x < 0 || s.x > W) { shots.splice(i, 1); continue; }
          const hit = foes.find((f) => f.alive && Math.abs(f.x - s.x) < 18 && Math.abs(f.y - s.y) < 18);
          if (hit) {
            hit.alive = false;
            shots.splice(i, 1);
            A.addScore(hit.kind.pts * wave);
            A.sfx("coin");
            A.particles.burst(hit.x, hit.y, hit.kind.art === "comet" ? "#9fe8ff" : hit.kind.art === "meteor" ? "#ffb341" : "#c9a27e", 14, 200, 4);
            if (Math.random() < 0.09) {
              const ks = Object.keys(POWERS) as PK[];
              let p = ks[Math.floor(Math.random() * ks.length)];
              if (p === "life" && lives >= 5) p = "spread";
              drops.push({ x: hit.x, y: hit.y, k: p, t: 0 });
            }
          }
        }

        const alive = foes.filter((f) => f.alive);
        if (!alive.length) {
          A.addScore(200 * wave);
          A.sfx("win");
          A.float(`Wave ${wave} cleared! +${200 * wave}`, W / 2, 320, "#FFD166");
          if (wave === 3) A.win("Three meteor swarms stopped!");
          else A.toast("💡 " + TIPS[wave % TIPS.length], 2400);
          wave++;
          bombs = [];
          buildWave();
          return;
        }
        const speed = (18 + (COLS * ROWS - alive.length) * 2.2) * (1 + (wave - 1) * 0.25);
        let edge = false;
        alive.forEach((f) => { f.x += dir * speed * dt; if (f.x < 22 || f.x > W - 22) edge = true; });
        if (edge) { dir = -dir; alive.forEach((f) => { f.x += dir * speed * dt * 2; f.y += 16; }); }
        if (alive.some((f) => f.y > PY - 40)) { lives = 0; invT = 0; shieldOn = false; hurt(A); return; }

        if (Math.random() < (0.6 + wave * 0.35) * dt && waveBanner < 1) {
          const cols = [...new Set(alive.map((f) => f.c))], c = cols[Math.floor(Math.random() * cols.length)];
          const low = alive.filter((f) => f.c === c).sort((a, b) => b.y - a.y)[0];
          bombs.push({ x: low.x, y: low.y + 16, vy: 170 + wave * 25, kind: low.kind.art === "comet" ? "ice" : "rock", t: 0 });
        }
        for (let i = bombs.length - 1; i >= 0; i--) {
          const b = bombs[i];
          b.y += b.vy * dt;
          b.t += dt;
          if (b.y > H) { bombs.splice(i, 1); continue; }
          if (Math.abs(b.x - hero.x) < 20 && Math.abs(b.y - (PY - 14)) < 20) { bombs.splice(i, 1); hurt(A); if (A.state !== "play") return; }
        }
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.y += 120 * dt;
          d.t += dt;
          if (d.y > H) { drops.splice(i, 1); continue; }
          if (Math.abs(d.x - hero.x) < 26 && Math.abs(d.y - (PY - 14)) < 26) {
            drops.splice(i, 1);
            A.sfx("medal");
            A.toast(POWERS[d.k].name);
            if (d.k === "shield") shieldOn = true;
            if (d.k === "spread") spreadT = 10;
            if (d.k === "life") lives++;
          }
        }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#05031a");
        g.addColorStop(0.7, "#14123a");
        g.addColorStop(1, "#2a1f4e");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const neb = ctx.createRadialGradient(320, 180, 10, 320, 180, 220);
        neb.addColorStop(0, "rgba(255,140,66,.18)");
        neb.addColorStop(1, "rgba(255,140,66,0)");
        ctx.fillStyle = neb;
        ctx.fillRect(0, 0, W, H);
        stars.forEach((s) => { ctx.fillStyle = `rgba(255,255,255,${0.3 + s.r / 3})`; ctx.fillRect(s.x, s.y, s.r, s.r * 2); });
        // planet horizon
        const pg = ctx.createRadialGradient(W / 2, H + 120, 120, W / 2, H + 300, 420);
        pg.addColorStop(0, "#4fb7e8");
        pg.addColorStop(0.7, "#1f6f9a");
        pg.addColorStop(1, "#0f3a55");
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.ellipse(W / 2, H + 300, 420, 340, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(140,220,255,.6)";
        ctx.lineWidth = 3;
        ctx.stroke();

        for (let i = 0; i < lives; i++) A.drawSprite("heart", 70 + i * 24, 76, 22);
        ctx.fillStyle = "#a3a6c8";
        ctx.font = A.font(14, 700);
        ctx.textAlign = "right";
        ctx.fillText(`Wave ${wave}${wave <= 3 ? " / 3" : ""}`, W - 64, 81);
        if (spreadT > 0) { ctx.textAlign = "left"; ctx.fillStyle = "#7fd5ff"; ctx.fillText(`⚡×3 ${Math.ceil(spreadT)}s`, 14, H - 12); }

        foes.forEach((f) => { if (f.alive) A.drawSprite(f.kind.art, f.x, f.y + Math.sin(f.t * 3) * 2, 42, Math.sin(f.t * 2) * 0.1); });
        bombs.forEach((b) => {
          if (b.kind === "ice") {
            const bg = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 9);
            bg.addColorStop(0, "#e8fbff");
            bg.addColorStop(1, "#3aa6d6");
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill();
          } else {
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 6);
            ctx.fillStyle = "#8a6a52"; A.rr(-6, -6, 12, 12, 3); ctx.fill(); ctx.fillStyle = "#ffb341"; ctx.fillRect(-2, -2, 4, 4);
            ctx.restore();
          }
        });
        drops.forEach((d) => {
          const dg = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, 24);
          dg.addColorStop(0, "rgba(124,255,178,.5)");
          dg.addColorStop(1, "rgba(124,255,178,0)");
          ctx.fillStyle = dg;
          ctx.fillRect(d.x - 24, d.y - 24, 48, 48);
          A.drawSprite(POWERS[d.k].art, d.x, d.y, 32);
        });
        shots.forEach((s) => A.drawSprite("laser-bolt", s.x, s.y, 20));
        const blink = invT > 0 && Math.floor(invT * 12) % 2;
        if (!blink) {
          ctx.fillStyle = "rgba(0,0,0,.3)";
          ctx.beginPath(); ctx.ellipse(hero.x, PY + 18, 22, 5, 0, 0, 7); ctx.fill();
          A.drawHero(hero.x, PY - 8, 62, keys.l ? -0.12 : keys.r ? 0.12 : 0, A.state === "dying" || A.state === "over" ? "hurt" : "happy");
          if (shieldOn) {
            ctx.strokeStyle = "rgba(127,213,255,.85)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(hero.x, PY - 8, 38 + Math.sin(hero.t * 6) * 2, 0, 7); ctx.stroke();
          }
        }
        if (waveBanner > 0 && A.state === "play") {
          ctx.globalAlpha = Math.min(1, waveBanner);
          ctx.textAlign = "center";
          ctx.font = A.font(38);
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(7,7,26,.85)";
          ctx.strokeText(`WAVE ${wave}`, W / 2, 330);
          ctx.fillStyle = "#FFD166";
          ctx.fillText(`WAVE ${wave}`, W / 2, 330);
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
