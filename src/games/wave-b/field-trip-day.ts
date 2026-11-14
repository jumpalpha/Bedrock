import type { Api, GameModule } from "../engine/types";

const W = 900, H = 480, TRACK = 392, PXM = 34;
const RIVALS = [{ name: "Quartz", color: "gold" }, { name: "Basalt", color: "sky" }, { name: "Mica", color: "violet" }];
const EVENTS = [
  { key: "sprint", name: "Lava Flow Dash", icon: "🌋", how: "Tap ◀ ▶ (or ← →) back and forth as fast as you can!", fact: "Basalt lava flows cover much of Idaho's Snake River Plain. Some at Craters of the Moon are only about 2,000 years old." },
  { key: "hurdles", name: "Boulder Hurdles", icon: "🪨", how: "You run automatically. Tap / Space to jump each boulder!", fact: "Rocks that break off cliffs pile up at the bottom as talus. Frost wedging helps pry them loose." },
  { key: "long", name: "Sandbar Jump", icon: "🏞️", how: "Mash ◀ ▶ to build speed, then tap JUMP right before the white board!", fact: "Sandbars form where a stream slows down and drops the sand it was carrying. That's deposition." },
  { key: "jav", name: "Survey Pole Toss", icon: "📍", how: "Mash ◀ ▶ to run, tap THROW at the line, then tap again to release at about 40°.", fact: "Geologists map rock layers and faults so towns know where hazards and resources are." },
  { key: "high", name: "Scarp Jump", icon: "🧗", how: "Tap when the marker is in the green zone to clear the bar. 3 misses and you're out.", fact: "Idaho's 1983 Borah Peak earthquake left a fault scarp, a step in the ground, that you can still see near Mackay." },
] as const;
type Key = (typeof EVENTS)[number]["key"];
const RIVAL_MARKS: Record<Key, number[]> = { sprint: [12.9, 12.1, 11.4], hurdles: [9.3, 8.8, 8.3], long: [6.1, 6.8, 7.4], jav: [48, 56, 64], high: [1.8, 1.95, 2.05] };
const LOWER: Partial<Record<Key, boolean>> = { sprint: true, hurdles: true };
const POINTS: Record<Key, (v: number) => number> = {
  sprint: (t) => ((20 - t) / 9.5) * 1000, hurdles: (t) => ((12.5 - t) / 5) * 1000, long: (d) => ((d - 3) / 5.2) * 1000,
  jav: (d) => ((d - 20) / 55) * 1000, high: (h) => ((h - 1.3) / 0.95) * 1000,
};
const clampPts = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
const MARK_COLORS = ["#FFD23F", "#4CC4FF", "#B49BFF"];

export const fieldTripDay: GameModule = {
  config: {
    key: "bedrock_field_trip_day",
    title: "Field Trip Day",
    subtitle: "Five geology events. One champion.",
    W, H,
    winText: "Field Trip champion!",
    deathDelay: 300,
    overTitle: "Field trip complete!",
    accent: "#FFD166",
    medals: [
      { at: 1800, name: "Bronze", icon: "🥉" },
      { at: 3000, name: "Silver", icon: "🥈" },
      { at: 3900, name: "Gold", icon: "🥇" },
      { at: 4500, name: "Legend", icon: "💎" },
    ],
    howTo: "Race 3 rival sprites through <b>5 field trip events</b>: lava flow dash, boulder hurdles, sandbar jump, survey pole toss and scarp jump. Score <b>3,000+</b> all-around to become champion!",
    controls: "← → mash to run · Space / tap to jump, throw and start · P pause",
    pad: [
      { label: "◀", type: "left", wide: true },
      { label: "JUMP / GO", type: "tap", wide: true },
      { label: "▶", type: "right", wide: true },
    ],
    facts: [
      "Geologists do fieldwork: they visit outcrops to measure, sketch and sample rock layers.",
      "A Brunton compass measures the strike and dip, or tilt, of rock layers.",
      "Field geologists use a hand lens to see the crystals and grains in a rock.",
      "Idaho's field trip spots include Craters of the Moon, Hells Canyon, and the Borah Peak fault scarp.",
      "Always tell someone your route and bring water when you head out to the field.",
    ],
  },
  create() {
    type Me = { x: number; y: number; vy: number; v: number; air: boolean; legs: number; done: boolean; time: number; hit: number; max?: number; jumpFrom?: number; jumpDist?: number; tStart?: number; clear?: boolean; jt?: number };
    type Rival = (typeof RIVALS)[number] & { x: number; v: number; legs: number; done: boolean; time: number; y: number; vy: number; air?: boolean };
    type Result = { name: string; icon: string; mark: number | null; unit: string; place: number; pts: number };
    let ev = 0, stage: "intro" | "count" | "run" | "between" | "result" | "final" = "intro", stageT = 0, results: Result[] = [];
    let me: Me = { x: 0, y: 0, vy: 0, v: 0, air: false, legs: 0, done: false, time: 0, hit: 0 };
    let rivals: Rival[] = [], cam = 0, lastKey: string | null = null, crowdT = 0, meter = 0, attempt = 1, best: number | null = null;
    let msg: { text: string; color: string; t: number } | null = null;
    let jav: { phase: "aim" | "fly" | "land"; ang: number; dir: number; runV: number; dist?: number; t?: number; dur?: number; v0?: number; rad?: number } | null = null;
    let bar = { h: 1.5, misses: 0, cleared: 0, lastClear: 0 }, hurdles: { m: number; down: boolean }[] = [];

    const key = (): Key => EVENTS[ev].key;
    function startEvent() {
      me = { x: 0, y: 0, vy: 0, v: 0, air: false, legs: 0, done: false, time: 0, hit: 0 };
      rivals = RIVALS.map((r) => ({ ...r, x: 0, v: 0, legs: Math.random() * 6, done: false, time: 0, y: 0, vy: 0 }));
      cam = 0; lastKey = null; attempt = 1; best = null; meter = 0; jav = null; msg = null;
      if (key() === "hurdles") hurdles = [12, 20, 28, 36, 44, 52].map((m) => ({ m, down: false }));
      if (key() === "high") bar = { h: 1.5, misses: 0, cleared: 0, lastClear: 0 };
      stage = "intro"; stageT = 0;
    }
    function resetAttempt() { me.x = 0; me.v = 0; me.y = 0; me.vy = 0; me.air = false; me.done = false; me.time = 0; jav = null; meter = 0; stage = "count"; stageT = 0; }
    function finishEvent(A: Api, mark: number | null) {
      const E = EVENTS[ev], k = E.key, marks = RIVAL_MARKS[k], lower = !!LOWER[k];
      const better = (a: number, b: number) => (lower ? a < b : a > b);
      const place = 1 + marks.filter((m) => (mark == null ? true : better(m, mark))).length;
      const pts = mark == null ? 0 : clampPts(POINTS[k](mark));
      results.push({ name: E.name, icon: E.icon, mark, unit: lower ? "s" : "m", place, pts });
      A.addScore(pts);
      A.sfx(place === 1 ? "win" : place <= 3 ? "medal" : "point");
      if (place <= 3) A.particles.burst(W / 2, 170, ["#FFD700", "#d9e2ec", "#e2a36b"][place - 1], 30, 300, 5);
      stage = "result"; stageT = 0;
    }
    function mash(type: string) {
      const alt = (type === "left" || type === "right") && lastKey && lastKey !== type;
      me.v = Math.min(me.max || 11.6, me.v + (alt ? 0.95 : 0.6));
      lastKey = type;
      me.legs += 0.5;
    }
    function foul(A: Api) { A.sfx("hit"); msg = { text: "FOUL!", color: "#FF5C77", t: 0 }; afterAttempt(null); }
    function afterAttempt(mark: number | null) {
      if (mark != null && (best == null || mark > best)) best = mark;
      stage = "between"; stageT = 0;
    }
    function takeoffLong(A: Api) {
      const boardM = 40, at = me.x / PXM;
      if (at > boardM + 0.2) { foul(A); return; }
      const behind = Math.max(0, boardM - at);
      if (behind > 4) msg = { text: "Too early!", color: "#FFD23F", t: 0 };
      me.air = true; me.vy = 5.2; me.jumpFrom = me.x; me.jumpDist = Math.max(0, 0.075 * me.v * me.v + 0.5 - behind);
      A.sfx("jump");
    }
    function releaseJav(A: Api) {
      const j = jav!, rad = (j.ang * Math.PI) / 180, v0 = 12 + j.runV * 1.55;
      j.phase = "fly"; j.dist = Math.max(0, (v0 * v0 * Math.sin(2 * rad)) / 9.8); j.t = 0; j.dur = Math.max(0.8, (2 * v0 * Math.sin(rad)) / 9.8); j.v0 = v0; j.rad = rad;
      A.sfx("flap");
    }
    function tryHigh(A: Api) {
      if (me.air) return;
      const q = 1 - Math.abs(meter - 0.5) / 0.5, need = Math.min(0.92, 0.35 + (bar.h - 1.5) * 0.65);
      me.air = true; me.vy = 0; me.clear = q >= need; me.jt = 0;
      A.sfx("jump");
    }
    function nextEvent(A: Api) {
      if (ev + 1 >= EVENTS.length) {
        stage = "final"; stageT = 0;
        if (results.reduce((s, r) => s + r.pts, 0) >= 3000) A.win("Field Trip champion!");
        A.sfx("win");
        return;
      }
      ev++;
      startEvent();
    }
    function runRivals(dt: number, finishM: number, k: Key) {
      rivals.forEach((r, i) => {
        if (r.done) return;
        const target = RIVAL_MARKS[k][i], top = finishM / (target - 1.3);
        r.v = Math.min(top, r.v + top * 1.6 * dt);
        r.x += r.v * PXM * dt; r.legs += r.v * dt * 1.6; r.time += dt;
        if (k === "hurdles") {
          const m = r.x / PXM;
          if (!r.air && hurdles.some((h) => h.m - m > 0.6 && h.m - m < 1.6)) { r.air = true; r.vy = 6.2; }
          if (r.air) { r.vy -= 22 * dt; r.y += r.vy * dt; if (r.y <= 0) { r.y = 0; r.air = false; } }
        }
        if (r.x / PXM >= finishM) { r.done = true; r.time = target + (Math.random() - 0.5) * 0.2; }
      });
    }

    // ---- drawing helpers ----
    const X = (m: number) => m * PXM - cam + 80;
    function runner(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number, legs: number, color: string | null, size: number, air: boolean) {
      const s = Math.sin(legs * 6);
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath(); ctx.ellipse(x, Math.max(y, TRACK - 30) + 6, size * 0.38, 5, 0, 0, 7); ctx.fill();
      const bob = air ? 0 : Math.abs(s) * 3;
      const pose = air ? "happy" : "run";
      if (color) A.drawHeroAs(color, x, y - size / 2 - bob + 4, size, 0, pose);
      else A.drawHero(x, y - size / 2 - bob + 4, size, air ? -0.15 : 0.06, pose);
    }
    function hurdle(ctx: CanvasRenderingContext2D, x: number, y: number, down: boolean, s = 1) {
      ctx.save();
      ctx.translate(x, y);
      if (down) ctx.rotate(1.2);
      // a boulder about as tall as the original hurdle
      const g = ctx.createLinearGradient(0, -34 * s, 0, 0);
      g.addColorStop(0, "#a89a8c"); g.addColorStop(1, "#5e5148");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-8 * s, 0); ctx.lineTo(-6 * s, -20 * s); ctx.lineTo(2 * s, -33 * s); ctx.lineTo(14 * s, -30 * s); ctx.lineTo(20 * s, -14 * s); ctx.lineTo(18 * s, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(30,20,14,.5)"; ctx.lineWidth = 1.5 * s; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.beginPath(); ctx.ellipse(4 * s, -25 * s, 5 * s, 2.5 * s, -0.4, 0, 7); ctx.fill();
      ctx.restore();
    }
    function pill(ctx: CanvasRenderingContext2D, A: Api, x: number, y: number, text: string) {
      ctx.font = A.font(15, 700);
      const w = ctx.measureText(text).width + 26;
      A.rr(x, y, w, 32, 16);
      ctx.fillStyle = "rgba(7,7,26,.72)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#FFD166"; ctx.textAlign = "center"; ctx.fillText(text, x + w / 2, y + 21);
    }
    function card(ctx: CanvasRenderingContext2D, A: Api, w: number, h: number): [number, number] {
      const x = (W - w) / 2, y = (H - h) / 2;
      ctx.fillStyle = "rgba(7,7,26,.5)";
      ctx.fillRect(0, 0, W, H);
      A.rr(x, y, w, h, 22);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, "rgba(23,22,52,.96)"); g.addColorStop(1, "rgba(12,12,32,.96)");
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(255,209,102,.4)"; ctx.lineWidth = 1.5; ctx.stroke();
      return [x, y];
    }
    function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, color: string, font: string) {
      ctx.font = font; ctx.fillStyle = color; ctx.textAlign = "center";
      let line = "", yy = y;
      text.split(" ").forEach((w) => { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; });
      if (line) ctx.fillText(line, x, yy);
    }

    return {
      reset() { ev = 0; results = []; crowdT = 0; startEvent(); },
      input(type, A) {
        if (type.startsWith("release")) return;
        const k = key();
        if (stage === "intro") { if (type === "tap" || type === "up") { stage = "count"; stageT = 0; } return; }
        if (stage === "result") { if (stageT > 0.8 && (type === "tap" || type === "up")) nextEvent(A); return; }
        if (stage === "final") { if (stageT > 1 && (type === "tap" || type === "up")) A.gameOver(true); return; }
        if (stage !== "run") return;
        if (k === "sprint") { if (type === "left" || type === "right" || type === "tap") mash(type); }
        else if (k === "hurdles") { if ((type === "tap" || type === "up") && !me.air) { me.air = true; me.vy = 6.4; A.sfx("jump"); } }
        else if (k === "long") {
          if (type === "left" || type === "right") mash(type);
          else if ((type === "tap" || type === "up") && !me.air) takeoffLong(A);
        } else if (k === "jav") {
          if (!jav) {
            if (type === "left" || type === "right") mash(type);
            else if (type === "tap" || type === "up") { if (me.x / PXM > 26) foul(A); else { jav = { phase: "aim", ang: 0, dir: 1, runV: me.v }; A.sfx("swipe"); } }
          } else if (jav.phase === "aim" && (type === "tap" || type === "up")) releaseJav(A);
        } else if (k === "high") { if (type === "tap" || type === "up") tryHigh(A); }
      },
      update(dt, A) {
        crowdT += dt;
        if (A.state !== "play") return;
        stageT += dt;
        if (msg) { msg.t += dt; if (msg.t > 1.4) msg = null; }
        const k = key();
        if (stage === "count") {
          if (stageT > 2.2 && (k === "sprint" || k === "hurdles")) { stage = "run"; stageT = 0; A.sfx("point"); }
          else if (stageT > 0.6 && !(k === "sprint" || k === "hurdles")) { stage = "run"; stageT = 0; }
          return;
        }
        if (stage === "between") {
          if (stageT > 1.6) {
            if (k === "high") {
              if (bar.misses >= 3) finishEvent(A, bar.cleared ? bar.lastClear : null);
              else { me.x = 0; me.air = false; me.y = 0; stage = "run"; stageT = 0; }
            } else if (attempt >= 3) finishEvent(A, best);
            else { attempt++; resetAttempt(); }
          }
          return;
        }
        if (stage !== "run") return;
        me.time += dt;
        if (k === "sprint") {
          me.v = Math.max(0, me.v - me.v * 0.8 * dt);
          me.x += me.v * PXM * dt; me.legs += me.v * dt * 1.6;
          runRivals(dt, 100, k);
          if (me.x / PXM >= 100 && !me.done) { me.done = true; finishEvent(A, Math.round(me.time * 100) / 100); }
          if (me.time > 25 && !me.done) { me.done = true; finishEvent(A, 25); }
        } else if (k === "hurdles") {
          const top = me.hit > 0 ? 5 : 9.2;
          me.v += (top - me.v) * Math.min(1, dt * (me.v < top ? 1.6 : 4));
          me.hit = Math.max(0, me.hit - dt);
          me.x += me.v * PXM * dt; me.legs += me.v * dt * 1.6;
          if (me.air) { me.vy -= 22 * dt; me.y += me.vy * dt; if (me.y <= 0) { me.y = 0; me.air = false; } }
          const m = me.x / PXM;
          hurdles.forEach((h) => {
            if (!h.down && Math.abs(h.m - m) < 0.35 && me.y < 0.75) {
              h.down = true; me.hit = 0.9; me.v = 4;
              A.sfx("hit"); A.shake(5, 0.15);
              msg = { text: "Clipped it!", color: "#FF8FA3", t: 0 };
            }
          });
          runRivals(dt, 60, k);
          if (m >= 60 && !me.done) { me.done = true; finishEvent(A, Math.round(me.time * 100) / 100); }
        } else if (k === "long") {
          if (!me.air) {
            me.v = Math.max(0, me.v - me.v * 0.7 * dt); me.max = 10.4;
            me.x += me.v * PXM * dt; me.legs += me.v * dt * 1.6;
            if (me.x / PXM > 41.5) foul(A);
          } else {
            me.vy -= 9.8 * dt; me.y += me.vy * dt;
            if (!me.tStart) me.tStart = stageT;
            const prog = Math.min(1, (stageT - me.tStart) / ((2 * 5.2) / 9.8));
            me.x = me.jumpFrom! + me.jumpDist! * PXM * prog;
            if (prog >= 1) {
              me.y = 0; me.air = false; me.tStart = 0;
              const d = Math.round(me.jumpDist! * 100) / 100;
              A.particles.burst(me.x - cam + 80, TRACK, "#f2d49b", 18, 160, 4);
              msg = { text: d.toFixed(2) + " m", color: "#FFD166", t: 0 };
              A.sfx(d > 6.5 ? "coin" : "point");
              afterAttempt(d);
            }
          }
        } else if (k === "jav") {
          if (!jav) {
            me.v = Math.max(0, me.v - me.v * 0.7 * dt); me.max = 10;
            me.x += me.v * PXM * dt; me.legs += me.v * dt * 1.6;
            if (me.x / PXM > 26.5) foul(A);
          } else if (jav.phase === "aim") {
            me.v = Math.max(0, me.v - 6 * dt); me.x += me.v * PXM * dt * 0.4;
            jav.ang += jav.dir * 70 * dt;
            if (jav.ang > 80) { jav.ang = 80; jav.dir = -1; }
            if (jav.ang < 5) { jav.ang = 5; jav.dir = 1; }
          } else if (jav.phase === "fly") {
            jav.t! += dt;
            if (jav.t! >= jav.dur!) {
              jav.phase = "land";
              const d = Math.round(jav.dist! * 10) / 10;
              msg = { text: d.toFixed(1) + " m", color: "#FFD166", t: 0 };
              A.sfx(d > 55 ? "coin" : "point");
              afterAttempt(d);
            }
          }
        } else if (k === "high") {
          meter = 0.5 + 0.5 * Math.sin(stageT * (2.4 + (bar.h - 1.5) * 4));
          if (!me.air) { me.x = Math.min(me.x + 200 * dt, 300); me.legs += dt * 8; }
          else {
            me.jt! += dt;
            if (me.jt! > 1.1) {
              me.air = false;
              if (me.clear) {
                bar.cleared++; bar.lastClear = Math.round(bar.h * 100) / 100; bar.misses = 0;
                msg = { text: `Cleared ${bar.h.toFixed(2)} m!`, color: "#7CFFB2", t: 0 };
                A.sfx("coin");
                bar.h = Math.round((bar.h + 0.1) * 100) / 100;
                if (bar.h > 2.45) { finishEvent(A, bar.lastClear); return; }
              } else {
                bar.misses++;
                msg = { text: `Knocked the bar! (${bar.misses}/3)`, color: "#FF8FA3", t: 0 };
                A.sfx("hit");
              }
              stage = "between"; stageT = 0;
            }
          }
        }
        cam += (Math.max(0, me.x - 220) - cam) * Math.min(1, dt * 6);
      },
      draw(ctx, A) {
        const k = key();
        const sky = ctx.createLinearGradient(0, 0, 0, 260);
        sky.addColorStop(0, "#4f8fd8"); sky.addColorStop(1, "#ffd9a8");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        // sun and distant buttes
        const lg = ctx.createRadialGradient(760, 60, 2, 760, 60, 110);
        lg.addColorStop(0, "rgba(255,250,220,.95)"); lg.addColorStop(0.25, "rgba(255,240,190,.6)"); lg.addColorStop(1, "rgba(255,240,190,0)");
        ctx.fillStyle = lg; ctx.fillRect(650, -50, 220, 220);
        ctx.fillStyle = "#9a7a8f";
        ctx.beginPath(); ctx.moveTo(0, 160); ctx.lineTo(60, 110); ctx.lineTo(150, 104); ctx.lineTo(200, 140); ctx.lineTo(330, 120); ctx.lineTo(380, 92); ctx.lineTo(470, 96); ctx.lineTo(520, 150); ctx.lineTo(700, 130); ctx.lineTo(780, 108); ctx.lineTo(900, 140); ctx.lineTo(900, 160); ctx.closePath(); ctx.fill();
        const off = (cam * 0.3) % 40;
        const st = ctx.createLinearGradient(0, 150, 0, 290);
        st.addColorStop(0, "#b8643a"); st.addColorStop(1, "#7a3e22");
        ctx.fillStyle = st;
        ctx.fillRect(0, 150, W, 140);
        // canyon-wall rock layers behind the classmates
        ["#d08a52", "#9a5432", "#e0b070", "#8a4a2e"].forEach((c, i) => { ctx.fillStyle = c; ctx.globalAlpha = 0.55; ctx.fillRect(0, 160 + i * 32, W, 12); });
        ctx.globalAlpha = 1;
        const cols = ["#FF5C77", "#FFD23F", "#4CC4FF", "#3FCB6B", "#B57CFF", "#fff", "#FF9F43"];
        for (let r = 0; r < 4; r++)
          for (let i = -1; i < W / 20 + 2; i++) {
            const x = i * 20 - off - (r % 2) * 10, j = Math.abs(Math.sin(crowdT * 6 + i * 1.7 + r)) * 3;
            ctx.fillStyle = cols[(i * 3 + r * 5 + 1000) % cols.length];
            ctx.beginPath(); ctx.arc(x, 182 + r * 32 - j, 7, 0, 7); ctx.fill();
          }
        ctx.fillStyle = "#4a2a18"; ctx.fillRect(0, 286, W, 10);
        ctx.fillStyle = "#8a9a5a"; ctx.fillRect(0, 296, W, 24);
        const tg = ctx.createLinearGradient(0, 320, 0, H);
        tg.addColorStop(0, "#c89a6a"); tg.addColorStop(1, "#8f6a44");
        ctx.fillStyle = tg; ctx.fillRect(0, 320, W, H - 320);
        ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2;
        [336, 352, 368, TRACK + 4, 420].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
        ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.font = A.font(12, 600); ctx.textAlign = "center";
        for (let m = 0; m <= 110; m += 10) { const x = X(m); if (x > -40 && x < W + 40) { ctx.fillRect(x - 1, 324, 2, 100); ctx.fillText(m + "m", x, 440); } }

        if (k === "sprint" || k === "hurdles") {
          const fin = k === "sprint" ? 100 : 60;
          for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#1A1030"; ctx.fillRect(X(fin) - 4, 324 + i * 10, 8, 10); }
          if (k === "hurdles") {
            hurdles.forEach((h) => hurdle(ctx, X(h.m), TRACK + 2, h.down));
            hurdles.forEach((h) => [342, 358, 374].forEach((y) => hurdle(ctx, X(h.m), y + 2, false, 0.6)));
          }
          rivals.forEach((r, i) => runner(ctx, A, X(r.x / PXM), 342 + i * 16 - r.y * PXM * 0.6, r.legs, r.color, 38, !!r.air));
        }
        if (k === "long") {
          ctx.fillStyle = "#f2d49b"; ctx.fillRect(X(41), TRACK - 10, 10 * PXM, 26);
          ctx.fillStyle = "#fff"; ctx.fillRect(X(40) - 4, TRACK - 8, 8, 22);
          ctx.fillStyle = "#FF3B5C"; ctx.fillRect(X(40.2), TRACK - 8, 4, 22);
          ctx.fillStyle = "rgba(26,16,48,.6)";
          for (let mm = 4; mm <= 9; mm++) ctx.fillText(mm + "m", X(40 + mm), TRACK + 32);
          RIVAL_MARKS.long.forEach((d, i) => { ctx.fillStyle = MARK_COLORS[i]; ctx.fillRect(X(40 + d) - 2, TRACK - 16, 4, 12); });
        }
        if (k === "jav") { ctx.fillStyle = "#fff"; ctx.fillRect(X(26.5) - 3, 324, 6, 100); }
        if (k === "high") {
          const bx = 640, hpx = bar.h * 70;
          const mg = ctx.createLinearGradient(0, TRACK - 30, 0, TRACK + 10);
          mg.addColorStop(0, "#e8cf9a"); mg.addColorStop(1, "#b8955a");
          A.rr(bx + 20, TRACK - 30, 150, 40, 10); ctx.fillStyle = mg; ctx.fill();
          ctx.fillStyle = "#fff"; ctx.fillRect(bx - 4, TRACK - hpx - 20, 6, hpx + 20); ctx.fillRect(bx + 50, TRACK - hpx - 20, 6, hpx + 20);
          ctx.strokeStyle = "#FFD23F"; ctx.lineWidth = 5;
          const knocked = stage === "between" && msg && msg.text.startsWith("Knocked");
          ctx.beginPath();
          if (knocked) { ctx.moveTo(bx, TRACK - hpx + 30); ctx.lineTo(bx + 54, TRACK - 6); } else { ctx.moveTo(bx, TRACK - hpx); ctx.lineTo(bx + 54, TRACK - hpx); }
          ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = A.font(16); ctx.fillText(bar.h.toFixed(2) + " m", bx + 27, TRACK - hpx - 28);
        }

        if (k === "jav" && jav && jav.phase !== "aim") {
          const j = jav, p = Math.min(1, j.t! / j.dur!), sx = 260, scale = 6.2;
          const dx = j.dist! * p, h = j.v0! * Math.sin(j.rad!) * (p * j.dur!) - 4.9 * Math.pow(p * j.dur!, 2);
          const x = sx + dx * scale, y = TRACK - 34 - Math.max(0, h) * scale * 0.9;
          ctx.fillStyle = "#8a9a5a"; ctx.fillRect(sx, 300, W - sx, 20);
          ctx.fillStyle = "#fff"; ctx.font = A.font(11, 600); ctx.textAlign = "center";
          for (let m = 20; m <= 90; m += 10) ctx.fillText(m + "m", sx + m * scale, 314);
          RIVAL_MARKS.jav.forEach((d, i) => { ctx.fillStyle = MARK_COLORS[i]; ctx.fillRect(sx + d * scale - 2, 296, 4, 10); });
          const vy = j.v0! * Math.sin(j.rad!) - 9.8 * p * j.dur!, vx = j.v0! * Math.cos(j.rad!), a = Math.atan2(vy, vx);
          ctx.save(); ctx.translate(x, y); ctx.rotate(-a);
          ctx.strokeStyle = "#f0e8cc"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.stroke();
          ctx.fillStyle = "#FF3B5C"; ctx.beginPath(); ctx.arc(28, 0, 3, 0, 7); ctx.fill();
          ctx.restore();
        }
        if (k === "high") {
          const hpx = bar.h * 70;
          if (!me.air) runner(ctx, A, 260 + me.x, TRACK, me.legs, null, 54, false);
          else {
            const p = Math.min(1, me.jt! / 1.1), x = 560 + p * 170, peak = me.clear ? hpx + 26 : hpx - 4;
            A.drawHero(x, TRACK - 30 - Math.sin(p * Math.PI) * peak, 54, -p * Math.PI * 1.1, me.clear ? "happy" : "hurt");
          }
        } else {
          const py = TRACK - me.y * PXM * (k === "long" ? 0.7 : 0.6);
          runner(ctx, A, X(me.x / PXM), py, me.legs, null, 56, me.air);
          if (k === "jav" && (!jav || jav.phase === "aim")) {
            const ang = jav ? jav.ang : 20, x0 = X(me.x / PXM) + 8, y0 = py - 36, r = (ang * Math.PI) / 180;
            ctx.strokeStyle = "#f0e8cc"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(x0 - Math.cos(r) * 26, y0 + Math.sin(r) * 26); ctx.lineTo(x0 + Math.cos(r) * 30, y0 - Math.sin(r) * 30); ctx.stroke();
            ctx.fillStyle = "#FF3B5C"; ctx.beginPath(); ctx.arc(x0 + Math.cos(r) * 30, y0 - Math.sin(r) * 30, 3, 0, 7); ctx.fill();
          }
        }

        // HUD
        if (stage !== "intro") {
          const E = EVENTS[ev];
          pill(ctx, A, 70, 12, `${E.icon} ${E.name} · Event ${ev + 1}/5`);
          let info = "";
          if (k === "sprint" || k === "hurdles") info = me.time.toFixed(2) + " s";
          if (k === "long" || k === "jav") info = `Attempt ${attempt}/3${best != null ? ` · Best ${best.toFixed(k === "jav" ? 1 : 2)} m` : ""}`;
          if (k === "high") info = `Bar ${bar.h.toFixed(2)} m · Misses ${bar.misses}/3`;
          if (info) pill(ctx, A, 70, 50, info);
          if ((k === "sprint" || k === "long" || (k === "jav" && !jav)) && stage === "run") {
            const v = Math.min(1, me.v / 11.6);
            A.rr(W / 2 - 150, 452, 300, 16, 8); ctx.fillStyle = "rgba(7,7,26,.7)"; ctx.fill();
            if (v > 0) { A.rr(W / 2 - 150, 452, 300 * v, 16, 8); ctx.fillStyle = v > 0.8 ? "#7CFFB2" : v > 0.5 ? "#FFD23F" : "#FF9F43"; ctx.fill(); }
            ctx.fillStyle = "#fff"; ctx.font = A.font(12, 700); ctx.textAlign = "center"; ctx.fillText("SPEED", W / 2, 465);
          }
          if (k === "jav" && jav && jav.phase === "aim") {
            const cx = W - 130, cy = 250, R = 70;
            ctx.fillStyle = "rgba(7,7,26,.78)";
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R + 10, -Math.PI / 2 - 0.1, 0.1); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#3FCB6B"; ctx.lineWidth = 10;
            ctx.beginPath(); ctx.arc(cx, cy, R - 6, (-45 * Math.PI) / 180 - 0.1, (-35 * Math.PI) / 180 + 0.1); ctx.stroke();
            const r = (jav.ang * Math.PI) / 180;
            ctx.strokeStyle = "#FFD166"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(r) * R, cy - Math.sin(r) * R); ctx.stroke();
            ctx.fillStyle = "#fff"; ctx.font = A.font(18); ctx.textAlign = "center"; ctx.fillText(Math.round(jav.ang) + "°", cx - 20, cy + 24);
            ctx.font = A.font(13, 700); ctx.fillText("Tap to release!", cx - 10, cy + 44);
          }
          if (k === "high" && stage === "run" && !me.air) {
            const x0 = W / 2 - 160, y0 = 200, w = 320, need = Math.min(0.92, 0.35 + (bar.h - 1.5) * 0.65), zone = (1 - need) * w;
            A.rr(x0, y0, w, 26, 13); ctx.fillStyle = "rgba(7,7,26,.8)"; ctx.fill();
            ctx.fillStyle = "#3FCB6B"; ctx.fillRect(x0 + w / 2 - zone / 2, y0 + 3, zone, 20);
            ctx.fillStyle = "#FFD166"; ctx.fillRect(x0 + meter * w - 3, y0 - 6, 6, 38);
            ctx.fillStyle = "#fff"; ctx.font = A.font(14, 700); ctx.textAlign = "center"; ctx.fillText("Tap in the green!", W / 2, y0 - 12);
          }
          ctx.fillStyle = "#fff"; ctx.font = A.font(16); ctx.textAlign = "center";
          if (stage === "run" && k === "long" && !me.air && me.x / PXM > 30) ctx.fillText("JUMP at the board!", W / 2, 300);
          if (stage === "run" && k === "jav" && !jav && me.x / PXM > 18) ctx.fillText("Tap THROW before the line!", W / 2, 300);
        }
        if (msg) {
          ctx.globalAlpha = Math.max(0, Math.min(1, (1.4 - msg.t) * 3));
          ctx.textAlign = "center"; ctx.font = A.font(36); ctx.lineWidth = 6; ctx.strokeStyle = "rgba(7,7,26,.85)";
          ctx.strokeText(msg.text, W / 2, 250 - msg.t * 20);
          ctx.fillStyle = msg.color; ctx.fillText(msg.text, W / 2, 250 - msg.t * 20);
          ctx.globalAlpha = 1;
        }
        if (stage === "count" && (k === "sprint" || k === "hurdles")) {
          const txt = stageT < 0.8 ? "Ready…" : stageT < 1.6 ? "Set…" : "GO!";
          ctx.textAlign = "center"; ctx.font = A.font(58); ctx.lineWidth = 8; ctx.strokeStyle = "rgba(7,7,26,.85)";
          ctx.strokeText(txt, W / 2, 240);
          ctx.fillStyle = txt === "GO!" ? "#7CFFB2" : "#FFD166"; ctx.fillText(txt, W / 2, 240);
        }
        if (stage === "intro") {
          const E = EVENTS[ev], [, y] = card(ctx, A, 520, 250);
          ctx.textAlign = "center";
          ctx.fillStyle = "#a3a6c8"; ctx.font = A.font(14, 700); ctx.fillText(`EVENT ${ev + 1} OF 5`, W / 2, y + 40);
          ctx.fillStyle = "#FFD166"; ctx.font = A.font(38); ctx.fillText(`${E.icon} ${E.name}`, W / 2, y + 86);
          wrap(ctx, E.how, W / 2, y + 124, 440, 22, "#eef0ff", A.font(16, 600));
          ctx.globalAlpha = 0.6 + Math.sin(crowdT * 5) * 0.4;
          ctx.fillStyle = "#7CFFB2"; ctx.font = A.font(17); ctx.fillText("Tap or press Space to start", W / 2, y + 222);
          ctx.globalAlpha = 1;
        }
        if (stage === "result") {
          const r = results[results.length - 1], E = EVENTS[ev], [, y] = card(ctx, A, 540, 300);
          ctx.textAlign = "center";
          ctx.fillStyle = "#FFD166"; ctx.font = A.font(30); ctx.fillText(E.name, W / 2, y + 46);
          ctx.fillStyle = "#fff"; ctx.font = A.font(40); ctx.fillText(["🥇 GOLD", "🥈 SILVER", "🥉 BRONZE", "4th place"][r.place - 1], W / 2, y + 100);
          ctx.font = A.font(18, 600); ctx.fillStyle = "#d9dbf3";
          ctx.fillText(`Your mark: ${r.mark == null ? "no mark" : r.mark.toFixed(r.unit === "s" ? 2 : E.key === "jav" ? 1 : 2) + " " + r.unit}   ·   +${r.pts} pts`, W / 2, y + 140);
          RIVALS.forEach((rv, i) => {
            const xx = W / 2 - 160 + i * 160;
            A.drawHeroAs(rv.color, xx, y + 176, 40);
            ctx.fillStyle = "#a3a6c8"; ctx.font = A.font(14, 600); ctx.fillText(`${rv.name}: ${RIVAL_MARKS[E.key][i]} ${r.unit}`, xx, y + 214);
          });
          wrap(ctx, "💡 " + E.fact, W / 2, y + 244, 460, 18, "#7fd5ff", A.font(14, 600));
          if (stageT > 0.8) { ctx.fillStyle = "#7CFFB2"; ctx.font = A.font(15); ctx.fillText(ev < 4 ? "Tap for the next event →" : "Tap for final results →", W / 2, y + 286); }
        }
        if (stage === "final") {
          const [x, y] = card(ctx, A, 560, 380), total = results.reduce((s, r) => s + r.pts, 0);
          ctx.textAlign = "center"; ctx.fillStyle = "#FFD166"; ctx.font = A.font(32); ctx.fillText("Field Trip Results", W / 2, y + 46);
          results.forEach((r, i) => {
            const yy = y + 90 + i * 40;
            ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = A.font(18, 600); ctx.fillText(`${r.icon} ${r.name}`, x + 40, yy);
            ctx.textAlign = "center"; ctx.fillText(["🥇", "🥈", "🥉", "—"][r.place - 1], x + 330, yy);
            ctx.textAlign = "right"; ctx.fillStyle = "#FFD166"; ctx.fillText(`${r.pts} pts`, x + 520, yy);
          });
          ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.beginPath(); ctx.moveTo(x + 40, y + 292); ctx.lineTo(x + 520, y + 292); ctx.stroke();
          ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = A.font(26); ctx.fillText(`All-around: ${total.toLocaleString()}`, W / 2, y + 328);
          ctx.fillStyle = total >= 3000 ? "#7CFFB2" : "#a3a6c8"; ctx.font = A.font(15, 600);
          ctx.fillText(total >= 3000 ? "🏆 Champion! Quest complete." : "Score 3,000+ to become Field Trip champion.", W / 2, y + 354);
          if (stageT > 1) { ctx.fillStyle = "#7CFFB2"; ctx.font = A.font(14); ctx.fillText("Tap to finish", W / 2, y + 374); }
        }
      },
    };
  },
};
