import type { Api, GameModule } from "./engine/types";
import { shade } from "./engine/color";

const COLS = 18, ROWS = 18, CELL = 24, OX = 4, OY = 72;
const W = COLS * CELL + OX * 2, H = OY + ROWS * CELL + 8;

const GOOD = ["crystal", "star-garnet", "fossil", "water-drop", "gold-nugget"] as const;
const BAD = ["lava-bomb", "meteor", "boulder", "storm-cloud", "tornado"] as const;
type Good = (typeof GOOD)[number];
const TIPS: Record<Good, string> = {
  crystal: "In a crystal, atoms line up in a repeating pattern.",
  "star-garnet": "Idaho is one of the only places on Earth with star garnets.",
  fossil: "Fossils are almost always found in sedimentary rock.",
  "water-drop": "Less than 1% of Earth's water is fresh liquid water we can use.",
  "gold-nugget": "An ore is a mineral we can mine for a profit.",
};

type P = { x: number; y: number };
const cx = (x: number) => OX + x * CELL + CELL / 2;
const cy = (y: number) => OY + y * CELL + CELL / 2;


export const spriteSnake: GameModule = {
  config: {
    key: "bedrock_sprite_snake",
    title: "Sprite Snake",
    subtitle: "Mine a chain of crystals!",
    W, H,
    winAt: 150,
    winText: "You are a master miner!",
    swipe: true,
    medals: [
      { at: 50, name: "Bronze", icon: "🥉" },
      { at: 150, name: "Silver", icon: "🥈" },
      { at: 300, name: "Gold", icon: "🥇" },
      { at: 500, name: "Legend", icon: "💎" },
    ],
    howTo: "<b>Collect gems, fossils and water</b> to grow (+10). <b>Hazards</b> like lava bombs and meteors shrink you. Don't hit the cave wall or your own tail!",
    controls: "Arrow keys / WASD · swipe on phones · P = pause",
    overTitle: "Bonk!",
    accent: "#00E5A0",
    pad: [
      { label: "◀", type: "left" },
      { label: "▲", type: "up" },
      { label: "▼", type: "down" },
      { label: "▶", type: "right" },
    ],
    sprites: [...GOOD, ...BAD],
    facts: [
      "There are over 5,000 known minerals, but only about 20 are common.",
      "On the Mohs scale, talc is the softest mineral (1) and diamond is the hardest (10).",
      "Idaho is the Gem State, with over 70 kinds of gems, including rare star garnets.",
      "A gem is a mineral that's rare, hard, and beautiful enough to be cut and polished.",
      "Granite cools slowly underground, so its crystals grow big enough to see.",
      "Idaho's state fossil is the Hagerman Horse, a zebra-like horse from about 3.5 million years ago.",
      "Your fingernail has a hardness of about 2.5. A steel nail or glass is about 5.5.",
    ],
  },
  create() {
    let snake: P[] = [];
    let dir: P = { x: 1, y: 0 }, queue: P[] = [];
    let stepT = 0, interval = 0.16, grow = 0, hazardT = 5, eaten = 0, hurtT = 0, eatAnim = 0, dead = false, clock = 0;
    let gem: (P & { kind: Good; t: number }) | null = null;
    let hazard: (P & { kind: (typeof BAD)[number]; t: number }) | null = null;
    let facing = 1;

    function freeCell(): P {
      for (let i = 0; i < 500; i++) {
        const x = Math.floor(Math.random() * COLS), y = Math.floor(Math.random() * ROWS);
        if (snake.some((s) => s.x === x && s.y === y)) continue;
        if (gem && gem.x === x && gem.y === y) continue;
        if (hazard && hazard.x === x && hazard.y === y) continue;
        return { x, y };
      }
      return { x: 0, y: 0 };
    }
    const newGem = () => ({ ...freeCell(), kind: GOOD[Math.floor(Math.random() * GOOD.length)], t: 0 });

    return {
      reset() {
        snake = [{ x: 6, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 9 }];
        dir = { x: 1, y: 0 };
        queue = [];
        stepT = 0;
        interval = 0.16;
        grow = 0;
        gem = null;
        hazard = null;
        gem = newGem();
        hazardT = 5;
        eaten = 0;
        hurtT = 0;
        eatAnim = 0;
        dead = false;
        facing = 1;
      },

      input(type) {
        const D = ({ up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } } as Record<string, P>)[type];
        if (!D) return;
        const lastD = queue.length ? queue[queue.length - 1] : dir;
        if ((D.x === -lastD.x && D.y === -lastD.y) || (D.x === lastD.x && D.y === lastD.y)) return;
        if (queue.length < 2) queue.push(D);
      },

      update(dt, A: Api) {
        clock += dt;
        if (gem) gem.t += dt;
        if (hazard) hazard.t += dt;
        hurtT = Math.max(0, hurtT - dt);
        eatAnim = Math.max(0, eatAnim - dt * 4);
        if (A.state !== "play") return;

        hazardT -= dt;
        if (!hazard && hazardT <= 0 && eaten >= 2) {
          hazard = { ...freeCell(), kind: BAD[Math.floor(Math.random() * BAD.length)], t: 0 };
          hazardT = 7;
        }
        if (hazard && hazard.t > 8) {
          hazard = null;
          hazardT = 3 + Math.random() * 4;
        }

        stepT += dt;
        if (stepT < interval) return;
        stepT -= interval;
        if (queue.length) dir = queue.shift()!;
        if (dir.x) facing = dir.x;
        const head = snake[0], nx = head.x + dir.x, ny = head.y + dir.y;
        const hitsSelf = snake.slice(0, snake.length - (grow > 0 ? 0 : 1)).some((s) => s.x === nx && s.y === ny);
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || hitsSelf) {
          dead = true;
          A.particles.burst(cx(head.x), cy(head.y), "#FFD166", 24, 220, 5);
          A.gameOver();
          return;
        }
        snake.unshift({ x: nx, y: ny });
        if (grow > 0) grow--;
        else snake.pop();

        if (gem && nx === gem.x && ny === gem.y) {
          eaten++;
          grow += 1;
          eatAnim = 1;
          A.addScore(10);
          A.sfx("coin");
          A.particles.burst(cx(nx), cy(ny), "#7CFFB2", 16, 170, 4);
          A.float("+10", cx(nx), cy(ny) - 14, "#7CFFB2");
          if (eaten % 4 === 0) A.toast("💡 " + TIPS[gem.kind]);
          gem = newGem();
          interval = Math.max(0.075, 0.16 - eaten * 0.0035);
        }
        if (hazard && nx === hazard.x && ny === hazard.y) {
          A.sfx("hit");
          A.shake(6, 0.2);
          A.particles.burst(cx(nx), cy(ny), "#FF5C77", 16, 170, 4);
          A.float("−2 length", cx(nx), cy(ny) - 14, "#FF8FA3");
          A.toast("🌋 Hazard! You lost 2 links.");
          for (let i = 0; i < 2 && snake.length > 3; i++) snake.pop();
          hurtT = 1.5;
          hazard = null;
          hazardT = 4 + Math.random() * 4;
        }
      },

      draw(ctx, A) {
        // header band
        const g = ctx.createLinearGradient(0, 0, 0, OY);
        g.addColorStop(0, "#14101c");
        g.addColorStop(1, "#2a2230");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // cave wall frame
        const hg = ctx.createLinearGradient(0, OY - 10, 0, H);
        hg.addColorStop(0, "#5a4e48");
        hg.addColorStop(1, "#2a2320");
        A.rr(0, OY - 10, W, H - OY + 10, 14);
        ctx.fillStyle = hg;
        ctx.fill();
        for (let i = 0; i < 24; i++) {
          ctx.fillStyle = i % 2 ? "#6a5e56" : "#5e534c";
          ctx.beginPath();
          ctx.arc(10 + i * 19.5, OY - 6, 9, Math.PI, 0);
          ctx.fill();
        }
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = ["#C48CFF", "#4AEDD9", "#FFD166"][i % 3];
          ctx.beginPath();
          ctx.arc(22 + i * 50, OY - 12, 3.5, 0, 7);
          ctx.fill();
        }
        // stone floor
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++) {
            ctx.fillStyle = (x + y) % 2 ? "#4a4250" : "#544b5a";
            ctx.fillRect(OX + x * CELL, OY + y * CELL, CELL, CELL);
          }
        const vg = ctx.createRadialGradient(W / 2, OY + (ROWS * CELL) / 2, 40, W / 2, OY + (ROWS * CELL) / 2, W * 0.75);
        vg.addColorStop(0, "rgba(255,220,180,.10)");
        vg.addColorStop(1, "rgba(10,5,15,.45)");
        ctx.fillStyle = vg;
        ctx.fillRect(OX, OY, COLS * CELL, ROWS * CELL);

        // gem pickup
        if (gem) {
          const b = Math.sin(gem.t * 5) * 2;
          const fg = ctx.createRadialGradient(cx(gem.x), cy(gem.y), 1, cx(gem.x), cy(gem.y), 22);
          fg.addColorStop(0, "rgba(255,255,200,.55)");
          fg.addColorStop(1, "rgba(255,255,200,0)");
          ctx.fillStyle = fg;
          ctx.fillRect(cx(gem.x) - 22, cy(gem.y) - 22, 44, 44);
          ctx.fillStyle = "rgba(0,0,0,.18)";
          ctx.beginPath();
          ctx.ellipse(cx(gem.x), cy(gem.y) + 10, 9, 3, 0, 0, 7);
          ctx.fill();
          A.drawSprite(gem.kind, cx(gem.x), cy(gem.y) - 1 + b, 32);
        }
        if (hazard) {
          const blink = hazard.t > 6 && Math.floor(hazard.t * 8) % 2;
          if (!blink) {
            const jg = ctx.createRadialGradient(cx(hazard.x), cy(hazard.y), 1, cx(hazard.x), cy(hazard.y), 20);
            jg.addColorStop(0, "rgba(255,59,92,.55)");
            jg.addColorStop(1, "rgba(255,59,92,0)");
            ctx.fillStyle = jg;
            ctx.fillRect(cx(hazard.x) - 20, cy(hazard.y) - 20, 40, 40);
            A.drawSprite(hazard.kind, cx(hazard.x), cy(hazard.y), 32, Math.sin(hazard.t * 4) * 0.12);
          }
        }

        // body
        const base = A.heroSwatch();
        for (let i = snake.length - 1; i >= 1; i--) {
          const s = snake[i], r = Math.max(6.5, 11.5 - i * 0.12);
          const x = cx(s.x), y = cy(s.y);
          const bg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
          bg.addColorStop(0, shade(base, 0.55));
          bg.addColorStop(0.55, i % 2 ? base : shade(base, -0.12));
          bg.addColorStop(1, shade(base, -0.45));
          ctx.fillStyle = "rgba(0,0,0,.18)";
          ctx.beginPath();
          ctx.ellipse(x, y + r * 0.7, r * 0.9, r * 0.35, 0, 0, 7);
          ctx.fill();
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 7);
          ctx.fill();
          if (i % 3 === 0) {
            ctx.fillStyle = "rgba(255,255,255,.35)";
            ctx.beginPath();
            ctx.ellipse(x, y - r * 0.15, r * 0.25, r * 0.5, 0.6 + Math.sin(clock * 3 + i) * 0.2, 0, 7);
            ctx.fill();
          }
        }
        // head = your sprite
        const h = snake[0];
        if (h) {
          ctx.save();
          ctx.translate(cx(h.x), cy(h.y) - 2);
          if (facing < 0) ctx.scale(-1, 1);
          A.drawHero(0, 0, 42 + eatAnim * 8, 0, dead || hurtT > 0 ? "hurt" : "happy");
          ctx.restore();
        }

        // header: length + goal
        if (A.state === "play" || A.state === "dying") {
          ctx.font = A.font(13, 700);
          ctx.textAlign = "left";
          ctx.fillStyle = "rgba(255,255,255,.7)";
          ctx.fillText(`Length ${snake.length}`, 60, 34);
        }
      },
    };
  },
};
