"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Gamepad2, RotateCcw } from "lucide-react";

// Twin of Dopps Class "Dopp Spin": spin the wheel, do the quick Earth science class challenge (or pass). 8 spins per round.
const CHALLENGES = [
  { emoji: "🪨", label: "Rock Hunt", text: "Point to 3 things in the room made from rocks or minerals", fact: "Glass is made from quartz sand, pencil 'lead' is the mineral graphite, and concrete is crushed rock and cement.", color: "#C2703D" },
  { emoji: "🫨", label: "Quake Drill", text: "Drop, cover, and hold on for 10 seconds!", fact: "Idaho's 1983 Borah Peak earthquake was magnitude 6.9. Drop, cover, and hold on is the safest move.", color: "#F25C45" },
  { emoji: "🌍", label: "Layer Lineup", text: "Name Earth's 4 layers from the center out — say them out loud!", fact: "Inner core, outer core, mantle, crust. The crust is thinner, compared to Earth, than an apple's skin.", color: "#A78BFA" },
  { emoji: "☁️", label: "Sky Check", text: "Look outside and name the cloud type (or the weather) you see", fact: "Cumulus clouds are puffy, stratus are flat sheets, and cirrus are high, wispy ice clouds.", color: "#38BDF8" },
  { emoji: "🧭", label: "Find North", text: "Everyone point north on 3. Then check with a compass app!", fact: "A compass needle lines up with Earth's magnetic field, which comes from the liquid iron outer core.", color: "#34D399" },
  { emoji: "💎", label: "Mohs Moment", text: "Rank fingernail, penny, steel nail and glass from softest to hardest", fact: "Fingernail ~2.5, copper penny ~3, glass ~5.5, steel nail ~6.5 on the Mohs scale.", color: "#F6C453" },
  { emoji: "🌋", label: "Eruption Break", text: "Crouch down low, then ERUPT out of your seat on 3!", fact: "Lava at Idaho's Craters of the Moon last erupted about 2,100 years ago, and it could erupt again.", color: "#FF8C42" },
  { emoji: "💧", label: "Water Cycle Wave", text: "With your table, act out evaporation, condensation and precipitation", fact: "The Sun powers the water cycle. A water molecule spends about 9 days in the atmosphere on average.", color: "#5EEAD4" },
];
const TOTAL_SPINS = 8, N = CHALLENGES.length, SLICE = 360 / N, R = 140, C = 150;

function wedge(i: number) {
  const a0 = ((i * SLICE - 90) * Math.PI) / 180, a1 = (((i + 1) * SLICE - 90) * Math.PI) / 180;
  return `M${C},${C} L${C + R * Math.cos(a0)},${C + R * Math.sin(a0)} A${R},${R} 0 0 1 ${C + R * Math.cos(a1)},${C + R * Math.sin(a1)} Z`;
}

export function BedrockSpin() {
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const [passed, setPassed] = useState(0);
  const [spins, setSpins] = useState(0);
  const [dur, setDur] = useState(4);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const finished = spins >= TOTAL_SPINS && current === null && !spinning;

  const spin = () => {
    if (spinning || current !== null || spins >= TOTAL_SPINS) return;
    const idx = Math.floor(Math.random() * N);
    const d = 3 + Math.random() * 1.5;
    const jitter = (Math.random() - 0.5) * SLICE * 0.7;
    const want = 360 - (idx + 0.5) * SLICE + jitter;          // wheel angle that puts wedge idx under the top pointer
    const base = rot - (((rot % 360) + 360) % 360);
    setDur(d);
    setRot(base + 360 * (4 + Math.floor(Math.random() * 4)) + want);
    setSpinning(true);
    timer.current = setTimeout(() => { setSpinning(false); setSpins((s) => s + 1); setCurrent(idx); }, d * 1000 + 80);
  };
  const act = (ok: boolean) => { if (ok) setDone(done + 1); else setPassed(passed + 1); setCurrent(null); };
  const restart = () => { setDone(0); setPassed(0); setSpins(0); setCurrent(null); };

  const ch = current !== null ? CHALLENGES[current] : null;
  const pct = done / TOTAL_SPINS;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      <h1 className="text-gradient font-display text-4xl font-extrabold tracking-tight">Bedrock Spin</h1>
      <p className="mt-1 text-sm text-muted">Spin the wheel. Do the Earth science challenge — or pass. {TOTAL_SPINS} spins!</p>
      <div className="mt-5 grid w-full grid-cols-3 gap-3">
        {[["Done it", done, "text-emerald"], ["Passed", passed, "text-crimson"], ["Spins", `${spins}/${TOTAL_SPINS}`, "text-gold"]].map(([l, v, c]) => (
          <div key={l as string} className="glass rounded-2xl py-2 text-center">
            <div className={`font-display text-3xl font-extrabold ${c}`}>{v}</div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted">{l}</div>
          </div>
        ))}
      </div>

      <div className="relative mt-6 w-full max-w-[340px]">
        <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,.6))" }}>
          <svg width="34" height="40" viewBox="0 0 34 40"><path d="M17 38 L3 6 Q17 -2 31 6 Z" fill="#FFD700" stroke="#7a5a00" strokeWidth="2" /></svg>
        </div>
        <div className="rounded-full p-2" style={{ background: "conic-gradient(from 0deg, #FFD700, #ff9f1c, #FFD700, #ff9f1c, #FFD700)", boxShadow: "0 0 60px -10px rgba(255,215,0,.55), 0 30px 60px -20px rgba(0,0,0,.9)" }}>
          <svg viewBox="0 0 300 300" className="block w-full rounded-full bg-[#0d1030]"
            style={{ transform: `rotate(${rot}deg)`, transition: spinning ? `transform ${dur}s cubic-bezier(.12,.75,.2,1)` : "none" }}>
            <defs>
              <radialGradient id="spinShine" cx="50%" cy="50%" r="50%"><stop offset="60%" stopColor="#fff" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity=".35" /></radialGradient>
              {CHALLENGES.map((c, i) => (
                <linearGradient key={i} id={`sw${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c.color} /><stop offset="1" stopColor={c.color} stopOpacity=".65" /></linearGradient>
              ))}
            </defs>
            {CHALLENGES.map((c, i) => {
              const mid = (i + 0.5) * SLICE;
              return (
                <g key={i}>
                  <path d={wedge(i)} fill={`url(#sw${i})`} stroke="rgba(5,7,15,.75)" strokeWidth="2" opacity={current !== null && current !== i ? 0.45 : 1} />
                  <g transform={`rotate(${mid} ${C} ${C})`}>
                    <text x={C} y={C - R * 0.66} textAnchor="middle" dominantBaseline="central" fontSize="34">{c.emoji}</text>
                  </g>
                </g>
              );
            })}
            <circle cx={C} cy={C} r={R} fill="url(#spinShine)" pointerEvents="none" />
            <circle cx={C} cy={C} r="30" fill="#151338" stroke="rgba(255,215,0,.6)" strokeWidth="3" />
            <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="900" fill="#FFD700" style={{ transform: `rotate(${-rot}deg)`, transformOrigin: "150px 150px", transition: spinning ? `transform ${dur}s cubic-bezier(.12,.75,.2,1)` : "none" }}>BEDROCK</text>
          </svg>
        </div>
      </div>

      {!ch && !finished && (
        <button onClick={spin} disabled={spinning}
          className="mt-6 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-10 py-4 font-display text-xl font-extrabold text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)] transition enabled:hover:-translate-y-0.5 disabled:opacity-60">
          {spinning ? "Spinning…" : "🌀 SPIN"}
        </button>
      )}

      {ch && (
        <div className="glass mt-6 w-full rounded-3xl border p-5 text-center" style={{ borderColor: ch.color + "66", backgroundImage: `linear-gradient(160deg, ${ch.color}2e, transparent 70%)` }}>
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: ch.color }}>Your Earth science challenge</div>
          <div className="mt-2 font-display text-2xl font-extrabold text-fg">{ch.emoji} {ch.text}</div>
          <p className="mt-2 text-sm text-muted">💡 {ch.fact}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => act(true)} className="rounded-2xl bg-emerald-400 px-5 py-2.5 font-bold text-[#04130c] transition hover:-translate-y-0.5">✅ Done it!</button>
            <button onClick={() => act(false)} className="glass rounded-2xl px-5 py-2.5 font-bold text-fg transition hover:bg-white/10">⏭️ Pass</button>
          </div>
        </div>
      )}

      {finished && (
        <div className="mt-6 w-full rounded-3xl border border-gold/40 bg-gold/10 p-6 text-center">
          <div className="font-display text-3xl font-extrabold text-gold">Challenge complete!</div>
          <div className="mt-3 flex justify-center gap-10">
            <div><div className="font-display text-4xl font-extrabold text-emerald">{done}</div><div className="text-xs font-bold uppercase tracking-widest text-muted">Completed</div></div>
            <div><div className="font-display text-4xl font-extrabold text-crimson">{passed}</div><div className="text-xs font-bold uppercase tracking-widest text-muted">Passed</div></div>
          </div>
          <p className="mt-3 text-sm text-fg">{pct >= 0.75 ? "🏆 Rock solid! You tackled most challenges like a real geologist!" : pct >= 0.5 ? "🌟 Solid effort! Every challenge builds your Earth science skills." : "💪 Even showing up to spin counts! Mountains rise one layer at a time."}</p>
          <button onClick={restart} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-6 py-3 font-bold text-ink"><RotateCcw className="size-4" /> Spin again</button>
        </div>
      )}

      <Link href="/arcade/" className="glass mt-6 text-fg inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold transition hover:bg-white/10"><Gamepad2 className="size-4" /> More games</Link>
    </div>
  );
}
