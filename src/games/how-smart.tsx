"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Brain, Gamepad2, RotateCcw } from "lucide-react";
import { loadSmartBank, reviewEnabled, type SmartQ as Q } from "./earth-quiz";

const FLOORS = ["2nd grade", "3rd grade", "4th grade", "5th grade", "6th grade", "7th grade", "8th grade", "9th grade", "10th grade", "11th grade", "12th grade", "College student", "College grad", "Grad student", "Expert"];
const TOP = 15, START = 4;
const TITLES: [number, string][] = [[0, "Curious Cub 🐣"], [3, "Rising Explorer 🧭"], [5, "Sharp Scout 🔎"], [7, "Knowledge Knight 🛡"], [9, "Wisdom Warrior ⚔"], [11, "Scholar 📜"], [12.5, "Sage 🦉"], [14, "Legend of Bedrock 👑"]];

function erf(x: number) {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}
const cdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
function invNorm(p: number) { let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (cdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
function topShare(p: number) {
  const z = invNorm(1 - p), phi = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI), r = phi / p;
  return { m: 11 + 2 * r, s: 2 * Math.sqrt(Math.max(0.05, 1 + z * r - r * r)) };
}
const GROUPS = [
  { name: "3rd graders", m: 2, s: 2 }, { name: "5th graders", m: 4, s: 2 }, { name: "8th graders", m: 7, s: 2 },
  { name: "10th graders", m: 9, s: 2 }, { name: "12th graders", m: 11, s: 2 },
  { name: "college students", ...topShare(0.62) }, { name: "college graduates", ...topShare(0.38) }, { name: "graduate students", ...topShare(0.14) },
];
const pRight = (a: number, b: number) => 0.25 + 0.75 / (1 + Math.exp(-1.3 * (a - b)));
function estimate(hist: { lvl: number; ok: boolean }[]) {
  let num = 0, den = 0;
  for (let a = -2; a <= 19; a += 0.05) {
    let lp = -((a - 7) ** 2) / (2 * 16);
    hist.forEach((h) => { const p = pRight(a, h.lvl); lp += Math.log(h.ok ? p : 1 - p); });
    const w = Math.exp(lp);
    num += a * w; den += w;
  }
  return Math.max(0, Math.min(17, num / den));
}
const pctText = (p: number) => (p >= 0.995 ? "99%+" : p < 0.01 ? "under 1%" : Math.round(p * 100) + "%");
const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

type Result = { lvl: number; title: string; head: string; goal: string; pcts: { name: string; p: number }[]; right: number; total: number; maxFloor: number; missed: Q[]; newBest: boolean };

export function HowSmart() {
  const [bank, setBank] = useState<Q[] | null>(null);
  const [view, setView] = useState<"start" | "play" | "result">("start");
  const [level, setLevel] = useState(START);
  const [hist, setHist] = useState<{ id: number; lvl: number; ok: boolean }[]>([]);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [streakMiss, setStreakMiss] = useState(0);
  const [maxFloor, setMaxFloor] = useState(START);
  const [cur, setCur] = useState<Q | null>(null);
  const [opts, setOpts] = useState<{ t: string; ok: boolean }[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<{ lvl: number; head: string } | null>(null);
  const [cheer, setCheer] = useState("");

  useEffect(() => {
    setBest(store.get("bedrock_how_smart_best_info", null));
    let alive = true;
    loadSmartBank().then((b) => alive && setBank(b));
    return () => { alive = false; };
  }, []);

  const pick = useCallback(
    (lvl: number, usedSet: Set<number>) => {
      if (!bank) return null;
      const seen = new Set(store.get<number[]>("bedrock_how_smart_seen", []));
      for (let d = 0; d <= TOP; d++)
        for (const L of d ? [lvl + d, lvl - d] : [lvl]) {
          if (L < 1 || L > TOP) continue;
          const pool = bank.filter((q) => q.lvl === L && !usedSet.has(q.id));
          if (!pool.length) continue;
          const fresh = pool.filter((q) => !seen.has(q.id));
          const from = fresh.length ? fresh : pool;
          return from[Math.floor(Math.random() * from.length)];
        }
      return null;
    },
    [bank]
  );

  const show = (q: Q | null, usedSet: Set<number>) => {
    if (!q) return;
    usedSet.add(q.id);
    setUsed(new Set(usedSet));
    setCur(q);
    setPicked(null);
    setOpts([q.right, ...q.wrong].map((t) => ({ t, ok: t === q.right })).sort(() => Math.random() - 0.5));
  };

  const start = () => {
    const u = new Set<number>();
    setLevel(START); setHist([]); setStreakMiss(0); setMaxFloor(START); setResult(null); setView("play");
    store.set("bedrock_how_smart_plays", store.get("bedrock_how_smart_plays", 0) + 1);
    show(pick(START, u), u);
  };

  const answer = (i: number) => {
    if (picked !== null || !cur) return;
    setPicked(i);
    const ok = opts[i].ok;
    const h = [...hist, { id: cur.id, lvl: cur.lvl, ok }];
    setHist(h);
    setStreakMiss((s) => (ok ? 0 : s + 1));
    setLevel((l) => Math.max(1, Math.min(TOP, l + (ok ? (h.length <= 4 ? 2 : 1) : -1))));
    if (ok) setMaxFloor((m) => Math.max(m, cur.lvl));
  };

  const done = picked !== null && ((streakMiss >= 3 && hist.length >= 20) || hist.length >= 30);

  const finish = () => {
    if (!bank) return;
    const lvl = estimate(hist);
    const pcts = GROUPS.map((g) => ({ name: g.name, p: cdf((lvl - g.m) / g.s) }));
    let i = -1;
    pcts.forEach((g, k) => { if (g.p >= 0.5) i = k; });
    const head =
      i === -1 ? `You're smarter than ${pctText(pcts[0].p)} of 3rd graders. Every climb teaches you something new, so try again!`
        : i === pcts.length - 1 ? `You're smarter than ${pctText(pcts[i].p)} of graduate students. That's legendary! 👑`
          : `You're smarter than ${pctText(pcts[i].p)} of ${pcts[i].name}, and already ahead of ${pctText(pcts[i + 1].p)} of ${pcts[i + 1].name}!`;
    const goalG = i < pcts.length - 1 ? GROUPS[i + 1] : null;
    const prev = store.get<{ lvl: number; head: string } | null>("bedrock_how_smart_best_info", null);
    const newBest = !prev || lvl > prev.lvl;
    if (newBest) { store.set("bedrock_how_smart_best_info", { lvl, head }); store.set("bedrock_how_smart_best", Math.round(lvl * 100)); setBest({ lvl, head }); }
    if (lvl >= 9) store.set("bedrock_how_smart_wins", store.get("bedrock_how_smart_wins", 0) + 1);
    store.set("bedrock_how_smart_seen", store.get<number[]>("bedrock_how_smart_seen", []).concat(hist.map((x) => x.id)).slice(-300));
    const missed = hist.filter((x) => !x.ok).map((x) => bank[x.id]);
    setCheer(newBest && prev ? "✨ New personal best! " : "");
    setResult({
      lvl, head, pcts, newBest, missed, maxFloor, total: hist.length, right: hist.filter((x) => x.ok).length,
      title: TITLES.filter((t) => lvl >= t[0]).pop()![1],
      goal: goalG ? `🎯 Next goal: reach Brain Level ${Math.max(goalG.m, lvl + 0.1).toFixed(1)} to pass half of all ${goalG.name}.` : "",
    });
    setView("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    if (done) return finish();
    const u = new Set(used);
    const q = pick(level, u);
    if (!q) return finish();
    show(q, u);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view === "start" && e.key === "Enter" && bank) start();
      if (view !== "play") return;
      if (picked === null && /^[1-4]$/.test(e.key)) answer(+e.key - 1);
      else if (picked !== null && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const card = "block-panel rounded-3xl shadow-[0_30px_80px_-30px_rgba(0,0,0,.6)]";

  if (view === "start") {
    return (
      <div className={`${card} mx-auto max-w-xl animate-rise p-8 text-center`}>
        <Image src="/sprites/hero.png" alt="" width={130} height={130} className="mx-auto animate-float drop-shadow-[0_14px_24px_rgba(0,0,0,.5)]" />
        <h1 className="text-gradient mt-3 font-display text-4xl font-extrabold tracking-tight">How Smart Am I?</h1>
        <p className="mt-3 text-muted">
          Climb the Tower of Knowledge with Earth science questions! They get <b className="text-fg">harder when you&apos;re right</b> and easier when you miss. After 20–30 questions, see how your Brain Level compares with 3rd graders all the way up to grad students.
        </p>
        <p className="mt-2 text-xs text-muted">{reviewEnabled() ? "Questions come from the chapter review bank, all 28 chapters." : "Questions come from the class glossary, all 28 chapters."}</p>
        {best && <p className="mt-4 text-sm text-muted">Your best: <b className="text-gold">Brain Level {best.lvl.toFixed(1)}</b> · {best.head}</p>}
        <button disabled={!bank} onClick={start} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] py-3.5 text-lg font-bold text-[#10140e] shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)] transition hover:-translate-y-0.5 disabled:opacity-50">
          <Brain className="size-5" /> {bank ? "Start climbing" : "Loading questions…"}
        </button>
        <p className="mt-3 font-mono text-[11px] text-muted/80">Keys 1–4 to answer · Enter for next</p>
      </div>
    );
  }

  if (view === "result" && result) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className={`${card} animate-rise p-8 text-center`}>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Your Brain Level</div>
          <div className="text-gradient font-display text-8xl font-extrabold leading-none tracking-tighter">{result.lvl.toFixed(1)}</div>
          <div className="mt-2 font-display text-2xl font-extrabold">{result.title}</div>
          <p className="mx-auto mt-3 max-w-lg text-lg text-fg/85">{result.head}</p>
          <div className="mt-6 space-y-2.5 text-left">
            {result.pcts.map((g) => (
              <div key={g.name} className="grid grid-cols-[130px_1fr_60px] items-center gap-3 text-sm">
                <span className="text-muted">{g.name[0].toUpperCase() + g.name.slice(1)}</span>
                <span className="h-3 overflow-hidden rounded-full bg-fg/10">
                  <span className="block h-full rounded-full bg-gradient-to-r from-emerald to-sky transition-[width] duration-1000" style={{ width: `${g.p * 100}%` }} />
                </span>
                <span className="text-right font-bold">{pctText(g.p)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
            <span className="glass rounded-full px-3 py-1">📝 {result.total} questions</span>
            <span className="glass rounded-full px-3 py-1">✅ {result.right} right</span>
            <span className="glass rounded-full px-3 py-1">🧗 Highest floor {result.maxFloor} ({FLOORS[result.maxFloor - 1]})</span>
          </div>
          <p className="mt-4 text-sm text-muted">
            {cheer}{result.goal} {result.missed.length ? `You just learned ${result.missed.length} new fact${result.missed.length === 1 ? "" : "s"} — look them over below, then climb again.` : "You didn't miss a single one. Incredible!"}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={start} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-6 py-3 font-bold text-[#10140e] shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)]"><RotateCcw className="size-4" /> Climb again</button>
            <Link href="/arcade/" className="glass inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold"><Gamepad2 className="size-4" /> More games</Link>
          </div>
        </div>
        {result.missed.length > 0 && (
          <div className={`${card} p-6`}>
            <h2 className="mb-4 text-center font-display text-xl font-extrabold">📚 Facts you just learned</h2>
            <div className="space-y-3">
              {result.missed.map((q) => (
                <div key={q.id} className="rounded-2xl border border-line bg-fg/[0.03] p-4">
                  <div className="font-semibold">{q.q}</div>
                  <div className="mt-1 font-bold text-emerald">✔ {q.right}</div>
                  <div className="mt-1 text-sm text-muted">{q.why}</div>
                  {q.ch > 0 && <a href={`/chapters/${q.ch}/`} className="mt-2 inline-block text-sm font-semibold text-sky hover:underline">Learn more in Chapter {q.ch} →</a>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_260px]">
      <div className={`${card} p-6 sm:p-8`}>
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold">Question {hist.length + (picked === null ? 1 : 0)}</span>
          <span className="flex items-center gap-1.5 text-muted">
            Misses {[0, 1, 2].map((i) => <i key={i} className={`size-2.5 rounded-full ${i < Math.min(3, streakMiss) ? "bg-crimson" : "bg-fg/15"}`} />)}
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-fg/10">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber transition-[width] duration-500" style={{ width: `${(level / TOP) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted"><span>Floor {level} · {FLOORS[level - 1]}</span><span>Best floor {maxFloor}</span></div>
        {cur && (
          <>
            <div className="mt-6 font-mono text-xs uppercase tracking-widest text-sky">{cur.topic} · Floor {cur.lvl}</div>
            <h2 className="mt-2 font-display text-2xl font-extrabold leading-snug sm:text-3xl">{cur.q}</h2>
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {opts.map((o, i) => {
                const state = picked === null ? "border-line bg-fg/[0.04]" : o.ok ? "border-emerald bg-emerald/15" : picked === i ? "border-crimson bg-crimson/15" : "border-line bg-fg/[0.04] opacity-60";
                return (
                  <button key={i} disabled={picked !== null} onClick={() => answer(i)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition enabled:hover:border-gold/50 enabled:hover:bg-gold/10 ${state}`}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-fg/10 font-bold">{i + 1}</span>
                    <span className="font-semibold">{o.t}</span>
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className={`mt-5 animate-rise rounded-2xl border p-4 ${opts[picked].ok ? "border-emerald/40 bg-emerald/10" : "border-crimson/40 bg-crimson/10"}`}>
                <b className="block">{opts[picked].ok ? "✅ Correct!" : `❌ The answer is: ${cur.right}`}</b>
                <span className="text-sm text-fg/85">{cur.why}</span>
                <div className="mt-3 text-right">
                  <button onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-amber px-5 py-2.5 font-bold text-[#10140e]">
                    {done ? "See my results" : "Next"} <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className={`${card} hidden p-4 lg:block`}>
        <div className="mb-2 text-center font-mono text-[11px] uppercase tracking-widest text-gold/80">Tower of Knowledge</div>
        <div className="space-y-1">
          {Array.from({ length: TOP }, (_, k) => TOP - k).map((f) => (
            <div key={f} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${f === level ? "bg-gold/20 font-bold text-fg" : f <= maxFloor ? "bg-emerald/10 text-fg/85" : "text-muted"}`}>
              <span className="w-5 text-right font-mono">{f}</span>
              <span className="flex-1">{FLOORS[f - 1]}</span>
              {f === level && <Image src={streakMiss ? "/sprites/hero-hurt.png" : "/sprites/hero.png"} alt="" width={22} height={22} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
