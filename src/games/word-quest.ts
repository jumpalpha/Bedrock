import type { Api, GameModule } from "./engine/types";
import { loadTerms } from "./earth-quiz";

const W = 420, H = 660;
// Curated Earth science words with a fact each. Five-letter terms from the class glossary (glossary.json) are
// merged in at runtime with their definitions, so the pool grows with the course. Word/definition game → glossary,
// not the review bank (see earth-quiz.ts).
const WORDS: Record<string, string> = {
  MAGMA: "Magma is melted rock underground. Once it reaches the surface it's called lava.",
  CRUST: "Earth's crust is its thin, rocky outer layer, as thin as an apple's skin by comparison.",
  FAULT: "A fault is a break in rock where the two sides have moved. Earthquakes happen along faults.",
  DELTA: "A delta is a fan of sediment dropped where a river slows down at a lake or ocean.",
  SHALE: "Shale is the most common sedimentary rock. It forms from mud and clay.",
  SLATE: "Slate is shale changed by heat and pressure. It splits into flat sheets.",
  OCEAN: "Oceans cover about 71% of Earth's surface.",
  STORM: "Thunderstorms need moisture, rising air and an unstable atmosphere.",
  CLOUD: "Clouds are tiny water droplets or ice crystals that condensed on bits of dust.",
  ORBIT: "Earth takes about 365.25 days to orbit the Sun once.",
  COMET: "Comets are icy bodies that grow glowing tails when they near the Sun.",
  QUAKE: "Idaho's biggest recorded earthquake was the 1983 Borah Peak quake, magnitude 6.9.",
  PLATE: "Earth's lithosphere is broken into about a dozen large tectonic plates.",
  TIDES: "Tides are caused mainly by the Moon's gravity pulling on Earth's oceans.",
  OZONE: "The ozone layer in the stratosphere blocks most of the Sun's harmful UV light.",
  FLOOD: "About 15,000 years ago, the Bonneville Flood roared down the Snake River Canyon.",
  RIVER: "The Snake River flows over 1,000 miles, much of it across southern Idaho.",
  EARTH: "Earth is about 4.6 billion years old.",
  STONE: "A rock is made of one or more minerals or other natural materials.",
  GEODE: "A geode is a hollow rock lined with crystals that grew inward.",
  LAHAR: "A lahar is a fast mudflow of volcanic ash and water.",
  PLUME: "A mantle plume of hot rock feeds the Yellowstone hotspot.",
  SLOPE: "The steeper the slope, the more likely a landslide.",
  CLIFF: "Waves undercut sea cliffs until the rock above collapses.",
  DUNES: "Sand dunes form where wind drops the sand it carries. Bruneau Dunes in Idaho is 470 feet tall.",
  SHORE: "Longshore currents move sand along the shore like a conveyor belt.",
  CORAL: "Coral reefs are built by tiny animals that make limestone skeletons.",
  LUNAR: "A lunar eclipse happens when Earth's shadow falls on the Moon.",
  SOLAR: "Solar energy drives Earth's weather and the water cycle.",
  FROST: "Frost forms when water vapor turns straight into ice on a cold surface.",
  SLEET: "Sleet is rain that freezes into ice pellets before it lands.",
  TOPAZ: "Topaz is an 8 on the Mohs hardness scale.",
  AGATE: "Agate is a banded form of quartz that often fills holes in volcanic rock.",
  FLINT: "Flint is a hard form of quartz that people once chipped into tools.",
  CHALK: "Chalk is a soft limestone made from the shells of tiny sea creatures.",
  VAPOR: "Water vapor is an invisible gas, and it's also a greenhouse gas.",
  EPOCH: "Geologic time is split into eons, eras, periods and epochs.",
  ERODE: "Wind, water and ice erode rock and carry it away.",
  BASIN: "The Great Basin has no outlet to the sea. Its rivers end in lakes or sink into the ground.",
  HUMID: "Humidity is the amount of water vapor in the air.",
};

const LIST = Object.keys(WORDS).filter((w) => w.length === 5);
let glossaryMerged = false;
function mergeGlossary() {
  if (glossaryMerged) return;
  glossaryMerged = true;
  loadTerms().then((terms) => {
    terms.forEach(({ term, def }) => {
      const w = term.toUpperCase();
      if (!/^[A-Z]{5}$/.test(w) || WORDS[w]) return;
      WORDS[w] = `${term}: ${def}`;
      LIST.push(w);
    });
  }).catch(() => {});
}

const ROWS = 6, TILE = 56, GAP = 7, GX = (W - (5 * TILE + 4 * GAP)) / 2, GY = 92, ROUNDS = 5;
const KB = ["QWERTYUIOP", "ASDFGHJKL", "⏎ZXCVBNM⌫"];
type St = "correct" | "present" | "absent";
const COL: Record<St, [string, string]> = { correct: ["#5ee07a", "#2a9a4a"], present: ["#ffe27a", "#d6a400"], absent: ["#3a3028", "#1c1612"] };

export const wordQuest: GameModule = {
  config: {
    key: "bedrock_word_quest",
    title: "Word Quest",
    subtitle: "Guess the Earth science word!",
    W, H,
    winText: "3 Earth science words solved!",
    deathDelay: 600,
    overTitle: "Quest over!",
    accent: "#3FCB6B",
    medals: [
      { at: 600, name: "Bronze", icon: "🥉" },
      { at: 1400, name: "Silver", icon: "🥈" },
      { at: 2200, name: "Gold", icon: "🥇" },
      { at: 2900, name: "Legend", icon: "💎" },
    ],
    howTo: "Guess the 5-letter Earth science word in 6 tries. 🟩 right spot · 🟨 in the word · ⬛ not in it. Up to 5 words, 3 hearts. <b>Solve 3</b> to win!",
    controls: "Type on your keyboard or tap the letters · Enter to guess",
    sprites: ["heart"],
    facts: [
      "Word games help build vocabulary and memory.",
      "Knowing science vocabulary makes news about earthquakes and storms easier to follow.",
      "Many Earth science words come from Greek or Latin: \"geo\" means Earth.",
      "Saying a new term out loud and using it in a sentence helps it stick.",
      "Every 5-letter term from your class glossary can show up here.",
    ],
  },
  create() {
    mergeGlossary();
    let word = "", guesses: { w: string; res: St[] }[] = [], cur = "", keyState: Record<string, St> = {}, lives = 3, solved = 0, roundNo = 1;
    let phase: "play" | "done" = "play", phaseT = 0, shakeT = 0, revealT = 0, used: string[] = [], msg: { t: number; text: string } | null = null;
    const host = { hurt: false, t: 0, jump: 0 };

    const pickWord = () => { const pool = LIST.filter((w) => !used.includes(w)); const w = pool[Math.floor(Math.random() * pool.length)]; used.push(w); return w; };
    const startRound = () => { word = pickWord(); guesses = []; cur = ""; keyState = {}; phase = "play"; phaseT = 0; revealT = 0; msg = null; };
    function score(g: string): St[] {
      const res: St[] = Array(5).fill("absent"), left: Record<string, number> = {};
      for (let i = 0; i < 5; i++) { if (g[i] === word[i]) res[i] = "correct"; else left[word[i]] = (left[word[i]] || 0) + 1; }
      for (let i = 0; i < 5; i++) if (res[i] !== "correct" && left[g[i]]) { res[i] = "present"; left[g[i]]--; }
      return res;
    }
    function typeKey(ch: string, A: Api) {
      if (phase !== "play" || revealT > 0 || A.state !== "play") return;
      if (ch === "⌫") { cur = cur.slice(0, -1); return; }
      if (ch === "⏎") { submit(A); return; }
      if (cur.length < 5 && /^[A-Z]$/.test(ch)) { cur += ch; A.sfx("click"); }
    }
    function submit(A: Api) {
      if (cur.length < 5) { shakeT = 0.4; msg = { t: 0, text: "Need 5 letters" }; return; }
      const res = score(cur);
      guesses.push({ w: cur, res });
      revealT = 1.1;
      const rank = { absent: 1, present: 2, correct: 3 };
      res.forEach((r, i) => { const k = cur[i]; if (!keyState[k] || rank[r] > rank[keyState[k]]) keyState[k] = r; });
      const g = cur;
      cur = "";
      setTimeout(() => {
        if (A.state !== "play") return;
        if (g === word) {
          solved++;
          const pts = (7 - guesses.length) * 100 + (solved >= 2 ? 100 : 0);
          A.addScore(pts); A.sfx("win"); host.hurt = false; host.jump = 1;
          A.particles.burst(W / 2, GY + guesses.length * (TILE + GAP), "#FFD166", 30, 280, 5);
          A.float("+" + pts, W / 2, GY + 170, "#7CFFB2");
          if (solved === 3) A.win("3 Earth science words solved!");
          phase = "done"; phaseT = 0;
          msg = { t: 0, text: ["Genius!", "Amazing!", "Great!", "Nice!", "Phew!", "Just made it!"][guesses.length - 1] };
        } else if (guesses.length >= ROWS) {
          lives--; A.sfx("hit"); host.hurt = true;
          phase = "done"; phaseT = 0; msg = { t: 0, text: "The word was " + word };
        } else A.sfx("swipe");
      }, 1000);
    }
    function nextRound(A: Api) {
      if (lives <= 0) { A.gameOver(); return; }
      if (roundNo >= ROUNDS) { A.gameOver(true); return; }
      roundNo++; host.hurt = false; startRound();
    }
    function keyRects() {
      const rects: { k: string; x: number; y: number; w: number; h: number }[] = [], top = 476, kh = 50, kg = 5;
      KB.forEach((r, ri) => {
        const keys = r.split(""), unit = (W - 16 - kg * 9) / 10;
        const widths = keys.map((k) => (k === "⏎" || k === "⌫" ? unit * 1.5 : unit));
        let x = (W - (widths.reduce((a, b) => a + b, 0) + kg * (keys.length - 1))) / 2;
        keys.forEach((k, i) => { rects.push({ k, x, y: top + ri * (kh + kg), w: widths[i], h: kh }); x += widths[i] + kg; });
      });
      return rects;
    }
    function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
      let line = "", yy = y;
      text.split(" ").forEach((w) => { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; });
      if (line) ctx.fillText(line, x, yy);
    }
    function fillTile(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number, w: number, h: number, r: number, st: St) {
      A.rr(x, y, w, h, r);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, COL[st][0]); g.addColorStop(1, COL[st][1]);
      ctx.fillStyle = g; ctx.fill();
    }

    return {
      reset() { lives = 3; solved = 0; roundNo = 1; used = []; host.hurt = false; host.jump = 0; startRound(); },
      input(type, A) { if (phase === "done" && phaseT > 1.2 && (type === "tap" || type === "up")) nextRound(A); },
      key(code, A) {
        if (phase === "done") { if (code === "Enter" && phaseT > 1.2) nextRound(A); return; }
        const m = code.match(/^Key([A-Z])$/);
        if (m) typeKey(m[1], A);
        else if (code === "Backspace") typeKey("⌫", A);
        else if (code === "Enter" || code === "NumpadEnter") typeKey("⏎", A);
      },
      pointer(t, x, y, A) {
        if (t !== "down") return;
        if (phase === "done" && phaseT > 1.2) { nextRound(A); return; }
        const k = keyRects().find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (k) typeKey(k.k, A);
      },
      update(dt, A) {
        host.t += dt; host.jump = Math.max(0, host.jump - dt * 2);
        if (A.state !== "play") return;
        phaseT += dt; revealT = Math.max(0, revealT - dt); shakeT = Math.max(0, shakeT - dt);
        if (msg) { msg.t += dt; if (msg.t > 2.2 && phase === "play") msg = null; }
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#2a1c14"); g.addColorStop(1, "#0d0806");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 3; i++) A.drawSprite("heart", 66 + i * 22, 75, 20, 0, i < lives ? 1 : 0.2);
        ctx.font = A.font(14, 700); ctx.textAlign = "right"; ctx.fillStyle = "#a3a6c8";
        ctx.fillText(`Word ${roundNo}/${ROUNDS} · ${solved} solved`, W - 62, 80);
        A.drawHero(38, 72 + Math.sin(host.t * 3) * 2 - host.jump * 8, 30, 0, host.hurt ? "hurt" : "happy");
        for (let r = 0; r < ROWS; r++) {
          const sx = r === guesses.length && shakeT > 0 ? Math.sin(shakeT * 60) * 6 : 0;
          for (let c = 0; c < 5; c++) {
            const x = GX + c * (TILE + GAP) + sx, y = GY + r * (TILE + GAP);
            let ch = "", st: St | null = null, sy = 1;
            if (r < guesses.length) { ch = guesses[r].w[c]; st = guesses[r].res[c]; }
            else if (r === guesses.length) ch = cur[c] || "";
            if (r === guesses.length - 1 && revealT > 0) {
              const p = 1.1 - revealT - c * 0.18;
              if (p < 0) st = null;
              else if (p < 0.2) { sy = Math.abs(Math.cos((p / 0.2) * Math.PI)); if (p < 0.1) st = null; }
            }
            ctx.save();
            ctx.translate(x + TILE / 2, y + TILE / 2);
            ctx.scale(1, sy);
            if (st) fillTile(ctx, A, -TILE / 2, -TILE / 2, TILE, TILE, 12, st);
            else {
              A.rr(-TILE / 2, -TILE / 2, TILE, TILE, 12);
              ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fill();
              ctx.lineWidth = 2; ctx.strokeStyle = ch ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.12)"; ctx.stroke();
            }
            if (ch) {
              ctx.fillStyle = st === "present" ? "#2a1d00" : "#fff";
              ctx.font = A.font(28); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ch, 0, 2); ctx.textBaseline = "alphabetic";
            }
            ctx.restore();
          }
        }
        keyRects().forEach((r) => {
          const st = keyState[r.k];
          if (st) fillTile(ctx, A, r.x, r.y, r.w, r.h, 10, st);
          else { A.rr(r.x, r.y, r.w, r.h, 10); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fill(); }
          ctx.fillStyle = st === "present" ? "#2a1d00" : "#fff";
          ctx.font = A.font(r.k === "⏎" || r.k === "⌫" ? 18 : 17); ctx.textAlign = "center";
          ctx.fillText(r.k, r.x + r.w / 2, r.y + r.h / 2 + 6);
        });
        if (msg) {
          ctx.globalAlpha = Math.min(1, msg.t * 5);
          ctx.font = A.font(16);
          const w = ctx.measureText(msg.text).width + 28;
          A.rr(W / 2 - w / 2, 440, w, 30, 15);
          const mg = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
          mg.addColorStop(0, "#ffd166"); mg.addColorStop(1, "#ff9f1c");
          ctx.fillStyle = mg; ctx.fill();
          ctx.fillStyle = "#2a1d00"; ctx.textAlign = "center"; ctx.fillText(msg.text, W / 2, 460);
          ctx.globalAlpha = 1;
        }
        if (phase === "done" && phaseT > 0.3) {
          ctx.globalAlpha = Math.min(1, (phaseT - 0.3) * 4);
          ctx.fillStyle = "rgba(7,7,26,.9)"; ctx.fillRect(0, 470, W, H - 470);
          ctx.textAlign = "center"; ctx.fillStyle = "#FFD166"; ctx.font = A.font(28); ctx.fillText(word, W / 2, 512);
          ctx.fillStyle = "#fff"; ctx.font = A.font(15, 600); wrap(ctx, "💡 " + (WORDS[word] || ""), W / 2, 542, W - 50, 20);
          if (phaseT > 1.2) {
            ctx.fillStyle = "#7CFFB2"; ctx.font = A.font(15);
            ctx.fillText(lives <= 0 ? "Tap to finish" : roundNo >= ROUNDS ? "Tap to see your score" : "Tap or press Enter for the next word →", W / 2, 630);
          }
          ctx.globalAlpha = 1;
        }
      },
    };
  },
};
