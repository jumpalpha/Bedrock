// ── wave-live ── Partner games: rules and computer players. Boards use the same text encoding as the server
// (supabase/migrations/006_live.sql), so the same board pictures draw local and two-device games.
//   tictactoe 9 chars · connect4 42 chars (7 × 6) · dots 85 chars (30 across, 30 down, 25 boxes)
//   core sample hunt: a 64-char map ('0' rock, '1'-'5' deposit id) and 64-char drill log ('0', 'm', 'h', 's')
export type Seat = 1 | 2;
export type LineGame = "tictactoe" | "connect4";

export const SPEC = {
  tictactoe: { cols: 3, rows: 3, need: 3 },
  connect4: { cols: 7, rows: 6, need: 4 },
} as const;

function lines(kind: LineGame) {
  const { cols, rows, need } = SPEC[kind];
  const out: number[][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const l: number[] = [];
        for (let k = 0; k < need; k++) {
          const cc = c + dc * k, rr = r + dr * k;
          if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) break;
          l.push(rr * cols + cc);
        }
        if (l.length === need) out.push(l);
      }
  return out;
}
export const LINES = { tictactoe: lines("tictactoe"), connect4: lines("connect4") };

/** The winning line, if any. */
export function winLine(kind: LineGame, b: string): { p: Seat; cells: number[] } | null {
  for (const l of LINES[kind]) {
    const v = b[l[0]];
    if (v !== "0" && l.every((i) => b[i] === v)) return { p: +v as Seat, cells: l };
  }
  return null;
}
export const full = (b: string) => !b.includes("0");
export function dropRow(b: string, col: number) {
  for (let r = 5; r >= 0; r--) if (b[r * 7 + col] === "0") return r * 7 + col;
  return -1;
}
const put = (b: string, i: number, ch: string) => b.slice(0, i) + ch + b.slice(i + 1);

// ---------- computer players: Tic-Tac-Toe + Connect 4 ----------
function tttBest(b: string, me: Seat): number {
  const opp: Seat = me === 1 ? 2 : 1;
  const score = (bd: string, turn: Seat, depth: number): number => {
    const w = winLine("tictactoe", bd);
    if (w) return w.p === me ? 10 - depth : depth - 10;
    if (full(bd)) return 0;
    let best = turn === me ? -99 : 99;
    for (let i = 0; i < 9; i++) {
      if (bd[i] !== "0") continue;
      const s = score(put(bd, i, String(turn)), turn === me ? opp : me, depth + 1);
      best = turn === me ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  };
  let bestI = -1, bestS = -Infinity;
  for (const i of [4, 0, 2, 6, 8, 1, 3, 5, 7]) {
    if (b[i] !== "0") continue;
    const s = score(put(b, i, String(me)), opp, 1);
    if (s > bestS) { bestS = s; bestI = i; }
  }
  return bestI;
}
function c4Eval(b: string, me: Seat) {
  const m0 = String(me), o0 = me === 1 ? "2" : "1";
  let s = 0;
  for (let r = 0; r < 6; r++) if (b[r * 7 + 3] === m0) s += 3;
  for (const l of LINES.connect4) {
    let m = 0, o = 0;
    for (const i of l) { if (b[i] === m0) m++; else if (b[i] === o0) o++; }
    if (m && o) continue;
    if (m === 3) s += 5; else if (m === 2) s += 2;
    if (o === 3) s -= 4; else if (o === 2) s -= 1;
  }
  return s;
}
function c4Best(b: string, me: Seat, depth: number): number {
  const opp: Seat = me === 1 ? 2 : 1, order = [3, 2, 4, 1, 5, 0, 6];
  const nega = (bd: string, d: number, a: number, beta: number, turn: Seat): number => {
    const w = winLine("connect4", bd);
    if (w) return w.p === turn ? 100000 + d : -100000 - d;
    if (full(bd)) return 0;
    if (d === 0) return turn === me ? c4Eval(bd, me) : -c4Eval(bd, me);
    let best = -Infinity;
    for (const c of order) {
      const i = dropRow(bd, c);
      if (i < 0) continue;
      const v = -nega(put(bd, i, String(turn)), d - 1, -beta, -a, turn === me ? opp : me);
      if (v > best) best = v;
      if (best > a) a = best;
      if (a >= beta) break;
    }
    return best;
  };
  let bestC = -1, bestV = -Infinity;
  for (const c of order) {
    const i = dropRow(b, c);
    if (i < 0) continue;
    const v = -nega(put(b, i, String(me)), depth - 1, -Infinity, Infinity, opp);
    if (v > bestV) { bestV = v; bestC = c; }
  }
  return bestC;
}
/** A move for the computer (a square for Tic-Tac-Toe, a column for Connect 4). */
export function lineCpuMove(kind: LineGame, b: string, me: Seat, hard: boolean): number {
  const legal = kind === "tictactoe" ? [...b].map((v, i) => (v === "0" ? i : -1)).filter((i) => i >= 0) : [0, 1, 2, 3, 4, 5, 6].filter((c) => dropRow(b, c) >= 0);
  if (!hard) {
    for (const m of legal) if (winLine(kind, put(b, kind === "tictactoe" ? m : dropRow(b, m), String(me)))) return m;
    if (Math.random() < 0.5) return kind === "tictactoe" ? tttBest(b, me) : c4Best(b, me, 2);
    return legal[Math.floor(Math.random() * legal.length)];
  }
  return kind === "tictactoe" ? tttBest(b, me) : c4Best(b, me, 6);
}
/** Plays a line-game move. Returns null if it isn't legal. */
export function lineMove(kind: LineGame, b: string, me: Seat, m: number): { board: string; idx: number } | null {
  const idx = kind === "tictactoe" ? m : dropRow(b, m);
  if (idx < 0 || b[idx] !== "0") return null;
  return { board: put(b, idx, String(me)), idx };
}

// ---------- Dots & Boxes (6 × 6 dots, 25 boxes) ----------
export const DN = 5;
export const H = (r: number, c: number) => r * DN + c;
export const V = (r: number, c: number) => 30 + r * (DN + 1) + c;
export const BOX_SIDES = Array.from({ length: DN * DN }, (_, k) => { const r = Math.floor(k / DN), c = k % DN; return [H(r, c), H(r + 1, c), V(r, c), V(r, c + 1)]; });
export const BOXES_OF: number[][] = Array.from({ length: 60 }, () => []);
BOX_SIDES.forEach((s, k) => s.forEach((l) => BOXES_OF[l].push(k)));
const sidesDone = (b: string, k: number) => BOX_SIDES[k].filter((l) => b[l] !== "0").length;

/** Draw line i. Closing a box claims it and keeps the turn. */
export function dotsMove(b: string, me: Seat, i: number): { board: string; got: number } | null {
  if (i < 0 || i > 59 || b[i] !== "0") return null;
  let nb = put(b, i, String(me)), got = 0;
  for (const k of BOXES_OF[i]) if (nb[60 + k] === "0" && sidesDone(nb, k) === 4) { nb = put(nb, 60 + k, String(me)); got++; }
  return { board: nb, got };
}
export const dotsScore = (b: string) => ({ 1: [...b.slice(60)].filter((x) => x === "1").length, 2: [...b.slice(60)].filter((x) => x === "2").length });
function completing(b: string) { return [...b.slice(0, 60)].map((v, i) => (v === "0" && BOXES_OF[i].some((k) => sidesDone(b, k) === 3) ? i : -1)).filter((i) => i >= 0); }
function safe(b: string) { return [...b.slice(0, 60)].map((v, i) => (v === "0" && BOXES_OF[i].every((k) => sidesDone(b, k) < 2) ? i : -1)).filter((i) => i >= 0); }
function giveaway(b: string, i: number) {
  let bb = put(b, i, "2"), n = 0;
  for (;;) {
    const c = completing(bb);
    if (!c.length) return n;
    bb = put(bb, c[0], "1");
    n += BOXES_OF[c[0]].filter((k) => sidesDone(bb, k) === 4).length;
  }
}
export function dotsCpuMove(b: string, hard: boolean): number {
  const open = [...b.slice(0, 60)].map((v, i) => (v === "0" ? i : -1)).filter((i) => i >= 0);
  const rnd = (a: number[]) => a[Math.floor(Math.random() * a.length)];
  const take = completing(b);
  if (!hard) {
    if (take.length && Math.random() < 0.75) return rnd(take);
    const s = safe(b);
    return s.length && Math.random() < 0.6 ? rnd(s) : rnd(open);
  }
  if (take.length) return take[0];
  const s = safe(b);
  if (s.length) return rnd(s);
  let best = open[0], bestN = Infinity;
  for (const i of open) { const g = giveaway(b, i); if (g < bestN) { bestN = g; best = i; } }
  return best;
}

// ---------- Core Sample Hunt (Battleship) ----------
export const SN = 8;
export const DEPOSITS = [
  { len: 4, name: "Gold vein", icon: "🟨" },
  { len: 3, name: "Silver lode", icon: "⬜" },
  { len: 3, name: "Copper seam", icon: "🟧" },
  { len: 2, name: "Star garnet pocket", icon: "🔴" },
  { len: 2, name: "Opal pocket", icon: "🔵" },
];
/** A random map: 5 deposits (4, 3, 3, 2, 2) that never touch, not even diagonally. Same rule as the server. */
export function randomMap(): string {
  for (;;) {
    const g = Array(64).fill("0");
    let ok = true;
    DEPOSITS.forEach((d, s) => {
      if (!ok) return;
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const horiz = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (horiz ? SN : SN - d.len + 1)), c = Math.floor(Math.random() * (horiz ? SN - d.len + 1 : SN));
        const cells = Array.from({ length: d.len }, (_, k) => (horiz ? r * SN + c + k : (r + k) * SN + c));
        const bad = cells.some((i) => {
          const ir = Math.floor(i / SN), ic = i % SN;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const rr = ir + dr, cc = ic + dc;
            if (rr >= 0 && rr < SN && cc >= 0 && cc < SN && g[rr * SN + cc] !== "0") return true;
          }
          return false;
        });
        if (bad) continue;
        cells.forEach((i) => (g[i] = String(s + 1)));
        placed = true;
      }
      if (!placed) ok = false;
    });
    if (ok) return g.join("");
  }
}
/** Drill square i into map. Returns the new drill log ('m', 'h', or every square of a found deposit 's'). */
export function drill(log: string, map: string, i: number): string {
  if (log[i] !== "0") return log;
  const id = map[i];
  if (id === "0") return put(log, i, "m");
  let nl = put(log, i, "h");
  const cells = [...map].map((v, j) => (v === id ? j : -1)).filter((j) => j >= 0);
  if (cells.every((j) => nl[j] !== "0")) for (const j of cells) nl = put(nl, j, "s");
  return nl;
}
export const hitsIn = (log: string) => [...log].filter((x) => x === "h" || x === "s").length;
/** Deposits fully found in a drill log (they never touch, so each group of 's' squares is one). */
export function foundCount(log: string): number {
  const seen = new Set<number>();
  let n = 0;
  for (let i = 0; i < 64; i++) {
    if (log[i] !== "s" || seen.has(i)) continue;
    n++;
    const st = [i]; seen.add(i);
    while (st.length) {
      const j = st.pop()!, r = j >> 3, c = j & 7;
      for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const k = rr * 8 + cc;
        if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && log[k] === "s" && !seen.has(k)) { seen.add(k); st.push(k); }
      }
    }
  }
  return n;
}
/** Computer drill: hard mode follows up on hits and drills a checkerboard, never next to a found deposit. */
export function cpuDrill(log: string, hard: boolean): number {
  const open = [...log].map((v, i) => (v === "0" ? i : -1)).filter((i) => i >= 0);
  if (hard) {
    const hits = [...log].map((v, i) => (v === "h" ? i : -1)).filter((i) => i >= 0);
    if (hits.length) {
      const cand: number[] = [];
      const neighbors = (i: number) => [i - SN, i + SN, i % SN > 0 ? i - 1 : -1, i % SN < SN - 1 ? i + 1 : -1].filter((j) => j >= 0 && j < 64);
      if (hits.length > 1) {
        const horiz = Math.floor(hits[0] / SN) === Math.floor(hits[1] / SN);
        const sorted = [...hits].sort((a, b) => a - b);
        const ends = horiz ? [sorted[0] - 1, sorted[sorted.length - 1] + 1].filter((j) => Math.floor(j / SN) === Math.floor(sorted[0] / SN)) : [sorted[0] - SN, sorted[sorted.length - 1] + SN];
        ends.forEach((j) => { if (j >= 0 && j < 64 && log[j] === "0") cand.push(j); });
      }
      if (!cand.length) hits.forEach((h) => neighbors(h).forEach((j) => { if (log[j] === "0") cand.push(j); }));
      if (cand.length) return cand[Math.floor(Math.random() * cand.length)];
    }
    const near = new Set<number>();
    [...log].forEach((v, i) => {
      if (v !== "s") return;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = Math.floor(i / SN) + dr, c = (i % SN) + dc; if (r >= 0 && r < SN && c >= 0 && c < SN) near.add(r * SN + c); }
    });
    const smart = open.filter((i) => (Math.floor(i / SN) + (i % SN)) % 2 === 0 && !near.has(i));
    if (smart.length) return smart[Math.floor(Math.random() * smart.length)];
  }
  return open[Math.floor(Math.random() * open.length)];
}
