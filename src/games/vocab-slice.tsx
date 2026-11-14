"use client";

import { useEffect, useState } from "react";
import { ArcadeGame } from "./engine/arcade-game";
import type { Api, GameModule } from "./engine/types";
import { capFirst, loadReviewDeck, loadVocab, maskTerm, shuffle, type ReviewDeck, type Vocab } from "./earth-quiz";

// Two modes, picked in the chapter menu: vocab (glossary term ↔ definition, value "1".."28"/"all") and
// review (the chapter review bank's questions with their own 4 choices, value "r:1".."r:28"/"r:all").
let VOCAB: Vocab = {}, REVIEW: ReviewDeck = {};
const valid = (v: string) => (v.startsWith("r:") ? v === "r:all" || !!REVIEW[v.slice(2)] : v === "all" || !!VOCAB[v]);
const vocab = () => VOCAB;
let chosenChapter = "1";

const W = 420, H = 640, WIN_TERMS = 10;
const ROCKS = ["crystal", "star-garnet", "geode", "gold-nugget", "fossil", "meteor", "boulder"];
const DUST: Record<string, string> = { crystal: "#c48cff", "star-garnet": "#ff3b5c", geode: "#a46bff", "gold-nugget": "#ffd23f", fossil: "#e6cfa0", meteor: "#ff8a3c", boulder: "#c9c4bc" };

const vocabSliceGame: GameModule = {
  config: {
    key: "bedrock_vocab_slice",
    title: "Vocab Slice",
    subtitle: "Read it. Find it. Slice it!",
    W, H,
    winText: `You matched ${WIN_TERMS} vocab terms!`,
    deathDelay: 1600,
    overTitle: "Out of hearts!",
    accent: "#00E5A0",
    medals: [
      { at: 500, name: "Bronze", icon: "🥉" },
      { at: 1200, name: "Silver", icon: "🥈" },
      { at: 2200, name: "Gold", icon: "🥇" },
      { at: 3500, name: "Legend", icon: "💎" },
    ],
    howTo: `Read the <b>definition</b> (or review question) at the top, then <b>swipe (or tap)</b> the rock carrying the matching <b>term</b> (or answer). Wrong term or letting the right one drop costs a heart. 5 in a row = extra heart. <b>Match ${WIN_TERMS} terms</b> to win!`,
    controls: "Pick a chapter above · swipe or tap to slice · P pause",
    sprites: [...ROCKS, "heart"],
    facts: [
      "Saying a definition out loud in your own words helps you remember it.",
      "Short practice sessions spread over several days beat one long cram session.",
      "Missed a term? It comes back soon in the same game, so watch for it.",
      "Every term here comes from your class glossary, chapter by chapter.",
      "Quiz yourself on terms you miss: testing beats rereading for memory.",
    ],
  },
  create() {
    type Card = { term: string; def: string; ch: string; wrong?: string[] };
    type Item = { x: number; y: number; vx: number; vy: number; kind: string; term: string; correct?: boolean; lines: string[]; lw: number; rot: number; spin: number; r: number };
    let items: Item[] = [], halves: { x: number; y: number; vx: number; vy: number; rot: number; spin: number; kind: string; side: number; life: number }[] = [];
    let splats: { x: number; y: number; c: string; r: number; life: number }[] = [], trail: { x: number; y: number; a: number }[] = [];
    let last: { x: number; y: number } | null = null, queue: { delay: number; term: string; kind: string; x: number }[] = [];
    let deck: Card[] = [], target: Card | null = null, defBox: { lines: string[]; h: number; ok: number } | null = null;
    let lives = 3, correct = 0, streak = 0, phase: "gap" | "volley" = "gap", gapT = 0.6, reveal: { term: string; life: number; ok: boolean } | null = null;
    let t = 0, flash = 0, chUsed = "1";
    const mctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d")! : null;
    let fontTerm = "700 13px sans-serif", fontDef = "600 16px sans-serif";

    function wrap(text: string, font: string, maxW: number) {
      mctx!.font = font;
      const lines: string[] = [];
      let line = "";
      for (const w of String(text).split(/\s+/)) {
        const s = line ? line + " " + w : w;
        if (mctx!.measureText(s).width > maxW && line) { lines.push(line); line = w; } else line = s;
      }
      if (line) lines.push(line);
      return { lines, w: Math.max(...lines.map((l) => mctx!.measureText(l).width)) };
    }
    const pool = (ch: string): Card[] => {
      if (ch.startsWith("r:")) {
        const k = ch.slice(2), keys = k === "all" ? Object.keys(REVIEW) : [k];
        return keys.flatMap((c) => (REVIEW[c]?.qs ?? []).map((r) => ({ term: r.right, def: r.q, ch: c, wrong: r.wrong })));
      }
      const V = vocab();
      return ch === "all" ? Object.keys(V).flatMap((k) => V[k].terms.map((x) => ({ term: x[0], def: x[1], ch: k }))) : (V[ch]?.terms ?? []).map((x) => ({ term: x[0], def: x[1], ch }));
    };
    const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      let u = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
      u = Math.max(0, Math.min(1, u));
      return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
    };
    const labelRect = (it: Item) => ({ x: it.x - it.lw / 2 - 8, y: it.y + 24, w: it.lw + 16, h: it.lines.length * 15 + 8 });
    const segHitsRect = (ax: number, ay: number, bx: number, by: number, r: { x: number; y: number; w: number; h: number }) => {
      for (let i = 0; i <= 10; i++) { const x = ax + ((bx - ax) * i) / 10, y = ay + ((by - ay) * i) / 10; if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true; }
      return false;
    };
    const hits = (it: Item, ax: number, ay: number, bx: number, by: number) => segDist(it.x, it.y, ax, ay, bx, by) < it.r || (it.lines.length > 0 && segHitsRect(ax, ay, bx, by, labelRect(it)));
    const gravity = () => 470 + Math.min(correct, 15) * 14;

    function nextTarget() {
      if (!deck.length) deck = shuffle(pool(chUsed));
      target = deck.shift()!;
      const w = wrap(target.wrong ? target.def : capFirst(maskTerm(target.def, target.term)), fontDef, W - 56);
      defBox = { lines: w.lines, h: 34 + w.lines.length * 20 + 12, ok: 0 };
    }
    function newVolley() {
      nextTarget();
      const n = correct < 4 ? 3 : correct < 9 ? 4 : 5;
      const decoys = target!.wrong ? target!.wrong.slice() : shuffle((vocab()[target!.ch]?.terms ?? []).map((x) => x[0]).filter((x) => x !== target!.term)).slice(0, n - 1);
      const terms = shuffle([target!.term, ...decoys]), rocks = shuffle(ROCKS);
      const xs = shuffle(terms.map((_, i) => 62 + (i * (W - 124)) / Math.max(1, terms.length - 1)));
      terms.forEach((term, i) => queue.push({ delay: i * 0.28, term, kind: rocks[i % rocks.length], x: xs[i] }));
      phase = "volley";
    }
    function launch(q: { term: string; kind: string; x: number }) {
      const g = gravity(), apex = 64 + defBox!.h + 28 + Math.random() * 80;
      const lab = wrap(q.term, fontTerm, 128);
      items.push({ x: q.x, y: H + 30, vx: (Math.random() - 0.5) * 50, vy: -Math.sqrt(2 * g * (H + 30 - apex)), kind: q.kind, term: q.term, correct: q.term === target!.term, lines: lab.lines, lw: lab.w, rot: 0, spin: (Math.random() - 0.5) * 2, r: 30 });
    }
    function slice(it: Item, ax: number, ay: number, bx: number, by: number, A: Api) {
      const ang = Math.atan2(by - ay, bx - ax);
      [-1, 1].forEach((side) => halves.push({ x: it.x, y: it.y, vx: it.vx * 0.5 + Math.cos(ang + Math.PI / 2) * side * 120, vy: Math.min(it.vy, 0) * 0.3 - 80, rot: ang, spin: side * 4, kind: it.kind, side, life: 1.4 }));
      splats.push({ x: it.x, y: it.y, c: DUST[it.kind] || "#7CFFB2", r: 16 + Math.random() * 8, life: 2.2 });
      A.particles.burst(it.x, it.y, DUST[it.kind] || "#7CFFB2", 10, 180, 3);
      if (it.correct) {
        correct++; streak++;
        const pts = 100 + Math.min(streak - 1, 8) * 25;
        A.addScore(pts); A.sfx("coin"); A.float("+" + pts, it.x, it.y - 26, streak > 2 ? "#FFD166" : "#ffffff");
        reveal = { term: target!.term, life: 1.3, ok: true };
        defBox!.ok = 1;
        items.forEach((x) => A.particles.burst(x.x, x.y, "rgba(255,255,255,.8)", 8, 120, 2.5));
        items = []; queue = []; trail = []; last = null;
        if (streak % 5 === 0 && lives < 3) { lives++; A.toast(`❤ ${streak} in a row! Extra heart`); }
        else if (streak % 5 === 0) A.toast(`🔥 ${streak} in a row!`);
        if (correct === WIN_TERMS) A.win(`You matched ${WIN_TERMS} vocab terms!`);
        phase = "gap"; gapT = 1.1;
      } else {
        lives--; streak = 0; flash = 0.35;
        A.sfx("hit"); A.shake(9, 0.3);
        A.float("✗ " + (it.term.length > 18 ? it.term.slice(0, 17) + "…" : it.term), it.x, it.y - 26, "#FF8FA3");
        trail = []; last = null;
        if (lives <= 0) { reveal = { term: target!.term, life: 2, ok: false }; A.gameOver(); }
      }
    }

    return {
      reset(A) {
        fontTerm = A.font(13, 700); fontDef = A.font(16, 600);
        items = []; halves = []; splats = []; trail = []; last = null; queue = []; lives = 3; correct = 0; streak = 0;
        phase = "gap"; gapT = 0.6; reveal = null; t = 0; flash = 0; target = null; defBox = null;
        chUsed = chosenChapter;
        deck = shuffle(pool(chUsed));
      },
      pointer(type, x, y, A) {
        if (type === "down") {
          last = { x, y };
          trail = [{ x, y, a: 1 }];
          for (let i = items.length - 1; i >= 0; i--) if (hits(items[i], x, y, x, y)) { const it = items.splice(i, 1)[0]; slice(it, x - 10, y, x + 10, y, A); return; }
          return;
        }
        if (type === "up") { last = null; return; }
        if (type !== "drag" || !last) return;
        const ax = last.x, ay = last.y;
        if (Math.hypot(x - ax, y - ay) < 3) return;
        trail.push({ x, y, a: 1 });
        if (trail.length > 14) trail.shift();
        for (let i = items.length - 1; i >= 0; i--) {
          if (hits(items[i], ax, ay, x, y)) { const it = items.splice(i, 1)[0]; slice(it, ax, ay, x, y, A); if (A.state !== "play" || !last) return; }
        }
        last = { x, y };
      },
      update(dt, A) {
        t += dt;
        flash = Math.max(0, flash - dt);
        trail.forEach((p) => (p.a -= dt * 5));
        trail = trail.filter((p) => p.a > 0);
        halves.forEach((h) => { h.vy += 900 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.spin * dt; h.life -= dt; });
        halves = halves.filter((h) => h.life > 0 && h.y < H + 60);
        splats.forEach((s) => (s.life -= dt));
        splats = splats.filter((s) => s.life > 0);
        if (reveal) { reveal.life -= dt; if (reveal.life <= 0) reveal = null; }
        if (defBox && defBox.ok) defBox.ok = Math.max(0, defBox.ok - dt);
        if (A.state === "menu") {
          if (items.length < 3 && Math.random() < dt * 1.2) {
            items.push({ x: 60 + Math.random() * (W - 120), y: H + 30, vx: (Math.random() - 0.5) * 60, vy: -(620 + Math.random() * 120), kind: ROCKS[Math.floor(Math.random() * ROCKS.length)], term: "", lines: [], lw: 0, rot: 0, spin: 1, r: 28 });
          }
        } else if (A.state !== "play") return;
        if (A.state === "play") {
          if (phase === "gap") { gapT -= dt; if (gapT <= 0) newVolley(); }
          for (let i = queue.length - 1; i >= 0; i--) { queue[i].delay -= dt; if (queue[i].delay <= 0) launch(queue.splice(i, 1)[0]); }
        }
        const g = A.state === "play" ? gravity() : 470;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.vy += g * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.spin * dt;
          const m = Math.max(30, it.lw / 2 + 10);
          if (it.x < m || it.x > W - m) { it.vx *= -0.6; it.x = Math.max(m, Math.min(W - m, it.x)); }
          if (it.vy > 0 && it.y > H + 60) items.splice(i, 1);
        }
        if (A.state === "play" && phase === "volley" && !queue.length && !items.some((it) => it.correct)) {
          lives--; streak = 0; A.sfx("hit"); flash = 0.3;
          deck.splice(Math.min(2, deck.length), 0, target!);
          reveal = { term: target!.term, life: 1.8, ok: false };
          items = [];
          if (lives <= 0) { A.gameOver(); return; }
          phase = "gap"; gapT = 1.8;
        }
      },
      draw(ctx, A) {
        const fr = ctx.createLinearGradient(0, 0, W, H);
        fr.addColorStop(0, "#a8703c"); fr.addColorStop(1, "#5e3a1a");
        ctx.fillStyle = fr; ctx.fillRect(0, 0, W, H);
        const cb = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, H * 0.7);
        cb.addColorStop(0, "#2a5446"); cb.addColorStop(1, "#14302a");
        ctx.fillStyle = cb; ctx.fillRect(10, 10, W - 20, H - 20);
        ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 14;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(30, 120 + i * 110); ctx.bezierCurveTo(W * 0.3, 90 + i * 110, W * 0.7, 150 + i * 110, W - 30, 110 + i * 110); ctx.stroke(); }
        splats.forEach((s) => { ctx.globalAlpha = Math.min(0.5, (s.life / 2.2) * 0.5); ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
        A.drawHero(W - 46, H - 46, 72, 0, flash > 0 ? "hurt" : "happy");
        if (A.state !== "menu" && defBox && target) {
          const bx = 18, by = 62, bw = W - 36;
          A.rr(bx, by, bw, defBox.h, 16);
          ctx.fillStyle = defBox.ok ? `rgba(0,229,160,${0.25 + defBox.ok * 0.5})` : "rgba(7,7,26,.85)"; ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = defBox.ok ? "#00E5A0" : "rgba(255,209,102,.7)"; ctx.stroke();
          ctx.textAlign = "left"; ctx.font = A.font(11, 700); ctx.fillStyle = "#FFD166";
          ctx.fillText(target.wrong ? "SLICE THE RIGHT ANSWER…" : "SLICE THE TERM THAT MEANS…", bx + 14, by + 22);
          ctx.textAlign = "right"; ctx.fillStyle = correct >= WIN_TERMS ? "#00E5A0" : "#d9dbf3";
          ctx.fillText(`Ch ${target.ch} · ${Math.min(correct, WIN_TERMS)}/${WIN_TERMS}${correct > WIN_TERMS ? " +" + (correct - WIN_TERMS) : ""}`, bx + bw - 14, by + 22);
          ctx.textAlign = "left"; ctx.font = fontDef; ctx.fillStyle = "#fff";
          defBox.lines.forEach((l, i) => ctx.fillText(l, bx + 14, by + 46 + i * 20));
        }
        halves.forEach((h) => {
          ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
          ctx.beginPath(); ctx.rect(-32, h.side < 0 ? -32 : 0, 64, 32); ctx.clip();
          ctx.globalAlpha = Math.min(1, h.life);
          A.drawSprite(h.kind, 0, 0, 58);
          ctx.restore();
        });
        items.forEach((it) => {
          A.drawSprite(it.kind, it.x, it.y, 58, Math.sin(it.rot) * 0.4);
          if (!it.lines.length) return;
          const r = labelRect(it);
          A.rr(r.x, r.y, r.w, r.h, 9);
          ctx.fillStyle = "rgba(255,248,225,.97)"; ctx.fill();
          ctx.textAlign = "center"; ctx.font = fontTerm; ctx.fillStyle = "#1a1230";
          it.lines.forEach((l, i) => ctx.fillText(l, it.x, r.y + 16 + i * 15));
        });
        if (trail.length > 1) {
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          for (let i = 1; i < trail.length; i++) {
            const p = trail[i], q = trail[i - 1], w = 2 + (i / trail.length) * 9;
            ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, p.a)})`; ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.strokeStyle = `rgba(124,255,178,${Math.max(0, p.a) * 0.6})`; ctx.lineWidth = w * 0.4; ctx.stroke();
          }
        }
        if (reveal) {
          const y = H * 0.56;
          ctx.globalAlpha = Math.min(1, reveal.life * 2);
          ctx.textAlign = "center"; ctx.lineJoin = "round";
          ctx.font = A.font(14); ctx.lineWidth = 5; ctx.strokeStyle = "#05070F";
          const head = reveal.ok ? "✔ CORRECT" : "THE ANSWER WAS";
          ctx.strokeText(head, W / 2, y - 26); ctx.fillStyle = reveal.ok ? "#00E5A0" : "#FF8FA3"; ctx.fillText(head, W / 2, y - 26);
          const big = wrap(reveal.term, A.font(26), W - 60);
          ctx.font = A.font(26); ctx.lineWidth = 7;
          big.lines.forEach((l, i) => { ctx.strokeText(l, W / 2, y + 4 + i * 30); ctx.fillStyle = "#FFD166"; ctx.fillText(l, W / 2, y + 4 + i * 30); });
          ctx.globalAlpha = 1;
        }
        if (flash > 0) { ctx.fillStyle = `rgba(255,59,92,${flash * 0.7})`; ctx.fillRect(0, 0, W, H); }
        if (A.state !== "menu") {
          for (let i = 0; i < 3; i++) A.drawSprite("heart", 32 + i * 26, H - 30, 24, 0, i < lives ? 1 : 0.2);
          if (streak >= 2) { ctx.fillStyle = "#FFD166"; ctx.font = A.font(14); ctx.textAlign = "left"; ctx.fillText(`🔥 ${streak} in a row`, 22, H - 52); }
        }
      },
    };
  },
};

export function VocabSlice() {
  const [ready, setReady] = useState(false);
  const [ch, setCh] = useState("1");
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get("ch");
    let saved = "1";
    try { saved = JSON.parse(localStorage.getItem("bedrock_vocab_slice_ch") || '"1"'); } catch {}
    let alive = true;
    const init = () => {
      if (!alive) return;
      const pick = fromUrl && valid(fromUrl) ? fromUrl : valid(saved) ? saved : "1";
      chosenChapter = pick;
      setCh(pick);
      setReady(true);
    };
    Promise.all([loadVocab(), loadReviewDeck()]).then(([v, r]) => { VOCAB = v; REVIEW = r; init(); });
    return () => { alive = false; };
  }, []);
  if (!ready) return <div className="mx-auto aspect-[5/8] max-h-[70vh] animate-pulse rounded-3xl bg-fg/5" />;
  const V = vocab();
  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-md items-center gap-3">
        <label htmlFor="vs-ch" className="shrink-0 text-sm font-semibold text-muted">Deck</label>
        <select
          id="vs-ch"
          value={ch}
          onChange={(e) => { setCh(e.target.value); chosenChapter = e.target.value; try { localStorage.setItem("bedrock_vocab_slice_ch", JSON.stringify(e.target.value)); } catch {} e.target.blur(); }}
          className="glass w-full rounded-xl px-3 py-2 text-sm font-semibold text-fg outline-none"
        >
          <optgroup label="Vocab: slice the term">
            <option value="all">🎲 All chapters (mix)</option>
            {Object.keys(V).sort((a, b) => +a - +b).map((k) => <option key={k} value={k}>Ch {k} · {V[k].title}</option>)}
          </optgroup>
          {Object.keys(REVIEW).length > 0 && (
            <optgroup label="Review: slice the answer">
              <option value="r:all">📝 All chapters (review mix)</option>
              {Object.keys(REVIEW).sort((a, b) => +a - +b).map((k) => <option key={k} value={"r:" + k}>📝 Ch {k} review · {REVIEW[k].title}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      <ArcadeGame game={vocabSliceGame} />
      <p className="mt-2 text-center text-xs text-muted/70">Changing the chapter applies to your next game.</p>
    </div>
  );
}
