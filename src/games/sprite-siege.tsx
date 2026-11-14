"use client";

import { useEffect, useState } from "react";
import { ArcadeGame } from "./engine/arcade-game";
import type { Api, GameModule } from "./engine/types";
import { decoys, loadMeta as loadQuizMeta, loadReview, loadTerms, maskTerm, capFirst, shuffle, type ReviewQ, type Term } from "./earth-quiz";

// Port of sprite_siege.html (Oct 2026 rebalance, VERSION 2). Permanent upgrades are saved on this device only
// (the original synced them to the student's Quest login; the local rebuild never writes to the live database).
// Earth science theme: defend your field base from rockfalls, lava bombs, meteors, storms and the Magma King.
const W = 420, H = 700, CX = 210, CY = 318, CORE_R = 26, PANEL_Y = 598;
const WIN_WAVE = 20, Q_EVERY = 2, VERSION = 2, META_KEY = "bedrock_sprite_siege_meta";
const hpMult = (w: number) => Math.pow(1.13, w - 1) * (w > 20 ? Math.pow(1.1, w - 20) : 1);
const dmgMult = (w: number) => 1 + 0.09 * (w - 1) + (w > 20 ? 0.25 * (w - 20) : 0);

type Foe = { name: string; hp: number; spd: number; dmg: number; coins: number; pts: number; r: number; from: number; fact: string; sprite?: string };
const FOES: Record<string, Foe> = {
  rock: { name: "Rockfall", hp: 14, spd: 34, dmg: 10, coins: 3, pts: 3, r: 12, from: 1, sprite: "boulder", fact: "Rockfalls start when ice wedging and gravity pry loose rock off steep cliffs." },
  lava: { name: "Lava Bomb", hp: 9, spd: 62, dmg: 6, coins: 2, pts: 2, r: 10, from: 2, sprite: "lava-bomb", fact: "Lava bombs are blobs of molten rock flung from a vent. Some are as big as a car." },
  meteor: { name: "Meteor Shower", hp: 5, spd: 84, dmg: 3, coins: 1, pts: 1, r: 7, from: 3, sprite: "meteor", fact: "Meteor showers happen when Earth plows through dust left by a comet." },
  twister: { name: "Twister", hp: 35, spd: 34, dmg: 12, coins: 5, pts: 5, r: 12, from: 5, sprite: "tornado", fact: "Tornadoes zigzag because they're steered by the storm above them." },
  storm: { name: "Thunderstorm", hp: 80, spd: 24, dmg: 20, coins: 8, pts: 8, r: 17, from: 7, sprite: "storm-cloud", fact: "Lightning heats the air to about 30,000 °C, five times hotter than the Sun's surface." },
  ash: { name: "Ash Cloud", hp: 45, spd: 50, dmg: 14, coins: 6, pts: 6, r: 13, from: 9, fact: "Volcanic ash is tiny bits of sharp rock and glass. It can stall jet engines." },
  boss: { name: "Magma King", hp: 900, spd: 17, dmg: 60, coins: 60, pts: 100, r: 30, from: 10, sprite: "magma-king", fact: "The Magma King erupts every 5 waves. Stack your defenses, like towns that plan for hazards." },
};
const GEAR = [
  { k: "hammer", name: "Rock Hammer", icon: "⛏", base: 10, max: 30, what: "+damage", fact: "Geologists use a rock hammer to crack rocks and see the fresh surface inside." },
  { k: "radar", name: "Radar", icon: "📡", base: 12, max: 15, what: "faster shots", fact: "Doppler radar spots spinning storms before a tornado forms." },
  { k: "shelter", name: "Shelter", icon: "🧱", base: 14, max: 20, what: "+max health", fact: "Buildings in quake zones use flexible steel frames so they sway instead of snapping." },
  { k: "plants", name: "Plant Cover", icon: "🌱", base: 20, max: 12, what: "heal over time", fact: "Plant roots hold soil together and slow erosion and landslides." },
  { k: "sensors", name: "Seismograph", icon: "📈", base: 15, max: 10, what: "+range", fact: "Seismographs can sense earthquake waves from the other side of the planet." },
  { k: "wetland", name: "Wetlands", icon: "🌾", base: 25, max: 6, what: "slows foes", fact: "Wetlands soak up floodwater like a sponge and slow it down." },
]
const costOf = (h: (typeof GEAR)[number], lvl: number) => Math.round(h.base * Math.pow(1.32, lvl));
const PERMS = [
  { k: "heart", name: "Bedrock Foundation", desc: "+25 starting max health", cost: (l: number) => 3 + l, max: 8 },
  { k: "allow", name: "Mining Claim", desc: "+20% coins from every hazard", cost: (l: number) => 4 + l * 2, max: 5 },
  { k: "routine", name: "Ground Cover", desc: "+0.3 health / second from the start", cost: (l: number) => 5 + l * 2, max: 5 },
  { k: "start", name: "Head Start", desc: "+40 starting coins", cost: (l: number) => 3 + l, max: 5 },
  { k: "multi", name: "Double Shot", desc: "+1 extra shot each time you fire", cost: (l: number) => 12 + l * 8, max: 3 },
]

type Meta = { diamonds: number; perm: Record<string, number>; right: number; best: number; v?: number };
let META: Meta = { diamonds: 0, perm: {}, right: 0, best: 0 };
const pl = (k: string) => META.perm[k] || 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(META)); } catch {} notify(); }
function loadMeta() {
  try { const r = JSON.parse(localStorage.getItem(META_KEY) || "null"); if (r) META = { ...META, ...r }; } catch {}
  if (META.v !== VERSION) { META.v = VERSION; META.best = 0; saveMeta(); }
}

export type SiegeQ = { ch: string; title: string; term: string; prompt: string; why?: string; opts: string[]; gems: number; heal: number; wave: number };
let showQ: ((q: SiegeQ | null) => void) | null = null;
let answerHook: ((ok: boolean) => void) | null = null;
let resumeHook: (() => void) | null = null;
let apiRef: Api | null = null;

// Questions: half from the review bank when review.json is wired in (see earth-quiz.ts), the rest are glossary
// fill-in-the-blanks. Loaded when the page mounts; until then waves just skip the question.
let TERMS: Term[] = [], REVIEW: ReviewQ[] | null = null, TITLES: Record<number, string> = {}, realmOf = (_ch: number) => "";
function studyChapter(avail: number[]) {
  let n = 0;
  try { n = +((JSON.parse(localStorage.getItem("bedrock_last_chapter") || "null") || {}).n) || 0; } catch {}
  if (n && avail.includes(n) && Math.random() < 0.6) return n;
  const ok = avail.filter((c) => !n || c <= n), from = ok.length ? ok : avail;
  return from[Math.floor(Math.random() * from.length)];
}
function makeQ(): Omit<SiegeQ, "gems" | "heal" | "wave"> | null {
  if (REVIEW?.length && Math.random() < 0.5) {
    const ch = studyChapter([...new Set(REVIEW.map((r) => r.ch))]), rs = REVIEW.filter((r) => r.ch === ch), r = rs[Math.floor(Math.random() * rs.length)];
    return { ch: String(ch), title: TITLES[ch] || "Chapter " + ch, term: r.right, prompt: r.q, why: r.why, opts: shuffle([r.right, ...r.wrong]) };
  }
  if (!TERMS.length) return null;
  const chs = [...new Set(TERMS.map((t) => t.ch))].filter((c) => TERMS.filter((t) => t.ch === c).length >= 4), ch = studyChapter(chs);
  const inCh = TERMS.filter((t) => t.ch === ch), pick = inCh[Math.floor(Math.random() * inCh.length)];
  return { ch: String(ch), title: TITLES[ch] || "Chapter " + ch, term: pick.term, prompt: capFirst(maskTerm(pick.def, pick.term)), opts: shuffle([pick.term, ...decoys(pick, TERMS, "chapter", realmOf)]) };
}

const siegeGame: GameModule = {
  config: {
    key: "bedrock_sprite_siege",
    title: "Sprite Siege",
    subtitle: "Defend your base from Earth's hazards!",
    W, H,
    winText: `Wave ${WIN_WAVE} reached!`,
    deathDelay: 800,
    overTitle: "Base overrun!",
    accent: "#7EE8FF",
    heroless: false,
    medals: [
      { at: 600, name: "Bronze", icon: "🥉" },
      { at: 1200, name: "Silver", icon: "🥈" },
      { at: 2000, name: "Gold", icon: "🥇" },
      { at: 3000, name: "Legend", icon: "💎" },
    ],
    howTo: `Your sprite guards the field base and fires on its own. Rockfalls, lava bombs, meteors, twisters and storms close in. Spend 🪙 coins on <b>science gear</b> to power up. Every ${Q_EVERY} waves, answer a question for 💎 diamonds and a health boost — diamonds buy <b>permanent upgrades</b> (below the game). Hazards get much tougher every wave, and the Magma King erupts every 5. Reach <b>wave ${WIN_WAVE}</b> to win!`,
    controls: "Tap gear to buy it · P pause",
    sprites: ["boulder", "lava-bomb", "meteor", "tornado", "storm-cloud", "magma-king"],
    facts: GEAR.map((h) => h.icon + " " + h.fact).concat(["Communities that plan ahead for natural hazards recover much faster."]),
  },
  create() {
    type E = { k: string; f: Foe; x: number; y: number; hp: number; max: number; wob: number; dead?: boolean };
    type Shot = { x: number; y: number; t: E; sp: number; done?: boolean };
    type St = { wave: number; between: number; queue: string[]; spawnT: number; foes: E[]; shots: Shot[]; lv: Record<string, number>; coins: number; maxHp: number; hp: number; cd: number; seen: Record<string, boolean>; paused: boolean; kills: number; hurtT: number; msg: string; msgT: number; askedFor: number };
    let S!: St;
    const stat = {
      dmg: () => 10 + 4 * S.lv.hammer,
      rate: () => Math.max(0.15, 0.6 * Math.pow(0.9, S.lv.radar)),
      range: () => 140 + 18 * S.lv.sensors,
      regen: () => 0.5 * S.lv.plants + 0.3 * pl("routine"),
      slow: () => 0.08 * S.lv.wetland,
      shots: () => 1 + pl("multi"),
    };
    const say = (t: string, s = 4) => { S.msg = t; S.msgT = s; };
    function buildWave(n: number) {
      const list: string[] = [], count = 6 + Math.floor(n * 2.5);
      const pool = Object.keys(FOES).filter((k) => k !== "boss" && FOES[k].from <= n);
      for (let i = 0; i < count; i++) { const k = pool[Math.floor(Math.random() * pool.length)]; list.push(k); if (k === "meteor") list.push("meteor"); }
      if (n % 5 === 0) for (let b = 0; b < 1 + Math.floor(n / 15); b++) list.push("boss");
      return list;
    }
    function nextWave(A: Api) {
      S.wave++; S.queue = buildWave(S.wave); S.spawnT = 0.4;
      A.setScore(Math.max(A.score, (S.wave - 1) * 100 + S.kills));
      if (S.wave === WIN_WAVE) A.win(`You reached wave ${WIN_WAVE}! Keep going for a new best.`);
      if (S.wave % 5 === 0) say("👑 The Magma King is coming! " + FOES.boss.fact, 5);
      else if (S.wave === 21) say("⚠️ Overtime! Every wave from here hits much harder. How long can you last?", 5);
    }
    function spawn(k: string) {
      const f = FOES[k], a = Math.random() * Math.PI * 2, d = 330, m = hpMult(S.wave);
      S.foes.push({ k, f, x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d * 0.95, hp: f.hp * m, max: f.hp * m, wob: Math.random() * 6 });
      if (!S.seen[k] && k !== "boss") { S.seen[k] = true; say("New: " + f.name + " — " + f.fact, 6); }
    }
    function kill(A: Api, e: E) {
      e.dead = true; S.kills++;
      S.coins += Math.round(e.f.coins * (1 + 0.2 * pl("allow")));
      A.addScore(e.f.pts);
      A.particles.burst(e.x, e.y, e.k === "boss" ? "#FFD700" : "#7ee8ff", e.k === "boss" ? 40 : 8, 140, 3);
      A.sfx(e.k === "boss" ? "medal" : "point");
    }
    function finishRun(A: Api) {
      if (S.wave > (META.best || 0)) { META.best = S.wave; saveMeta(); }
      A.gameOver();
    }
    function ask(A: Api) {
      const q = makeQ();
      if (!q || !showQ) { S.between = 1.6; S.askedFor = 0; nextWave(A); return; }
      const gems = 1 + Math.floor(S.wave / 10), heal = Math.round(S.maxHp * 0.25);
      S.paused = true;
      answerHook = (ok) => {
        if (!ok) return;
        META.diamonds += gems; META.right = (META.right || 0) + 1; saveMeta();
        S.hp = Math.min(S.maxHp, S.hp + heal); A.sfx("coin");
      };
      resumeHook = () => { S.paused = false; S.between = 1.2; S.askedFor = 0; nextWave(A); };
      showQ({ ...q, gems, heal, wave: S.wave });
    }
    function coin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); g.addColorStop(0, "#fff3a0"); g.addColorStop(1, "#e0a400");
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "#8a6200"; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
    function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
      const words = String(text).split(" "); let line = "", n = 0;
      for (const w of words) {
        const t = line ? line + " " + w : w;
        if (ctx.measureText(t).width > maxW && line) {
          if (n === maxLines - 1) { ctx.fillText(line + "…", x, y + n * lh); return; }
          ctx.fillText(line, x, y + n * lh); n++; line = w;
        } else line = t;
      }
      ctx.fillText(line, x, y + n * lh);
    }
    function drawFoe(ctx: CanvasRenderingContext2D, A: Api, e: E) {
      const r = e.f.r, b = Math.sin(A.time * 6 + e.wob) * 1.5;
      if (e.f.sprite) {
        const sz = e.k === "boss" ? r * 2.8 : e.k === "meteor" ? r * 3.4 : r * 2.6;
        A.drawSprite(e.f.sprite, e.x, e.y + b, sz, e.k === "meteor" ? Math.atan2(CY - e.y, CX - e.x) - 2.4 : 0);
      } else {
        ctx.save(); ctx.translate(e.x, e.y + b);
        {
          const blobs: [number, number, number][] = [[-r * 0.5, 0, 0.6], [r * 0.45, -r * 0.1, 0.55], [0, -r * 0.4, 0.6], [0, r * 0.25, 0.55]];
          const g = ctx.createRadialGradient(0, -r * 0.3, 2, 0, 0, r * 1.2); g.addColorStop(0, "#c9c4c0"); g.addColorStop(1, "#5a5450");
          ctx.fillStyle = g;
          blobs.forEach(([x, y, s]) => { ctx.beginPath(); ctx.arc(x, y, r * s, 0, 7); ctx.fill(); });
          ctx.fillStyle = "rgba(255,140,60,.8)"; [[-r * 0.3, r * 0.1], [r * 0.25, -r * 0.2], [0, r * 0.35]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); });
        }
        ctx.restore();
      }
      if (e.hp < e.max) {
        const w = Math.max(22, r * 2.2);
        ctx.fillStyle = "#06101c"; ctx.fillRect(e.x - w / 2, e.y - r - 12, w, 5);
        ctx.fillStyle = "#ff6b8a"; ctx.fillRect(e.x - w / 2 + 1, e.y - r - 11, (w - 2) * Math.max(0, e.hp / e.max), 3);
      }
    }

    return {
      reset(A) {
        loadMeta();
        S = { wave: 0, between: 1.2, queue: [], spawnT: 0, foes: [], shots: [], lv: {}, coins: 20 + 40 * pl("start"), maxHp: 100 + 25 * pl("heart"), hp: 100 + 25 * pl("heart"), cd: 0, seen: {}, paused: false, kills: 0, hurtT: 0, msg: "Hazards incoming! Tap science gear below to power up your base.", msgT: 6, askedFor: 0 };
        GEAR.forEach((h) => (S.lv[h.k] = 0));
        A.setScore(0);
        apiRef = A;
        showQ?.(null);
      },
      update(dt, A) {
        if (S.msgT > 0) S.msgT -= dt;
        if (A.state !== "play" || S.paused) return;
        if (S.hurtT > 0) S.hurtT -= dt; else S.hp = Math.min(S.maxHp, S.hp + stat.regen() * dt);
        if (!S.queue.length && !S.foes.length) {
          S.between -= dt;
          if (S.between <= 0) {
            if (S.wave > 0 && S.wave % Q_EVERY === 0 && !S.askedFor) { S.askedFor = S.wave; ask(A); return; }
            S.between = 1.6; S.askedFor = 0; nextWave(A);
          }
        }
        S.spawnT -= dt;
        if (S.queue.length && S.spawnT <= 0) { spawn(S.queue.shift()!); S.spawnT = Math.max(0.12, 1.0 - S.wave * 0.04); }
        const slow = stat.slow();
        for (const e of S.foes) {
          const dx = CX - e.x, dy = CY - e.y, dist = Math.hypot(dx, dy);
          let sp = e.f.spd * (1 + Math.min(1, S.wave * 0.02));
          if (slow && dist < 110) sp *= 1 - slow;
          if (e.k === "twister") e.wob += dt * 4;
          const nx = dx / dist, ny = dy / dist, zig = e.k === "twister" ? Math.sin(e.wob) * 30 : 0;
          e.x += (nx * sp - ny * zig) * dt; e.y += (ny * sp + nx * zig) * dt;
          if (dist < CORE_R + e.f.r) {
            const dmg = Math.round(e.f.dmg * dmgMult(S.wave));
            e.dead = true; S.hp -= dmg; S.hurtT = 2; A.shake(5, 0.2); A.sfx("hit"); A.float("-" + dmg, CX, CY - 40, "#FF3B5C");
            if (S.hp <= 0) { S.hp = 0; finishRun(A); return; }
          }
        }
        S.cd -= dt;
        if (S.cd <= 0) {
          const R = stat.range();
          const targets = S.foes.filter((e) => !e.dead && Math.hypot(e.x - CX, e.y - CY) <= R).sort((a, b) => Math.hypot(a.x - CX, a.y - CY) - Math.hypot(b.x - CX, b.y - CY)).slice(0, stat.shots());
          if (targets.length) { S.cd = stat.rate(); targets.forEach((t) => S.shots.push({ x: CX, y: CY, t, sp: 420 })); A.sfx("flap"); }
        }
        for (const s of S.shots) {
          if (s.t.dead) { s.done = true; continue; }
          const dx = s.t.x - s.x, dy = s.t.y - s.y, d = Math.hypot(dx, dy), stp = s.sp * dt;
          if (d <= stp + s.t.f.r) { s.done = true; s.t.hp -= stat.dmg(); if (s.t.hp <= 0) kill(A, s.t); }
          else { s.x += (dx / d) * stp; s.y += (dy / d) * stp; }
        }
        S.shots = S.shots.filter((s) => !s.done);
        S.foes = S.foes.filter((e) => !e.dead);
      },
      pointer(type, x, y, A) {
        if (type !== "down" || S.paused || y < PANEL_Y) return;
        const col = Math.floor((x - 6) / 137), row = Math.floor((y - PANEL_Y - 8) / 46);
        if (col < 0 || col > 2 || row < 0 || row > 1) return;
        const h = GEAR[row * 3 + col], lvl = S.lv[h.k], c = costOf(h, lvl);
        if (lvl >= h.max) return say(h.name + " is maxed out!", 2);
        if (S.coins < c) return say("Need " + c + " coins for " + h.name + ".", 2);
        S.coins -= c; S.lv[h.k]++;
        if (h.k === "shelter") { S.maxHp += 20; S.hp = Math.min(S.maxHp, S.hp + 20); }
        A.sfx("coin"); A.particles.burst(CX, CY, "#FFD700", 10, 120, 3);
        say(h.icon + " " + h.name + " " + S.lv[h.k] + ": " + h.fact, 4);
      },
      draw(ctx, A) {
        const bg = ctx.createRadialGradient(CX, CY, 20, CX, CY, 420);
        bg.addColorStop(0, "#2a2016"); bg.addColorStop(1, "#0c0906");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        // topographic contour lines around the base
        ctx.strokeStyle = "rgba(230,190,130,.08)"; ctx.lineWidth = 1.5;
        for (let k = 1; k < 14; k++) { ctx.beginPath(); for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2, rr = k * 30 + Math.sin(t * 3 + k) * 8 + Math.cos(t * 5 - k) * 5, px = CX + Math.cos(t) * rr, py = CY + Math.sin(t) * rr * 0.9; if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
        ctx.beginPath(); ctx.arc(CX, CY, stat.range(), 0, 7); ctx.strokeStyle = "rgba(126,232,255,.3)"; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -A.time * 12; ctx.stroke(); ctx.setLineDash([]);
        if (stat.slow()) { ctx.beginPath(); ctx.arc(CX, CY, 110, 0, 7); ctx.fillStyle = `rgba(168,85,247,${0.05 + stat.slow() * 0.2})`; ctx.fill(); }
        const glow = 0.3 + Math.sin(A.time * 3) * 0.1;
        const cg = ctx.createRadialGradient(CX, CY, 4, CX, CY, CORE_R + 22);
        cg.addColorStop(0, `rgba(126,232,255,${glow + 0.2})`); cg.addColorStop(1, "rgba(126,232,255,0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(CX, CY, CORE_R + 22, 0, 7); ctx.fill();
        A.drawHero(CX, CY, 62, 0, S.hp < S.maxHp * 0.3 ? "hurt" : "happy");
        A.rr(CX - 40, CY + 38, 80, 8, 4); ctx.fillStyle = "#06101c"; ctx.fill();
        A.rr(CX - 39, CY + 39, Math.max(0, 78 * S.hp / S.maxHp), 6, 3); ctx.fillStyle = S.hp > S.maxHp * 0.3 ? "#3ff0b5" : "#FF3B5C"; ctx.fill();
        S.foes.forEach((e) => drawFoe(ctx, A, e));
        S.shots.forEach((s) => {
          ctx.shadowColor = "#9df0ff"; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fillStyle = "#dffaff"; ctx.fill();
          ctx.shadowBlur = 0;
        });
        ctx.font = A.font(15, 900); ctx.lineWidth = 4; ctx.strokeStyle = "#06101c"; ctx.textAlign = "right";
        const hud = (t: string, y: number, c: string) => { ctx.strokeText(t, 408, y); ctx.fillStyle = c; ctx.fillText(t, 408, y); };
        hud(String(S.coins), 68, "#FFD700"); coin(ctx, 408 - ctx.measureText(String(S.coins)).width - 12, 63, 7);
        hud("💎 " + META.diamonds, 90, "#7ee8ff");
        hud("Wave " + Math.max(1, S.wave), 112, "#f4efff");
        hud("❤ " + Math.ceil(S.hp) + "/" + S.maxHp, 134, "#ff8fa3");
        if (S.msgT > 0) {
          ctx.textAlign = "center"; ctx.font = A.font(13, 800);
          ctx.fillStyle = "rgba(6,16,28,.88)"; A.rr(16, PANEL_Y - 62, W - 32, 52, 12); ctx.fill();
          ctx.strokeStyle = "rgba(126,232,255,.25)"; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = "#e7f9ff"; wrap(ctx, S.msg, CX, PANEL_Y - 41, W - 52, 16, 2);
        }
        const pg = ctx.createLinearGradient(0, PANEL_Y, 0, H); pg.addColorStop(0, "#0e1a2e"); pg.addColorStop(1, "#070d1a");
        ctx.fillStyle = pg; ctx.fillRect(0, PANEL_Y, W, H - PANEL_Y);
        ctx.fillStyle = "rgba(126,232,255,.5)"; ctx.fillRect(0, PANEL_Y, W, 2);
        GEAR.forEach((h, i) => {
          const x = 6 + (i % 3) * 137, y = PANEL_Y + 8 + Math.floor(i / 3) * 46, lvl = S.lv[h.k], maxed = lvl >= h.max, c = costOf(h, lvl), can = !maxed && S.coins >= c;
          A.rr(x, y, 133, 42, 10);
          const bgr = ctx.createLinearGradient(0, y, 0, y + 42);
          if (can) { bgr.addColorStop(0, "#1f5a7a"); bgr.addColorStop(1, "#123048"); } else { bgr.addColorStop(0, "#151f33"); bgr.addColorStop(1, "#0f1626"); }
          ctx.fillStyle = bgr; ctx.fill();
          ctx.strokeStyle = can ? "rgba(126,232,255,.6)" : "rgba(255,255,255,.08)"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.textAlign = "left"; ctx.font = A.font(13, 900); ctx.fillStyle = can ? "#f4efff" : "#7f8aa0";
          ctx.fillText(h.icon + " " + h.name + (lvl ? " " + lvl : ""), x + 8, y + 18);
          ctx.font = A.font(11, 800); ctx.fillStyle = can ? "#FFD700" : "#6d7890";
          if (maxed) ctx.fillText("MAX · " + h.what, x + 8, y + 34); else { if (can) coin(ctx, x + 13, y + 30, 5); else { ctx.beginPath(); ctx.arc(x + 13, y + 30, 5, 0, 7); ctx.fill(); } ctx.fillText(c + " · " + h.what, x + 22, y + 34); }
        });
      },
    };
  },
};

function QuestionCard({ q, onDone }: { q: SiegeQ; onDone: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const ok = picked !== null && q.opts[picked] === q.term;
  return (
    <div data-ui className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-[#050a16]/80 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-sm rounded-3xl p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-sky">💎 Diamond question · after wave {q.wave}</div>
        <div className="mt-1 text-xs text-muted">Right answer = +{q.gems} 💎 and ❤ +{q.heal} health · Ch {q.ch} {q.title}</div>
        <p className="mt-3 text-base font-semibold text-fg">{q.prompt}</p>
        <div className="mt-3 grid gap-2">
          {q.opts.map((o, i) => {
            const right = picked !== null && o === q.term, wrong = picked === i && !ok;
            return (
              <button
                key={i}
                disabled={picked !== null}
                onClick={() => { setPicked(i); const good = o === q.term; answerHook?.(good); if (!good) setWait(2); }}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${right ? "border-emerald bg-emerald/20 text-fg" : wrong ? "border-crimson bg-crimson/20 text-fg" : "border-line bg-fg/5 text-fg hover:bg-fg/10"}`}
              >
                {o}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <>
            <p className="mt-3 text-sm text-fg">
              {ok ? <>✅ <b>Nice!</b> +{q.gems} 💎 · ❤ +{q.heal}</> : <>❌ The answer is <b>{q.term}</b> (in green).</>}
              {q.why && <><br /><span className="text-muted">{q.why}</span></>}
            </p>
            <button disabled={wait > 0} onClick={onDone} className="mt-4 w-full rounded-xl bg-sky-400 px-4 py-2 font-bold text-[#06101c] disabled:opacity-50">
              {wait > 0 ? `Read it… ${wait}` : "Back to the siege →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Shop() {
  const [, force] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    const t = setInterval(() => setPlaying(!!apiRef && (apiRef.state === "play" || apiRef.state === "dying" || apiRef.state === "paused")), 400);
    return () => { listeners.delete(f); clearInterval(t); };
  }, []);
  return (
    <div className="glass mx-auto mt-5 max-w-md rounded-3xl p-5">
      <h2 className="flex items-center justify-between font-display text-lg font-bold text-fg">Permanent upgrades <span className="text-sky">💎 {META.diamonds}</span></h2>
      <p className="mt-1 text-xs text-muted">Diamonds only come from answering questions right (one every {Q_EVERY} waves). These upgrades last forever, every run.{META.best ? ` Your best: wave ${META.best}.` : ""}</p>
      <div className="mt-3 grid gap-2">
        {PERMS.map((p) => {
          const l = pl(p.k), maxed = l >= p.max, c = p.cost(l);
          return (
            <div key={p.k} className="flex items-center gap-3 rounded-2xl border border-line bg-fg/5 px-3 py-2">
              <div className="min-w-0 flex-1"><b className="text-sm text-fg">{p.name}</b><div className="text-xs text-muted">{p.desc}</div></div>
              <div className="text-xs font-bold text-muted">Lv {l}/{p.max}</div>
              <button
                disabled={maxed || META.diamonds < c || playing}
                onClick={() => { if (playing || maxed || META.diamonds < c) return; META.diamonds -= c; META.perm[p.k] = l + 1; saveMeta(); }}
                className="rounded-xl bg-sky-400 px-3 py-1.5 text-sm font-bold text-[#06101c] disabled:bg-fg/10 disabled:text-muted"
              >
                {maxed ? "MAX" : `💎 ${c}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted/80">{playing ? "Upgrades can be bought between runs." : "Saved on this device."}</p>
    </div>
  );
}

export function SpriteSiege() {
  const [q, setQ] = useState<SiegeQ | null>(null);
  const [, setReady] = useState(0);
  useEffect(() => {
    loadMeta(); setReady(1);
    showQ = setQ;
    Promise.all([loadTerms(), loadReview(), loadQuizMeta()]).then(([t, r, m]) => { TERMS = t; REVIEW = r; TITLES = m.titles; realmOf = m.realmOf; }).catch(() => {});
    return () => { showQ = null; };
  }, []);
  return (
    <div>
      <div className="relative">
        <ArcadeGame game={siegeGame} />
        {q && <QuestionCard key={q.wave} q={q} onDone={() => { setQ(null); resumeHook?.(); }} />}
      </div>
      <Shop />
    </div>
  );
}
