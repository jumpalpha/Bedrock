import type { Api, GameModule } from "../engine/types";
import { shade } from "../engine/color";

const W = 420, H = 620, N = 4, BX = 20, BY = 120, BS = 380, GAP = 10, CS = (BS - GAP * 5) / 4;
// Up the Mohs hardness scale: each merge makes a harder mineral.
const LADDER: Record<number, { art: string; name: string; bg: string }> = {
  2: { art: "mineral-talc", name: "Talc", bg: "#7a8a8f" }, 4: { art: "mineral-gypsum", name: "Gypsum", bg: "#8f7f6a" }, 8: { art: "mineral-calcite", name: "Calcite", bg: "#b88a3a" },
  16: { art: "mineral-fluorite", name: "Fluorite", bg: "#6a3ab8" }, 32: { art: "mineral-apatite", name: "Apatite", bg: "#2a8a7a" }, 64: { art: "mineral-feldspar", name: "Feldspar", bg: "#c06a5a" },
  128: { art: "mineral-quartz", name: "Quartz", bg: "#5a6ab8" }, 256: { art: "mineral-topaz", name: "Topaz", bg: "#c08a1f" }, 512: { art: "mineral-corundum", name: "Corundum", bg: "#b8253f" },
  1024: { art: "mineral-diamond", name: "Diamond", bg: "#2a8ab8" }, 2048: { art: "sprite", name: "Bedrock Legend!", bg: "#0f8a5f" },
};
const TIPS: Record<number, string> = {
  32: "Apatite (Mohs 5) is the mineral in your teeth and bones.", 64: "Feldspar (Mohs 6) is the most common mineral group in Earth's crust.", 128: "Quartz (Mohs 7) scratches glass and is common in Idaho granite.",
  256: "Topaz (Mohs 8) forms in granite and pegmatite veins.", 512: "Corundum (Mohs 9) is ruby when red and sapphire in other colors. Idaho has star garnets too!", 1024: "Diamond (Mohs 10) is pure carbon, the hardest natural mineral!",
};
const cellXY = (r: number, c: number): [number, number] => [BX + GAP + c * (CS + GAP), BY + GAP + r * (CS + GAP)];

export const mineral2048: GameModule = {
  config: {
    key: "bedrock_mineral_2048",
    title: "Mineral 2048",
    subtitle: "Merge minerals up the Mohs scale!",
    W, H,
    winText: "You reached Corundum, Mohs 9!",
    swipe: true,
    deathDelay: 400,
    overTitle: "Board full!",
    accent: "#38BDF8",
    medals: [
      { at: 2000, name: "Bronze", icon: "🥉" },
      { at: 6000, name: "Silver", icon: "🥈" },
      { at: 12000, name: "Gold", icon: "🥇" },
      { at: 22000, name: "Legend", icon: "💎" },
    ],
    howTo: "Slide the board. Two matching minerals <b>merge</b> into the next harder one on the Mohs scale. Reach 🔴 <b>Corundum (512)</b> to win. Can you pass Diamond and make the Sprite tile?",
    controls: "Arrow keys / WASD · swipe on phones · P pause",
    sprites: Object.values(LADDER).map((l) => l.art).filter((a) => a !== "sprite"),
    facts: [
      "The Mohs scale ranks minerals from 1 (talc) to 10 (diamond) by which one can scratch the other.",
      "Your fingernail is about 2.5 on the Mohs scale, so it can scratch talc and gypsum but not calcite.",
      "Hardness is just one clue geologists use; they also test luster, streak, cleavage, and color.",
      "Idaho is the Gem State, and the star garnet is its state gem.",
      "A mineral is a natural, inorganic solid with a definite chemical makeup and a crystal structure.",
    ],
  },
  create() {
    type T = { id: number; v: number; r: number; c: number; x: number; y: number; pop: number; gone?: boolean; merged?: boolean; dying?: boolean; mergeInto?: T | null };
    let tiles: T[] = [], nextId = 1, anim = 0, best = 2, over = false;
    const spr = { t: 0, jump: 0 };

    const empty = () => {
      const e: [number, number][] = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!tiles.some((t) => !t.gone && t.r === r && t.c === c)) e.push([r, c]);
      return e;
    };
    const spawn = () => {
      const e = empty();
      if (!e.length) return;
      const [r, c] = e[Math.floor(Math.random() * e.length)];
      const [x, y] = cellXY(r, c);
      tiles.push({ id: nextId++, v: Math.random() < 0.9 ? 2 : 4, r, c, x, y, pop: 0.01 });
    };
    const at = (r: number, c: number) => tiles.find((t) => !t.gone && t.r === r && t.c === c);
    const canMove = () => {
      if (empty().length) return true;
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++) {
          const t = at(r, c)!;
          if ((c < 3 && at(r, c + 1)!.v === t.v) || (r < 3 && at(r + 1, c)!.v === t.v)) return true;
        }
      return false;
    };
    function slide(dir: string, A: Api) {
      if (anim > 0 || over || A.state !== "play") return;
      const vec = ({ left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] } as Record<string, [number, number]>)[dir];
      if (!vec) return;
      tiles = tiles.filter((t) => !t.gone);
      tiles.forEach((t) => (t.merged = false));
      const order = [0, 1, 2, 3];
      const rs = vec[0] === 1 ? order.slice().reverse() : order, cs = vec[1] === 1 ? order.slice().reverse() : order;
      let any = false, gained = 0;
      for (const r of rs)
        for (const c of cs) {
          const t = at(r, c);
          if (!t) continue;
          let nr = r, nc = c;
          for (;;) {
            const tr = nr + vec[0], tc = nc + vec[1];
            if (tr < 0 || tr >= N || tc < 0 || tc >= N) break;
            const o = at(tr, tc);
            if (!o) { nr = tr; nc = tc; continue; }
            if (o.v === t.v && !o.merged && !o.dying) { nr = tr; nc = tc; o.dying = true; t.mergeInto = o; }
            break;
          }
          if (nr !== r || nc !== c) { any = true; t.r = nr; t.c = nc; }
          if (t.mergeInto) {
            const o = t.mergeInto;
            t.mergeInto = null;
            t.v *= 2; t.merged = true; t.pop = 0.01; o.gone = true; gained += t.v;
            if (t.v > best) {
              best = t.v;
              if (TIPS[t.v]) A.toast("💡 " + TIPS[t.v], 2400);
              if (t.v >= 128) { spr.jump = 1; A.sfx("medal"); }
              if (t.v === 512) A.win("You reached Corundum, Mohs 9!");
              if (t.v === 2048) A.toast("🏆 BEDROCK LEGEND! You made the Sprite tile!", 3000);
            }
            any = true;
          }
        }
      tiles.forEach((t) => (t.dying = false));
      if (!any) return;
      if (gained) { A.addScore(gained); A.sfx("coin"); } else A.sfx("swipe");
      anim = 0.11;
      setTimeout(() => { spawn(); if (!canMove()) { over = true; setTimeout(() => A.gameOver(true), 900); } }, 120);
    }
    function icon(ctx: CanvasRenderingContext2D, A: Api, art: string, x: number, y: number, size: number) {
      if (art === "sprite") A.drawHero(x, y, size * 1.15, 0, "happy");
      else A.drawSprite(art, x, y, size);
    }

    return {
      reset() { tiles = []; nextId = 1; anim = 0; best = 2; over = false; spr.t = 0; spr.jump = 0; spawn(); spawn(); },
      input(type, A) { slide(type, A); },
      update(dt) {
        spr.t += dt;
        spr.jump = Math.max(0, spr.jump - dt * 2);
        anim = Math.max(0, anim - dt);
        tiles.forEach((t) => {
          const [tx, ty] = cellXY(t.r, t.c), k = Math.min(1, dt * 30);
          t.x += (tx - t.x) * k;
          t.y += (ty - t.y) * k;
          if (t.pop) { t.pop += dt * 6; if (t.pop >= 1) t.pop = 0; }
        });
        tiles = tiles.filter((t) => !(t.gone && Math.abs(t.x - cellXY(t.r, t.c)[0]) < 1 && Math.abs(t.y - cellXY(t.r, t.c)[1]) < 1));
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#22181a");
        g.addColorStop(1, "#0c0a10");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.font = A.font(13, 600);
        ctx.textAlign = "center";
        ctx.fillStyle = "#a3a6c8";
        ctx.fillText(`Best: ${LADDER[best].name} (${best})   ·   Goal: Corundum (512)`, W / 2, 100);
        A.rr(BX, BY, BS, BS, 22);
        ctx.fillStyle = "#0d0907";
        ctx.fill();
        ctx.strokeStyle = "rgba(56,189,248,.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let r = 0; r < N; r++)
          for (let c = 0; c < N; c++) {
            const [x, y] = cellXY(r, c);
            A.rr(x, y, CS, CS, 14);
            ctx.fillStyle = "rgba(255,255,255,.05)";
            ctx.fill();
          }
        tiles
          .slice()
          .sort((a, b) => (a.gone ? 0 : 1) - (b.gone ? 0 : 1))
          .forEach((t) => {
            const L = LADDER[t.v] || LADDER[2048], s = t.pop ? 1 + Math.sin(t.pop * Math.PI) * 0.12 : 1;
            ctx.save();
            ctx.translate(t.x + CS / 2, t.y + CS / 2);
            ctx.scale(s, s);
            const tg = ctx.createLinearGradient(-CS / 2, -CS / 2, CS / 2, CS / 2);
            tg.addColorStop(0, shade(L.bg, 0.3));
            tg.addColorStop(1, shade(L.bg, -0.35));
            A.rr(-CS / 2, -CS / 2, CS, CS, 14);
            ctx.fillStyle = tg;
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,.25)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,.16)";
            A.rr(-CS / 2 + 8, -CS / 2 + 6, CS - 16, 6, 3);
            ctx.fill();
            icon(ctx, A, L.art, 0, -8, CS * 0.62);
            ctx.fillStyle = "#fff";
            ctx.font = A.font(t.v >= 1000 ? 13 : 15);
            ctx.textAlign = "center";
            ctx.fillText(String(t.v), 0, CS / 2 - 9);
            ctx.restore();
          });
        const vals = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048], lw = (W - 40) / vals.length;
        ctx.fillStyle = "#a3a6c8";
        ctx.font = A.font(11, 600);
        ctx.fillText("Mohs hardness scale", W / 2, BY + BS + 26);
        vals.forEach((v, i) => {
          ctx.globalAlpha = v <= best ? 1 : 0.28;
          icon(ctx, A, LADDER[v].art, 20 + lw * i + lw / 2, BY + BS + 52, 28);
          ctx.globalAlpha = 1;
        });
        A.drawHero(W - 44, 82 - spr.jump * 14 + Math.sin(spr.t * 3) * 2, 40, 0, over ? "hurt" : "happy");
        if (over) {
          ctx.fillStyle = "rgba(7,7,26,.65)";
          A.rr(BX, BY, BS, BS, 22);
          ctx.fill();
          ctx.fillStyle = "#FFD166";
          ctx.font = A.font(32);
          ctx.fillText("No moves left!", W / 2, BY + BS / 2);
        }
      },
    };
  },
};
