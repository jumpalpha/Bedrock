import type { Api, GameModule } from "../engine/types";
import { shade } from "../engine/color";

const COLS = 10, ROWS = 20, CELL = 27, BX = 12, BY = 76;
const W = 420, H = BY + ROWS * CELL + 12;
const PX = BX + COLS * CELL + 12;

type K = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
const PIECES: Record<K, { cells: [number, number][]; rock: string; color: string }> = {
  I: { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], rock: "rock-limestone", color: "#6FB7D9" },
  O: { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], rock: "rock-sandstone", color: "#F2C14E" },
  T: { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], rock: "rock-shale", color: "#A88BD9" },
  S: { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], rock: "rock-greensand", color: "#6BBF59" },
  Z: { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], rock: "rock-mudstone", color: "#E0603F" },
  J: { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], rock: "rock-conglomerate", color: "#FF9F43" },
  L: { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], rock: "fossil", color: "#E58CB0" },
};
const KEYS = Object.keys(PIECES) as K[];
const LINE_PTS = [0, 100, 300, 500, 800];
const TIPS = [
  "Limestone often forms from the shells of sea creatures.", "Sandstone is sand grains cemented together.", "Shale forms from mud that settled in calm water.",
  "Greensand gets its color from the mineral glauconite.", "Red mudstone is colored by iron oxide, like rust.", "Conglomerate has rounded pebbles cemented together.", "Fossils are most often found in sedimentary rock.",
];

export const strataStack: GameModule = {
  config: {
    key: "bedrock_strata_stack",
    title: "Strata Stack",
    subtitle: "Stack rock layers, clear the lines!",
    W, H,
    winText: "You cleared 10 lines!",
    swipe: true,
    repeatKeys: true,
    spaceType: "drop",
    medals: [
      { at: 500, name: "Bronze", icon: "🥉" },
      { at: 1500, name: "Silver", icon: "🥈" },
      { at: 4000, name: "Gold", icon: "🥇" },
      { at: 8000, name: "Legend", icon: "💎" },
    ],
    howTo: "Fill a whole row with rock layers to clear it. <b>Clear 10 lines</b> to complete the quest!",
    controls: "← → move · ↑ rotate · ↓ soft drop · Space hard drop · Phones: tap to rotate, swipe to move",
    overTitle: "Stacked out!",
    accent: "#E8A33D",
    pad: [
      { label: "◀", type: "left" },
      { label: "⟳", type: "rotate" },
      { label: "▼", type: "down" },
      { label: "⤓", type: "drop" },
      { label: "▶", type: "right" },
    ],
    sprites: KEYS.map((k) => PIECES[k].rock),
    facts: [
      "Law of superposition: in undisturbed rock layers, the oldest layers are on the bottom.",
      "Sedimentary rock forms when sediment is deposited, compacted, and cemented into layers called strata.",
      "The Grand Canyon shows nearly 2 billion years of Earth history in its rock layers.",
      "Fossils in a layer help geologists match rock layers of the same age in different places.",
      "An unconformity is a gap in the rock record where layers were eroded away.",
    ],
  },
  create() {
    type Cur = { k: K; cells: [number, number][]; x: number; y: number };
    let board: (K | null)[][] = [], cur: Cur | null = null, next: K = "I", bag: K[] = [];
    let dropT = 0, lockT = 0, lines = 0, level = 1, clearing: number[] | null = null, clearT = 0;
    const sprite = { pose: "happy" as "happy" | "hurt", worried: false, cheer: 0, t: 0 };

    const newBag = () => {
      const b = KEYS.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      return b;
    };
    const take = () => { if (!bag.length) bag = newBag(); return bag.pop()!; };
    const collides = (cells: [number, number][], x: number, y: number) =>
      cells.some(([cx, cy]) => { const X = x + cx, Y = y + cy; return X < 0 || X >= COLS || Y >= ROWS || (Y >= 0 && !!board[Y][X]); });

    function spawn(A: Api) {
      const k = next;
      next = take();
      cur = { k, cells: PIECES[k].cells.map((c) => [c[0], c[1]] as [number, number]), x: 3, y: 0 };
      if (collides(cur.cells, cur.x, cur.y)) { sprite.pose = "hurt"; A.gameOver(); }
    }
    function rotate(A: Api) {
      if (!cur || cur.k === "O") return;
      const n = cur.k === "I" ? 4 : 3;
      const rot = cur.cells.map(([x, y]) => [n - 1 - y, x] as [number, number]);
      for (const dx of [0, -1, 1, -2, 2]) if (!collides(rot, cur.x + dx, cur.y)) { cur.cells = rot; cur.x += dx; lockT = 0; A.sfx("swipe"); return; }
    }
    const move = (dx: number) => { if (cur && !collides(cur.cells, cur.x + dx, cur.y)) { cur.x += dx; lockT = 0; } };
    const ghostY = () => { let y = cur!.y; while (!collides(cur!.cells, cur!.x, y + 1)) y++; return y; };
    function lock(A: Api) {
      cur!.cells.forEach(([cx, cy]) => { const Y = cur!.y + cy; if (Y >= 0) board[Y][cur!.x + cx] = cur!.k; });
      A.sfx("drop");
      const full: number[] = [];
      for (let y = 0; y < ROWS; y++) if (board[y].every(Boolean)) full.push(y);
      if (full.length) { clearing = full; clearT = 0.3; scoreLines(full.length, A); }
      else spawn(A);
    }
    function scoreLines(n: number, A: Api) {
      lines += n;
      const pts = LINE_PTS[n] * level;
      A.addScore(pts);
      A.sfx(n >= 4 ? "win" : "clear");
      A.float((n === 4 ? "STRATA STACK! " : "") + "+" + pts, BX + (COLS * CELL) / 2, BY + clearing![0] * CELL, n >= 3 ? "#FFD166" : "#7CFFB2");
      clearing!.forEach((r) => A.particles.burst(BX + (COLS * CELL) / 2, BY + r * CELL + CELL / 2, "#FFE066", 18, 260, 4));
      sprite.cheer = 1;
      const nl = 1 + Math.floor(lines / 5);
      if (nl > level) { level = nl; A.toast("⬆ Level " + level + "! " + TIPS[Math.floor(Math.random() * TIPS.length)], 2400); }
      if (lines >= 10) A.win("You cleared 10 lines!");
    }
    function hardDrop(A: Api) {
      const gy = ghostY(), rows = gy - cur!.y;
      cur!.y = gy;
      if (rows) A.addScore(rows * 2);
      A.shake(4, 0.12);
      lock(A);
    }

    function tile(ctx: CanvasRenderingContext2D, A: Api, px: number, py: number, k: K, size: number, alpha = 1, showRock = true) {
      const P = PIECES[k];
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(px, py, px + size, py + size);
      g.addColorStop(0, shade(P.color, 0.45));
      g.addColorStop(0.5, P.color);
      g.addColorStop(1, shade(P.color, -0.4));
      A.rr(px + 1.5, py + 1.5, size - 3, size - 3, size * 0.24);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.3)";
      A.rr(px + 4, py + 3.5, size - 10, size * 0.18, 3);
      ctx.fill();
      if (showRock && alpha === 1) A.drawSprite(P.rock, px + size / 2, py + size / 2 + 1, size * 0.78);
      ctx.globalAlpha = 1;
    }

    return {
      reset(A) {
        board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        bag = [];
        next = take();
        lines = 0; level = 1; clearing = null; clearT = 0; dropT = 0; lockT = 0;
        sprite.pose = "happy"; sprite.cheer = 0;
        cur = null;
        spawn(A);
      },
      input(type, A) {
        if (!cur || clearing || A.state !== "play") return;
        if (type === "left") move(-1);
        else if (type === "right") move(1);
        else if (type === "up" || type === "tap" || type === "rotate") rotate(A);
        else if (type === "down") { if (!collides(cur.cells, cur.x, cur.y + 1)) { cur.y++; dropT = 0; A.addScore(1); } }
        else if (type === "drop") hardDrop(A);
      },
      update(dt, A) {
        sprite.t += dt;
        sprite.cheer = Math.max(0, sprite.cheer - dt * 1.5);
        if (A.state !== "play" || !cur) return;
        if (clearing) {
          clearT -= dt;
          if (clearT <= 0) {
            clearing.forEach((r) => { board.splice(r, 1); board.unshift(Array(COLS).fill(null)); });
            clearing = null;
            spawn(A);
          }
          return;
        }
        const interval = Math.max(0.09, 0.8 - (level - 1) * 0.08);
        if (collides(cur.cells, cur.x, cur.y + 1)) { lockT += dt; if (lockT > 0.45) lock(A); }
        else { dropT += dt; if (dropT >= interval) { dropT = 0; cur.y++; } }
        let top = ROWS;
        for (let y = 0; y < ROWS; y++) if (board[y].some(Boolean)) { top = y; break; }
        sprite.worried = top < 6;
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#2a1d14");
        g.addColorStop(1, "#0f0a08");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // well
        A.rr(BX - 5, BY - 5, COLS * CELL + 10, ROWS * CELL + 10, 14);
        ctx.fillStyle = "#0d0907";
        ctx.fill();
        ctx.strokeStyle = "rgba(232,163,61,.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.045)";
        ctx.lineWidth = 1;
        for (let x = 1; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(BX + x * CELL, BY); ctx.lineTo(BX + x * CELL, BY + ROWS * CELL); ctx.stroke(); }
        for (let y = 1; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(BX, BY + y * CELL); ctx.lineTo(BX + COLS * CELL, BY + y * CELL); ctx.stroke(); }

        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++) {
            const k = board[y][x];
            if (!k) continue;
            if (clearing && clearing.includes(y)) {
              ctx.fillStyle = Math.floor(clearT * 20) % 2 ? "#fff" : "#FFE066";
              A.rr(BX + x * CELL + 1, BY + y * CELL + 1, CELL - 2, CELL - 2, 6);
              ctx.fill();
            } else tile(ctx, A, BX + x * CELL, BY + y * CELL, k, CELL);
          }

        if (cur && !clearing && A.state !== "menu") {
          const gy = ghostY();
          cur.cells.forEach(([cx, cy]) => {
            if (gy + cy < 0) return;
            A.rr(BX + (cur!.x + cx) * CELL + 3, BY + (gy + cy) * CELL + 3, CELL - 6, CELL - 6, 6);
            ctx.strokeStyle = PIECES[cur!.k].color;
            ctx.globalAlpha = 0.6;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
          });
          cur.cells.forEach(([cx, cy]) => { if (cur!.y + cy >= 0) tile(ctx, A, BX + (cur!.x + cx) * CELL, BY + (cur!.y + cy) * CELL, cur!.k, CELL); });
        }

        // side panel
        const lbl = (t: string, y: number) => { ctx.fillStyle = "#a3a6c8"; ctx.font = A.font(11, 700); ctx.textAlign = "center"; ctx.fillText(t, PX + 52, y); };
        const panel = (y: number, h: number) => { A.rr(PX, y, 104, h, 14); ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 1; ctx.stroke(); };
        lbl("NEXT", BY + 12);
        panel(BY + 20, 76);
        const P = PIECES[next], xs = P.cells.map((c) => c[0]), ys = P.cells.map((c) => c[1]);
        const nw = (Math.max(...xs) - Math.min(...xs) + 1) * 22, nh = (Math.max(...ys) - Math.min(...ys) + 1) * 22;
        P.cells.forEach(([cx, cy]) => tile(ctx, A, PX + 52 - nw / 2 + (cx - Math.min(...xs)) * 22, BY + 58 - nh / 2 + (cy - Math.min(...ys)) * 22, next, 22));
        lbl("LINES", BY + 124);
        ctx.fillStyle = "#FFD166";
        ctx.font = A.font(30);
        ctx.fillText(lines + (lines < 10 ? "/10" : ""), PX + 52, BY + 156);
        const pct = Math.min(1, lines / 10);
        A.rr(PX + 6, BY + 166, 92, 8, 4);
        ctx.fillStyle = "rgba(255,255,255,.1)";
        ctx.fill();
        if (pct > 0) {
          A.rr(PX + 6, BY + 166, 92 * pct, 8, 4);
          const pg = ctx.createLinearGradient(PX, 0, PX + 92, 0);
          pg.addColorStop(0, "#00e5a0"); pg.addColorStop(1, "#7cffb2");
          ctx.fillStyle = pg;
          ctx.fill();
        }
        lbl("LEVEL", BY + 202);
        ctx.fillStyle = "#fff";
        ctx.font = A.font(28);
        ctx.fillText(String(level), PX + 52, BY + 232);
        const bob = Math.sin(sprite.t * 3) * 4 - sprite.cheer * 14;
        ctx.fillStyle = "rgba(0,0,0,.3)";
        ctx.beginPath(); ctx.ellipse(PX + 52, BY + 356, 30, 6, 0, 0, 7); ctx.fill();
        A.drawHero(PX + 52, BY + 312 + bob, 90, Math.sin(sprite.t * 2) * 0.06, sprite.pose === "hurt" || sprite.worried ? "hurt" : "happy");
        ctx.fillStyle = "#a3a6c8";
        ctx.font = A.font(11, 600);
        ctx.fillText(sprite.worried ? "Too tall! Clear lines!" : sprite.cheer > 0.2 ? "Rock on! Nice clear!" : "Fill a row to clear it", PX + 52, BY + 382);
      },
    };
  },
};
