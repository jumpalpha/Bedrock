import type { Api, GameModule } from "../engine/types";

const W = 420, H = 640;
const LEVELS = [
  { cols: 9, rows: 11, quakes: 12, cell: 42, y0: 120 },
  { cols: 10, rows: 12, quakes: 20, cell: 38, y0: 118 },
];
// Each hidden tile is an earthquake epicenter on a fault line.
const FAULTS = [
  { name: "a strike-slip fault", sprite: "quake-crack", tip: "At a strike-slip fault, two blocks of crust slide past each other sideways, like California's San Andreas Fault." },
  { name: "a normal fault", sprite: "quake-crack", tip: "At a normal fault, crust is pulled apart and one block drops down. Idaho's Lost River Fault is a normal fault." },
  { name: "a reverse fault", sprite: "quake-crack", tip: "At a reverse fault, crust is squeezed together and one block is pushed up over the other." },
  { name: "the 1983 Borah Peak quake", sprite: "quake-crack", tip: "The magnitude 6.9 Borah Peak earthquake lifted Idaho's tallest mountain about 0.3 m and dropped the valley beside it." },
  { name: "a megathrust quake", sprite: "quake-crack", tip: "The biggest earthquakes happen at subduction zones, where one plate dives under another." },
  { name: "an aftershock", sprite: "quake-crack", tip: "Aftershocks are smaller quakes that follow a big one as the crust settles. Drop, cover, and hold on!" },
];
const NUMC = ["", "#1e7bff", "#16a34a", "#e11d48", "#7c3aed", "#b45309", "#0891b2", "#111827", "#6b7280"];

export const quakeSweeper: GameModule = {
  config: {
    key: "bedrock_quake_sweeper",
    title: "Quake Sweeper",
    subtitle: "Survey the fault zone, don't trigger a quake!",
    W, H,
    winText: "Zone 1 is surveyed!",
    deathDelay: 600,
    overTitle: "Game Over!",
    keys: { KeyF: "rotate" },
    medals: [
      { at: 500, name: "Bronze", icon: "🥉" },
      { at: 1000, name: "Silver", icon: "🥈" },
      { at: 1600, name: "Gold", icon: "🥇" },
      { at: 2000, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Tap</b> a tile to survey it. A number tells how many hidden quake epicenters touch that tile. <b>Hold</b> a tile (or switch to Flag) to mark a fault with 🚩. Your first tap is always safe. Clear <b>zone 1</b> to win, then try the bigger zone!",
    controls: "Tap · hold to flag · or arrows to move, Space survey, F flag · P pause",
    accent: "#E8A33D",
    sprites: ["quake-crack", "survey-flag"],
    facts: [
      "The focus is where an earthquake starts underground; the epicenter is the spot on the surface right above it.",
      "Seismographs record P waves first, then S waves; the gap between them tells how far away the quake was.",
      "Each step up the magnitude scale means about 32 times more energy released.",
      "Idaho is earthquake country: the 1983 Borah Peak quake was magnitude 6.9.",
      "In an earthquake, drop, cover, and hold on until the shaking stops.",
    ],
  },
  create() {
    type Tile = { quake: boolean; n: number; open: boolean; flag: boolean; kind: number; hit?: boolean };
    let lv = 0, L = LEVELS[0], grid: Tile[][] = [], cell = 42, x0 = 0, y0 = 0;
    let started = false, alive = true, revealedSafe = 0, flags = 0, mode: "dig" | "flag" = "dig";
    let cur = { r: 0, c: 0 }, kbd = false, timer = 0, msg = "", msgT = 0, lost = false, deathT = 0, tt = 0;
    let press: { at: { r: number; c: number }; t: number; x: number; y: number; used: boolean } | null = null;
    const BTN = { x: W / 2 - 130, w: 260, h: 44 };

    function setup(i: number) {
      lv = i; L = LEVELS[i]; cell = L.cell; x0 = Math.round((W - L.cols * cell) / 2); y0 = L.y0;
      grid = Array.from({ length: L.rows }, () => Array.from({ length: L.cols }, () => ({ quake: false, n: 0, open: false, flag: false, kind: 0 })));
      started = false; revealedSafe = 0; flags = 0; timer = 0; cur = { r: Math.floor(L.rows / 2), c: Math.floor(L.cols / 2) }; press = null;
    }
    const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < L.rows && c < L.cols;
    const around = (r: number, c: number, fn: (a: number, b: number) => void) => {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && inside(r + dr, c + dc)) fn(r + dr, c + dc);
    };
    function plant(sr: number, sc: number) {
      const spots: [number, number][] = [];
      for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) if (Math.abs(r - sr) > 1 || Math.abs(c - sc) > 1) spots.push([r, c]);
      for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
      spots.slice(0, L.quakes).forEach(([r, c]) => { grid[r][c].quake = true; grid[r][c].kind = Math.floor(Math.random() * FAULTS.length); });
      for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) { let n = 0; around(r, c, (a, b) => { if (grid[a][b].quake) n++; }); grid[r][c].n = n; }
      started = true;
    }
    function open(r: number, c: number, A: Api) {
      const g = grid[r][c];
      if (g.open || g.flag) return;
      if (g.quake) { boom(r, c, A); return; }
      const stack: [number, number][] = [[r, c]];
      let gained = 0;
      while (stack.length) {
        const [a, b] = stack.pop()!, t = grid[a][b];
        if (t.open || t.flag) continue;
        t.open = true; revealedSafe++; gained++;
        if (t.n === 0) around(a, b, (p, q) => { if (!grid[p][q].open && !grid[p][q].quake) stack.push([p, q]); });
      }
      A.addScore(gained * 5);
      A.sfx(gained > 6 ? "coin" : "point");
      if (revealedSafe === L.rows * L.cols - L.quakes) cleared(A);
    }
    function dig(r: number, c: number, A: Api) {
      if (!alive) return;
      if (!started) plant(r, c);
      const g = grid[r][c];
      if (g.open) {
        let f = 0;
        around(r, c, (a, b) => { if (grid[a][b].flag) f++; });
        if (g.n && f === g.n) around(r, c, (a, b) => { if (alive) open(a, b, A); });
        return;
      }
      open(r, c, A);
    }
    function toggleFlag(r: number, c: number, A: Api) {
      if (!alive || !started) return;
      const g = grid[r][c];
      if (g.open) return;
      g.flag = !g.flag;
      flags += g.flag ? 1 : -1;
      A.sfx("click");
    }
    function boom(r: number, c: number, A: Api) {
      alive = false; lost = true; deathT = 0;
      grid[r][c].open = true; grid[r][c].hit = true;
      for (const row of grid) for (const g of row) if (g.quake) g.open = true;
      const k = FAULTS[grid[r][c].kind];
      A.sfx("hit"); A.shake(10, 0.4); A.flash(0.2);
      msg = `💥 You triggered ${k.name}! ${k.tip}`;
      msgT = 99;
    }
    function cleared(A: Api) {
      alive = false;
      const bonus = 300 + Math.max(0, 300 - Math.floor(timer) * 2);
      A.addScore(bonus);
      A.sfx("win");
      for (const row of grid) for (const g of row) if (g.quake) g.flag = true;
      A.float("Zone clear! +" + bonus, W / 2, 300, "#7CFFB2");
      if (lv === 0) {
        A.win("Zone 1 is surveyed!");
        msg = "🚩 Zone mapped! Next: a bigger zone with more faults."; msgT = 2.4;
        setTimeout(() => { if (A.state === "play" || A.state === "paused") { setup(1); alive = true; } }, 2400);
      } else {
        msg = "🏆 Both zones mapped! Geologists map faults so towns can build safer buildings."; msgT = 99;
        setTimeout(() => A.gameOver(true), 1800);
      }
    }
    const cellAt = (x: number, y: number) => {
      const c = Math.floor((x - x0) / cell), r = Math.floor((y - y0) / cell);
      return inside(r, c) ? { r, c } : null;
    };
    const btnY = () => y0 + L.rows * cell + 16;
    const onBtn = (x: number, y: number) => { const by = btnY(); return x >= BTN.x && x <= BTN.x + BTN.w && y >= by && y <= by + BTN.h; };
    function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
      const words = text.split(" "), lines: string[] = [];
      let line = "";
      words.forEach((w) => { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
      if (line) lines.push(line);
      return lines;
    }

    return {
      reset() { mode = "dig"; kbd = false; msg = ""; msgT = 0; alive = true; lost = false; deathT = 0; setup(0); },
      pointer(type, x, y, A) {
        if (type === "down") {
          kbd = false;
          if (onBtn(x, y)) { mode = mode === "dig" ? "flag" : "dig"; A.sfx("swipe"); press = null; return; }
          const at = cellAt(x, y);
          press = at ? { at, t: 0, x, y, used: false } : null;
        } else if (type === "drag" && press) {
          if (Math.hypot(x - press.x, y - press.y) > 14) press = null;
        } else if (type === "up" && press) {
          const p = press;
          press = null;
          if (p.used) return;
          const { r, c } = p.at;
          if (mode === "flag" && !grid[r][c].open) toggleFlag(r, c, A);
          else dig(r, c, A);
        }
      },
      input(type, A) {
        if (type === "rotate") { kbd = true; toggleFlag(cur.r, cur.c, A); return; }
        if (type === "tap") { if (kbd) dig(cur.r, cur.c, A); else kbd = !press; return; }
        const d = ({ up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] } as Record<string, [number, number]>)[type];
        if (d) {
          if (kbd) { cur.r = Math.max(0, Math.min(L.rows - 1, cur.r + d[0])); cur.c = Math.max(0, Math.min(L.cols - 1, cur.c + d[1])); }
          kbd = true;
        }
      },
      update(dt, A) {
        msgT = Math.max(0, msgT - dt);
        if (A.state !== "play") return;
        if (alive && started) timer += dt;
        if (press && !press.used) {
          press.t += dt;
          if (press.t > 0.42) {
            press.used = true;
            toggleFlag(press.at.r, press.at.c, A);
            try { navigator.vibrate?.(20); } catch {}
          }
        }
        if (lost) { deathT += dt; if (deathT > 2.2 && deathT - dt <= 2.2) A.gameOver(true); }
      },
      draw(ctx, A) {
        tt += 1 / 60;
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#2e2010");
        g.addColorStop(1, "#140d0a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(W / 2, 330, 40, W / 2, 330, 320);
        glow.addColorStop(0, "rgba(232,163,61,.14)");
        glow.addColorStop(1, "rgba(232,163,61,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        ctx.font = A.font(15, 700);
        ctx.textAlign = "center";
        ctx.fillStyle = "#f7ead9";
        ctx.fillText(`Zone ${lv + 1} of 2  ·  🚩 ${L.quakes - flags}  ·  ⏱ ${Math.floor(timer)}s`, W / 2, 100);

        A.rr(x0 - 7, y0 - 7, L.cols * cell + 14, L.rows * cell + 14, 16);
        ctx.fillStyle = "rgba(255,255,255,.05)";
        ctx.fill();
        ctx.strokeStyle = "rgba(232,163,61,.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.textBaseline = "middle";
        for (let r = 0; r < L.rows; r++)
          for (let c = 0; c < L.cols; c++) {
            const t = grid[r][c], x = x0 + c * cell, y = y0 + r * cell, s = cell - 3;
            if (t.open) {
              A.rr(x + 1.5, y + 1.5, s, s, 8);
              ctx.fillStyle = t.hit ? "#ff6a3d" : "#f3e9d8";
              ctx.fill();
              if (t.quake) A.drawSprite(FAULTS[t.kind].sprite, x + cell / 2, y + cell / 2, cell * 0.92, Math.sin(tt * 2 + r + c) * 0.15);
              else if (t.n) {
                ctx.font = A.font(Math.round(cell * 0.52));
                ctx.fillStyle = NUMC[t.n];
                ctx.fillText(String(t.n), x + cell / 2, y + cell / 2 + 1);
              }
            } else {
              A.rr(x + 1.5, y + 1.5, s, s, 9);
              const gg = ctx.createLinearGradient(0, y, 0, y + cell);
              gg.addColorStop(0, "#b08a5e");
              gg.addColorStop(1, "#6b4a2e");
              ctx.fillStyle = gg;
              ctx.fill();
              ctx.fillStyle = "rgba(255,255,255,.22)";
              A.rr(x + 6, y + 5, s - 10, 4, 2);
              ctx.fill();
              ctx.strokeStyle = "rgba(0,0,0,.25)";
              ctx.lineWidth = 1;
              A.rr(x + 1.5, y + 1.5, s, s, 9);
              ctx.stroke();
              if (t.flag) A.drawSprite("survey-flag", x + cell / 2, y + cell / 2, cell * 0.85);
              if (press && press.at.r === r && press.at.c === c && !press.used) {
                ctx.fillStyle = "rgba(255,255,255,.25)";
                A.rr(x + 1.5, y + 1.5, s, s, 9);
                ctx.fill();
                const f = Math.min(1, press.t / 0.42);
                if (f > 0.25) {
                  ctx.strokeStyle = "#FFD166";
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  ctx.arc(x + cell / 2, y + cell / 2, cell * 0.36, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
                  ctx.stroke();
                }
              }
            }
            if (kbd && cur.r === r && cur.c === c && alive) {
              ctx.strokeStyle = "#FFD166";
              ctx.lineWidth = 3;
              A.rr(x, y, cell, cell, 10);
              ctx.stroke();
            }
          }
        ctx.textBaseline = "alphabetic";

        const by = btnY();
        A.rr(BTN.x, by, BTN.w, BTN.h, 22);
        const bg = ctx.createLinearGradient(BTN.x, 0, BTN.x + BTN.w, 0);
        if (mode === "dig") { bg.addColorStop(0, "#e8a33d"); bg.addColorStop(1, "#ffd166"); }
        else { bg.addColorStop(0, "#38bfff"); bg.addColorStop(1, "#8ad9ff"); }
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.fillStyle = "#07071a";
        ctx.font = A.font(15, 700);
        ctx.textAlign = "center";
        ctx.fillText(mode === "dig" ? "Mode: Survey  ⇄  tap for Flag" : "Mode: Flag  ⇄  tap for Survey", W / 2, by + 28);

        A.drawHero(40, H - 34, 64, 0, lost ? "hurt" : "happy");

        if (msgT > 0 && msg) {
          ctx.font = A.font(14, 600);
          const lines = wrap(ctx, msg, W - 64), hh = lines.length * 20 + 18, my = 240;
          ctx.globalAlpha = Math.min(1, msgT * 2);
          A.rr(16, my, W - 32, hh, 14);
          ctx.fillStyle = "rgba(7,12,26,.94)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.14)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.textAlign = "left";
          lines.forEach((l, i) => ctx.fillText(l, 32, my + 24 + i * 20));
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
