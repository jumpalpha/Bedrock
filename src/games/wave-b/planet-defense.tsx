"use client";

import { useEffect, useState } from "react";
import { ArcadeGame } from "../engine/arcade-game";
import type { Api, GameModule } from "../engine/types";
import { glossaryQuestion, type Quest } from "./review-bank";

// Twin of Dopps Class "Immune Defense": the same tower defense, but Earth's atmosphere and magnetic field
// defend the planet from meteoroids and the solar wind. Quiz answers only award in-game coins.
const W = 420, H = 700, PANEL_Y = 604;
const WAVES = 10, START_COINS = 120, START_HP = 20, WAVE_BONUS = 30, Q_PER_BREAK = 2, Q_COINS = 20;
const PATH: [number, number][] = [[60, 44], [60, 170], [360, 170], [360, 300], [60, 300], [60, 430], [360, 430], [360, 548], [210, 548], [210, 566]];
const EARTH = { x: 210, y: 578 };
const SEG: { x1: number; y1: number; x2: number; y2: number; len: number; at: number }[] = [];
let PATH_LEN = 0;
for (let i = 0; i < PATH.length - 1; i++) {
  const [x1, y1] = PATH[i], [x2, y2] = PATH[i + 1], len = Math.hypot(x2 - x1, y2 - y1);
  SEG.push({ x1, y1, x2, y2, len, at: PATH_LEN }); PATH_LEN += len;
}
function posAt(d: number): [number, number] {
  for (const s of SEG) if (d <= s.at + s.len) { const t = (d - s.at) / s.len; return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t]; }
  const e = PATH[PATH.length - 1]; return [e[0], e[1]];
}
const SLOT_POS: [number, number][] = [[150, 108], [270, 108], [130, 235], [210, 235], [290, 235], [130, 365], [210, 365], [290, 365], [130, 492], [210, 492], [290, 492]];

type TowerDef = { name: string; color: string; cost: number; up: number[]; dmg: number[]; rate: number[]; range: number[]; area?: boolean; slow?: number[]; targets?: number[]; vsSolar?: number; rockOnly?: boolean; fact: string };
const TOWERS: Record<string, TowerDef> = {
  neutro: { name: "Mesosphere", color: "#5cc8ff", cost: 40, up: [35, 55], dmg: [6, 9, 13], rate: [0.45, 0.42, 0.38], range: [85, 90, 98], fact: "Most meteors burn up in the mesosphere, about 50 to 85 km up, as friction with the air heats them white-hot." },
  macro: { name: "Thermosphere", color: "#c08bff", cost: 70, up: [60, 80], dmg: [10, 16, 24], rate: [1.3, 1.2, 1.1], range: [68, 72, 78], area: true, fact: "The thermosphere soaks up the Sun's strongest X-rays and can reach well over 1,000 °C. Its heat pulses hit everything nearby." },
  anti: { name: "Ionosphere", color: "#ffd23f", cost: 55, up: [45, 60], dmg: [2, 3, 4], rate: [0.8, 0.7, 0.6], range: [95, 105, 115], slow: [0.45, 0.55, 0.6], targets: [1, 1, 2], fact: "The ionosphere is charged by sunlight. It slows and marks incoming particles so other layers hit harder, and it makes auroras glow." },
  tcell: { name: "Magnetosphere", color: "#4be38a", cost: 90, up: [75, 100], dmg: [30, 45, 65], rate: [1.1, 1.05, 1.0], range: [100, 105, 112], vsSolar: 2, fact: "Earth's magnetic field, made by its liquid iron outer core, deflects the solar wind. Extra strong against solar particles." },
  pill: { name: "DART Impactor", color: "#ff8fa3", cost: 50, up: [40, 55], dmg: [22, 32, 45], rate: [0.7, 0.65, 0.6], range: [100, 105, 110], rockOnly: true, fact: 'In 2022 NASA\'s DART spacecraft hit asteroid Dimorphos and changed its orbit. It only works on rocks, and overusing it shatters them into "rubble piles."' },
};
const ORDER = ["neutro", "macro", "anti", "tcell", "pill"];
type ThreatDef = { name: string; hp: number; speed: number; coins: number; pts: number; hurt: number; kind: string; r: number; resist?: boolean; fact: string };
// kind "rock" = rocky (DART can hit it), kind "solar" = solar particles (the magnetosphere hits these double).
const THREATS: Record<string, ThreatDef> = {
  rock: { name: "Meteoroid", hp: 30, speed: 42, coins: 6, pts: 10, hurt: 1, kind: "rock", r: 11, fact: "Meteoroids are bits of rock and metal in space. Most are smaller than a pebble." },
  solar: { name: "Solar Wind", hp: 16, speed: 70, coins: 5, pts: 8, hurt: 1, kind: "solar", r: 9, fact: "The solar wind is a stream of charged particles from the Sun. DART can't stop it, but the magnetosphere can!" },
  comet: { name: "Comet Chunk", hp: 90, speed: 26, coins: 12, pts: 15, hurt: 2, kind: "comet", r: 13, fact: "Comets are dirty snowballs of ice and dust. Their chunks are big, slow and tough." },
  super: { name: "Rubble Pile", hp: 120, speed: 38, coins: 15, pts: 25, hurt: 3, kind: "rock", resist: true, r: 13, fact: "Rubble piles are loose heaps of rock held together by gravity. They soak up impacts, so DART can't hurt them." },
  boss: { name: "Solar Storm", hp: 1200, speed: 22, coins: 100, pts: 200, hurt: 10, kind: "solar", r: 24, fact: "A solar storm, or coronal mass ejection, is a giant burst of solar plasma. The 1859 Carrington Event made telegraph wires spark." },
};
const WAVE_PLAN: [string, number][][] = [
  [["rock", 8]], [["rock", 10], ["solar", 4]], [["solar", 8], ["rock", 6]], [["comet", 4], ["rock", 10]], [["solar", 14], ["comet", 4]],
  [["rock", 16], ["comet", 6]], [["solar", 18], ["rock", 8]], [["comet", 8], ["solar", 14], ["rock", 8]], [["rock", 20], ["solar", 14], ["comet", 6]], [["solar", 12], ["rock", 8], ["boss", 1]],
];
const RESIST_PER_RUBBLE = 70;

// Atmosphere, space and solar system chapters get asked half the time.
const SPACE_CH = [19, 27, 28];
type Q = Quest;
const makeQ = (): Q | null => glossaryQuestion(SPACE_CH);
type Quiz = { wave: number; qs: Q[]; onRight: () => void; done: (right: number) => void };
let showQuiz: ((q: Quiz | null) => void) | null = null;

const planetGame: GameModule = {
  config: {
    key: "bedrock_planet_defense",
    title: "Planet Defense",
    subtitle: "Shield Earth from meteors and the solar wind!",
    W, H,
    winText: "Earth survived every wave!",
    deathDelay: 700,
    overTitle: "Earth took too many hits!",
    accent: "#38BDF8",
    medals: [
      { at: 600, name: "Bronze", icon: "🥉" },
      { at: 1500, name: "Silver", icon: "🥈" },
      { at: 2500, name: "Gold", icon: "🥇" },
      { at: 3000, name: "Legend", icon: "💎" },
    ],
    howTo: "Meteoroids and the solar wind stream in from space toward <b>Earth</b>. Tap a glowing <b>+</b> spot to place a shield layer. Tap a layer to upgrade it. Survive <b>10 waves</b> to win. Between waves, answer questions for bonus coins.<br>⚠ The <b>DART Impactor</b> only hits rocks, and overusing it makes <b>rubble piles</b> it can't hurt!",
    controls: "Tap to build and upgrade · Space starts the next wave · P pause",
    sprites: ["space-rock", "solar-wind", "earth"],
    facts: [
      "Earth's atmosphere has layers: troposphere, stratosphere, mesosphere and thermosphere, then the thin exosphere.",
      "The ozone layer in the stratosphere absorbs most of the Sun's harmful ultraviolet light.",
      "Earth's magnetic field comes from moving liquid iron in the outer core.",
      "Auroras happen when solar wind particles slam into gases high in the atmosphere and make them glow.",
      "Tons of space dust and tiny meteoroids fall into Earth's atmosphere every day.",
      "NASA's DART mission in 2022 was the first test of moving an asteroid to protect Earth.",
    ],
  },
  create() {
    type Tower = { type: string; lvl: number; cd: number; spin: number; x: number; y: number };
    type Slot = { x: number; y: number; tower: Tower | null };
    type Threat = { k: string; g: ThreatDef; d: number; hp: number; max: number; slowT: number; slowF: number; tagT: number; wob: number; dead?: boolean };
    const SLOTS: Slot[] = SLOT_POS.map(([x, y]) => ({ x, y, tower: null }));
    let S!: {
      wave: number; phase: "build" | "wave" | "quiz" | "done"; hp: number; coins: number; threats: Threat[]; queue: string[]; spawnT: number;
      sel: Slot | null; buildAt: Slot | null; shots: { x1: number; y1: number; x2: number; y2: number; t: number; c: string }[];
      pulses: { x: number; y: number; r: number; t: number; c: string }[]; overuse: number; rubble: number; seen: Record<string, boolean>;
      speed: number; lastPtr: number; msg: string; msgT: number;
    };
    const say = (t: string, s = 4) => { S.msg = t; S.msgT = s; };
    const sellValue = (t: Tower) => { const T = TOWERS[t.type]; let spent = T.cost; for (let i = 0; i < t.lvl; i++) spent += T.up[i]; return Math.floor(spent * 0.6); };
    function buildQueue(n: number) {
      const list: string[] = [];
      WAVE_PLAN[n - 1].forEach(([k, c]) => { for (let i = 0; i < c; i++) list.push(k); });
      for (let i = 0; i < S.rubble; i++) list.push("super");
      const boss = list.filter((k) => k === "boss"), rest = list.filter((k) => k !== "boss");
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      return rest.concat(boss);
    }
    function startWave(A: Api) {
      if (S.phase !== "build") return;
      S.wave++; S.phase = "wave"; S.queue = buildQueue(S.wave); S.spawnT = 0; S.sel = null; S.buildAt = null;
      if (S.rubble) say(`⚠ DART overuse shattered rocks into ${S.rubble} rubble pile${S.rubble > 1 ? "s" : ""}! DART can't hurt them.`, 5);
      S.rubble = 0;
      A.sfx("jump");
    }
    function spawn(k: string) {
      const g = THREATS[k], m = 1 + 0.12 * (S.wave - 1);
      S.threats.push({ k, g, d: 0, hp: Math.round(g.hp * m), max: Math.round(g.hp * m), slowT: 0, slowF: 0, tagT: 0, wob: Math.random() * 6 });
      if (!S.seen[k]) { S.seen[k] = true; say("☄️ New: " + g.name + " — " + g.fact, 6); }
    }
    function waveCleared(A: Api) {
      A.addScore(50);
      if (S.wave >= WAVES) { A.addScore(S.hp * 20); A.win("Earth survived every wave!"); S.phase = "done"; A.gameOver(true); return; }
      S.coins += WAVE_BONUS;
      S.rubble = Math.floor(S.overuse / RESIST_PER_RUBBLE);
      S.overuse %= RESIST_PER_RUBBLE;
      S.phase = "quiz";
      const done = () => { S.phase = "build"; say(`Wave ${S.wave} cleared! Build or upgrade, then start wave ${S.wave + 1}.`, 5); };
      const qs: Q[] = [];
      for (let i = 0; i < Q_PER_BREAK; i++) { const q = makeQ(); if (q) qs.push(q); }
      if (!qs.length || !showQuiz) { done(); return; }
      showQuiz({
        wave: S.wave, qs,
        onRight: () => { S.coins += Q_COINS; A.sfx("coin"); },
        done: (right) => { if (right) A.toast(`🧠 ${right} right · +${right * Q_COINS} coins`, 2200); done(); },
      });
    }
    function damage(A: Api, e: Threat, amt: number) {
      if (e.tagT > 0) amt *= 1.4;
      e.hp -= amt;
      if (e.hp <= 0 && !e.dead) {
        e.dead = true; S.coins += e.g.coins; A.addScore(e.g.pts); A.sfx("point");
        const [x, y] = posAt(e.d);
        A.particles.burst(x, y, e.k === "solar" || e.k === "boss" ? "#ffd23f" : e.k === "comet" ? "#9fe8ff" : "#d9a77a", e.k === "boss" ? 40 : 10, 140, 3);
        A.float("+" + e.g.coins, x, y - 10, "#FFD700");
      }
    }
    const inRange = (t: Tower, e: Threat) => { const [x, y] = posAt(e.d); return Math.hypot(x - t.x, y - t.y) <= TOWERS[t.type].range[t.lvl]; };

    function coin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dim = false) {
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, dim ? "#bbb" : "#fff3a0"); g.addColorStop(1, dim ? "#6d6680" : "#e0a400");
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = dim ? "#444" : "#8a6200"; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
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
    function btn(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number, w: number, h: number, fill: string, label: string, sub: string, disabled = false) {
      A.rr(x, y, w, h, 12);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      if (disabled) { g.addColorStop(0, "#4a4458"); g.addColorStop(1, "#332e40"); } else { g.addColorStop(0, fill); g.addColorStop(1, shade(fill)); }
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = disabled ? "#aaa" : "#10091f"; ctx.textAlign = "center";
      ctx.font = A.font(15, 900); ctx.fillText(label, x + w / 2, y + (sub ? h / 2 - 2 : h / 2 + 5));
      if (sub) { ctx.font = A.font(12, 800); ctx.fillText(sub, x + w / 2, y + h / 2 + 14); }
    }
    const shade = (hex: string) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.round(v * 0.72); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
    function drawTowerIcon(ctx: CanvasRenderingContext2D, A: Api, type: string, x: number, y: number, r: number, lvl: number) {
      const T = TOWERS[type];
      ctx.save(); ctx.translate(x, y);
      ctx.shadowColor = T.color; ctx.shadowBlur = 12;
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, T.color); g.addColorStop(1, shade(T.color));
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(16,9,31,.8)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "rgba(16,9,31,.7)"; ctx.strokeStyle = "rgba(16,9,31,.75)"; ctx.lineWidth = 3; ctx.lineCap = "round";
      if (type === "neutro") ([[-5, -3], [4, -5], [2, 5]] as const).forEach(([a, b]) => { ctx.beginPath(); ctx.arc((a * r) / 16, (b * r) / 16, r / 4.5, 0, 7); ctx.fill(); });
      else if (type === "macro") { ctx.beginPath(); ctx.arc(-r / 4, 0, r / 3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(r / 3, -r / 4, r / 7, 0, 7); ctx.fill(); }
      else if (type === "anti") { ctx.beginPath(); ctx.moveTo(0, r / 2); ctx.lineTo(0, 0); ctx.lineTo(-r / 2.2, -r / 2); ctx.moveTo(0, 0); ctx.lineTo(r / 2.2, -r / 2); ctx.stroke(); }
      else if (type === "tcell") { ctx.beginPath(); ctx.arc(0, 0, r / 2.6, 0, 7); ctx.fill(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); ctx.stroke(); } }
      else if (type === "pill") { ctx.rotate(-0.6); ctx.fillStyle = "#fff"; ctx.fillRect(-r * 0.22, -r * 0.22, r * 0.44, r * 0.44); ctx.lineWidth = 2; ctx.strokeStyle = "#10091f"; ctx.strokeRect(-r * 0.22, -r * 0.22, r * 0.44, r * 0.44); ctx.fillStyle = "#2f8fe0"; ctx.fillRect(-r * 0.75, -r * 0.14, r * 0.5, r * 0.28); ctx.fillRect(r * 0.25, -r * 0.14, r * 0.5, r * 0.28); }
      ctx.restore();
      for (let i = 0; i < lvl; i++) { ctx.beginPath(); ctx.arc(x - 6 + i * 12, y + r + 6, 4, 0, 7); ctx.fillStyle = "#FFD700"; ctx.fill(); ctx.strokeStyle = "#7a5a00"; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    function drawThreat(ctx: CanvasRenderingContext2D, A: Api, e: Threat) {
      const [x, y] = posAt(e.d), r = e.g.r, wob = Math.sin(A.time * 6 + e.wob) * 1.5;
      if (e.k === "rock" || e.k === "super") {
        if (e.k === "super") { ctx.save(); ctx.shadowColor = "#ff2a4a"; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(x, y + wob, r * 1.3, 0, 7); ctx.fillStyle = "rgba(255,42,74,.35)"; ctx.fill(); ctx.restore(); }
        A.drawSprite("space-rock", x, y + wob, r * 3, Math.sin(A.time * 2 + e.wob) * 0.4);
        if (e.k === "super") { ctx.fillStyle = "#ffd23f"; ctx.font = A.font(10, 900); ctx.textAlign = "center"; ctx.fillText("RUBBLE", x, y + r + 12); }
      } else if (e.k === "solar" || e.k === "boss") {
        A.drawSprite("solar-wind", x, y + wob, r * 3, A.time * (e.k === "boss" ? 0.6 : 1.5));
        if (e.k === "boss") { ctx.font = A.font(13, 900); ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "#1A1030"; ctx.strokeText("SOLAR STORM", x, y + r + 22); ctx.fillStyle = "#fff"; ctx.fillText("SOLAR STORM", x, y + r + 22); }
      } else {
        ctx.save(); ctx.translate(x, y + wob);
        ([[-6, 2], [5, -4], [3, 6], [-2, -7]] as const).forEach(([a, b], i) => {
          const rr = r * (i ? 0.55 : 0.7), g = ctx.createRadialGradient(a - rr * 0.3, b - rr * 0.3, 1, a, b, rr);
          g.addColorStop(0, "#f2fbff"); g.addColorStop(1, "#5aa8d0");
          ctx.beginPath(); ctx.arc(a, b, rr, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "#1e3f5a"; ctx.lineWidth = 1.5; ctx.stroke();
        });
        ctx.restore();
      }
      if (e.tagT > 0) { ctx.fillStyle = "#ffd23f"; ctx.font = A.font(11, 900); ctx.textAlign = "center"; ctx.fillText("Y", x + r + 4, y - r); }
      if (e.hp < e.max) {
        const w = Math.max(20, r * 2.4);
        ctx.fillStyle = "#1A1030"; ctx.fillRect(x - w / 2, y - r - 12, w, 5);
        ctx.fillStyle = e.hp / e.max > 0.5 ? "#3ff0b5" : e.hp / e.max > 0.25 ? "#ffd23f" : "#FF3B5C";
        ctx.fillRect(x - w / 2 + 1, y - r - 11, (w - 2) * Math.max(0, e.hp / e.max), 3);
      }
    }

    return {
      reset(A) {
        SLOTS.forEach((s) => (s.tower = null));
        S = { wave: 0, phase: "build", hp: START_HP, coins: START_COINS, threats: [], queue: [], spawnT: 0, sel: null, buildAt: null, shots: [], pulses: [], overuse: 0, rubble: 0, seen: {}, speed: 1, lastPtr: 0, msg: "Tap a glowing spot to place a shield layer, then start wave 1.", msgT: 99 };
        A.setScore(0);
        showQuiz?.(null);
      },
      update(dt, A) {
        if (S.msgT > 0 && S.msgT < 90) S.msgT -= dt;
        if (A.state !== "play") return;
        const step = dt * S.speed;
        S.shots = S.shots.filter((s) => (s.t -= dt) > 0);
        S.pulses = S.pulses.filter((p) => (p.t -= dt) > 0);
        if (S.phase !== "wave") return;
        S.spawnT -= step;
        if (S.queue.length && S.spawnT <= 0) { const k = S.queue.shift()!; spawn(k); S.spawnT = k === "solar" ? 0.55 : k === "boss" ? 2 : 0.8; }
        for (const e of S.threats) {
          if (e.dead) continue;
          e.slowT -= step; e.tagT -= step;
          e.d += e.g.speed * (e.slowT > 0 ? 1 - e.slowF : 1) * step;
          if (e.d >= PATH_LEN) {
            e.dead = true; S.hp = Math.max(0, S.hp - e.g.hurt);
            A.shake(6, 0.25); A.sfx("hit"); A.float("-" + e.g.hurt + " 🌍", EARTH.x, EARTH.y - 30, "#FF3B5C");
            if (S.hp <= 0) { S.phase = "done"; A.gameOver(); return; }
          }
        }
        for (const sl of SLOTS) {
          const t = sl.tower; if (!t) continue;
          const T = TOWERS[t.type]; t.cd -= step; t.spin += step;
          if (t.cd > 0) continue;
          let cands = S.threats.filter((e) => !e.dead && inRange(t, e));
          if (T.rockOnly) cands = cands.filter((e) => e.g.kind === "rock");
          if (!cands.length) continue;
          cands.sort((a, b) => b.d - a.d);
          t.cd = T.rate[t.lvl];
          if (T.area) { S.pulses.push({ x: t.x, y: t.y, r: T.range[t.lvl], t: 0.35, c: T.color }); cands.forEach((e) => damage(A, e, T.dmg[t.lvl])); continue; }
          const n = T.targets ? T.targets[t.lvl] : 1;
          cands.slice(0, n).forEach((e) => {
            let amt = T.dmg[t.lvl];
            if (T.vsSolar && e.g.kind === "solar") amt *= T.vsSolar;
            if (T.rockOnly) { S.overuse++; if (e.g.resist) amt = 0; }
            if (T.slow) { e.slowT = 1.8; e.slowF = T.slow[t.lvl]; e.tagT = 2.2; }
            const [x, y] = posAt(e.d);
            S.shots.push({ x1: t.x, y1: t.y, x2: x, y2: y, t: 0.12, c: T.color });
            if (amt === 0) A.float("resists!", x, y - 14, "#FF3B5C");
            damage(A, e, amt);
          });
        }
        S.threats = S.threats.filter((e) => !e.dead);
        if (!S.queue.length && !S.threats.length && S.phase === "wave") waveCleared(A);
      },
      input(type, A) {
        if (type !== "tap" || Date.now() - S.lastPtr < 120) return;
        if (S.phase === "build" && !S.buildAt && !S.sel) startWave(A);
      },
      pointer(type, x, y, A) {
        if (type !== "down" || S.phase === "quiz" || S.phase === "done") return;
        S.lastPtr = Date.now();
        if (y >= PANEL_Y) {
          if (S.buildAt) {
            const i = Math.floor((x - 6) / 82);
            if (i >= 0 && i < ORDER.length) {
              const k = ORDER[i], T = TOWERS[k];
              if (S.coins < T.cost) { say("Not enough coins for a " + T.name + " yet.", 3); return; }
              S.coins -= T.cost; S.buildAt.tower = { type: k, lvl: 0, cd: 0, spin: 0, x: S.buildAt.x, y: S.buildAt.y };
              A.particles.burst(S.buildAt.x, S.buildAt.y, T.color, 14, 120, 3);
              S.sel = null; S.buildAt = null; A.sfx("coin"); say(T.name + ": " + T.fact, 6);
            }
            return;
          }
          if (S.sel && x >= 256) {
            const t = S.sel.tower!, T = TOWERS[t.type];
            if (y < PANEL_Y + 56) {
              const c = t.lvl < 2 ? T.up[t.lvl] : null;
              if (c && S.coins >= c) { S.coins -= c; t.lvl++; A.sfx("medal"); A.particles.burst(S.sel.x, S.sel.y, "#FFD700", 14, 120, 3); }
            } else { S.coins += sellValue(t); S.sel.tower = null; S.sel = null; A.sfx("swipe"); }
            return;
          }
          if (!S.sel && x >= 256) { if (S.phase === "build") startWave(A); else S.speed = S.speed > 1 ? 1 : 2; }
          return;
        }
        const hit = SLOTS.find((s) => Math.hypot(s.x - x, s.y - y) <= 26);
        if (!hit) { S.sel = null; S.buildAt = null; return; }
        if (hit.tower) { S.sel = S.sel === hit ? null : hit; S.buildAt = null; }
        else { S.buildAt = S.buildAt === hit ? null : hit; S.sel = null; }
      },
      draw(ctx, A) {
        const bg = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 520);
        bg.addColorStop(0, "#1a2350"); bg.addColorStop(1, "#05061a");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) {
          const cx = (i * 97) % W, cy = (i * 151) % 600, r = 14 + (i % 4) * 6;
          const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r); g.addColorStop(0, "rgba(160,190,255,.12)"); g.addColorStop(1, "rgba(160,190,255,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
        }
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); PATH.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = "#0a0a20"; ctx.lineWidth = 48; ctx.stroke();
        ctx.strokeStyle = "#2a2f6a"; ctx.lineWidth = 40; ctx.stroke();
        ctx.strokeStyle = "#3d4a9a"; ctx.lineWidth = 28; ctx.stroke();
        ctx.strokeStyle = "rgba(255,200,140,.3)"; ctx.lineWidth = 10; ctx.setLineDash([10, 18]); ctx.lineDashOffset = -A.time * 30; ctx.stroke(); ctx.setLineDash([]);
        // Earth
        const hs = 1 + Math.sin(A.time * 5) * 0.05 * (S.hp > 5 ? 1 : 2);
        ctx.save(); ctx.shadowColor = "#38bdf8"; ctx.shadowBlur = 20 * hs; A.drawSprite("earth", EARTH.x, EARTH.y - 4, 52 * hs); ctx.restore();
        for (const sl of SLOTS) {
          if (sl.tower) {
            if (S.sel === sl) { ctx.beginPath(); ctx.arc(sl.x, sl.y, TOWERS[sl.tower.type].range[sl.tower.lvl], 0, 7); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 2; ctx.stroke(); }
            drawTowerIcon(ctx, A, sl.tower.type, sl.x, sl.y, 18, sl.tower.lvl);
          } else {
            const glow = S.phase === "build" || S.buildAt === sl ? 0.35 + Math.sin(A.time * 4) * 0.15 : 0.18;
            ctx.beginPath(); ctx.arc(sl.x, sl.y, 18, 0, 7); ctx.fillStyle = `rgba(255,215,0,${glow})`; ctx.fill();
            ctx.strokeStyle = S.buildAt === sl ? "#FFD700" : "rgba(255,215,0,.55)"; ctx.lineWidth = S.buildAt === sl ? 4 : 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = "rgba(255,215,0,.95)"; ctx.font = A.font(18, 900); ctx.textAlign = "center"; ctx.fillText("+", sl.x, sl.y + 6);
          }
        }
        S.threats.forEach((e) => drawThreat(ctx, A, e));
        S.shots.forEach((s) => { ctx.strokeStyle = s.c; ctx.lineWidth = 3; ctx.globalAlpha = s.t / 0.12; ctx.shadowColor = s.c; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; });
        S.pulses.forEach((p) => { ctx.strokeStyle = p.c; ctx.lineWidth = 4; ctx.globalAlpha = p.t / 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - (p.t / 0.35) * 0.5), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; });
        ctx.font = A.font(15, 900); ctx.lineWidth = 4; ctx.strokeStyle = "#1A1030"; ctx.textAlign = "right";
        const hud = (t: string, y: number, c: string) => { ctx.strokeText(t, 408, y); ctx.fillStyle = c; ctx.fillText(t, 408, y); };
        hud(String(S.coins), 68, "#FFD700"); coin(ctx, 408 - ctx.measureText(String(S.coins)).width - 12, 63, 7);
        hud("🌍 " + S.hp + " / " + START_HP, 90, S.hp > 5 ? "#ff8fa3" : "#FF3B5C");
        hud("Wave " + Math.max(S.wave, 1) + " of " + WAVES, 112, "#f4efff");
        const pg = ctx.createLinearGradient(0, PANEL_Y, 0, H); pg.addColorStop(0, "#141a3a"); pg.addColorStop(1, "#080a1e");
        ctx.fillStyle = pg; ctx.fillRect(0, PANEL_Y, W, H - PANEL_Y);
        ctx.fillStyle = "rgba(255,215,0,.5)"; ctx.fillRect(0, PANEL_Y, W, 2);
        ctx.textAlign = "left";
        if (S.buildAt) {
          ORDER.forEach((k, i) => {
            const T = TOWERS[k], x = 6 + i * 82, y = PANEL_Y + 8, can = S.coins >= T.cost;
            A.rr(x, y, 78, 88, 12); ctx.fillStyle = can ? "#2a1d55" : "#1d1530"; ctx.fill();
            ctx.strokeStyle = can ? T.color + "aa" : "rgba(255,255,255,.08)"; ctx.lineWidth = 1.5; ctx.stroke();
            drawTowerIcon(ctx, A, k, x + 39, y + 28, 16, 0);
            ctx.textAlign = "center"; ctx.fillStyle = can ? "#f4efff" : "#8d86a3"; ctx.font = A.font(11, 900);
            ctx.fillText(T.name.replace(" Impactor", ""), x + 39, y + 62);
            ctx.font = A.font(13, 900); const tw = ctx.measureText(String(T.cost)).width;
            coin(ctx, x + 39 - tw / 2 - 4, y + 76, 5, !can);
            ctx.fillStyle = can ? "#FFD700" : "#8d86a3"; ctx.fillText(String(T.cost), x + 39 + 5, y + 80);
          });
        } else if (S.sel) {
          const t = S.sel.tower!, T = TOWERS[t.type];
          ctx.textAlign = "left"; ctx.fillStyle = "#FFD700"; ctx.font = A.font(15, 900); ctx.fillText(T.name + " · level " + (t.lvl + 1), 12, PANEL_Y + 24);
          ctx.fillStyle = "#e9e3ff"; ctx.font = A.font(12.5, 700); wrap(ctx, T.fact, 12, PANEL_Y + 44, 236, 16, 3);
          const upCost = t.lvl < 2 ? T.up[t.lvl] : null;
          btn(ctx, A, 256, PANEL_Y + 10, 156, 44, "#3ff0b5", upCost ? "Upgrade" : "Max level", upCost ? upCost + " coins" : "", !upCost || S.coins < upCost);
          btn(ctx, A, 256, PANEL_Y + 60, 156, 36, "#ffb3c1", `Remove (+${sellValue(t)})`, "");
        } else {
          if (S.phase === "build") btn(ctx, A, 256, PANEL_Y + 14, 156, 74, "#3ff0b5", "▶ Start wave " + (S.wave + 1), S.rubble ? "⚠ rubble piles coming" : `wave bonus +${WAVE_BONUS}`);
          else btn(ctx, A, 256, PANEL_Y + 14, 156, 74, S.speed > 1 ? "#ffd23f" : "#c9c2e6", S.speed > 1 ? "⏩ Fast (2×)" : "▶ Normal speed", "tap to change");
          ctx.textAlign = "left"; ctx.fillStyle = "#e9e3ff"; ctx.font = A.font(13, 700);
          wrap(ctx, S.msgT > 0 ? S.msg : "Tap a + spot to add a shield layer. Tap a layer to read about it or upgrade it.", 12, PANEL_Y + 24, 234, 17, 5);
        }
      },
    };
  },
};

function QuizCard({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const q = quiz.qs[n], last = n >= quiz.qs.length - 1, ok = picked !== null && q.opts[picked] === q.term;
  return (
    <div data-ui className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-[#05061a]/80 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-sm rounded-3xl p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-sky-300">🧠 Wave {quiz.wave} cleared · Question {n + 1} of {quiz.qs.length}</div>
        <div className="mt-1 text-xs text-muted">Right answer = +{Q_COINS} coins for more shield layers · Ch {q.ch} {q.title}</div>
        <p className="mt-3 text-base font-semibold text-fg">{q.prompt}</p>
        <div className="mt-3 grid gap-2">
          {q.opts.map((o, i) => {
            const isRight = picked !== null && o === q.term, wrong = picked === i && !ok;
            return (
              <button key={i} disabled={picked !== null}
                onClick={() => { setPicked(i); if (o === q.term) { setRight(right + 1); quiz.onRight(); } else setWait(2); }}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${isRight ? "border-emerald-400 bg-emerald-500/20 text-emerald-100" : wrong ? "border-rose-400 bg-rose-500/20 text-rose-100" : "border-line bg-white/5 text-fg hover:bg-white/10"}`}>
                {o}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <>
            <p className="mt-3 text-sm text-fg">{ok ? <>✅ <b>Nice!</b> +{Q_COINS} coins</> : <>❌ The answer is <b>{q.term}</b> (in green).</>}</p>
            <button disabled={wait > 0}
              onClick={() => { if (last) { quiz.done(right); onClose(); } else { setN(n + 1); setPicked(null); } }}
              className="mt-4 w-full rounded-xl bg-sky-400 px-4 py-2 font-bold text-[#05061a] disabled:opacity-50">
              {wait > 0 ? `Read it… ${wait}` : last ? "Back to the battle →" : "Next question →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function PlanetDefense() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  useEffect(() => {
    showQuiz = setQuiz;
    return () => { showQuiz = null; };
  }, []);
  return (
    <div className="relative">
      <ArcadeGame game={planetGame} />
      {quiz && <QuizCard key={quiz.wave} quiz={quiz} onClose={() => setQuiz(null)} />}
    </div>
  );
}
