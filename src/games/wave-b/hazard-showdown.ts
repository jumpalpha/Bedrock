import type { Api, GameModule } from "../engine/types";
import { shade } from "../engine/color";

const W = 420, H = 640, ROUND_TIME = 10;
const HAZARDS = [
  { e: '🎒', t: 'Packing a Go-Bag', s: 'Water, flashlight, meds, radio', good: true, f: 'Experts say to keep at least 3 days of water and food ready in case a disaster cuts power or roads.' },
  { e: '🛡️', t: 'Drop, Cover, Hold On', s: 'Under a sturdy table when it shakes', good: true, f: 'Most earthquake injuries come from falling objects. Getting under a table protects your head and neck.' },
  { e: '🚪', t: 'Running Outside in a Quake', s: '"I\'ll just sprint out the door"', good: false, f: 'Running during shaking is how people get hit by falling glass and bricks. Drop, cover, and hold on instead.' },
  { e: '🚗', t: 'Driving Into Floodwater', s: '"It doesn\'t look that deep"', good: false, f: 'Just 30 cm of moving water can float a car. Turn around, don\'t drown.' },
  { e: '📻', t: 'Weather Alerts On', s: 'Emergency alerts turned on', good: true, f: 'Tornado and flash flood warnings can give you minutes to get to safety. Leave alerts on.' },
  { e: '🌪️', t: 'Lowest Interior Room', s: 'Basement or a room with no windows', good: true, f: 'In a tornado, get to the lowest floor and away from windows. Walls between you and the storm help.' },
  { e: '📸', t: 'Filming the Tornado', s: '"Just one more video"', good: false, f: 'Flying debris causes most tornado injuries. Take shelter first.' },
  { e: '⛈️', t: 'Indoors When Thunder Roars', s: 'Head inside at the first rumble', good: true, f: 'If you can hear thunder, you are close enough to be struck by lightning.' },
  { e: '🌳', t: 'Hiding Under a Lone Tree', s: '"The tree will keep me dry"', good: false, f: 'Lightning often strikes the tallest object around. A lone tree is one of the worst places to be.' },
  { e: '🔥', t: 'Clearing Brush Near Home', s: 'A 10 m firebreak around the house', good: true, f: 'Defensible space slows wildfires. Idaho has big fire seasons, so cleared yards save homes.' },
  { e: '🌊', t: 'Heading to High Ground', s: 'After strong coastal shaking', good: true, f: 'If the ground shakes hard near the coast, a tsunami may follow. Move inland and uphill right away.' },
  { e: '🏖️', t: 'Watching the Sea Pull Back', s: '"Look at all the shells!"', good: false, f: 'When the ocean suddenly pulls back, a tsunami wave is coming. Run to high ground.' },
  { e: '🗺️', t: 'Knowing Your Evacuation Route', s: 'Two ways out of the neighborhood', good: true, f: 'Planning routes ahead saves time when roads close from fires, floods, or landslides.' },
  { e: '🪵', t: 'Building on a Steep Bare Slope', s: '"Great view, no trees in the way"', good: false, f: 'Steep, bare slopes are prone to landslides, especially after heavy rain or wildfires.' },
  { e: '🌋', t: 'Following Volcano Warnings', s: 'Listening to USGS alerts', good: true, f: 'Scientists watch for earthquakes, gas, and ground swelling to warn people before eruptions.' }
];
const PAIRS = [
  { a: ['🚪', 'Run Outside'], b: ['🛡️', 'Drop, Cover, Hold On'], w: 1, f: 'Falling objects cause most quake injuries. Cover protects you.' },
  { a: ['🏠', 'Basement'], b: ['🚗', 'Car Under a Bridge'], w: 0, f: 'Overpasses funnel tornado winds. A basement is far safer.' },
  { a: ['⛰️', 'Climb to High Ground'], b: ['🚗', 'Drive Through Flood'], w: 0, f: 'Moving water just 30 cm deep can sweep a car away.' },
  { a: ['🌳', 'Shelter Under a Tree'], b: ['🏢', 'Go Inside a Building'], w: 1, f: 'Lightning seeks tall objects. A closed building is safe.' },
  { a: ['📻', 'Alerts On'], b: ['🔕', 'Alerts Off'], w: 0, f: 'Warnings give you precious minutes to reach safety.' },
  { a: ['🪟', 'Stand by a Window'], b: ['🚿', 'Interior Bathroom'], w: 1, f: 'Windows shatter in storms and quakes. Stay in a room without them.' },
  { a: ['🏖️', 'Explore the Bare Seafloor'], b: ['🏃', 'Run Uphill'], w: 1, f: 'A sea that pulls back fast is a tsunami warning sign.' },
  { a: ['🎒', 'Go-Bag Ready'], b: ['🤷', 'Pack Later'], w: 0, f: 'Disasters rarely give time to pack. Prepare ahead.' },
  { a: ['😷', 'Mask in Ash Fall'], b: ['🌫️', 'Breathe the Ash'], w: 0, f: 'Volcanic ash is tiny glass shards that hurt your lungs.' },
  { a: ['🔥', 'Clear Dry Brush'], b: ['🌾', 'Let Weeds Grow Tall'], w: 0, f: 'Defensible space slows wildfire near homes.' },
  { a: ['🗄️', 'Bolt Shelves to Wall'], b: ['📚', 'Loose Tall Shelves'], w: 0, f: 'Strapped furniture can\'t topple on you in a quake.' },
  { a: ['🧊', 'Cross Thin River Ice'], b: ['🌉', 'Use the Bridge'], w: 1, f: 'River ice is often thin where water moves underneath.' },
  { a: ['⚡', 'Wait 30 Min After Thunder'], b: ['⚽', 'Keep Playing'], w: 0, f: 'Lightning can strike after storms seem to pass.' },
  { a: ['🏔️', 'Ski the Closed Slope'], b: ['🚩', 'Obey Avalanche Signs'], w: 1, f: 'Avalanche warnings close slopes for a reason.' },
  { a: ['🥵', 'Hike at Noon in a Heat Wave'], b: ['🌅', 'Hike Early, Bring Water'], w: 1, f: 'Heat waves are deadly. Go early and drink water.' }
];
const MYTHS = [
  { e: '🚪', t: 'A doorway is the safest place in an earthquake.', fact: false, f: 'Modern doorways are no stronger than other walls. Get under a sturdy table instead.' },
  { e: '⚡', t: 'Lightning never strikes the same place twice.', fact: false, f: 'Tall buildings get struck many times a year. Lightning hits whatever is tallest.' },
  { e: '🪟', t: 'Opening windows protects a house from a tornado.', fact: false, f: 'It wastes time and doesn\'t help. Get to shelter right away.' },
  { e: '🌍', t: 'Scientists can predict the exact day of an earthquake.', fact: false, f: 'No one can predict quakes. Scientists can only say how likely they are in an area.' },
  { e: '🌊', t: 'A tsunami can be a series of waves hours apart.', fact: true, f: 'The first wave is often not the biggest. Stay on high ground until officials say it is safe.' },
  { e: '🌋', t: 'Idaho has volcanoes that have erupted in the last few thousand years.', fact: true, f: 'Lava at Craters of the Moon erupted about 2,100 years ago.' },
  { e: '⛰️', t: 'Wildfires can make landslides more likely.', fact: true, f: 'Burned slopes lose roots and plants that hold soil, so heavy rain can trigger debris flows.' },
  { e: '🌪️', t: 'Tornadoes can\'t cross rivers or mountains.', fact: false, f: 'Tornadoes have crossed rivers, lakes, and mountains. No place is fully safe.' },
  { e: '🚗', t: 'Most flood deaths happen in vehicles.', fact: true, f: 'Many drivers underestimate floodwater. Turn around, don\'t drown.' },
  { e: '📏', t: 'Each step up in magnitude means about 32 times more energy.', fact: true, f: 'A magnitude 7 quake releases about 32 times the energy of a magnitude 6.' },
  { e: '🌫️', t: 'Volcanic ash is soft like fireplace ash.', fact: false, f: 'Volcanic ash is tiny bits of rock and glass. It is sharp and heavy.' },
  { e: '☀️', t: 'Heat waves cause more deaths in the U.S. than most other weather.', fact: true, f: 'Extreme heat is one of the deadliest weather hazards. Stay cool and hydrated.' }
];
const TYPES: Record<string, { label: string; left?: string; right?: string }> = { choice: { label: 'PREPARED OR NOT?', left: '👎 RISKY', right: 'PREPARED 👍' }, pair: { label: 'WHICH IS SAFER?' }, myth: { label: 'MYTH OR FACT?', left: '❌ MYTH', right: 'FACT ✅' } };

type Round = { type: "choice"; q: (typeof HAZARDS)[number] } | { type: "pair"; q: (typeof PAIRS)[number]; flip: boolean } | { type: "myth"; q: (typeof MYTHS)[number] };
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const answerSide = (r: Round) => (r.type === "choice" ? (r.q.good ? 1 : 0) : r.type === "myth" ? (r.q.fact ? 1 : 0) : r.flip ? 1 - r.q.w : r.q.w);

export const hazardShowdown: GameModule = {
  config: {
    key: "bedrock_hazard_showdown",
    title: "Hazard Showdown",
    subtitle: "The natural-hazards quiz show!",
    W, H,
    winText: "10 correct answers!",
    swipe: true,
    deathDelay: 600,
    overTitle: "Out of hearts!",
    accent: "#FF8C42",
    medals: [
      { at: 1500, name: "Bronze", icon: "🥉" },
      { at: 3000, name: "Silver", icon: "🥈" },
      { at: 4500, name: "Gold", icon: "🥇" },
      { at: 5800, name: "Legend", icon: "💎" },
    ],
    howTo: "15 quick rounds: <b>Prepared or not?</b> <b>Which is safer?</b> <b>Myth or fact?</b> Answer fast for bonus points, build streaks, and get <b>10 right</b> to win!",
    controls: "← → or swipe to answer · tap the buttons · P pause",
    pad: [
      { label: "◀", type: "left", wide: true },
      { label: "Next", type: "tap" },
      { label: "▶", type: "right", wide: true },
    ],
    sprites: ["heart"],
    facts: [
      "Natural hazards like earthquakes and floods only become disasters when people are unprepared.",
      "In an earthquake: drop, cover, and hold on until the shaking stops.",
      "Turn around, don't drown: just 30 cm of moving water can sweep away a car.",
      "When thunder roars, go indoors. Lightning can strike 15 km from a storm.",
      "The USGS watches Idaho's faults and volcanoes so warnings can reach people in time.",
    ],
  },
  create() {
    let rounds: Round[] = [], idx = 0, timeLeft = ROUND_TIME, lives = 3, streak = 0, correct = 0;
    let phase: "ask" | "reveal" | "done" = "ask", phaseT = 0, pickSide: number | null = null, slide = 0;
    let feedback: { ok: boolean; text: string; timeout: boolean } | null = null;
    const host = { hurt: false, t: 0, jump: 0 };

    const startRound = () => { phase = "ask"; phaseT = 0; timeLeft = ROUND_TIME; feedback = null; pickSide = null; slide = 0; };
    function choose(side: number, A: Api) {
      if (phase !== "ask" || A.state !== "play") return;
      const r = rounds[idx], ok = side === answerSide(r);
      pickSide = side; phase = "reveal"; phaseT = 0; slide = side ? 1 : -1;
      if (ok) {
        correct++; streak++;
        const mult = streak >= 6 ? 3 : streak >= 3 ? 2 : 1, pts = Math.round((100 + timeLeft * 10) * mult);
        A.addScore(pts); A.sfx(mult > 1 ? "medal" : "coin");
        A.float(`+${pts}${mult > 1 ? " ×" + mult : ""}`, W / 2, 330, "#7CFFB2");
        A.particles.burst(W / 2, 300, "#7CFFB2", 18, 220, 4);
        if (streak === 3 || streak === 6) A.toast(`🔥 ${streak} in a row! Points ×${mult}`);
        host.hurt = false; host.jump = 1;
      } else {
        streak = 0; lives--;
        A.sfx("hit"); A.shake(6, 0.2);
        host.hurt = true;
      }
      feedback = { ok, text: r.q.f, timeout: false };
      if (correct === 10) A.win("10 correct answers!");
    }
    function next(A: Api) {
      if (lives <= 0) { A.gameOver(); return; }
      if (idx + 1 >= rounds.length) { phase = "done"; A.sfx("win"); A.gameOver(true); return; }
      idx++;
      startRound();
    }
    function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 9) {
      let line = "", yy = y, n = 0;
      for (const w of text.split(" ")) {
        const t = line ? line + " " + w : w;
        if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; if (++n >= maxLines) return yy; } else line = t;
      }
      if (line) ctx.fillText(line, x, yy);
      return yy + lh;
    }
    function panel(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number, w: number, h: number, c1: string, c2: string) {
      A.rr(x, y, w, h, 20);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    function button(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number, w: number, h: number, label: string, color: string, state: string) {
      ctx.globalAlpha = state === "dim" ? 0.35 : 1;
      A.rr(x, y, w, h, 18);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, shade(color, 0.3)); g.addColorStop(1, shade(color, -0.2));
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = "#1A1030"; ctx.font = A.font(21); ctx.textAlign = "center"; ctx.fillText(label, x + w / 2, y + h / 2 + 8);
      if (state === "right") { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; A.rr(x - 4, y - 4, w + 8, h + 8, 20); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    return {
      reset() {
        const h = shuffle(HAZARDS).slice(0, 5).map((q) => ({ type: "choice" as const, q }));
        const p = shuffle(PAIRS).slice(0, 5).map((q) => ({ type: "pair" as const, q, flip: Math.random() < 0.5 }));
        const m = shuffle(MYTHS).slice(0, 5).map((q) => ({ type: "myth" as const, q }));
        rounds = [];
        for (let i = 0; i < 5; i++) rounds.push(h[i], p[i], m[i]);
        rounds = rounds.slice(0, 3).concat(shuffle(rounds.slice(3)));
        idx = 0; lives = 3; streak = 0; correct = 0; host.hurt = false; host.jump = 0;
        startRound();
      },
      input(type, A) {
        if (phase === "ask" && phaseT > 0.4) { if (type === "left") choose(0, A); else if (type === "right") choose(1, A); }
        else if (phase === "reveal" && phaseT > 0.6 && (type === "tap" || type === "up" || type === "left" || type === "right")) next(A);
      },
      pointer(type, x, y, A) {
        if (type !== "down") return;
        if (phase === "ask") {
          const r = rounds[idx];
          if (r.type === "pair") { if (y > 170 && y < 470) choose(x < W / 2 ? 0 : 1, A); }
          else if (y > 470 && y < 560) choose(x < W / 2 ? 0 : 1, A);
        } else if (phase === "reveal" && phaseT > 0.6) next(A);
      },
      update(dt, A) {
        host.t += dt;
        host.jump = Math.max(0, host.jump - dt * 2.5);
        if (A.state !== "play") return;
        phaseT += dt;
        if (phase === "ask") {
          timeLeft = Math.max(0, timeLeft - dt);
          if (timeLeft <= 0) { streak = 0; lives--; A.sfx("hit"); host.hurt = true; phase = "reveal"; phaseT = 0; feedback = { ok: false, text: rounds[idx].q.f, timeout: true }; }
        } else if (phase === "reveal" && phaseT > 4.5) next(A);
      },
      draw(ctx, A) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#22125a"); g.addColorStop(1, "#0b0726");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        [[60, 0, 200], [360, 220, 420]].forEach(([sx, a, b]) => {
          const sg = ctx.createLinearGradient(sx, 60, sx, 600);
          sg.addColorStop(0, "rgba(255,215,0,.16)"); sg.addColorStop(1, "rgba(255,215,0,0)");
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.moveTo(sx, 60); ctx.lineTo(a, 600); ctx.lineTo(b, 600); ctx.fill();
        });
        if (!rounds.length) return;
        const r = rounds[idx], T = TYPES[r.type];
        for (let i = 0; i < 3; i++) A.drawSprite("heart", 70 + i * 24, 77, 22, 0, i < lives ? 1 : 0.2);
        ctx.font = A.font(14, 700); ctx.textAlign = "right"; ctx.fillStyle = "#a3a6c8"; ctx.fillText(`Round ${idx + 1}/${rounds.length}`, W - 64, 82);
        if (streak >= 2) { ctx.textAlign = "center"; ctx.fillStyle = "#FFD166"; ctx.fillText(`🔥 ${streak} streak${streak >= 3 ? " ×" + (streak >= 6 ? 3 : 2) : ""}`, W / 2, 104); }
        const tp = phase === "ask" ? timeLeft / ROUND_TIME : 0;
        A.rr(24, 114, W - 48, 10, 5); ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fill();
        if (tp > 0) { A.rr(24, 114, (W - 48) * tp, 10, 5); ctx.fillStyle = tp > 0.5 ? "#3FCB6B" : tp > 0.25 ? "#FFD23F" : "#FF5C77"; ctx.fill(); }
        ctx.font = A.font(13, 700);
        const cw = ctx.measureText(T.label).width + 28;
        A.rr(W / 2 - cw / 2, 136, cw, 28, 14);
        const cg = ctx.createLinearGradient(W / 2 - cw / 2, 0, W / 2 + cw / 2, 0);
        cg.addColorStop(0, "#ffd166"); cg.addColorStop(1, "#ff9f1c");
        ctx.fillStyle = cg; ctx.fill();
        ctx.fillStyle = "#2a1d00"; ctx.textAlign = "center"; ctx.fillText(T.label, W / 2, 155);

        const sl = phase === "reveal" ? Math.min(1, phaseT * 4) : 0;
        if (r.type === "pair") {
          const L = r.flip ? r.q.b : r.q.a, R = r.flip ? r.q.a : r.q.b, ans = answerSide(r);
          [L, R].forEach((c, i) => {
            const x = 22 + i * 196, y = 184, w = 180, h = 270;
            const [c1, c2] = phase === "reveal" ? (i === ans ? ["#2a8a5f", "#124a34"] : ["#7a2a4a", "#3a1020"]) : ["#2a1d66", "#140d36"];
            panel(ctx, A, x, y, w, h, c1, c2);
            ctx.font = "64px serif"; ctx.textAlign = "center"; ctx.fillText(c[0], x + w / 2, y + 100);
            ctx.fillStyle = "#fff"; ctx.font = A.font(20); wrap(ctx, c[1], x + w / 2, y + 150, w - 24, 24, 3);
            if (phase === "ask") { ctx.fillStyle = "#FFD166"; ctx.font = A.font(14, 700); ctx.fillText(i ? "Tap or ▶" : "◀ or Tap", x + w / 2, y + h - 18); }
            ctx.font = "28px serif";
            if (phase === "reveal" && i === ans) ctx.fillText("✅", x + w - 26, y + 36);
            if (phase === "reveal" && i === pickSide && i !== ans) ctx.fillText("❌", x + w - 26, y + 36);
          });
          ctx.fillStyle = "#FFD166"; ctx.font = A.font(24); ctx.textAlign = "center"; ctx.fillText("VS", W / 2, 330);
        } else {
          const q = r.q, x = 34 + slide * sl * 40, y = 184, w = W - 68, h = 270;
          ctx.save();
          ctx.translate(x + w / 2, y + h / 2); ctx.rotate(slide * sl * 0.05); ctx.translate(-(x + w / 2), -(y + h / 2));
          panel(ctx, A, x, y, w, h, "#2a1d66", "#140d36");
          ctx.font = "72px serif"; ctx.textAlign = "center"; ctx.fillText(q.e, x + w / 2, y + 100);
          ctx.fillStyle = "#fff"; ctx.font = A.font(22);
          const yy = wrap(ctx, q.t, x + w / 2, y + 150, w - 36, 28, 3);
          if ("s" in q && q.s) { ctx.fillStyle = "#a3a6c8"; ctx.font = A.font(15, 600); wrap(ctx, q.s, x + w / 2, yy + 2, w - 36, 20, 2); }
          if (phase === "ask") { ctx.fillStyle = "rgba(255,209,102,.8)"; ctx.font = A.font(13, 600); ctx.fillText("swipe ◀ or ▶", x + w / 2, y + h - 16); }
          ctx.restore();
          const ans = answerSide(r);
          button(ctx, A, 30, 478, 172, 64, T.left!, "#FF8FA3", phase === "reveal" ? (ans === 0 ? "right" : "dim") : "");
          button(ctx, A, 218, 478, 172, 64, T.right!, "#7CFFB2", phase === "reveal" ? (ans === 1 ? "right" : "dim") : "");
        }
        if (phase === "reveal" && feedback) {
          const y = r.type === "pair" ? 470 : 184, h = r.type === "pair" ? 110 : 270;
          ctx.globalAlpha = Math.min(1, phaseT * 4);
          panel(ctx, A, 24, y, W - 48, h, feedback.ok ? "#1f6b4a" : "#6a1f3e", feedback.ok ? "#0f3a2a" : "#3a0f20");
          ctx.textAlign = "center"; ctx.fillStyle = feedback.ok ? "#7CFFB2" : "#FF8FA3"; ctx.font = A.font(24);
          ctx.fillText(feedback.timeout ? "⏰ Time's up!" : feedback.ok ? "Correct!" : "Not quite!", W / 2, y + 36);
          ctx.fillStyle = "#fff"; ctx.font = A.font(16, 600); wrap(ctx, feedback.text, W / 2, y + 64, W - 90, 22, r.type === "pair" ? 2 : 7);
          if (phaseT > 0.6) { ctx.fillStyle = "#FFD166"; ctx.font = A.font(14); ctx.fillText("Tap for next →", W / 2, y + h - 12); }
          ctx.globalAlpha = 1;
        }
        const hb = Math.sin(host.t * 3) * 3 - host.jump * 18;
        ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(60, 626, 26, 5, 0, 0, 7); ctx.fill();
        A.drawHero(60, 594 + hb, 62, Math.sin(host.t * 2) * 0.05, host.hurt ? "hurt" : "happy");
        ctx.textAlign = "left"; ctx.fillStyle = "#a3a6c8"; ctx.font = A.font(13, 600);
        ctx.fillText(phase === "ask" ? "Quick! Beat the clock!" : feedback && feedback.ok ? "Nice one!" : "Now you know!", 98, 600);
        ctx.fillText(`${correct} correct`, 98, 618);
      },
    };
  },
};
