import type { Api, GameModule } from "../engine/types";
import { shade } from "../engine/color";

const W = 420, H = 640, N = 8, CELL = 46, GX = (W - N * CELL) / 2, GY = 104;
const TRAY_Y = GY + N * CELL + 22, TRAY_H = 128, SLOT_W = W / 3, MINI = 22, LIFT = 84;
// Gem colors: ruby, garnet-orange, citrine, emerald, sapphire, amethyst, rose quartz.
const COLORS = ["#E8364F", "#F2802C", "#FFD23F", "#2FBF71", "#2F8FE0", "#8B5CF6", "#F08AB8"];
type C = [number, number];
const SHAPES: [number, C[]][] = [
  [1, [[0, 0]]],
  [3, [[0, 0], [0, 1]]], [3, [[0, 0], [1, 0]]],
  [3, [[0, 0], [0, 1], [0, 2]]], [3, [[0, 0], [1, 0], [2, 0]]],
  [2, [[0, 0], [0, 1], [0, 2], [0, 3]]], [2, [[0, 0], [1, 0], [2, 0], [3, 0]]],
  [1, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]], [1, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]],
  [4, [[0, 0], [0, 1], [1, 0], [1, 1]]],
  [1, [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]],
  [1, [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]], [1, [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]],
  [2, [[0, 0], [1, 0], [1, 1]]], [2, [[0, 1], [1, 0], [1, 1]]], [2, [[0, 0], [0, 1], [1, 0]]], [2, [[0, 0], [0, 1], [1, 1]]],
  [2, [[0, 0], [1, 0], [2, 0], [2, 1]]], [2, [[0, 1], [1, 1], [2, 1], [2, 0]]], [2, [[0, 0], [0, 1], [1, 0], [2, 0]]], [2, [[0, 0], [0, 1], [1, 1], [2, 1]]],
  [2, [[0, 0], [0, 1], [0, 2], [1, 0]]], [2, [[0, 0], [0, 1], [0, 2], [1, 2]]], [2, [[0, 0], [1, 0], [1, 1], [1, 2]]], [2, [[0, 2], [1, 0], [1, 1], [1, 2]]],
  [2, [[0, 0], [0, 1], [0, 2], [1, 1]]], [2, [[1, 0], [1, 1], [1, 2], [0, 1]]], [2, [[0, 0], [1, 0], [2, 0], [1, 1]]], [2, [[0, 1], [1, 1], [2, 1], [1, 0]]],
  [2, [[0, 0], [0, 1], [1, 1], [1, 2]]], [2, [[0, 1], [0, 2], [1, 0], [1, 1]]], [2, [[0, 0], [1, 0], [1, 1], [2, 1]]], [2, [[0, 1], [1, 1], [1, 0], [2, 0]]],
  [1, [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]], [1, [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]]], [1, [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]]], [1, [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]],
];
const TOTALW = SHAPES.reduce((s, [w]) => s + w, 0);
const TIPS = [
  "Quarry workers cut limestone and granite into blocks for buildings and monuments.",
  "Crystals grow in repeating 3D patterns called crystal lattices, like blocks fitting together.",
  "Halite (rock salt) naturally breaks into perfect little cubes because of its cleavage.",
  "Columnar basalt forms neat six-sided columns as thick lava flows cool and crack.",
];

export const blastBlocks: GameModule = {
  config: {
    key: "bedrock_blast_blocks",
    title: "Blast Blocks",
    subtitle: "Fit gem blocks, blast rows and columns!",
    W, H,
    winAt: 2000,
    winText: "You scored 2,000!",
    deathDelay: 300,
    overTitle: "No room left!",
    accent: "#E8A33D",
    medals: [
      { at: 1000, name: "Bronze", icon: "🥉" },
      { at: 3000, name: "Silver", icon: "🥈" },
      { at: 6000, name: "Gold", icon: "🥇" },
      { at: 12000, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Drag</b> a piece onto the board (or <b>tap</b> a piece, then tap the board). Fill a whole <b>row or column</b> to blast it. Clear lines on back-to-back turns for a <b>combo</b>. The game ends when none of your pieces fit — plan ahead! Score <b>2,000</b> to win.",
    controls: "Drag pieces · or tap a piece, then tap the board · P pause",
    heroless: true,
    facts: TIPS,
  },
  create() {
    type Piece = { cells: C[]; h: number; w: number; color: string };
    let board: (string | null)[][] = [], tray: (Piece | null)[] = [];
    let drag: { i: number; x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
    let sel = -1, hover: { r: number; c: number } | null = null, combo = 0, sinceClear = 0;
    let flash: { r: number; c: number; color: string; t: number }[] = [], popTxt: { text: string; pts: number; t: number } | null = null;
    let dead = false, deadT = 0;

    const pickShape = () => { let r = Math.random() * TOTALW; for (const [w, c] of SHAPES) if ((r -= w) <= 0) return c; return SHAPES[0][1]; };
    const makePiece = (): Piece => {
      const cells = pickShape();
      return { cells, h: Math.max(...cells.map((c) => c[0])) + 1, w: Math.max(...cells.map((c) => c[1])) + 1, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
    };
    const fits = (p: Piece, r: number, c: number) => p.cells.every(([dr, dc]) => r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N && !board[r + dr][c + dc]);
    const fitsAnywhere = (p: Piece) => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(p, r, c)) return true; return false; };
    const refill = () => { for (let i = 0; i < 30; i++) { tray = [makePiece(), makePiece(), makePiece()]; if (tray.some((p) => p && fitsAnywhere(p))) return; } };
    const anchorFor = (p: Piece, x: number, y: number) => ({ r: Math.round((y - (p.h * CELL) / 2 - GY) / CELL), c: Math.round((x - (p.w * CELL) / 2 - GX) / CELL) });
    const trayHit = (x: number, y: number) => { if (y < TRAY_Y - 10 || y > TRAY_Y + TRAY_H + 10) return -1; const i = Math.floor(x / SLOT_W); return tray[i] ? i : -1; };

    function place(i: number, r: number, c: number, A: Api) {
      const p = tray[i];
      if (!p || !fits(p, r, c)) return false;
      p.cells.forEach(([dr, dc]) => (board[r + dr][c + dc] = p.color));
      A.addScore(p.cells.length);
      A.sfx("drop");
      tray[i] = null;
      const rows: number[] = [], cols: number[] = [];
      for (let k = 0; k < N; k++) { if (board[k].every(Boolean)) rows.push(k); if (board.every((row) => row[k])) cols.push(k); }
      const n = rows.length + cols.length;
      if (n) {
        combo++;
        sinceClear = 0;
        const pts = Math.round(((10 * N * n * (n + 1)) / 2) * (1 + (combo - 1) * 0.5));
        const cells = new Set<number>();
        rows.forEach((rr) => { for (let k = 0; k < N; k++) cells.add(rr * N + k); });
        cols.forEach((cc) => { for (let k = 0; k < N; k++) cells.add(k * N + cc); });
        cells.forEach((id) => {
          const rr = Math.floor(id / N), cc = id % N;
          flash.push({ r: rr, c: cc, color: board[rr][cc]!, t: 0 });
          A.particles.burst(GX + cc * CELL + CELL / 2, GY + rr * CELL + CELL / 2, board[rr][cc]!, 5, 170, 4);
          board[rr][cc] = null;
        });
        A.addScore(pts);
        A.sfx(n > 1 ? "medal" : "clear");
        if (n > 1) A.shake(5 + n * 2, 0.25);
        const words = n >= 4 ? "UNBELIEVABLE!" : n === 3 ? "AMAZING!" : n === 2 ? "GREAT!" : "NICE!";
        popTxt = { text: words + (combo > 1 ? `  COMBO ×${combo}` : ""), pts, t: 0 };
        if (board.every((row) => row.every((v) => !v))) { A.addScore(300); A.float("BOARD CLEAR +300", W / 2, GY + (N * CELL) / 2 + 40, "#7CFFB2"); }
      } else if (++sinceClear >= 3) combo = 0;
      if (tray.every((x) => !x)) refill();
      if (!tray.some((x) => x && fitsAnywhere(x))) { dead = true; deadT = 0; A.sfx("hit"); }
      return true;
    }
    function block(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number, s: number, color: string, alpha = 1) {
      ctx.globalAlpha = alpha;
      const r = Math.max(3, s * 0.22);
      const g = ctx.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, shade(color, 0.45));
      g.addColorStop(0.5, color);
      g.addColorStop(1, shade(color, -0.35));
      A.rr(x + 1.5, y + 1.5, s - 3, s - 3, r);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.4)";
      A.rr(x + 5, y + 4, s - 10, s * 0.22, r * 0.6);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.beginPath();
      ctx.arc(x + s * 0.28, y + s * 0.3, s * 0.06, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.3)";
      ctx.lineWidth = 1;
      A.rr(x + 1.5, y + 1.5, s - 3, s - 3, r);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    return {
      reset() {
        board = Array.from({ length: N }, () => Array(N).fill(null));
        drag = null; sel = -1; hover = null; combo = 0; sinceClear = 0; flash = []; popTxt = null; dead = false; deadT = 0;
        refill();
      },
      pointer(type, x, y, A) {
        if (dead) return;
        if (type === "down") {
          const i = trayHit(x, y);
          if (i >= 0) { drag = { i, x, y, sx: x, sy: y, moved: false }; return; }
          if (sel >= 0 && tray[sel]) {
            const p = tray[sel]!, r = Math.floor((y - GY) / CELL) - Math.floor((p.h - 1) / 2), c = Math.floor((x - GX) / CELL) - Math.floor((p.w - 1) / 2);
            if (place(sel, r, c, A)) sel = -1; else A.sfx("hit");
          }
        } else if ((type === "drag" || type === "move") && drag) {
          drag.x = x; drag.y = y;
          if (Math.hypot(x - drag.sx, y - drag.sy) > 10) drag.moved = true;
        } else if (type === "move" && sel >= 0 && tray[sel]) {
          const p = tray[sel]!;
          hover = { r: Math.floor((y - GY) / CELL) - Math.floor((p.h - 1) / 2), c: Math.floor((x - GX) / CELL) - Math.floor((p.w - 1) / 2) };
        } else if (type === "up" && drag) {
          const d = drag;
          drag = null;
          if (!d.moved) { sel = sel === d.i ? -1 : d.i; hover = null; return; }
          const p = tray[d.i]!, a = anchorFor(p, d.x, d.y - LIFT);
          if (!place(d.i, a.r, a.c, A)) A.sfx("swipe");
          sel = -1;
        }
      },
      update(dt, A) {
        flash = flash.filter((f) => (f.t += dt) < 0.35);
        if (popTxt && (popTxt.t += dt) > 1.3) popTxt = null;
        if (dead && A.state === "play") {
          deadT += dt;
          if (deadT > 1.2) { dead = false; A.toast("💡 " + TIPS[Math.floor(Math.random() * TIPS.length)], 2600); A.gameOver(); }
        }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#2a1c16");
        g.addColorStop(1, "#0e0a0c");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.font = A.font(14, 600);
        ctx.fillStyle = combo > 1 ? "#FFD166" : "rgba(255,255,255,.55)";
        ctx.fillText(combo > 1 ? `🔥 Combo ×${combo}  (clear within ${3 - sinceClear} to keep it)` : "Fill a row or column to clear it", W / 2, GY - 16);
        A.rr(GX - 8, GY - 8, N * CELL + 16, N * CELL + 16, 18);
        ctx.fillStyle = "#0d0907";
        ctx.fill();
        ctx.strokeStyle = "rgba(232,163,61,.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++) {
            const x = GX + c * CELL, y = GY + r * CELL;
            if (board[r][c]) block(ctx, A, x, y, CELL, board[r][c]!);
            else { ctx.fillStyle = "rgba(255,255,255,.05)"; A.rr(x + 2, y + 2, CELL - 4, CELL - 4, 8); ctx.fill(); }
          }
        let ghost: { p: Piece; r: number; c: number } | null = null;
        if (drag && drag.moved && tray[drag.i]) { const p = tray[drag.i]!; ghost = { p, ...anchorFor(p, drag.x, drag.y - LIFT) }; }
        else if (sel >= 0 && tray[sel] && hover) ghost = { p: tray[sel]!, ...hover };
        if (ghost && fits(ghost.p, ghost.r, ghost.c)) {
          const tmp = board.map((row) => row.slice());
          ghost.p.cells.forEach(([dr, dc]) => (tmp[ghost!.r + dr][ghost!.c + dc] = ghost!.p.color));
          for (let k = 0; k < N; k++) {
            if (tmp[k].every(Boolean)) { ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.fillRect(GX, GY + k * CELL, N * CELL, CELL); }
            if (tmp.every((row) => row[k])) { ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.fillRect(GX + k * CELL, GY, CELL, N * CELL); }
          }
          ghost.p.cells.forEach(([dr, dc]) => block(ctx, A, GX + (ghost!.c + dc) * CELL, GY + (ghost!.r + dr) * CELL, CELL, ghost!.p.color, 0.45));
        }
        flash.forEach((f) => {
          const s = CELL * (1 + f.t * 1.2), x = GX + f.c * CELL + CELL / 2 - s / 2, y = GY + f.r * CELL + CELL / 2 - s / 2;
          block(ctx, A, x, y, s, "#ffffff", 1 - f.t / 0.35);
        });
        ctx.fillStyle = "rgba(255,255,255,.05)";
        A.rr(8, TRAY_Y - 6, W - 16, TRAY_H + 12, 18);
        ctx.fill();
        tray.forEach((p, i) => {
          if (!p || (drag && drag.i === i && drag.moved)) return;
          const ok = fitsAnywhere(p), x = SLOT_W * i + SLOT_W / 2, y = TRAY_Y + TRAY_H / 2;
          if (sel === i) { ctx.strokeStyle = "#FFD166"; ctx.lineWidth = 2.5; A.rr(SLOT_W * i + 8, TRAY_Y - 2, SLOT_W - 16, TRAY_H + 4, 16); ctx.stroke(); }
          p.cells.forEach(([dr, dc]) => block(ctx, A, x - (p.w * MINI) / 2 + dc * MINI, y - (p.h * MINI) / 2 + dr * MINI, MINI, ok ? p.color : "#5e5348", ok ? 1 : 0.6));
        });
        if (drag && drag.moved && tray[drag.i]) {
          const p = tray[drag.i]!, cx = drag.x, cy = drag.y - LIFT;
          p.cells.forEach(([dr, dc]) => block(ctx, A, cx - (p.w * CELL) / 2 + dc * CELL, cy - (p.h * CELL) / 2 + dr * CELL, CELL, p.color, 0.95));
        }
        if (popTxt) {
          const k = Math.min(1, popTxt.t * 6), a = Math.max(0, 1 - Math.max(0, popTxt.t - 0.8) * 2);
          ctx.globalAlpha = a;
          ctx.textAlign = "center";
          ctx.font = A.font(Math.max(1, Math.round(30 * k)));
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(7,7,26,.85)";
          ctx.strokeText(popTxt.text, W / 2, GY + (N * CELL) / 2 - 10);
          ctx.fillStyle = "#FFD166";
          ctx.fillText(popTxt.text, W / 2, GY + (N * CELL) / 2 - 10);
          ctx.font = A.font(22);
          ctx.strokeText("+" + popTxt.pts, W / 2, GY + (N * CELL) / 2 + 24);
          ctx.fillStyle = "#7CFFB2";
          ctx.fillText("+" + popTxt.pts, W / 2, GY + (N * CELL) / 2 + 24);
          ctx.globalAlpha = 1;
        }
        if (dead) {
          ctx.fillStyle = "rgba(7,7,26,.6)";
          ctx.fillRect(0, GY - 8, W, N * CELL + 16);
          ctx.textAlign = "center";
          ctx.font = A.font(32);
          ctx.fillStyle = "#FF8FA3";
          ctx.fillText("No room left!", W / 2, GY + (N * CELL) / 2 + 10);
        }
      },
    };
  },
};
