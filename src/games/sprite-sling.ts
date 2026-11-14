import Matter from "matter-js";
import type { Api, GameModule } from "./engine/types";

const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;
const W = 1000, H = 560, G = 512;
const ANCHOR = { x: 170, y: 392 }, MAXPULL = 105, POWER = 0.145, PR = 20;
const MAT = {
  // wood = layered sandstone, stone = granite, glass = clear quartz (same physics as before)
  wood: { density: 0.0018, hp: 70, pts: 100, friction: 0.7, c: ["#e8c48a", "#c0904f", "#8a5f2e"] },
  stone: { density: 0.0035, hp: 170, pts: 150, friction: 0.8, c: ["#d6d0cc", "#a39a94", "#655d58"] },
  glass: { density: 0.0012, hp: 22, pts: 50, friction: 0.3, c: ["#f4f0ff", "#d8cdf5", "#a99cd8"] },
} as const;
type MatName = keyof typeof MAT;
const MONSTERS = ["boulder", "lava-bomb", "meteor", "storm-cloud", "tornado"];
const TIPS = [
  "Gas vents blast like an explosive eruption: thick magma traps gas until BOOM!",
  "Sandstone is a sedimentary rock built layer by layer.",
  "Granite cools slowly underground, so it has big crystals.",
  "Quartz is a 7 on the Mohs hardness scale.",
  "A rockfall happens when rocks break off a cliff and free-fall.",
];

type GB = Matter.Body & {
  kind: "block" | "monster" | "tnt" | "bomb" | "ground" | "proj";
  mat?: MatName; hp: number; maxHp?: number; w?: number; h?: number; r?: number; art?: string; blink?: number;
  radius?: number; power?: number; dead?: boolean;
};

export const spriteSling: GameModule = {
  config: {
    key: "bedrock_sprite_sling",
    title: "Sprite Slingshot",
    subtitle: "Launch at the boulder fort!",
    W, H,
    winText: "You cleared 3 levels!",
    deathDelay: 900,
    medals: [
      { at: 5000, name: "Bronze", icon: "🥉" },
      { at: 12000, name: "Silver", icon: "🥈" },
      { at: 22000, name: "Gold", icon: "🥇" },
      { at: 32000, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Drag</b> your sprite back and <b>let go</b> to launch. Knock out every hazard. Hit gas vents and volcanic bombs for big blasts! Tap mid-air to <b>BOOST</b>.",
    controls: "Mouse or finger · P pause · best in landscape",
    overTitle: "Out of retries!",
    accent: "#FF8C00",
    sprites: MONSTERS,
    facts: [
      "Gravity always wins: it pulls rock and soil downhill, sometimes slowly, sometimes all at once.",
      "The 1980 Mount St. Helens blast flattened about 230 square miles of forest.",
      "Tephra ranges from fine ash to golf-ball-sized lapilli to huge volcanic bombs.",
      "Granite is the classic intrusive rock. Idaho's Sawtooth Mountains are part of the granite Idaho Batholith.",
      "A lightning bolt heats the air to about 30,000 °C, five times hotter than the Sun's surface.",
      "Tornadoes are rated from EF0 to EF5 based on the damage they cause.",
      "Sedimentary rocks form layer by layer, and that's where almost all fossils are found.",
    ],
  },
  create() {
    let api: Api;
    let engine: Matter.Engine | null = null;
    let bodies: GB[] = [], monsters: GB[] = [], toRemove: GB[] = [];
    let shotsLeft = 0, level = 0, retries = 3, proj: GB | null = null;
    let drag: { x: number; y: number } | null = null;
    let phase: "aim" | "fly" | "done" = "aim", phaseT = 0, settleT = 0, boosted = false, sceneT = 0;
    let trail: [number, number][] = [], boomRings: { x: number; y: number; R: number; t: number }[] = [];
    let msg: { title: string; sub: string; t: number; next: "next" | "retry" } | null = null;

    function addBlock(x: number, y: number, w: number, h: number, mat: MatName, angle = 0) {
      const M = MAT[mat];
      const b = Bodies.rectangle(x, y, w, h, { density: M.density, friction: M.friction, restitution: 0.05, angle, sleepThreshold: 40 }) as GB;
      b.kind = "block"; b.mat = mat; b.hp = ((M.hp * (w * h)) / 1600) * 0.6 + M.hp * 0.4; b.maxHp = b.hp; b.w = w; b.h = h;
      bodies.push(b);
      return b;
    }
    function addMonster(x: number, y: number, r = 19) {
      const b = Bodies.circle(x, y, r, { density: 0.0014, friction: 0.6, restitution: 0.15, sleepThreshold: 40 }) as GB;
      b.kind = "monster"; b.art = MONSTERS[monsters.length % MONSTERS.length]; b.hp = 26; b.r = r; b.blink = Math.random() * 5;
      bodies.push(b);
      monsters.push(b);
      return b;
    }
    function addBarrel(x: number, y: number) {
      const b = Bodies.rectangle(x, y, 32, 40, { density: 0.0015, friction: 0.6, chamfer: { radius: 6 }, sleepThreshold: 40 }) as GB;
      b.kind = "tnt"; b.hp = 14; b.radius = 170; b.power = 14;
      bodies.push(b);
      return b;
    }
    function addBomb(x: number, y: number) {
      const b = Bodies.circle(x, y, 20, { density: 0.0022, friction: 0.5, restitution: 0.1, sleepThreshold: 40 }) as GB;
      b.kind = "bomb"; b.hp = 18; b.radius = 210; b.power = 17; b.r = 20;
      bodies.push(b);
      return b;
    }
    function story(cx: number, baseY: number, width: number, mat: MatName, pillarH = 80, plankMat?: MatName) {
      addBlock(cx - width / 2 + 10, baseY - pillarH / 2, 20, pillarH, mat);
      addBlock(cx + width / 2 - 10, baseY - pillarH / 2, 20, pillarH, mat);
      addBlock(cx, baseY - pillarH - 10, width + 10, 20, plankMat || mat);
      return baseY - pillarH - 20;
    }

    const LEVELS: { name: string; shots: number; build(): void }[] = [
      { name: "Basalt Shack", shots: 3, build() {
        const y = story(720, G, 110, "wood");
        addMonster(720, G - 20); addMonster(720, y - 19); addBarrel(810, G - 20);
        addBlock(870, G - 30, 20, 60, "glass"); addMonster(905, G - 20, 17);
      } },
      { name: "Boulder Towers", shots: 5, build() {
        let a = story(640, G, 100, "wood"); a = story(640, a, 100, "glass");
        addMonster(640, G - 20); addMonster(640, a - 19); addBarrel(735, G - 20); addBarrel(735, G - 60);
        let b = story(840, G, 110, "wood"); b = story(840, b, 110, "wood", 70, "stone");
        addMonster(840, G - 20); addMonster(840, b - 19, 21);
      } },
      { name: "Granite Fort", shots: 5, build() {
        const f1 = story(700, G, 150, "stone", 70);
        addBlock(700, G - 35, 20, 70, "glass"); addMonster(658, G - 20); addMonster(742, G - 20);
        const f2 = story(700, f1, 150, "wood", 70, "stone");
        addBomb(700, f1 - 21); addMonster(700, f2 - 19, 21); addBarrel(820, G - 20);
        const z = story(900, G, 80, "glass", 90); addMonster(900, G - 20, 17); addMonster(900, z - 18, 17);
      } },
      { name: "Lava Skyscraper", shots: 6, build() {
        const f1 = story(770, G, 120, "wood", 75);
        addBarrel(748, G - 20); addMonster(792, G - 20, 18);
        const f2 = story(770, f1, 120, "glass", 70, "wood"); addMonster(770, f1 - 19, 19);
        const f3 = story(770, f2, 120, "wood", 70, "wood"); addMonster(770, f2 - 19, 19); addMonster(770, f3 - 19, 21);
        addBomb(520, G - 20); addBlock(520, G - 50, 80, 20, "glass"); addMonster(520, G - 79, 18); addBarrel(880, G - 20);
      } },
      { name: "Boulder Castle", shots: 6, build() {
        let l = story(600, G, 90, "stone", 80); l = story(600, l, 90, "wood", 70);
        let r = story(880, G, 90, "stone", 80); r = story(880, r, 90, "wood", 70);
        addBlock(740, l - 10, 210, 20, "wood");
        addMonster(740, l - 39, 20); addBarrel(700, l - 40); addBarrel(780, l - 40);
        addMonster(600, G - 20); addMonster(880, G - 20); addMonster(600, l - 59, 18); addMonster(880, l - 59, 18);
        addBomb(740, G - 20); addBlock(740, G - 60, 20, 40, "glass");
        addBlock(600, l - 30, 20, 20, "glass"); addBlock(880, l - 30, 20, 20, "glass");
      } },
      { name: "Magma Chamber", shots: 7, build() {
        const a1 = story(540, G, 90, "stone", 70), a2 = story(540, a1, 90, "wood", 70), a3 = story(540, a2, 90, "wood", 60, "stone");
        addMonster(540, G - 20); addMonster(540, a1 - 19, 18); addBarrel(540, a2 - 20); addMonster(540, a3 - 19, 20);
        const v = story(705, G, 130, "glass", 90, "stone");
        addBarrel(705, G - 20); addBomb(705, G - 61);
        addMonster(705, v - 19, 21); addBlock(660, v - 25, 20, 30, "glass"); addBlock(750, v - 25, 20, 30, "glass");
        let c = G;
        (["wood", "glass", "wood", "glass"] as MatName[]).forEach((m, i) => {
          const top = story(885, c, 90, m, 66, i % 2 ? "wood" : "stone");
          if (i === 2) addBarrel(885, c - 20); else addMonster(885, c - 19, 17);
          c = top;
        });
        addMonster(885, c - 19, 19);
      } },
      { name: "Cinder Cone", shots: 6, build() {
        const b1 = story(620, G, 100, "wood", 70), b2 = story(740, G, 100, "glass", 70, "wood");
        story(860, G, 100, "wood", 70);
        addMonster(620, G - 20, 18); addBarrel(740, G - 20); addMonster(860, G - 20, 18);
        const m1 = story(680, b1, 100, "glass", 60, "wood");
        story(800, b2, 100, "glass", 60, "wood");
        addMonster(680, b1 - 19, 18); addMonster(800, b2 - 19, 18);
        const top = story(740, m1, 100, "wood", 60, "stone");
        addMonster(740, m1 - 19, 19); addMonster(740, top - 19, 21);
      } },
      { name: "Geyser Fortress", shots: 7, build() {
        addBlock(600, G - 60, 24, 120, "stone"); addBlock(900, G - 60, 24, 120, "stone");
        addBlock(750, G - 130, 330, 20, "stone");
        addBarrel(660, G - 20); addMonster(705, G - 20, 18); addBarrel(750, G - 20); addMonster(795, G - 20, 18); addBarrel(840, G - 20);
        const l = story(650, G - 140, 70, "wood", 60), r = story(850, G - 140, 70, "wood", 60);
        addMonster(650, G - 160, 17); addMonster(850, G - 160, 17); addMonster(650, l - 18, 18); addMonster(850, r - 18, 18);
        addBlock(750, G - 160, 20, 40, "glass"); addMonster(750, G - 199, 19);
      } },
      { name: "Natural Bridge", shots: 6, build() {
        [560, 680, 800, 920].forEach((x) => addBlock(x, G - 55, 22, 110, "stone"));
        addBlock(620, G - 120, 150, 20, "wood"); addBlock(860, G - 120, 150, 20, "wood"); addBlock(740, G - 140, 120, 20, "glass");
        addMonster(600, G - 149, 18); addMonster(740, G - 169, 20); addMonster(880, G - 149, 18);
        addBomb(740, G - 20); addMonster(620, G - 20, 17); addMonster(860, G - 20, 17); addBarrel(940, G - 20);
      } },
      { name: "Craters Cliffs", shots: 7, build() {
        addBlock(560, G - 70, 26, 140, "stone"); addBlock(560, G - 150, 60, 20, "stone"); addMonster(560, G - 179, 18);
        let a = G;
        (["wood", "glass", "wood"] as MatName[]).forEach((m, i) => { const t = story(720, a, 90, m, 70, i === 2 ? "stone" : "wood"); addMonster(720, a - 19, 17); a = t; });
        addMonster(720, a - 19, 20);
        let b = G;
        (["stone", "wood", "glass", "wood"] as MatName[]).forEach((m, i) => { const t = story(890, b, 90, m, 64, "wood"); if (i === 1) addBarrel(890, b - 20); else addMonster(890, b - 19, 17); b = t; });
        addMonster(890, b - 19, 20); addBomb(805, G - 20);
      } },
      { name: "Mega Mesa Tower", shots: 8, build() {
        let y = G;
        ([["stone", "stone"], ["wood", "wood"], ["glass", "wood"], ["wood", "stone"], ["glass", "wood"]] as [MatName, MatName][]).forEach(([m, p], i) => {
          const t = story(760, y, 170, m, 64, p);
          if (i === 0) { addBarrel(720, y - 20); addMonster(800, y - 20, 19); }
          else if (i === 2) { addBomb(760, y - 21); addMonster(715, y - 19, 17); addMonster(805, y - 19, 17); }
          else addMonster(760, y - 19, 18);
          y = t;
        });
        addMonster(760, y - 21, 22);
        const s1 = story(560, G, 80, "wood", 70); addMonster(560, G - 20, 17); addMonster(560, s1 - 18, 17);
        addBarrel(940, G - 20); addBlock(940, G - 55, 50, 20, "glass"); addMonster(940, G - 84, 18);
      } },
    ];

    function buildLevel(n: number) {
      engine = Engine.create({ enableSleeping: true });
      toRemove = [];
      engine.gravity.y = 1;
      bodies = []; monsters = []; boomRings = []; trail = [];
      const ground = Bodies.rectangle(W / 2, G + 40, W * 3, 80, { isStatic: true, friction: 0.9 }) as GB; ground.kind = "ground";
      const wallR = Bodies.rectangle(W + 60, H / 2, 120, H * 3, { isStatic: true }) as GB; wallR.kind = "ground";
      LEVELS[n].build();
      Composite.add(engine.world, [ground, wallR, ...bodies]);
      for (let i = 0; i < 90; i++) Engine.update(engine, 1000 / 60);
      Events.on(engine, "collisionStart", onCollide);
      shotsLeft = LEVELS[n].shots; proj = null; drag = null; phase = "aim"; phaseT = 0; settleT = 0; sceneT = 0;
    }

    function flushRemovals() {
      if (!toRemove.length || !engine) return;
      toRemove.forEach((b) => Composite.remove(engine!.world, b));
      toRemove = [];
      Composite.allBodies(engine.world).forEach((o) => { if (!o.isStatic) Sleeping.set(o, false); });
    }
    function damage(b: GB, amt: number) {
      if (!b || b.dead || b.kind === "ground" || b.kind === "proj") return;
      b.hp -= amt;
      if (b.hp <= 0) destroy(b);
    }
    function destroy(b: GB) {
      if (b.dead) return;
      b.dead = true;
      const A = api, p = b.position;
      if (b.kind === "monster") {
        A.addScore(500); A.sfx("coin"); A.float("+500", p.x, p.y - 20, "#7CFFB2");
        A.particles.burst(p.x, p.y, "#FF8FC7", 24, 260, 5);
      } else if (b.kind === "block") {
        const M = MAT[b.mat!];
        A.addScore(M.pts);
        A.particles.burst(p.x, p.y, M.c[1], b.mat === "glass" ? 16 : 10, 200, b.mat === "glass" ? 3 : 4);
        if (b.mat === "glass") A.sfx("point");
      } else if (b.kind === "tnt" || b.kind === "bomb") explode(b);
      toRemove.push(b);
    }
    function explode(b: GB) {
      const A = api, p = b.position, R = b.radius!;
      A.sfx("hit"); A.shake(b.kind === "bomb" ? 16 : 11, 0.45); A.flash(0.12);
      A.addScore(200);
      A.particles.burst(p.x, p.y, "#FFD23F", 34, 380, 6);
      A.particles.burst(p.x, p.y, "#FF5C5C", 24, 300, 5);
      A.particles.burst(p.x, p.y, "#ffffff", 14, 240, 4);
      boomRings.push({ x: p.x, y: p.y, R, t: 0 });
      A.float(b.kind === "bomb" ? "KA-BOOM!" : "GAS BLAST!", p.x, p.y - 30, "#FFD23F");
      const eng = engine;
      Composite.allBodies(engine!.world).forEach((o0) => {
        const o = o0 as GB;
        if (o === b || o.isStatic || o.dead) return;
        const dx = o.position.x - p.x, dy = o.position.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > R) return;
        const k = 1 - d / R;
        Sleeping.set(o, false);
        Body.setVelocity(o, { x: o.velocity.x + (dx / d) * b.power! * k, y: o.velocity.y + (dy / d - 0.35) * b.power! * k });
        Body.setAngularVelocity(o, o.angularVelocity + (Math.random() - 0.5) * 0.4 * k);
        if (o.kind === "tnt" || o.kind === "bomb") setTimeout(() => { if (engine === eng && !o.dead) damage(o, 999); }, 120 + d);
        else damage(o, (o.kind === "monster" ? 90 : 160) * k);
      });
    }
    function onCollide(ev: Matter.IEventCollision<Matter.Engine>) {
      if (phase === "done") return;
      ev.pairs.forEach((pr) => {
        const a = pr.bodyA as GB, b = pr.bodyB as GB;
        const vrel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
        if (vrel < 1.6) return;
        const base = (vrel - 1.4) * (vrel - 1.4) * 6;
        const ma = a.isStatic ? 8 : Math.min(a.mass, 8), mb = b.isStatic ? 8 : Math.min(b.mass, 8);
        damage(a, base * Math.max(0.35, mb / 2));
        damage(b, base * Math.max(0.35, ma / 2));
        if (vrel > 4 && (a.kind === "proj" || b.kind === "proj")) api.sfx("point");
      });
    }

    function pullVec() {
      if (!drag) return { x: 0, y: 0 };
      let dx = drag.x - ANCHOR.x, dy = drag.y - ANCHOR.y;
      const d = Math.hypot(dx, dy);
      if (d > MAXPULL) { dx *= MAXPULL / d; dy *= MAXPULL / d; }
      return { x: dx, y: dy };
    }
    function launch(A: Api) {
      const pv = pullVec();
      if (Math.hypot(pv.x, pv.y) < 18) { drag = null; return; }
      proj = Bodies.circle(ANCHOR.x + pv.x, ANCHOR.y + pv.y, PR, { density: 0.005, friction: 0.5, restitution: 0.3, frictionAir: 0.002 }) as GB;
      proj.kind = "proj"; proj.hp = 1e9;
      Composite.add(engine!.world, proj);
      Body.setVelocity(proj, { x: -pv.x * POWER, y: -pv.y * POWER });
      shotsLeft--; drag = null; phase = "fly"; phaseT = 0; settleT = 0; boosted = false; trail = [];
      A.sfx("flap");
      setTimeout(() => A.sfx("jump"), 60);
    }
    function trajectory() {
      const pv = pullVec();
      const vx = -pv.x * POWER;
      let x = ANCHOR.x + pv.x, y = ANCHOR.y + pv.y, vy = -pv.y * POWER;
      const g = engine!.gravity.y * 0.001 * (1000 / 60) * (1000 / 60), pts: [number, number][] = [];
      for (let i = 0; i < 70; i++) {
        vy += g; x += vx; y += vy;
        if (i % 3 === 0) pts.push([x, y]);
        if (y > G) break;
      }
      return pts;
    }
    function nextShotOrResult(A: Api) {
      const left = monsters.filter((m) => !m.dead).length;
      if (left === 0) {
        const bonus = shotsLeft * 1000;
        if (bonus) A.addScore(bonus);
        A.sfx("win");
        msg = { title: LEVELS[level].name + " cleared!", sub: (bonus ? "Unused sprites bonus +" + bonus.toLocaleString() + " · " : "") + "⭐".repeat(Math.min(3, 1 + shotsLeft)), t: 0, next: "next" };
        if (level === 2) A.win("You cleared 3 levels!");
        phase = "done";
      } else if (shotsLeft <= 0) {
        retries--;
        A.sfx("hit");
        if (retries <= 0) { phase = "done"; A.gameOver(); return; }
        msg = { title: "So close!", sub: left + " hazard" + (left > 1 ? "s" : "") + " left · Retries " + "❤".repeat(retries), t: 0, next: "retry" };
        phase = "done";
      } else { proj = null; phase = "aim"; }
    }

    // ---- drawing helpers ----
    function block(ctx: CanvasRenderingContext2D, A: Api, b: GB) {
      const M = MAT[b.mat!], w = b.w!, h = b.h!;
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      const long = w > h;
      const g = long ? ctx.createLinearGradient(0, -h / 2, 0, h / 2) : ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, M.c[0]);
      g.addColorStop(0.5, M.c[1]);
      g.addColorStop(1, M.c[2]);
      ctx.globalAlpha = b.mat === "glass" ? 0.78 : 1;
      A.rr(-w / 2, -h / 2, w, h, 5);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(0,0,0,.28)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (b.mat === "wood") {
        ctx.strokeStyle = "rgba(90,50,20,.45)";
        ctx.lineWidth = 1.2;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          if (long) { ctx.moveTo(-w / 2 + 4, -h / 2 + (h * i) / 4); ctx.bezierCurveTo(-w / 6, -h / 2 + (h * i) / 4 - 2, w / 6, -h / 2 + (h * i) / 4 + 2, w / 2 - 4, -h / 2 + (h * i) / 4); }
          else { ctx.moveTo(-w / 2 + (w * i) / 4, -h / 2 + 4); ctx.bezierCurveTo(-w / 2 + (w * i) / 4 - 2, -h / 6, -w / 2 + (w * i) / 4 + 2, h / 6, -w / 2 + (w * i) / 4, h / 2 - 4); }
          ctx.stroke();
        }
      } else if (b.mat === "stone") {
        ctx.fillStyle = "rgba(60,55,80,.35)";
        for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2 + 4 + ((i * 13) % Math.max(4, w - 10)), -h / 2 + 4 + ((i * 17) % Math.max(4, h - 10)), 5, 4);
      } else {
        ctx.strokeStyle = "rgba(255,255,255,.95)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 4, h / 2 - 6);
        ctx.lineTo(-w / 2 + Math.min(w, h) * 0.55, -h / 2 + 4);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.fillRect(-w / 2 + 3, -h / 2 + 2, w - 6, Math.min(3, h / 5));
      if (b.hp < b.maxHp! * 0.55) {
        ctx.strokeStyle = "rgba(20,10,30,.7)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-w * 0.3, -h * 0.35); ctx.lineTo(0, 0); ctx.lineTo(-w * 0.1, h * 0.3);
        ctx.moveTo(0, 0); ctx.lineTo(w * 0.3, -h * 0.1);
        ctx.stroke();
      }
      ctx.restore();
    }

    return {
      reset(A) {
        api = A;
        level = 0;
        retries = 3;
        msg = null;
        buildLevel(0);
      },
      input() {},
      pointer(type, x, y, A) {
        if (phase === "aim") {
          if (type === "down" && Math.hypot(x - ANCHOR.x, y - ANCHOR.y) < 120) drag = { x, y };
          else if ((type === "drag" || type === "move") && drag) drag = { x, y };
          else if (type === "up" && drag) launch(A);
        } else if (phase === "fly" && type === "down" && proj && !boosted && phaseT < 4) {
          boosted = true;
          Body.setVelocity(proj, { x: proj.velocity.x * 1.7 + 2, y: proj.velocity.y * 1.2 });
          A.sfx("medal");
          A.particles.burst(proj.position.x, proj.position.y, "#7CFFB2", 18, 200, 4);
          A.float("BOOST!", proj.position.x, proj.position.y - 30, "#7CFFB2");
        }
      },
      update(dt, A) {
        api = A;
        if (!engine) return;
        sceneT += dt;
        if (A.state === "menu") return;
        if (msg) {
          msg.t += dt;
          if (msg.t > 2.4) {
            const n = msg.next;
            msg = null;
            if (n === "next") {
              if (level + 1 >= LEVELS.length) {
                A.toast("🏆 All " + LEVELS.length + " levels beaten!", 2600);
                phase = "done";
                setTimeout(() => { if (A.state === "play") A.gameOver(true); }, 1200);
                return;
              }
              level++;
              A.toast("💡 " + TIPS[level % TIPS.length], 2400);
            }
            buildLevel(level);
          }
        }
        if (A.state !== "play" && A.state !== "dying") return;
        const steps = Math.min(4, Math.round(dt * 60)) || 1;
        for (let i = 0; i < steps; i++) { Engine.update(engine, 1000 / 60); flushRemovals(); }
        bodies.forEach((b) => { if (!b.dead && (b.position.y > H + 80 || b.position.x < -100 || b.position.x > W + 100)) destroy(b); });
        if (phase === "fly") {
          phaseT += dt;
          if (proj) { trail.push([proj.position.x, proj.position.y]); if (trail.length > 40) trail.shift(); }
          const moving = Composite.allBodies(engine.world).some((b) => !b.isStatic && !b.isSleeping && b.speed > 0.25);
          const projGone = !proj || proj.position.x > W + 50 || proj.position.x < -50 || proj.position.y > H + 50;
          if (projGone && proj) { Composite.remove(engine.world, proj); proj = null; }
          settleT = moving ? 0 : settleT + dt;
          if (settleT > 0.6 || phaseT > 9 || (monsters.every((m) => m.dead) && phaseT > 1.2)) {
            if (proj) { const p = proj.position; A.particles.burst(p.x, p.y, "#ffffff", 10, 120, 3); Composite.remove(engine.world, proj); proj = null; }
            nextShotOrResult(A);
          }
        }
        boomRings = boomRings.filter((r) => (r.t += dt) < 0.45);
      },

      draw(ctx, A) {
        const sky = ctx.createLinearGradient(0, 0, 0, G);
        sky.addColorStop(0, "#3a7fd8");
        sky.addColorStop(0.6, "#a8d4f0");
        sky.addColorStop(1, "#f6d9b0");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        const sun = ctx.createRadialGradient(860, 90, 10, 860, 90, 140);
        sun.addColorStop(0, "rgba(255,245,190,.95)");
        sun.addColorStop(0.3, "rgba(255,230,140,.5)");
        sun.addColorStop(1, "rgba(255,230,140,0)");
        ctx.fillStyle = sun;
        ctx.fillRect(700, 0, 300, 260);
        ctx.fillStyle = "#fff4c0";
        ctx.beginPath(); ctx.arc(860, 90, 40, 0, 7); ctx.fill();
        ([[120, 90, 1], [420, 60, 0.8], [700, 110, 1.2], [930, 70, 0.7]] as const).forEach(([x, y, s]) => {
          const cx = ((x + sceneT * 8 * s) % (W + 160)) - 80;
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.beginPath();
          ctx.arc(cx, y, 22 * s, 0, 7); ctx.arc(cx + 26 * s, y - 10 * s, 26 * s, 0, 7); ctx.arc(cx + 54 * s, y, 20 * s, 0, 7);
          ctx.fill();
        });
        const hills = (base: number, amp: number, c1: string, c2: string, f: number, ph: number) => {
          const g = ctx.createLinearGradient(0, base - amp, 0, G);
          g.addColorStop(0, c1); g.addColorStop(1, c2);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(0, G);
          for (let x = 0; x <= W; x += 10) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * f + ph) * Math.cos(x * f * 0.37)));
          ctx.lineTo(W, G); ctx.closePath(); ctx.fill();
        };
        hills(430, 70, "#c9a184", "#9a6f55", 0.007, 1.3);
        hills(470, 45, "#a9b582", "#77845a", 0.011, 0.4);
        const gg = ctx.createLinearGradient(0, G, 0, H);
        gg.addColorStop(0, "#d8c08e"); gg.addColorStop(0.25, "#b09a6a"); gg.addColorStop(0.26, "#5a4a3e"); gg.addColorStop(1, "#2e2520");
        ctx.fillStyle = gg;
        ctx.fillRect(0, G, W, H - G);
        if (!engine) return;

        const pv = pullVec(), loaded = phase === "aim";
        const hx = loaded ? ANCHOR.x + pv.x : ANCHOR.x, hy = loaded ? ANCHOR.y + pv.y : ANCHOR.y;
        const arm = (x: number, c1: string, c2: string) => {
          const g = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
          g.addColorStop(0, c2); g.addColorStop(0.5, c1); g.addColorStop(1, c2);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(ANCHOR.x - 7, G); ctx.lineTo(ANCHOR.x - 7, ANCHOR.y + 40); ctx.lineTo(x - 6, ANCHOR.y - 12);
          ctx.lineTo(x + 6, ANCHOR.y - 12); ctx.lineTo(ANCHOR.x + 7, ANCHOR.y + 40); ctx.lineTo(ANCHOR.x + 7, G);
          ctx.closePath(); ctx.fill();
        };
        arm(ANCHOR.x + 10, "#9a6a38", "#5e3a1a");
        ctx.strokeStyle = "#4a2414"; ctx.lineWidth = 6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(ANCHOR.x + 14, ANCHOR.y - 6); ctx.lineTo(hx, hy); ctx.stroke();

        if (drag) trajectory().forEach(([x, y], i) => {
          ctx.fillStyle = `rgba(255,255,255,${0.9 - i * 0.03})`;
          ctx.beginPath(); ctx.arc(x, y, 4 - i * 0.08, 0, 7); ctx.fill();
        });
        trail.forEach(([x, y], i) => {
          if (i % 3) return;
          ctx.fillStyle = "rgba(255,255,255,.7)";
          ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
        });

        bodies.forEach((b) => {
          if (b.dead) return;
          const p = b.position;
          if (b.kind === "block") block(ctx, A, b);
          else if (b.kind === "monster") {
            ctx.fillStyle = "rgba(0,0,0,.15)";
            ctx.beginPath(); ctx.ellipse(p.x, p.y + b.r! * 0.95, b.r! * 0.8, b.r! * 0.25, 0, 0, 7); ctx.fill();
            if (!A.drawSprite(b.art!, p.x, p.y - 2, b.r! * 2.6, b.angle * 0.5)) {
              ctx.fillStyle = "#ff4d6d"; ctx.beginPath(); ctx.arc(p.x, p.y, b.r!, 0, 7); ctx.fill();
            }
          } else if (b.kind === "tnt") {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.angle);
            const g = ctx.createLinearGradient(-16, 0, 16, 0);
            g.addColorStop(0, "#8a2a08"); g.addColorStop(0.4, "#ff7a2b"); g.addColorStop(1, "#8a2a08");
            A.rr(-16, -20, 32, 40, 8); ctx.fillStyle = g; ctx.fill();
            ctx.fillStyle = "#fff"; ctx.fillRect(-16, -6, 32, 12);
            ctx.fillStyle = "#c2410c"; ctx.font = A.font(9); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("GAS", 0, 0.5);
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#d8d8e4"; ctx.fillRect(-12, -22, 24, 4);
            ctx.fillStyle = "rgba(255,255,255,.65)";
            ([[-8, -13], [6, 12], [9, -12]] as const).forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); });
            ctx.restore();
          } else if (b.kind === "bomb") {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.angle);
            const g = ctx.createRadialGradient(-7, -7, 2, 0, 0, 20);
            g.addColorStop(0, "#6b6490"); g.addColorStop(1, "#16122a");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
            ctx.fillStyle = "#8d88a8"; A.rr(-6, -26, 12, 8, 2); ctx.fill();
            ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(8, -36, 4, -40); ctx.stroke();
            ctx.fillStyle = Math.floor(sceneT * 10) % 2 ? "#FFD23F" : "#FF7A3B";
            ctx.beginPath(); ctx.arc(4, -41, 4, 0, 7); ctx.fill();
            ctx.restore();
          }
        });

        arm(ANCHOR.x - 10, "#c08a50", "#7a4e24");
        ctx.strokeStyle = "#4a2414"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(ANCHOR.x - 14, ANCHOR.y - 4); ctx.lineTo(hx, hy); ctx.stroke();
        if (loaded && shotsLeft > 0 && A.state !== "over") A.drawHero(hx, hy, PR * 2.8, 0, "happy");
        if (proj) A.drawHero(proj.position.x, proj.position.y, PR * 2.8, proj.angle, boosted ? "wings" : "happy");
        for (let i = 0; i < shotsLeft - (loaded ? 1 : 0); i++) A.drawHero(120 - i * 34, G - 16, 36, 0, "happy");

        boomRings.forEach((r) => {
          const k = r.t / 0.45;
          ctx.strokeStyle = `rgba(255,210,63,${1 - k})`;
          ctx.lineWidth = 10 * (1 - k) + 2;
          ctx.beginPath(); ctx.arc(r.x, r.y, r.R * k, 0, 7); ctx.stroke();
        });

        const pill = (x: number, y: number, text: string) => {
          ctx.font = A.font(15, 700);
          const w = ctx.measureText(text).width + 26;
          A.rr(x, y, w, 32, 16);
          ctx.fillStyle = "rgba(7,7,26,.7)"; ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = "#FFD166"; ctx.textAlign = "center"; ctx.fillText(text, x + w / 2, y + 21);
        };
        pill(70, 14, `Level ${level + 1} · ${LEVELS[level].name}`);
        pill(70, 52, `🪨 ${monsters.filter((m) => !m.dead).length}   ❤ ${retries}`);
        if (phase === "aim" && !drag && A.state === "play" && sceneT < 9 && level === 0 && shotsLeft === LEVELS[0].shots) {
          ctx.globalAlpha = 0.65 + Math.sin(sceneT * 5) * 0.35;
          ctx.font = A.font(19);
          ctx.textAlign = "center";
          ctx.lineWidth = 5; ctx.strokeStyle = "rgba(7,7,26,.8)";
          ctx.strokeText("Drag the sprite back, aim, and let go!", ANCHOR.x + 80, ANCHOR.y - 110);
          ctx.fillStyle = "#fff";
          ctx.fillText("Drag the sprite back, aim, and let go!", ANCHOR.x + 80, ANCHOR.y - 110);
          ctx.globalAlpha = 1;
        }
        if (phase === "fly" && proj && !boosted && phaseT < 4) {
          ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = A.font(14, 700); ctx.textAlign = "center";
          ctx.fillText("Tap for BOOST!", proj.position.x, proj.position.y - 36);
        }
        if (msg) {
          const a = Math.min(1, msg.t * 4);
          ctx.globalAlpha = a;
          ctx.fillStyle = "rgba(7,7,26,.6)";
          ctx.fillRect(0, 0, W, H);
          ctx.textAlign = "center";
          ctx.font = A.font(48);
          const tg = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
          tg.addColorStop(0, "#fff4d6"); tg.addColorStop(0.5, "#ffd166"); tg.addColorStop(1, "#ff9f1c");
          ctx.fillStyle = tg;
          ctx.fillText(msg.title, W / 2, H / 2 - 10);
          ctx.font = A.font(20, 600);
          ctx.fillStyle = "#fff";
          ctx.fillText(msg.sub, W / 2, H / 2 + 30);
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
