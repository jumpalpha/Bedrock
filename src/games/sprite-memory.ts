import type { Api, GameModule } from "./engine/types";

const W = 420, H = 640;
const LEVELS = [{ cols: 4, rows: 4, time: 75 }, { cols: 4, rows: 5, time: 95 }, { cols: 5, rows: 6, time: 140 }];
const ITEMS: [string, string, string][] = [
  ["crystal", "Crystal", "In a crystal, atoms repeat in a regular pattern."], ["water-drop", "Water", "Water is the only substance found naturally as a solid, liquid and gas on Earth."],
  ["fossil", "Fossil", "Most fossils are found in sedimentary rock."], ["star-garnet", "Garnet", "The star garnet is Idaho's state gem."],
  ["gold-nugget", "Gold", "Gold is dense, so it settles to the bottom of streams and gold pans."], ["geode", "Geode", "Geodes are hollow rocks lined with crystals."],
  ["lava-bomb", "Lava Bomb", "Lava bombs cool into streamlined shapes as they fly."], ["meteor", "Meteor", "A meteor that reaches the ground is called a meteorite."],
  ["boulder", "Boulder", "A boulder is any rock bigger than about 25 cm across."], ["storm-cloud", "Storm", "Thunderstorms grow from tall cumulonimbus clouds."],
  ["tornado", "Tornado", "Tornadoes are rated on the Enhanced Fujita (EF) scale."], ["volcano", "Volcano", "Most volcanoes form where tectonic plates meet."],
  ["snowflake", "Snow", "Snowflakes are ice crystals with six sides."], ["compass", "Compass", "A compass needle points to magnetic north, not the North Pole."],
  ["pickaxe", "Pickaxe", "Geologists use a rock hammer to break off fresh samples."],
]

export const spriteMemory: GameModule = {
  config: {
    key: "bedrock_sprite_memory",
    title: "Sprite Memory",
    subtitle: "Match the Earth science pairs before time runs out!",
    W, H,
    winText: "You cleared 2 memory levels!",
    deathDelay: 600,
    overTitle: "Time's up!",
    accent: "#A855F7",
    medals: [
      { at: 2000, name: "Bronze", icon: "🥉" },
      { at: 5000, name: "Silver", icon: "🥈" },
      { at: 9000, name: "Gold", icon: "🥇" },
      { at: 13000, name: "Legend", icon: "💎" },
    ],
    howTo: "Tap two cards to flip them. Match the pairs! Matches in a row build a <b>combo</b>. Leftover time is bonus points. <b>Clear 2 levels</b> to win!",
    controls: "Tap or click cards · or arrows + Space · P pause",
    sprites: ITEMS.map((i) => i[0]),
    facts: [
      "Geologists remember rock types by linking each one to how it formed.",
      "Memory games give your working memory a workout.",
      "Geologists sort rocks by matching features like color, grain size and layering.",
      "Short study sessions spread over several days beat one long cram session.",
      "Making a picture in your head of a new word helps you remember it.",
    ],
  },
  create() {
    type Card = { art: string; name: string; fact: string; up: number; target: number; matched: boolean; shake: number; x: number; y: number; w: number; h: number };
    let cards: Card[] = [], open: Card[] = [], lock = 0, level = 0, timeLeft = 0, combo = 0, cursor = 0;
    let phase: "play" | "clear" | "out" = "play", phaseT = 0, pointerTap = false, kbUsed = false;
    const host = { t: 0 };

    function buildLevel(n: number) {
      const L = LEVELS[n], pairs = (L.cols * L.rows) / 2;
      const pick = ITEMS.slice().sort(() => Math.random() - 0.5).slice(0, pairs);
      const deck: Card[] = pick.concat(pick).map((it) => ({ art: it[0], name: it[1], fact: it[2], up: 0, target: 0, matched: false, shake: 0, x: 0, y: 0, w: 0, h: 0 })).sort(() => Math.random() - 0.5);
      const gap = 8, top = 112, avail = H - top - 30;
      const cw = Math.min((W - 24 - gap * (L.cols - 1)) / L.cols, (avail - gap * (L.rows - 1)) / L.rows / 1.15), ch = cw * 1.15;
      const gx = (W - (L.cols * cw + gap * (L.cols - 1))) / 2;
      deck.forEach((c, i) => { c.x = gx + (i % L.cols) * (cw + gap); c.y = top + Math.floor(i / L.cols) * (ch + gap); c.w = cw; c.h = ch; });
      cards = deck; open = []; timeLeft = L.time; combo = 0; cursor = 0; phase = "play"; phaseT = 0;
      cards.forEach((c) => (c.target = 1));
      lock = 1.3;
      setTimeout(() => { if (cards === deck) deck.forEach((c) => { if (!c.matched) c.target = 0; }); }, 1100);
    }
    function levelClear(A: Api) {
      const bonus = Math.round(timeLeft) * 10;
      A.addScore(250 + bonus); A.sfx("win");
      phase = "clear"; phaseT = 0;
      if (level === 1) A.win("You cleared 2 memory levels!");
      A.float(`Level clear! +${250 + bonus}`, W / 2, 330, "#FFD166");
    }
    function flip(i: number, A: Api) {
      if (phase !== "play" || lock > 0 || A.state !== "play") return;
      const c = cards[i];
      if (!c || c.matched || c.target === 1) return;
      c.target = 1;
      open.push(c);
      A.sfx("swipe");
      if (open.length === 2) {
        const [a, b] = open;
        lock = 0.6;
        setTimeout(() => {
          if (a.art === b.art) {
            a.matched = b.matched = true;
            combo++;
            const pts = 100 + (combo - 1) * 50;
            A.addScore(pts); A.sfx(combo > 2 ? "medal" : "coin");
            A.float(`+${pts}${combo > 1 ? " combo ×" + combo : ""}`, (a.x + b.x) / 2 + a.w / 2, Math.min(a.y, b.y), "#7CFFB2");
            A.particles.burst(a.x + a.w / 2, a.y + a.h / 2, "#FFD166", 10, 160, 3);
            A.particles.burst(b.x + b.w / 2, b.y + b.h / 2, "#FFD166", 10, 160, 3);
            if (Math.random() < 0.4) A.toast("💡 " + a.fact, 2200);
            if (cards.every((x) => x.matched)) levelClear(A);
          } else {
            combo = 0;
            a.shake = b.shake = 0.35;
            setTimeout(() => { a.target = 0; b.target = 0; }, 350);
          }
          open = [];
        }, 450);
      }
    }
    function nextLevel(A: Api) {
      if (level + 1 >= LEVELS.length) { A.gameOver(true); return; }
      level++;
      buildLevel(level);
      A.toast(`Level ${level + 1}: ${(LEVELS[level].cols * LEVELS[level].rows) / 2} pairs!`);
    }

    return {
      reset() { level = 0; buildLevel(0); },
      key(code) { if (/Arrow/.test(code)) kbUsed = true; },
      input(type, A) {
        const L = LEVELS[level];
        if (phase === "clear" && phaseT > 1.2 && (type === "tap" || type === "up")) { nextLevel(A); return; }
        if (type === "left") cursor = Math.max(0, cursor - 1);
        else if (type === "right") cursor = Math.min(cards.length - 1, cursor + 1);
        else if (type === "up") cursor = Math.max(0, cursor - L.cols);
        else if (type === "down") cursor = Math.min(cards.length - 1, cursor + L.cols);
        else if (type === "tap" && !pointerTap) flip(cursor, A);
        pointerTap = false;
      },
      pointer(t, x, y, A) {
        if (t !== "down") return;
        pointerTap = true;
        if (phase === "clear" && phaseT > 1.2) { nextLevel(A); return; }
        const i = cards.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
        if (i >= 0) { cursor = i; flip(i, A); }
      },
      update(dt, A) {
        host.t += dt;
        cards.forEach((c) => { c.up += (c.target - c.up) * Math.min(1, dt * 14); c.shake = Math.max(0, c.shake - dt); });
        if (A.state !== "play") return;
        phaseT += dt;
        lock = Math.max(0, lock - dt);
        if (phase === "play") { timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; phase = "out"; A.gameOver(); } }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#2a1a14"); g.addColorStop(1, "#0d0806");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const L = LEVELS[level];
        ctx.font = A.font(14, 700); ctx.textAlign = "left"; ctx.fillStyle = "#a3a6c8";
        ctx.fillText(`Level ${level + 1}/3 · ${cards.filter((c) => c.matched).length / 2}/${cards.length / 2} pairs`, 62, 80);
        const tp = timeLeft / L.time;
        A.rr(20, 92, W - 40, 8, 4); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fill();
        if (tp > 0) { A.rr(20, 92, (W - 40) * tp, 8, 4); ctx.fillStyle = tp > 0.5 ? "#3FCB6B" : tp > 0.25 ? "#FFD23F" : "#FF5C77"; ctx.fill(); }
        ctx.textAlign = "right"; ctx.fillStyle = tp < 0.25 ? "#FF8FA3" : "#fff"; ctx.fillText(Math.ceil(timeLeft) + "s", W - 62, 80);
        cards.forEach((c, i) => {
          const sx = Math.cos(c.up * Math.PI), front = c.up > 0.5, sh = c.shake ? Math.sin(c.shake * 60) * 4 : 0;
          ctx.save();
          ctx.translate(c.x + c.w / 2 + sh, c.y + c.h / 2);
          ctx.scale(Math.max(0.02, Math.abs(sx)), 1);
          A.rr(-c.w / 2, -c.h / 2, c.w, c.h, 14);
          const cg = ctx.createLinearGradient(0, -c.h / 2, 0, c.h / 2);
          if (front) {
            cg.addColorStop(0, c.matched ? "#2a8a5f" : "#4a3a30"); cg.addColorStop(1, c.matched ? "#124a34" : "#241a14");
            ctx.fillStyle = cg; ctx.fill();
            A.drawSprite(c.art, 0, -c.h * 0.08, c.w * 0.7);
            ctx.fillStyle = "#fff"; ctx.font = A.font(Math.round(c.w * 0.15), 700); ctx.textAlign = "center";
            ctx.fillText(c.name, 0, c.h / 2 - c.h * 0.1);
          } else {
            cg.addColorStop(0, "#c2703d"); cg.addColorStop(1, "#7a3e1c");
            ctx.fillStyle = cg; ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2;
            A.rr(-c.w / 2 + 6, -c.h / 2 + 6, c.w - 12, c.h - 12, 10); ctx.stroke();
            A.drawHero(0, 0, c.w * 0.6, 0, "happy");
          }
          ctx.restore();
          if (i === cursor && kbUsed) { ctx.strokeStyle = "#FFD166"; ctx.lineWidth = 3; A.rr(c.x - 4, c.y - 4, c.w + 8, c.h + 8, 16); ctx.stroke(); }
        });
        if (phase === "clear" && phaseT > 0.5) {
          ctx.fillStyle = "rgba(7,7,26,.65)"; ctx.fillRect(0, 0, W, H);
          ctx.textAlign = "center"; ctx.font = A.font(32); ctx.lineWidth = 6; ctx.strokeStyle = "rgba(7,7,26,.9)";
          const t = level + 1 >= LEVELS.length ? "All levels cleared!" : `Level ${level + 1} cleared!`;
          ctx.strokeText(t, W / 2, 300); ctx.fillStyle = "#FFD166"; ctx.fillText(t, W / 2, 300);
          A.drawHero(W / 2, 370 + Math.sin(host.t * 4) * 6, 90, 0, "happy");
          if (phaseT > 1.2) { ctx.fillStyle = "#7CFFB2"; ctx.font = A.font(17); ctx.fillText("Tap to continue →", W / 2, 452); }
        }
      },
    };
  },
};
