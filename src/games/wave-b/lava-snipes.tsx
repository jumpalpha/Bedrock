"use client";

import { useEffect, useState } from "react";
import { ArcadeGame } from "../engine/arcade-game";
import type { Api, GameModule } from "../engine/types";
import { HERO_COLORS } from "../engine/assets";

// Twin of the Dopps Class maze shooter. The original classic page is a 2–8 player network game (Supabase Realtime);
// Bedrock only has this single-device version, which runs the same simulation and fills the other seats with
// computer players. Lava vents spawn lava blobs; players spray water to cool them into rock.
type Mode = "coop" | "teams";
let chosenMode: Mode = "coop";
let chosenBots = 3;
const OPTS_KEY = "bedrock_lava_snipes_opts";

const W = 480, H = 640, HUD_H = 38;
// ---------- the maze (same generator as the original) ----------
const T = 24, CW = 11, CH = 11, MW = CW * 3 + 1, MH = CH * 3 + 1; // each cell = 2x2 open tiles + 1 wall -> 34 x 34 tiles
const PR = 6, PSPEED = 130, BOT_SPEED = 104, BSPEED = 330, GSPEED = 62, SPATTER_SPEED = 170, ROUND_SECS = 240;
type Grid = number[][];

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildMaze(seed: number): Grid {
  const R = rng(seed), g: Grid = Array.from({ length: MH }, () => Array(MW).fill(1)), seen = new Set<string>();
  const openCell = (cx: number, cy: number) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) g[cy * 3 + 1 + y][cx * 3 + 1 + x] = 0; };
  const openWall = (cx: number, cy: number, dx: number, dy: number) => {
    for (let k = 0; k < 2; k++) { if (dx) g[cy * 3 + 1 + k][cx * 3 + (dx > 0 ? 3 : 0)] = 0; else g[cy * 3 + (dy > 0 ? 3 : 0)][cx * 3 + 1 + k] = 0; }
  };
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) openCell(cx, cy);
  const stack: [number, number][] = [[0, 0]]; seen.add("0,0");
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < CW && y < CH && !seen.has(x + "," + y));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(R() * nb.length)];
    openWall(cx, cy, dx, dy); seen.add(nx + "," + ny); stack.push([nx, ny]);
  }
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
    if (cx < CW - 1 && R() < 0.5) openWall(cx, cy, 1, 0);
    if (cy < CH - 1 && R() < 0.5) openWall(cx, cy, 0, 1);
  }
  for (let k = 0; k < 4; k++) {
    const w = 2 + Math.floor(R() * 2), h = 2, rx = Math.floor(R() * (CW - w)), ry = Math.floor(R() * (CH - h));
    for (let y = ry * 3 + 1; y < (ry + h) * 3; y++) for (let x = rx * 3 + 1; x < (rx + w) * 3; x++) g[y][x] = 0;
  }
  for (let y = 3; y < MH - 1; y += 3) for (let x = 3; x < MW - 1; x += 3) if (!g[y - 1][x] && !g[y + 1][x] && !g[y][x - 1] && !g[y][x + 1] && R() < 0.6) g[y][x] = 0;
  return g;
}
const cellCenter = (cx: number, cy: number) => ({ x: (cx * 3 + 2) * T, y: (cy * 3 + 2) * T });
const solidAt = (m: Grid, px: number, py: number) => { const tx = Math.floor(px / T), ty = Math.floor(py / T); return ty < 0 || tx < 0 || ty >= MH || tx >= MW || m[ty][tx] === 1; };
const hitsWall = (m: Grid, x: number, y: number, r: number) => solidAt(m, x - r, y - r) || solidAt(m, x + r, y - r) || solidAt(m, x - r, y + r) || solidAt(m, x + r, y + r);
function moveCircle(m: Grid, o: { x: number; y: number }, dx: number, dy: number, r: number) {
  if (dx && !hitsWall(m, o.x + dx, o.y, r)) o.x += dx;
  if (dy && !hitsWall(m, o.x, o.y + dy, r)) o.y += dy;
}
function spawnFor(team: number, i: number) {
  if (team === 1) return cellCenter(0, i % 3);
  if (team === 2) return cellCenter(CW - 1, CH - 1 - (i % 3));
  return cellCenter(Math.floor(CW / 2) - 1 + (i % 3), Math.floor(CH / 2));
}
const teamCol = (t: number) => (t === 1 ? "#FF4D6D" : t === 2 ? "#3BA8FF" : "#00E5A0");
const BOT_NAMES = ["Ava", "Leo", "Mia", "Kai", "Zoe", "Max", "Ivy"];
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

type Pl = {
  id: number; name: string; team: number; bot: boolean; color: string;
  x: number; y: number; sx: number; sy: number; dir: [number, number];
  alive: boolean; lives: number; score: number; dead: number; inv: number; out: boolean; lastShot: number; moving: boolean;
  path: number[]; goalK: number; plan: number; seen: number; fireCd: number; dodge: number; dvx: number; dvy: number; stuckT: number; skill: number;
};
type Blob = { x: number; y: number; cd: number; rot: number };
type Vent = { x: number; y: number; hp: number; t: number; hit: number };
type Bul = { x: number; y: number; vx: number; vy: number; owner: Pl | null; team: number; kind: "water" | "spatter"; life: number; bounces: number };
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number };
type Final = { title: string; sub: string; color: string; rows: { name: string; team: number; score: number; me: boolean }[] };

const lavaSnipesGame: GameModule = {
  config: {
    key: "bedrock_lava_snipes",
    title: "Lava Snipes",
    subtitle: "Spray water. Dodge spatter. Cap the lava vents.",
    W, H,
    deathDelay: 2600,
    overTitle: "Round over!",
    winText: "Every lava vent is capped!",
    accent: "#FF8C42",
    medals: [
      { at: 1000, name: "Bronze", icon: "🥉" },
      { at: 2500, name: "Silver", icon: "🥈" },
      { at: 4500, name: "Gold", icon: "🥇" },
      { at: 7000, name: "Legend", icon: "💎" },
    ],
    howTo:
      "Inspired by <b>Snipes</b>, the classic '80s network game. <b>Lava vents</b> keep oozing lava blobs into a twisty lava-tube maze. <b>Spray water</b> to cool blobs into rock (+50), hit vents (+20) and cap them (+500). Lava blobs and their <b>spatter</b> knock you out. Water blasts bounce off a wall once.<br><b>Co-op:</b> you and computer teammates cap every vent (3 lives each). <b>Red vs Blue:</b> also tag the other team (+200); most points in 4 minutes wins.",
    controls: "Arrows / WASD move · Space sprays · click or hold on the maze to aim and spray · P pause",
    sprites: ["lava-blob", "lava-bomb", "heart"],
    pad: [
      { label: "◀", type: "left" },
      { label: "▲", type: "up" },
      { label: "▼", type: "down" },
      { label: "▶", type: "right" },
    ],
    facts: [
      "Lava tubes form when the top of a lava flow cools into a crust while hot lava keeps flowing underneath.",
      "Craters of the Moon in Idaho has lava tubes you can walk through, like Indian Tunnel.",
      "Basaltic lava erupts at about 1,100 to 1,200 °C and flows easily, like warm syrup.",
      "Pahoehoe lava cools with a smooth, ropy surface; ʻaʻā lava cools rough and jagged.",
      "Spatter cones build up when blobs of lava are tossed from a vent and pile up around it.",
      "Iceland once sprayed seawater on a lava flow in 1973 to slow it down and save a harbor.",
      "A vent is any opening in Earth's surface where lava, gas, or ash comes out.",
      "Lava that cools quickly forms rock with tiny crystals, like basalt.",
    ],
  },
  create() {
    let maze: Grid = [], mazeCv: HTMLCanvasElement | null = null, miniCv: HTMLCanvasElement | null = null;
    let pl: Pl[] = [], me: Pl = null as unknown as Pl, blobs: Blob[] = [], bul: Bul[] = [], vents: Vent[] = [], parts: Part[] = [];
    let mode: Mode = "coop", t = 0, left = ROUND_SECS, teamScore = [0, 0, 0], over = false, final: Final | null = null;
    let flow: number[][] | null = null, flowAt = -1, blobCap = 20;
    const keys = { up: false, down: false, left: false, right: false };
    let fireHeld = false, aimHeld = false, aimPt = { x: 0, y: 0 }, tapShot = false, fireCd = 0, diagT = 0;
    const cam = { x: 0, y: 0 };
    let watch: Pl | null = null;

    // ---------- pre-rendered maze art (2x for sharp walls) ----------
    function renderMaze() {
      if (typeof document === "undefined") return;
      const S = 2;
      mazeCv = mazeCv || document.createElement("canvas");
      mazeCv.width = MW * T * S; mazeCv.height = MH * T * S;
      const c = mazeCv.getContext("2d")!;
      c.setTransform(S, 0, 0, S, 0, 0);
      const fl = c.createRadialGradient(MW * T / 2, MH * T / 2, 60, MW * T / 2, MH * T / 2, MW * T * 0.75);
      fl.addColorStop(0, "#2a140c"); fl.addColorStop(1, "#120806");
      c.fillStyle = fl; c.fillRect(0, 0, MW * T, MH * T);
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!maze[y][x] && (x + y) % 2 === 0) { c.fillStyle = "rgba(255,150,80,.035)"; c.fillRect(x * T, y * T, T, T); }
      c.fillStyle = "rgba(255,170,90,.08)";
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!maze[y][x]) { c.beginPath(); c.arc(x * T + T / 2, y * T + T / 2, 1, 0, 7); c.fill(); }
      // lava glow under the basalt walls
      c.save(); c.shadowColor = "rgba(255,110,30,.75)"; c.shadowBlur = 14; c.fillStyle = "#3a2420";
      c.beginPath(); for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (maze[y][x]) c.rect(x * T, y * T, T, T);
      c.fill(); c.restore();
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        if (!maze[y][x]) continue;
        const g = c.createLinearGradient(0, y * T, 0, y * T + T);
        g.addColorStop(0, "#5a4a48"); g.addColorStop(1, "#2e2422");
        c.fillStyle = g; c.fillRect(x * T, y * T, T, T);
        const open = (dx: number, dy: number) => maze[y + dy] && maze[y + dy][x + dx] === 0;
        c.fillStyle = "rgba(255,190,120,.5)";
        if (open(0, -1)) c.fillRect(x * T, y * T, T, 3);
        c.fillStyle = "rgba(255,150,80,.25)";
        if (open(-1, 0)) c.fillRect(x * T, y * T, 2, T);
        if (open(1, 0)) c.fillRect(x * T + T - 2, y * T, 2, T);
        c.fillStyle = "rgba(4,12,28,.55)";
        if (open(0, 1)) c.fillRect(x * T, y * T + T - 4, T, 4);
      }
      miniCv = miniCv || document.createElement("canvas");
      miniCv.width = MW * 3; miniCv.height = MH * 3;
      const m = miniCv.getContext("2d")!;
      m.clearRect(0, 0, MW * 3, MH * 3);
      m.fillStyle = "rgba(90,160,235,.85)";
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (maze[y][x]) m.fillRect(x * 3, y * 3, 3, 3);
    }

    // ---------- round setup ----------
    function newRound(A: Api) {
      mode = chosenMode;
      const nBots = Math.max(1, Math.min(7, chosenBots)), n = nBots + 1;
      const seed = Math.floor(Math.random() * 1e9);
      maze = buildMaze(seed);
      renderMaze();
      const R = rng(seed + 7);
      const myColor = HERO_COLORS.find((c) => c.swatch === A.heroSwatch())?.id ?? "emerald";
      const others = HERO_COLORS.map((c) => c.id as string).filter((c) => c !== myColor);
      const redN = Math.ceil(n / 2), idx: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
      pl = [];
      for (let i = 0; i < n; i++) {
        const team = mode === "coop" ? 0 : i < redN ? 1 : 2;
        const s = spawnFor(team, idx[team]++);
        pl.push({
          id: i, name: i === 0 ? "You" : BOT_NAMES[i - 1], team, bot: i > 0,
          color: i === 0 ? myColor : team === 1 ? "rose" : team === 2 ? "sky" : others[(i - 1) % others.length],
          x: s.x, y: s.y, sx: s.x, sy: s.y, dir: [team === 2 ? -1 : 1, 0], alive: true, lives: mode === "coop" ? 3 : 99, score: 0, dead: 0, inv: 2, out: false, lastShot: -1, moving: false,
          path: [], goalK: -1, plan: Math.random() * 0.3, seen: 0, fireCd: 0.5, dodge: 0, dvx: 0, dvy: 0, stuckT: 0, skill: 0.8 + Math.random() * 0.4,
        });
      }
      me = pl[0];
      blobs = []; bul = []; parts = []; vents = []; t = 0; left = ROUND_SECS; teamScore = [0, 0, 0]; over = false; final = null; flow = null; flowAt = -1;
      blobCap = 10 + 3 * n; watch = null;
      const nh = Math.min(10, 4 + n), spots: [number, number][] = [];
      for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) spots.push([cx, cy]);
      spots.sort(() => R() - 0.5);
      for (const [cx, cy] of spots) {
        if (vents.length >= nh) break;
        const c = cellCenter(cx, cy);
        if (pl.some((p) => Math.hypot(p.sx - c.x, p.sy - c.y) < 8 * T)) continue;
        if (vents.some((h) => Math.hypot(h.x - c.x, h.y - c.y) < 6 * T)) continue;
        vents.push({ x: c.x, y: c.y, hp: 5, t: 1 + R() * 3, hit: 0 });
      }
      keys.up = keys.down = keys.left = keys.right = false;
      fireHeld = aimHeld = tapShot = false; fireCd = 0; diagT = 0;
      cam.x = me.x - W / 2; cam.y = me.y - H / 2; clampCam();
    }
    const clampCam = () => { cam.x = Math.max(0, Math.min(MW * T - W, cam.x)); cam.y = Math.max(0, Math.min(MH * T - H + HUD_H, cam.y)); };

    // ---------- helpers ----------
    const tileK = (x: number, y: number) => Math.floor(y / T) * MW + Math.floor(x / T);
    function clearLine(x0: number, y0: number, x1: number, y1: number) {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
      for (let i = 1; i < n; i++) if (solidAt(maze, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
      return true;
    }
    function burst(x: number, y: number, c: string, n: number, sp = 160) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = sp * (0.25 + Math.random());
        const life = 0.45 + Math.random() * 0.45;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, c, r: 1.5 + Math.random() * 2.5 });
      }
    }
    const isMeLive = (p: Pl | null, A: Api) => p === me && A.state === "play";
    function award(p: Pl | null, n: number, x: number, y: number, A: Api) {
      if (!p) return;
      p.score += n; teamScore[p.team] += n;
      if (isMeLive(p, A)) { A.addScore(n); A.float("+" + n, x - cam.x, y - cam.y - 12, n >= 500 ? "#FFD166" : n >= 200 ? "#FF8FA3" : "#B8F5FF"); }
    }
    function hurt(p: Pl, A: Api) {
      if (!p.alive || p.inv > 0 || over) return;
      p.alive = false; p.dead = 2; p.lives--;
      if (p.lives <= 0) p.out = true;
      burst(p.x, p.y, "#FF8FA3", 22, 200); burst(p.x, p.y, "#ffb341", 10, 120);
      if (isMeLive(p, A)) { A.sfx("hit"); A.shake(8, 0.3); }
    }
    function shoot(p: Pl, dx: number, dy: number) {
      if (!p.alive || over) return false;
      if (p.lastShot >= 0 && t - p.lastShot < 0.22) return false;
      p.lastShot = t;
      const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
      bul.push({ x: p.x + ux * 8, y: p.y + uy * 8, vx: ux * BSPEED, vy: uy * BSPEED, owner: p, team: p.team, kind: "water", life: 1.4, bounces: 0 });
      return true;
    }
    function buildFlow() { // distance from every tile to the nearest living player (blobs walk downhill)
      const d = Array.from({ length: MH }, () => Array(MW).fill(1e9)), q: [number, number][] = [];
      pl.forEach((p) => { if (p.alive) { const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T); d[ty][tx] = 0; q.push([tx, ty]); } });
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (maze[ny] && maze[ny][nx] === 0 && d[ny][nx] > d[y][x] + 1) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); } }
      }
      flow = d;
    }
    const dist = new Int32Array(MW * MH), par = new Int32Array(MW * MH), bq = new Int32Array(MW * MH);
    function bfs(s: number) { // path distances from one bot to every tile, with parents for backtracking
      dist.fill(-1); dist[s] = 0; par[s] = -1; bq[0] = s;
      let head = 0, tail = 1;
      while (head < tail) {
        const k = bq[head++], x = k % MW, y = (k / MW) | 0;
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || maze[ny][nx]) continue;
          const nk = ny * MW + nx;
          if (dist[nk] >= 0) continue;
          dist[nk] = dist[k] + 1; par[nk] = k; bq[tail++] = nk;
        }
      }
    }

    // ---------- computer players ----------
    function replan(p: Pl) {
      const s = tileK(p.x, p.y);
      bfs(s);
      let best = -1, bc = 1e9;
      const crowd = (k: number) => pl.reduce((n, q) => n + (q !== p && q.alive && q.goalK === k ? 1 : 0), 0) * 7;
      const consider = (x: number, y: number, bias: number) => {
        const k = tileK(x, y), d = dist[k];
        if (d < 0) return;
        const c = d + bias + crowd(k);
        if (c < bc) { bc = c; best = k; }
      };
      blobs.forEach((g) => consider(g.x, g.y, 0));
      vents.forEach((h) => { if (h.hp > 0) consider(h.x, h.y, mode === "teams" ? 14 : 5); });
      if (mode === "teams") pl.forEach((q) => { if (q.alive && q.team !== p.team) consider(q.x, q.y, 5 + (q.inv > 0 ? 25 : 0)); });
      if (best < 0) { wander(p); return; } // nothing to hunt
      setPath(p, s, best);
    }
    function wander(p: Pl) {
      const s = tileK(p.x, p.y);
      bfs(s);
      for (let tries = 0; tries < 20; tries++) {
        const c = cellCenter(Math.floor(Math.random() * CW), Math.floor(Math.random() * CH)), k = tileK(c.x, c.y);
        if (dist[k] > 6 && dist[k] < 40) { setPath(p, s, k); return; }
      }
    }
    function setPath(p: Pl, s: number, best: number) {
      p.goalK = best;
      p.path = [];
      for (let k = best; k >= 0 && k !== s; k = par[k]) p.path.push(k);
      p.path.reverse();
    }
    function botThink(p: Pl, dt: number) {
      p.plan -= dt; p.fireCd -= dt; p.dodge -= dt;
      if (p.plan <= 0) {
        // bots are not all-seeing hunters: now and then they wander off to patrol a random room for a few seconds
        if (Math.random() < 0.3) { wander(p); p.plan = 1.5 + Math.random() * 2.5; }
        else { p.plan = 0.3 + Math.random() * 0.2; replan(p); }
      }
      // something to spray at, in a clear straight line?
      let tx = 0, ty = 0, kind = "", td = 1e9;
      blobs.forEach((g) => { const d = Math.hypot(g.x - p.x, g.y - p.y); if (d < 8 * T && d < td && clearLine(p.x, p.y, g.x, g.y)) { td = d; tx = g.x; ty = g.y; kind = "blob"; } });
      vents.forEach((h) => { if (h.hp <= 0) return; const d = Math.hypot(h.x - p.x, h.y - p.y) + T; if (d < 6 * T && d < td && clearLine(p.x, p.y, h.x, h.y)) { td = d; tx = h.x; ty = h.y; kind = "vent"; } });
      if (mode === "teams") pl.forEach((q) => {
        if (!q.alive || q.team === p.team || q.inv > 0) return;
        const d = Math.hypot(q.x - p.x, q.y - p.y) - T;
        if (d < 8 * T && d < td && clearLine(p.x, p.y, q.x, q.y)) { td = d; tx = q.x; ty = q.y; kind = "foe"; }
      });
      if (kind) {
        p.seen += dt;
        const a = Math.atan2(ty - p.y, tx - p.x);
        p.dir = [Math.cos(a), Math.sin(a)];
        if (p.seen > 0.35 / p.skill && p.fireCd <= 0) {
          const j = (Math.random() - 0.5) * 0.34 / p.skill;
          if (shoot(p, Math.cos(a + j), Math.sin(a + j))) p.fireCd = (0.55 + Math.random() * 0.45) / p.skill;
        }
      } else p.seen = 0;
      // dodge spatter (and enemy water) that are about to hit
      if (p.dodge <= 0) for (const b of bul) {
        if (b.kind === "water" && (mode !== "teams" || b.team === p.team)) continue;
        const rx = p.x - b.x, ry = p.y - b.y;
        if (rx * rx + ry * ry > 100 * 100) continue;
        const vv = b.vx * b.vx + b.vy * b.vy, tt = (rx * b.vx + ry * b.vy) / vv;
        if (tt <= 0 || tt > 0.45) continue;
        const cx = rx - b.vx * tt, cy = ry - b.vy * tt;
        if (Math.hypot(cx, cy) > 14 || Math.random() > 0.3 * p.skill) continue;
        const n = Math.sqrt(vv);
        let ux = -b.vy / n, uy = b.vx / n;
        if (ux * cx + uy * cy < 0) { ux = -ux; uy = -uy; }
        if (hitsWall(maze, p.x + ux * 10, p.y + uy * 10, PR)) { ux = -ux; uy = -uy; }
        p.dodge = 0.25; p.dvx = ux; p.dvy = uy;
        break;
      }
      // move
      let vx = 0, vy = 0;
      if (p.dodge > 0) { vx = p.dvx; vy = p.dvy; }
      else if (kind === "blob" && td < 2.6 * T) { vx = (p.x - tx) / td; vy = (p.y - ty) / td; } // too close: back off while spraying
      else if (kind === "vent" && td < 4.5 * T) { /* hold still and spray the vent */ }
      else if (p.path.length) {
        const k = p.path[0], cx = ((k % MW) + 0.5) * T, cy = (Math.floor(k / MW) + 0.5) * T, dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy);
        if (d < 4) p.path.shift();
        else { vx = dx / d; vy = dy / d; }
      }
      const ox = p.x, oy = p.y, sp = BOT_SPEED * (0.93 + p.skill * 0.07);
      if (vx || vy) {
        moveCircle(maze, p, vx * sp * dt, vy * sp * dt, PR);
        if (!kind) p.dir = [vx, vy];
        const moved = Math.hypot(p.x - ox, p.y - oy);
        if (moved < sp * dt * 0.25) { p.stuckT += dt; if (p.stuckT > 0.5) { p.stuckT = 0; p.plan = 0; const a = Math.random() * 7; p.dodge = 0.3; p.dvx = Math.cos(a); p.dvy = Math.sin(a); } }
        else p.stuckT = 0;
      }
      p.moving = !!(vx || vy);
    }

    // ---------- the simulation (what the host ran in the original) ----------
    function sim(dt: number, A: Api) {
      const live = A.state === "play";
      t += dt;
      if (mode === "teams") left = Math.max(0, ROUND_SECS - t);
      // me
      if (live && me.alive) {
        const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
        me.moving = !!(ix || iy);
        if (ix || iy) {
          const n = Math.hypot(ix, iy);
          moveCircle(maze, me, (ix / n) * PSPEED * dt, (iy / n) * PSPEED * dt, PR);
          if (ix && iy) { me.dir = [ix, iy]; diagT = 0.15; }
          else if ((diagT -= dt) <= 0) me.dir = [ix, iy]; // letting go of one key a split second early keeps the diagonal
        }
        if (aimHeld) { const dx = aimPt.x + cam.x - me.x, dy = aimPt.y + cam.y - me.y, d = Math.hypot(dx, dy); if (d > 4) me.dir = [dx / d, dy / d]; }
        fireCd -= dt;
        if ((fireHeld || aimHeld || tapShot) && fireCd <= 0) { if (shoot(me, me.dir[0], me.dir[1])) { fireCd = 0.25; tapShot = false; } }
      }
      pl.forEach((p) => { if (p.alive && (p.bot || A.state === "menu")) botThink(p, dt); });
      pl.forEach((p) => {
        p.inv = Math.max(0, p.inv - dt);
        if (!p.alive && !p.out) { p.dead -= dt; if (p.dead <= 0) { p.alive = true; p.inv = 2; p.x = p.sx; p.y = p.sy; p.path = []; p.plan = 0; } }
      });
      // vents spawn blobs
      if (t - flowAt > 0.5 || flowAt < 0) { buildFlow(); flowAt = t; }
      vents.forEach((h) => {
        h.hit = Math.max(0, h.hit - dt);
        if (h.hp <= 0) return;
        h.t -= dt;
        if (h.t <= 0) { h.t = 3.5 + Math.random() * 2.5; if (blobs.length < blobCap) { blobs.push({ x: h.x, y: h.y, cd: 2 + Math.random() * 3, rot: Math.random() * 7 }); burst(h.x, h.y, "#ff7a2a", 6, 80); } }
      });
      // blobs chase down the distance field and spit spatter along open lines
      blobs.forEach((g) => {
        g.rot += dt * 1.6;
        const tx = Math.floor(g.x / T), ty = Math.floor(g.y / T);
        let best: [number, number] | null = null, bd = flow && flow[ty] ? flow[ty][tx] : 1e9;
        if (flow) for (const [dx, dy] of N4) { const v = flow[ty + dy] && flow[ty + dy][tx + dx]; if (v != null && v < bd) { bd = v; best = [dx, dy]; } }
        let ax = 0, ay = 0;
        if (best) { ax = (tx + best[0] + 0.5) * T - g.x; ay = (ty + best[1] + 0.5) * T - g.y; }
        else { const tgt = pl.find((p) => p.alive && Math.floor(p.x / T) === tx && Math.floor(p.y / T) === ty); if (tgt) { ax = tgt.x - g.x; ay = tgt.y - g.y; } }
        const n = Math.hypot(ax, ay);
        if (n > 0.5) moveCircle(maze, g, (ax / n) * GSPEED * dt, (ay / n) * GSPEED * dt, 6);
        g.cd -= dt;
        if (g.cd <= 0) {
          g.cd = 2.5 + Math.random() * 3;
          const tgt = pl.find((p) => p.alive && Math.hypot(p.x - g.x, p.y - g.y) < 8 * T && clearLine(g.x, g.y, p.x, p.y));
          if (tgt) {
            const d = Math.hypot(tgt.x - g.x, tgt.y - g.y);
            bul.push({ x: g.x, y: g.y, vx: ((tgt.x - g.x) / d) * SPATTER_SPEED, vy: ((tgt.y - g.y) / d) * SPATTER_SPEED, owner: null, team: -1, kind: "spatter", life: 2, bounces: 1 });
          }
        }
        pl.forEach((p) => { if (p.alive && Math.hypot(p.x - g.x, p.y - g.y) < PR + 6) hurt(p, A); });
      });
      // bubbles and spatter
      for (let i = bul.length - 1; i >= 0; i--) {
        const b = bul[i];
        b.life -= dt;
        const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
        if (solidAt(maze, nx, ny)) {
          if (b.bounces >= 1) { burst(b.x, b.y, b.kind === "water" ? "#dff8ff" : "#ffb341", 4, 60); bul.splice(i, 1); continue; }
          b.bounces++;
          if (solidAt(maze, nx, b.y)) b.vx = -b.vx;
          if (solidAt(maze, b.x, ny)) b.vy = -b.vy;
        } else { b.x = nx; b.y = ny; }
        if (b.life <= 0) { bul.splice(i, 1); continue; }
        let gone = false;
        if (b.kind === "water") {
          for (let j = blobs.length - 1; j >= 0; j--) {
            const g = blobs[j];
            if (Math.hypot(g.x - b.x, g.y - b.y) < 10) {
              blobs.splice(j, 1); award(b.owner, 50, g.x, g.y, A); burst(g.x, g.y, "#6b5a55", 14); burst(g.x, g.y, "#e6fbff", 6, 90);
              if (isMeLive(b.owner, A)) A.sfx("point");
              gone = true; break;
            }
          }
          if (!gone) for (const h of vents) {
            if (h.hp > 0 && Math.hypot(h.x - b.x, h.y - b.y) < 13) {
              h.hp--; h.hit = 0.2; gone = true;
              if (h.hp <= 0) {
                award(b.owner, 500, h.x, h.y, A); burst(h.x, h.y, "#FFD700", 34, 220); burst(h.x, h.y, "#ff7a2a", 20, 160);
                if (isMeLive(b.owner, A)) { A.sfx("clear"); A.shake(6, 0.25); } else if (A.state === "play") A.toast(`${b.owner?.name ?? "Someone"} capped a vent!`, 1300);
              } else { award(b.owner, 20, h.x, h.y, A); burst(b.x, b.y, "#ffc080", 6, 90); if (isMeLive(b.owner, A)) A.sfx("click"); }
              break;
            }
          }
          if (!gone && mode === "teams") for (const p of pl) {
            if (p.alive && p.team !== b.team && p.inv <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < PR + 4) {
              hurt(p, A); award(b.owner, 200, p.x, p.y, A); gone = true;
              if (isMeLive(b.owner, A)) A.sfx("coin");
              break;
            }
          }
        } else {
          for (const p of pl) { if (p.alive && Math.hypot(p.x - b.x, p.y - b.y) < PR + 4) { hurt(p, A); gone = true; break; } }
        }
        if (gone) bul.splice(i, 1);
      }
      // round over?
      const cleared = !vents.some((h) => h.hp > 0) && blobs.length === 0;
      const standing = pl.some((p) => !p.out);
      const done = cleared || (mode === "coop" && !standing) || (mode === "teams" && left <= 0);
      if (done) { if (live) finish(A, cleared); else if (A.state === "menu") newRound(A); }
    }
    function finish(A: Api, cleared: boolean) {
      if (over) return;
      over = true;
      const rows = pl.map((p) => ({ name: p.name, team: p.team, score: p.score, me: p === me })).sort((a, b) => b.score - a.score);
      if (mode === "coop") {
        final = cleared
          ? { title: "Lava cooled!", sub: `Every vent capped in ${Math.round(t)} seconds.`, color: "#00E5A0", rows }
          : { title: "The lava won", sub: me.out && pl.some((p) => !p.out) ? "You ended the round early." : "Everyone ran out of lives. Try again!", color: "#FF8FA3", rows };
        if (cleared) { A.win(`Every vent capped in ${Math.round(t)} seconds!`); A.gameOver(true); } else A.gameOver();
      } else {
        const w = teamScore[1] === teamScore[2] ? 0 : teamScore[1] > teamScore[2] ? 1 : 2;
        final = { title: w === 0 ? "Tie game!" : w === 1 ? "Red team wins!" : "Blue team wins!", sub: `Red ${teamScore[1]} · Blue ${teamScore[2]}`, color: w ? teamCol(w) : "#FFD166", rows };
        if (w === me.team) { A.win(`Red team wins, ${teamScore[1]} to ${teamScore[2]}!`); A.gameOver(true); }
        else { A.toast(w === 0 ? `Tie game, ${teamScore[1]} to ${teamScore[2]}` : `Blue team wins, ${teamScore[2]} to ${teamScore[1]}`, 2400); A.gameOver(w === 0); }
      }
    }

    // ---------- drawing ----------
    function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, a = 1) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
    }
    function drawVent(ctx: CanvasRenderingContext2D, h: Vent, A: Api) {
      if (h.hp <= 0) {
        ctx.fillStyle = "rgba(90,74,72,.5)"; ctx.beginPath(); ctx.arc(h.x, h.y, 13, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(h.x, h.y, 10, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        return;
      }
      const pulse = Math.sin(t * 5 + h.x) * 1.4, r = 14 + pulse;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; drawGlow(ctx, h.x, h.y, 34, "rgba(255,110,30,.55)"); ctx.restore();
      const g = ctx.createRadialGradient(h.x - 4, h.y - 5, 2, h.x, h.y, r);
      g.addColorStop(0, h.hit > 0 ? "#ffffff" : "#ffd27a"); g.addColorStop(0.6, "#e0521a"); g.addColorStop(1, "#5a1a08");
      ctx.fillStyle = g; ctx.strokeStyle = "#3a2420"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + t * 0.4; ctx.lineTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!A.drawSprite("lava-bomb", h.x, h.y, 20, t * 0.8)) { ctx.fillStyle = "#ffb341"; ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, 7); ctx.fill(); }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < h.hp ? "#FFB341" : "rgba(255,255,255,.18)";
        ctx.beginPath(); ctx.arc(h.x - 10 + i * 5, h.y + 21, 2, 0, 7); ctx.fill();
      }
    }
    function drawBlob(ctx: CanvasRenderingContext2D, g: Blob, A: Api) {
      drawGlow(ctx, g.x, g.y, 16, "rgba(255,130,40,.4)");
      if (!A.drawSprite("lava-blob", g.x, g.y, 22, g.rot)) { ctx.fillStyle = "#ff7a2a"; ctx.beginPath(); ctx.arc(g.x, g.y, 7, 0, 7); ctx.fill(); }
    }
    function drawBullet(ctx: CanvasRenderingContext2D, b: Bul) {
      const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
      if (b.kind === "spatter") {
        drawGlow(ctx, b.x, b.y, 11, "rgba(255,150,50,.55)");
        ctx.strokeStyle = "rgba(255,150,50,.4)"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(b.x - ux * 10, b.y - uy * 10); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.fillStyle = "#ffcf6a"; ctx.beginPath(); ctx.arc(b.x, b.y, 3.2, 0, 7); ctx.fill();
        return;
      }
      const tint = b.team === 1 ? "255,170,190" : b.team === 2 ? "170,215,255" : "200,245,255";
      ctx.strokeStyle = `rgba(${tint},.35)`; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(b.x - ux * 12, b.y - uy * 12); ctx.lineTo(b.x, b.y); ctx.stroke();
      const g = ctx.createRadialGradient(b.x - 1.5, b.y - 1.5, 0.5, b.x, b.y, 5);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, `rgba(${tint},.85)`); g.addColorStop(1, `rgba(${tint},.25)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 4.6, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1; ctx.stroke();
    }
    function drawPlayer(ctx: CanvasRenderingContext2D, p: Pl, A: Api) {
      if (!p.alive) return;
      const blink = p.inv > 0 && Math.floor(t * 10) % 2 === 0;
      const ring = mode === "coop" ? HERO_COLORS.find((c) => c.id === p.color)?.swatch ?? teamCol(0) : teamCol(p.team);
      ctx.save();
      if (blink) ctx.globalAlpha = 0.45;
      ctx.globalCompositeOperation = "lighter"; drawGlow(ctx, p.x, p.y + 4, 18, ring, 0.5 * (blink ? 0.45 : 1)); ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = blink ? 0.45 : 1;
      ctx.strokeStyle = ring; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 9, 3.5, 0, 0, 7); ctx.stroke();
      const pose = p.moving ? "run" : "happy", bob = p.moving ? Math.sin(t * 16 + p.id) * 1.2 : 0;
      if (p === me) A.drawHero(p.x, p.y - 1 + bob, 26, 0, pose); else A.drawHeroAs(p.color, p.x, p.y - 1 + bob, 26, 0, pose);
      const n = Math.hypot(p.dir[0], p.dir[1]) || 1, dx = p.dir[0] / n, dy = p.dir[1] / n;
      drawGlow(ctx, p.x + dx * 15, p.y + dy * 15, 6, "rgba(255,255,255,.8)");
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x + dx * 15, p.y + dy * 15, 1.8, 0, 7); ctx.fill();
      const label = p === me ? "You ★" : p.name;
      ctx.font = A.font(10, 800); ctx.textAlign = "center"; ctx.lineJoin = "round";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(label, p.x, p.y - 17);
      ctx.fillStyle = p === me ? "#FFD166" : mode === "coop" ? "#e9f6ff" : teamCol(p.team); ctx.fillText(label, p.x, p.y - 17);
      ctx.restore();
    }
    function drawHud(ctx: CanvasRenderingContext2D, A: Api) {
      // bottom bar (the engine draws its pause / mute buttons and the score along the top)
      ctx.save(); ctx.translate(0, H - HUD_H);
      const bar = ctx.createLinearGradient(0, 0, 0, HUD_H);
      bar.addColorStop(0, "rgba(22,12,8,.8)"); bar.addColorStop(1, "rgba(22,12,8,.96)");
      ctx.fillStyle = bar; ctx.fillRect(0, 0, W, HUD_H);
      ctx.fillStyle = "rgba(56,191,255,.35)"; ctx.fillRect(0, 0, W, 1);
      ctx.textBaseline = "middle"; ctx.textAlign = "left";
      const ventsLeft = vents.filter((h) => h.hp > 0).length;
      if (mode === "teams") {
        const pill = (x: number, team: number, label: string) => {
          A.rr(x, 7, 92, 24, 12); ctx.fillStyle = team === 1 ? "rgba(255,77,109,.22)" : "rgba(59,168,255,.22)"; ctx.fill();
          ctx.strokeStyle = teamCol(team); ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = teamCol(team); ctx.font = A.font(12, 900); ctx.fillText(label, x + 10, 20);
          ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.fillText(String(teamScore[team]), x + 84, 20); ctx.textAlign = "left";
        };
        pill(8, 1, "RED"); pill(106, 2, "BLUE");
        const s = Math.ceil(left);
        ctx.font = A.font(15, 900); ctx.fillStyle = s <= 30 ? "#FF8FA3" : "#fff";
        ctx.fillText(`⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, 210, 20);
      } else {
        for (let i = 0; i < 3; i++) A.drawSprite("heart", 18 + i * 22, 19, 20, 0, i < Math.max(0, me.lives) ? 1 : 0.2);
        ctx.font = A.font(14, 900); ctx.fillStyle = "#fff"; ctx.fillText(`Score ${me.score}`, 84, 20);
        const squad = pl.filter((p) => !p.out).length;
        ctx.font = A.font(12, 800); ctx.fillStyle = "#9fe9c8"; ctx.fillText(`Squad ${squad}/${pl.length}`, 190, 20);
      }
      ctx.textAlign = "right"; ctx.font = A.font(14, 900); ctx.fillStyle = "#ffb070";
      ctx.fillText(`Vents ${ventsLeft}`, W - 12, 20);
      if (mode === "teams") { ctx.font = A.font(11, 800); ctx.fillStyle = "#FFD166"; ctx.fillText(`You ${me.score}`, W - 86, 20); }
      ctx.textBaseline = "alphabetic";
      ctx.restore();
      // mini-map
      const s = 3, mw = MW * s, mx = W - mw - 10, my = H - HUD_H - MH * s - 10;
      A.rr(mx - 4, my - 4, mw + 8, MH * s + 8, 8); ctx.fillStyle = "rgba(5,10,20,.72)"; ctx.fill();
      ctx.strokeStyle = "rgba(56,191,255,.3)"; ctx.lineWidth = 1; ctx.stroke();
      if (miniCv) ctx.drawImage(miniCv, mx, my);
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.strokeRect(mx + (cam.x / T) * s, my + (cam.y / T) * s, (W / T) * s, (H / T) * s);
      ctx.fillStyle = "#ff7a2a"; vents.forEach((h) => { if (h.hp > 0) ctx.fillRect(mx + (h.x / T) * s - 2, my + (h.y / T) * s - 2, 4, 4); });
      ctx.fillStyle = "#ffcf6a"; blobs.forEach((g) => ctx.fillRect(mx + (g.x / T) * s - 1, my + (g.y / T) * s - 1, 2, 2));
      pl.forEach((p) => {
        if (!p.alive) return;
        ctx.fillStyle = p === me ? "#fff" : mode === "coop" ? HERO_COLORS.find((c) => c.id === p.color)?.swatch ?? "#00E5A0" : teamCol(p.team);
        ctx.fillRect(mx + (p.x / T) * s - 2, my + (p.y / T) * s - 2, 4, 4);
      });
    }
    function banner(ctx: CanvasRenderingContext2D, A: Api, text: string, sub: string, color: string, alpha = 1) {
      ctx.globalAlpha = alpha;
      const y = H / 2 - 40;
      const g = ctx.createLinearGradient(0, y, 0, y + 74);
      g.addColorStop(0, "rgba(6,10,24,0)"); g.addColorStop(0.2, "rgba(6,10,24,.82)"); g.addColorStop(0.8, "rgba(6,10,24,.82)"); g.addColorStop(1, "rgba(6,10,24,0)");
      ctx.fillStyle = g; ctx.fillRect(0, y, W, 74);
      ctx.textAlign = "center"; ctx.lineJoin = "round";
      ctx.font = A.font(22, 900); ctx.lineWidth = 5; ctx.strokeStyle = "#05070F"; ctx.strokeText(text, W / 2, y + 34); ctx.fillStyle = color; ctx.fillText(text, W / 2, y + 34);
      if (sub) { ctx.font = A.font(13, 700); ctx.fillStyle = "rgba(233,246,255,.85)"; ctx.fillText(sub, W / 2, y + 56); }
      ctx.globalAlpha = 1;
    }
    function drawFinal(ctx: CanvasRenderingContext2D, A: Api, f: Final) {
      ctx.fillStyle = "rgba(4,8,18,.6)"; ctx.fillRect(0, 0, W, H);
      const rows = f.rows.slice(0, 8), bw = 320, bh = 92 + rows.length * 24, bx = (W - bw) / 2, by = (H - bh) / 2;
      A.rr(bx, by, bw, bh, 18);
      const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, "rgba(23,22,52,.97)"); g.addColorStop(1, "rgba(10,10,28,.97)");
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = "center"; ctx.font = A.font(24, 900); ctx.fillStyle = f.color; ctx.fillText(f.title, W / 2, by + 36);
      ctx.font = A.font(13, 700); ctx.fillStyle = "rgba(233,246,255,.8)"; ctx.fillText(f.sub, W / 2, by + 58);
      rows.forEach((r, i) => {
        const y = by + 88 + i * 24;
        ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(bx + 16, y - 16, bw - 32, 1);
        ctx.textAlign = "left"; ctx.font = A.font(14, r.me ? 900 : 700);
        ctx.fillStyle = r.me ? "#FFD166" : mode === "coop" ? "#e9f6ff" : teamCol(r.team);
        ctx.fillText(`${i + 1}. ${r.name}${r.me ? " ★" : " (bot)"}`, bx + 22, y);
        ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.fillText(String(r.score), bx + bw - 22, y);
      });
    }

    return {
      reset(A) { newRound(A); },
      input(type, A) {
        switch (type) {
          case "up": case "down": case "left": case "right": keys[type] = true; break;
          case "release-up": keys.up = false; break;
          case "release-down": keys.down = false; break;
          case "release-left": keys.left = false; break;
          case "release-right": keys.right = false; break;
          case "tap": fireHeld = true; if (me.out && mode === "coop" && !over && t > 1) finish(A, false); break;
          case "release-tap": fireHeld = false; break;
        }
      },
      pointer(type, x, y) {
        if (type === "down") {
          aimHeld = true; aimPt = { x, y }; tapShot = true;
          const dx = x + cam.x - me.x, dy = y + cam.y - me.y, d = Math.hypot(dx, dy);
          if (d > 4 && me.alive) me.dir = [dx / d, dy / d];
          if (fireCd > 0.12) fireCd = 0.12; // a tap sprays almost right away
        } else if (type === "drag") aimPt = { x, y };
        else if (type === "up") aimHeld = false;
      },
      update(dt, A) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const q = parts[i];
          q.life -= dt;
          if (q.life <= 0) { parts.splice(i, 1); continue; }
          q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92;
        }
        if (!over && (A.state === "play" || A.state === "menu")) sim(dt, A);
        // camera: follow me; if I'm out of lives, watch a teammate
        let fx = me.x, fy = me.y;
        if (me.out) {
          if (!watch || !watch.alive) watch = pl.find((p) => p.alive && p !== me && (mode === "coop" || p.team === me.team)) ?? pl.find((p) => p.alive) ?? null;
          if (watch) { fx = watch.x; fy = watch.y; }
          const k = Math.min(1, dt * 6);
          cam.x += (fx - W / 2 - cam.x) * k; cam.y += (fy - (H - HUD_H) / 2 - cam.y) * k;
        } else { cam.x = fx - W / 2; cam.y = fy - (H - HUD_H) / 2; }
        clampCam();
      },
      draw(ctx, A) {
        ctx.fillStyle = "#120806"; ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.translate(-cam.x, -cam.y);
        if (mazeCv) {
          const sx = Math.max(0, cam.x), sy = Math.max(0, cam.y), sw = Math.min(W, MW * T - sx), sh = Math.min(H, MH * T - sy);
          ctx.drawImage(mazeCv, sx * 2, sy * 2, sw * 2, sh * 2, sx, sy, sw, sh);
        }
        // spawn pads
        if (mode === "teams") [1, 2].forEach((tm) => { for (let i = 0; i < 3; i++) { const s = spawnFor(tm, i); ctx.fillStyle = tm === 1 ? "rgba(255,77,109,.12)" : "rgba(59,168,255,.12)"; ctx.fillRect(s.x - T, s.y - T, 2 * T, 2 * T); } });
        const inView = (x: number, y: number, m = 40) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m;
        vents.forEach((h) => { if (inView(h.x, h.y)) drawVent(ctx, h, A); });
        blobs.forEach((g) => { if (inView(g.x, g.y)) drawBlob(ctx, g, A); });
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        bul.forEach((b) => { if (inView(b.x, b.y)) drawBullet(ctx, b); });
        ctx.restore();
        pl.forEach((p) => { if (p !== me && inView(p.x, p.y)) drawPlayer(ctx, p, A); });
        drawPlayer(ctx, me, A);
        parts.forEach((q) => { ctx.globalAlpha = Math.min(1, (q.life / q.max) * 1.6); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
        ctx.restore();
        // vignette
        const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
        v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.45)");
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
        drawHud(ctx, A);
        if (A.state === "menu") return;
        if (final) { drawFinal(ctx, A, final); return; }
        if (t < 3.2) banner(ctx, A, mode === "coop" ? "Cap every lava vent!" : "Red vs Blue!", mode === "coop" ? "Spray water at the glowing vents · dodge the spatter" : "You're on Red · most points in 4:00 wins", mode === "coop" ? "#00E5A0" : "#FF4D6D", Math.min(1, (3.2 - t) * 2));
        else if (!me.alive && me.out) banner(ctx, A, "Out of lives — cheer your team on!", "Tap or press Space to end the round", "#FF8FA3");
        else if (!me.alive) banner(ctx, A, "Splashed by lava! Back in a moment…", "", "#FF8FA3");
      },
    };
  },
};

export function LavaSnipes() {
  const [mode, setMode] = useState<Mode>("coop");
  const [bots, setBots] = useState(3);
  useEffect(() => {
    try {
      const o = JSON.parse(localStorage.getItem(OPTS_KEY) || "null") as { mode?: Mode; bots?: number } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved options after hydration (static export)
      if (o?.mode === "coop" || o?.mode === "teams") { chosenMode = o.mode; setMode(o.mode); }
      if (o?.bots && o.bots >= 1 && o.bots <= 7) { chosenBots = o.bots; setBots(o.bots); }
    } catch {}
  }, []);
  // module-level options are read by the canvas game when a round starts
  // eslint-disable-next-line react-hooks/globals
  const save = (m: Mode, b: number) => { chosenMode = m; chosenBots = b; try { localStorage.setItem(OPTS_KEY, JSON.stringify({ mode: m, bots: b })); } catch {} };
  const n = bots + 1, red = Math.ceil(n / 2);
  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-md flex-wrap items-center justify-center gap-3">
        <div className="glass flex rounded-xl p-1 text-sm font-semibold">
          {([["coop", "🤝 Co-op vs lava"], ["teams", "🔴 Red vs Blue 🔵"]] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={(e) => { setMode(m); save(m, bots); e.currentTarget.blur(); }}
              className={`rounded-lg px-3 py-1.5 transition ${mode === m ? "bg-gold/25 text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-muted">
          <span className="shrink-0">Bots</span>
          <select
            value={bots}
            onChange={(e) => { const b = +e.target.value; setBots(b); save(mode, b); e.target.blur(); }}
            className="glass rounded-xl px-3 py-2 text-sm font-semibold text-fg outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((b) => <option key={b} value={b}>{b} computer player{b > 1 ? "s" : ""}</option>)}
          </select>
        </label>
      </div>
      <p className="mb-3 text-center text-xs text-muted/80">
        {mode === "coop" ? `You + ${bots} bot${bots > 1 ? "s" : ""} vs the lava vents · 3 lives each` : `Red: you + ${red - 1} bot${red - 1 === 1 ? "" : "s"} · Blue: ${n - red} bot${n - red === 1 ? "" : "s"} · 4-minute round`}
        {" · changes apply to your next game"}
      </p>
      <ArcadeGame game={lavaSnipesGame} />
    </div>
  );
}
