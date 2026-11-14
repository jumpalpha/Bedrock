import type { Api, GameModule } from "./engine/types";

const MAP = [
  "###################",
  "#o.......#.......o#",
  "#.##.###.#.###.##.#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.###.#.###.####",
  "####.#.......#.####",
  "####.#.##-##.#.####",
  ".......#GGG#.......",
  "####.#.#####.#.####",
  "####.#.......#.####",
  "####.#.#####.#.####",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o.#.....P.....#.o#",
  "##.#.#.#####.#.#.##",
  "#....#...#...#....#",
  "#.######.#.######.#",
  "#.................#",
  "###################",
];
const COLS = 19, ROWS = 21, CELL = 21, OX = 10, OY = 84;
const W = COLS * CELL + OX * 2, H = OY + ROWS * CELL + 14;
type Dir = "up" | "down" | "left" | "right";
const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const rev = (d: Dir): Dir => ({ up: "down", down: "up", left: "right", right: "left" } as const)[d];
const GHOSTS = [
  { art: "lava-bomb", name: "Lava Bomb", color: "#FF5C1C", start: [9, 7], release: 0, corner: [17, 1] },
  { art: "storm-cloud", name: "Storm", color: "#9AA3B5", start: [8, 9], release: 4, corner: [1, 1] },
  { art: "boulder", name: "Boulder", color: "#C9C4BC", start: [9, 9], release: 9, corner: [17, 19] },
  { art: "tornado", name: "Twister", color: "#B57CFF", start: [10, 9], release: 15, corner: [1, 19] },
]
const TIPS = [
  "An aquifer is a layer of rock or sediment that holds and lets groundwater flow.", "The water table is the top of the saturated zone underground.",
  "Much of southern Idaho drinks from the Snake River Plain Aquifer.", "Pumping wells faster than rain refills them makes the water table drop.",
  "Permeable rock has connected pores that let water pass through.",
]

export const spriteMaze: GameModule = {
  config: {
    key: "bedrock_sprite_maze",
    title: "Sprite Maze",
    subtitle: "Collect the groundwater, dodge the hazards!",
    W, H,
    winText: "You cleared the maze!",
    swipe: true,
    deathDelay: 1000,
    overTitle: "Caught by a hazard!",
    accent: "#22d3ee",
    medals: [
      { at: 1000, name: "Bronze", icon: "🥉" },
      { at: 2500, name: "Silver", icon: "🥈" },
      { at: 5000, name: "Gold", icon: "🥇" },
      { at: 9000, name: "Legend", icon: "💎" },
    ],
    howTo: "Collect every 💧 water drop in the aquifer. Hazards chase you! Grab a 💎 <b>star garnet</b> to turn the tables. <b>Clear the maze</b> to win!",
    controls: "Arrow keys / WASD · swipe on phones · P pause",
    pad: [
      { label: "◀", type: "left" },
      { label: "▲", type: "up" },
      { label: "▼", type: "down" },
      { label: "▶", type: "right" },
    ],
    sprites: [...GHOSTS.map((g) => g.art), "star-garnet", "heart"],
    facts: [
      "About 30% of Earth's fresh water is groundwater. Most of the rest is frozen in ice.",
      "Groundwater fills the pores and cracks in rock and sediment, like water in a sponge.",
      "The Snake River Plain Aquifer is one of the most productive aquifers in the United States.",
      "Thousand Springs in Idaho is where aquifer water pours out of the canyon walls.",
      "Groundwater can take thousands of years to move through some aquifers.",
    ],
  },
  create() {
    type Actor = { x: number; y: number; dir: Dir | null; p: number };
    type Ghost = Actor & (typeof GHOSTS)[number] & { dir: Dir; home: boolean; wait: number; eaten: boolean; eatenT: number; bob: number };
    let grid: string[][] = [], dots = 0, lives = 3, level = 1, scaredT = 0, combo = 0, modeT = 0, chase = false, readyT = 0, deathAnim = 0, t = 0;
    let player: Actor & { want: Dir | null; mouth: number; face: number } = { x: 9, y: 15, dir: null, want: null, p: 0, mouth: 0, face: 1 };
    let ghosts: Ghost[] = [];

    const cellAt = (x: number, y: number) => (x < 0 || x >= COLS ? " " : grid[y] ? grid[y][x] : "#");
    const openFor = (x: number, y: number, isGhost: boolean, leaving = false) => {
      const c = cellAt((x + COLS) % COLS, y);
      if (c === "#") return false;
      if (c === "-") return isGhost && leaving;
      return true;
    };
    function loadLevel() {
      grid = MAP.map((r) => r.split(""));
      dots = 0;
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          const c = grid[y][x];
          if (c === "P" || c === "G") grid[y][x] = " ";
          if (c === "." || c === "o") dots++;
        }
    }
    function placeActors() {
      player = { x: 9, y: 15, dir: null, want: null, p: 0, mouth: 0, face: 1 };
      ghosts = GHOSTS.map((g, i) => ({ ...g, x: g.start[0], y: g.start[1], dir: (i === 0 ? "left" : "up") as Dir, p: 0, home: i !== 0, wait: g.release, eaten: false, eatenT: 0, bob: Math.random() * 6 }));
      scaredT = 0; combo = 0; modeT = 0; chase = false; readyT = 1.6; deathAnim = 0;
    }
    const pos = (a: Actor): [number, number] => {
      const d = a.dir ? DIRS[a.dir] : [0, 0];
      let px = a.x + d[0] * a.p;
      const py = a.y + d[1] * a.p;
      if (px < -0.5) px += COLS;
      if (px > COLS - 0.5) px -= COLS;
      return [OX + px * CELL + CELL / 2, OY + py * CELL + CELL / 2];
    };
    function stepPlayer(dt: number, A: Api) {
      let move = (6.2 + level * 0.25) * (scaredT > 0 ? 1.08 : 1) * dt;
      while (move > 0) {
        if (player.p === 0) {
          const c = cellAt(player.x, player.y);
          if (c === "." || c === "o") {
            grid[player.y][player.x] = " ";
            dots--;
            const [px, py] = pos(player);
            if (c === ".") { A.addScore(10); if (dots % 2) A.sfx("point"); }
            else {
              A.addScore(50);
              A.sfx("medal");
              scaredT = Math.max(3, 7 - level * 0.6);
              combo = 0;
              A.toast("💎 Star garnet power! Chase the hazards!");
              ghosts.forEach((g) => {
                if (g.home || g.eaten) return;
                if (g.p > 0) { g.x = (g.x + DIRS[g.dir][0] + COLS) % COLS; g.y += DIRS[g.dir][1]; g.p = 1 - g.p; }
                g.dir = rev(g.dir);
              });
              A.particles.burst(px, py, "#FF5C77", 16, 160, 4);
            }
            if (dots <= 0) { levelClear(A); return; }
          }
          if (player.want && openFor(player.x + DIRS[player.want][0], player.y + DIRS[player.want][1], false)) player.dir = player.want;
          if (!player.dir || !openFor(player.x + DIRS[player.dir][0], player.y + DIRS[player.dir][1], false)) return;
        }
        const need = 1 - player.p;
        if (move >= need) {
          move -= need;
          player.p = 0;
          player.x = (player.x + DIRS[player.dir!][0] + COLS) % COLS;
          player.y += DIRS[player.dir!][1];
        } else { player.p += move; move = 0; }
      }
    }
    function targetFor(g: Ghost, i: number): number[] {
      if (!chase && !g.eaten) return g.corner;
      const pd = player.dir ? DIRS[player.dir] : [0, 0];
      if (i === 0) return [player.x, player.y];
      if (i === 1) return [player.x + pd[0] * 4, player.y + pd[1] * 4];
      if (i === 2) return Math.hypot(g.x - player.x, g.y - player.y) > 6 ? [player.x, player.y] : g.corner;
      return [player.x - pd[0] * 3 + (Math.sin(t) > 0 ? 3 : -3), player.y];
    }
    function stepGhost(g: Ghost, i: number, dt: number) {
      if (g.eaten) {
        g.eatenT -= dt;
        if (g.eatenT <= 0) { g.eaten = false; g.x = 9; g.y = 9; g.p = 0; g.home = true; g.wait = 1.5; g.dir = "up"; }
        return;
      }
      if (g.home) {
        g.wait -= dt;
        if (g.wait <= 0) { g.home = false; g.x = 9; g.y = 7; g.p = 0; g.dir = Math.random() < 0.5 ? "left" : "right"; }
        return;
      }
      const scared = scaredT > 0;
      let move = (scared ? 3.2 : 3.9 + level * 0.4 + (i === 0 && dots < 25 ? 0.5 : 0)) * dt;
      if (g.y === 9 && (g.x < 3 || g.x > 15)) move *= 0.55;
      while (move > 0) {
        if (g.p === 0) {
          const opts = (Object.keys(DIRS) as Dir[]).filter((d) => d !== rev(g.dir) && openFor(g.x + DIRS[d][0], g.y + DIRS[d][1], true));
          if (!opts.length) opts.push(rev(g.dir));
          if (scared) g.dir = opts[Math.floor(Math.random() * opts.length)];
          else {
            const [tx, ty] = targetFor(g, i);
            g.dir = opts.sort((a, b) => Math.hypot(g.x + DIRS[a][0] - tx, g.y + DIRS[a][1] - ty) - Math.hypot(g.x + DIRS[b][0] - tx, g.y + DIRS[b][1] - ty))[0];
          }
        }
        const need = 1 - g.p;
        if (move >= need) { move -= need; g.p = 0; g.x = (g.x + DIRS[g.dir][0] + COLS) % COLS; g.y += DIRS[g.dir][1]; }
        else { g.p += move; move = 0; }
      }
    }
    function levelClear(A: Api) {
      A.addScore(500 * level);
      A.sfx("win");
      A.float(`Maze clear! +${500 * level}`, W / 2, OY + 200, "#FFD166");
      if (level === 1) A.win("You cleared the maze!");
      else A.toast("💡 " + TIPS[level % TIPS.length], 2400);
      level++;
      loadLevel();
      placeActors();
    }
    function caught(A: Api) {
      lives--;
      A.sfx("hit");
      A.shake(10, 0.3);
      deathAnim = 1;
      if (lives <= 0) { A.gameOver(); return; }
      A.toast(`💔 ${lives} ${lives === 1 ? "life" : "lives"} left`);
      setTimeout(() => { if (A.state === "play") placeActors(); }, 900);
    }

    return {
      reset() { lives = 3; level = 1; t = 0; loadLevel(); placeActors(); },
      input(type) {
        const d = type as Dir;
        if (!DIRS[d]) return;
        player.want = d;
        if (player.dir && DIRS[d][0] === -DIRS[player.dir][0] && DIRS[d][1] === -DIRS[player.dir][1] && player.p > 0) {
          player.x = (player.x + DIRS[player.dir][0] + COLS) % COLS;
          player.y += DIRS[player.dir][1];
          player.p = 1 - player.p;
          player.dir = d;
        }
      },
      update(dt, A) {
        t += dt;
        player.mouth += dt * 10;
        ghosts.forEach((g) => (g.bob += dt * 4));
        if (deathAnim > 0) { deathAnim = Math.max(0, deathAnim - dt * 1.1); return; }
        if (A.state !== "play") return;
        if (readyT > 0) { readyT -= dt; return; }
        scaredT = Math.max(0, scaredT - dt);
        if (!scaredT) { modeT += dt; chase = modeT % 22 > 8 + Math.max(0, 3 - level); }
        stepPlayer(dt, A);
        if (A.state !== "play" || readyT > 0) return;
        const [ppx, ppy] = pos(player);
        ghosts.forEach((g, i) => {
          stepGhost(g, i, dt);
          if (g.home || g.eaten) return;
          const [gx, gy] = pos(g);
          if (Math.hypot(gx - ppx, gy - ppy) < CELL * 0.62) {
            if (scaredT > 0) {
              combo++;
              const pts = 200 * Math.pow(2, combo - 1);
              A.addScore(pts);
              A.sfx("coin");
              A.float(`${g.name} +${pts}`, gx, gy - 10, "#7CFFB2");
              A.particles.burst(gx, gy, g.color, 18, 220, 4);
              g.eaten = true;
              g.eatenT = 3;
            } else if (deathAnim === 0) caught(A);
          }
        });
        player.face = player.dir === "left" ? -1 : player.dir === "right" ? 1 : player.face;
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#1a1410");
        g.addColorStop(1, "#0a0806");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < lives; i++) A.drawSprite("heart", 66 + i * 24, 72, 22);
        ctx.fillStyle = "#a3a6c8";
        ctx.font = A.font(14, 700);
        ctx.textAlign = "right";
        ctx.fillText(`${dots} drops left`, W - 60, 77);

        ctx.fillStyle = "#0c0906";
        ctx.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++) {
            const c = grid[y][x], px = OX + x * CELL, py = OY + y * CELL;
            if (c === "#") {
              const wg = ctx.createLinearGradient(px, py, px, py + CELL);
              wg.addColorStop(0, "#9a7a5a");
              wg.addColorStop(1, "#5a4232");
              ctx.fillStyle = wg;
              ctx.fillRect(px, py, CELL, CELL);
              ctx.fillStyle = "rgba(240,210,170,.6)";
              if (cellAt(x, y - 1) !== "#") ctx.fillRect(px, py, CELL, 2);
              ctx.fillStyle = "rgba(0,0,0,.3)";
              if (cellAt(x, y + 1) !== "#") ctx.fillRect(px, py + CELL - 3, CELL, 3);
            } else if (c === "-") {
              ctx.fillStyle = "#22d3ee";
              ctx.fillRect(px + 2, py + CELL / 2 - 2, CELL - 4, 4);
            } else if (c === ".") {
              const dg = ctx.createRadialGradient(px + CELL / 2, py + CELL / 2, 0.5, px + CELL / 2, py + CELL / 2, 6);
              dg.addColorStop(0, "#e6fbff");
              dg.addColorStop(0.4, "#7fd5ff");
              dg.addColorStop(1, "rgba(127,213,255,0)");
              ctx.fillStyle = dg;
              ctx.fillRect(px + CELL / 2 - 6, py + CELL / 2 - 6, 12, 12);
            } else if (c === "o") A.drawSprite("star-garnet", px + CELL / 2, py + CELL / 2 + Math.sin(t * 5) * 1.5, 26);
          }
        ctx.strokeStyle = "rgba(240,210,170,.35)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(OX - 1, OY - 1, COLS * CELL + 2, ROWS * CELL + 2);

        ghosts.forEach((gh) => {
          if (gh.eaten) return;
          let [x, y] = pos(gh);
          if (gh.home) { x = OX + gh.start[0] * CELL + CELL / 2; y = OY + gh.start[1] * CELL + CELL / 2 + Math.sin(gh.bob) * 3; }
          const sc = scaredT > 0 && !gh.home;
          if (sc) {
            const flash = scaredT < 2 && Math.floor(t * 8) % 2;
            const sg = ctx.createRadialGradient(x, y, 2, x, y, 16);
            sg.addColorStop(0, flash ? "rgba(255,255,255,.9)" : "rgba(76,196,255,.9)");
            sg.addColorStop(1, "rgba(76,196,255,0)");
            ctx.fillStyle = sg;
            ctx.fillRect(x - 16, y - 16, 32, 32);
          }
          A.drawSprite(gh.art, x, y + Math.sin(gh.bob) * 1.5, sc ? 22 : 30, 0, sc ? 0.75 : 1);
        });
        const [px, py] = pos(player);
        const squish = player.dir ? Math.abs(Math.sin(player.mouth)) * 0.08 : 0;
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(player.face * (1 + squish), 1 - squish);
        A.drawHero(0, -1, 34 + (scaredT > 0 ? 4 : 0), deathAnim * 6, deathAnim > 0 || A.state === "dying" || A.state === "over" ? "hurt" : "happy");
        ctx.restore();
        if (scaredT > 0) {
          ctx.strokeStyle = "rgba(255,92,119,.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 19 + Math.sin(t * 10) * 2, 0, 7);
          ctx.stroke();
        }
        if (readyT > 0 && A.state === "play") {
          ctx.textAlign = "center";
          ctx.font = A.font(28);
          ctx.lineWidth = 5;
          ctx.strokeStyle = "rgba(7,7,26,.85)";
          const txt = level > 1 ? `Level ${level}!` : "Ready!";
          ctx.strokeText(txt, W / 2, OY + 12 * CELL + 6);
          ctx.fillStyle = "#FFD166";
          ctx.fillText(txt, W / 2, OY + 12 * CELL + 6);
        }
      },
    };
  },
};
