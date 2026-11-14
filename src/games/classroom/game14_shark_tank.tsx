"use client";

// Bedrock twin of Dopps Class game14_shark_tank — the class acts as the Sharks. For each pitch (a hazard-preparedness,
// resource or energy solution) they rate five dimensions (1–5 stars → Earth Innovation Score /100) and decide IN or OUT.
import { useState } from "react";
import { ArrowRight, RotateCcw, Star } from "lucide-react";
import data from "./data/game14_shark_tank.json";
import { Btn, Hint, Shell, shuffle, useDeck, sfx, useKeys } from "./shared-c";

type Pitch = { company: string; tagline: string; ask: string; problem: string; solution: string; metrics: Record<string, string>; reviewNotes: string };
const PITCHES = (data as unknown as { PITCHES: Pitch[] }).PITCHES;
const SHARKS = ["Shark A", "Shark B", "Shark C", "Shark D"].map((name) => ({ name, budget: 500000, invested: 0 }));
const RUBRIC = ["Real-World Impact", "Earth Science & Evidence", "Feasibility", "Presentation", "Innovation"];
const blank = () => RUBRIC.map(() => 0);

export function Game14SharkTank() {
  const [pitches, setPitches] = useDeck(PITCHES);
  const [idx, setIdx] = useState(0);
  const [stars, setStars] = useState<number[]>(blank);
  const [decisions, setDecisions] = useState<("in" | "out" | undefined)[]>([]);
  const [focus, setFocus] = useState(0);

  const init = () => { setPitches(shuffle(PITCHES)); setIdx(0); setStars(blank()); setDecisions([]); setFocus(0); };
  const rate = (dim: number, val: number) => { setStars((s) => s.map((v, i) => (i === dim ? val : v))); sfx.click(); };
  const decide = (d: "in" | "out") => { setDecisions((ds) => { const n = [...ds]; n[idx] = d; return n; }); if (d === "in") sfx.good(); else sfx.bad(); };
  const next = () => { setIdx((i) => i + 1); setStars(blank()); setFocus(0); };

  const done = idx >= pitches.length;
  useKeys((e) => {
    if (done) { if (e.key === "Enter") init(); return; }
    const k = e.key.toLowerCase();
    if (/^[1-5]$/.test(k)) { rate(focus, Number(k)); setFocus((f) => Math.min(RUBRIC.length - 1, f + 1)); }
    else if (k === "arrowup") setFocus((f) => Math.max(0, f - 1));
    else if (k === "arrowdown") setFocus((f) => Math.min(RUBRIC.length - 1, f + 1));
    else if (k === "i") decide("in");
    else if (k === "o") decide("out");
    else if (k === "n" || k === "enter") next();
  });

  if (done) {
    const deals = decisions.filter((d) => d === "in").length;
    return (
      <Shell title="Shark Tank — Results" max="max-w-3xl">
        <div className="cr-dark animate-rise rounded-3xl border-2 border-gold/50 bg-gradient-to-b from-[#1f1a10]/90 to-[#0b110e]/90 p-6 shadow-[0_0_50px_-20px_#ffd166] sm:p-8">
          <div className="text-center font-display text-3xl font-extrabold text-gold">All Pitches Scored</div>
          <div className="mt-5 divide-y divide-line">
            {pitches.map((p, i) => (
              <div key={p.company} className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div><div className="text-xl font-bold text-fg">{p.company}</div><div className="text-sm text-muted">{p.tagline}</div></div>
                <span className={`rounded-full px-4 py-1.5 text-sm font-extrabold ${decisions[i] === "in" ? "bg-emerald/15 text-emerald" : "bg-crimson/15 text-crimson"}`}>{decisions[i] === "in" ? "DEAL ✓" : "NO DEAL ✗"}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 text-center font-display text-2xl font-extrabold text-gold">Deals made: {deals} / {pitches.length}</div>
        </div>
        <div className="mt-6 flex justify-center"><Btn big onClick={init}><RotateCcw className="size-6" /> New Session</Btn></div>
      </Shell>
    );
  }

  const p = pitches[idx];
  const total = stars.reduce((a, b) => a + b, 0);
  const score = Math.round((total / (RUBRIC.length * 5)) * 100);
  const dec = decisions[idx];

  return (
    <Shell title="Bedrock Shark Tank" sub={`Pitch ${idx + 1} of ${pitches.length} · Sample pitches are fictional — teams can pitch their own`} max="max-w-5xl">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SHARKS.map((s) => (
          <div key={s.name} className="glass rounded-2xl p-3 text-center">
            <div className="text-4xl">🦈</div>
            <div className="mt-1 text-sm font-extrabold uppercase tracking-widest text-sky">{s.name}</div>
            <div className="font-display text-xl font-extrabold text-gold">${(s.budget - s.invested).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div key={p.company} className="cr-dark mt-5 animate-rise rounded-3xl border-2 border-sky/40 bg-gradient-to-b from-[#0f2236]/90 to-[#0b110e]/90 p-6 shadow-[0_0_50px_-20px_#38bfff] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-display text-4xl font-extrabold text-fg sm:text-5xl">{p.company}</div>
            <div className="mt-1 text-lg italic text-sky">{p.tagline}</div>
          </div>
          <div className="rounded-2xl border border-gold/50 bg-gold/10 px-5 py-3 text-right">
            <div className="text-xs font-bold uppercase tracking-widest text-gold/80">Asking</div>
            <div className="font-display text-xl font-extrabold text-gold sm:text-2xl">{p.ask}</div>
          </div>
        </div>
        <Section label="The Problem">{p.problem}</Section>
        <Section label="Our Solution">{p.solution}</Section>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {Object.entries(p.metrics).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-fg/5 p-3 text-center">
              <div className="font-display text-xl font-extrabold text-emerald sm:text-2xl">{v}</div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted">{k.charAt(0).toUpperCase() + k.slice(1)}</div>
            </div>
          ))}
        </div>
        <Section label="Science Reviewer Notes"><span className="text-[#86efac]">{p.reviewNotes}</span></Section>
      </div>

      <div className="glass mt-5 rounded-3xl p-6">
        <div className="text-sm font-extrabold uppercase tracking-widest text-gold">Shark Scorecard — Rate each dimension (1–5 stars)</div>
        <div className="mt-3 space-y-2">
          {RUBRIC.map((item, i) => (
            <div key={item} onClick={() => setFocus(i)} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 transition ${focus === i ? "bg-fg/5 ring-1 ring-gold/30" : ""}`}>
              <div className="text-lg font-bold text-fg">{item}</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => rate(i, n)} aria-label={`${item} ${n} stars`} className="transition hover:scale-125">
                    <Star className="size-8 sm:size-9" fill={stars[i] >= n ? "#ffd166" : "transparent"} stroke={stars[i] >= n ? "#ffd166" : "color-mix(in srgb, var(--color-fg) 30%, transparent)"} style={stars[i] >= n ? { filter: "drop-shadow(0 0 6px #ffd166)" } : undefined} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border-2 border-gold/50 bg-gold/10 p-5 text-center">
        <div className="text-sm font-extrabold uppercase tracking-widest text-gold/80">Earth Innovation Score</div>
        <div className="font-display text-6xl font-extrabold text-gold tabular-nums">{score} <span className="text-3xl text-gold/60">/ 100</span></div>
      </div>

      <p className="mt-5 text-center font-semibold text-muted">Sharks: make your decision!</p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <button onClick={() => decide("in")} className={`rounded-3xl bg-emerald px-6 py-6 font-display text-2xl font-extrabold text-ink transition hover:-translate-y-1 sm:text-3xl ${dec === "in" ? "ring-4 ring-fg/70" : ""}`} style={{ boxShadow: "0 16px 40px -14px #00e5a0" }}>I&apos;m IN! 🦈 Deal</button>
        <button onClick={() => decide("out")} className={`rounded-3xl bg-crimson px-6 py-6 font-display text-2xl font-extrabold text-white transition hover:-translate-y-1 sm:text-3xl ${dec === "out" ? "ring-4 ring-fg/70" : ""}`} style={{ boxShadow: "0 16px 40px -14px #ff3b5c" }}>I&apos;m OUT</button>
      </div>
      {dec && (
        <div className="glass mt-4 animate-rise rounded-2xl px-4 py-3 text-center text-lg font-semibold">
          Class decision: <strong className={dec === "in" ? "text-emerald" : "text-crimson"}>{dec === "in" ? "✓ DEAL — Sharks invest!" : "✗ No deal"}</strong> (Score: {score}/100)
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Btn big onClick={next}>Next Pitch <ArrowRight className="size-6" /></Btn>
        <Btn tone="ghost" onClick={init}><RotateCcw className="size-4" /> Restart</Btn>
      </div>
      <Hint>Keys: 1–5 rate the highlighted row (↑/↓ to move) · I deal · O out · N next pitch</Hint>
    </Shell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-gold">{label}</div>
      <div className="mt-1 text-lg leading-relaxed text-fg/90">{children}</div>
    </div>
  );
}
