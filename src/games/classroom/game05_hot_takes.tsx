"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, RotateCcw } from "lucide-react";
import data from "./data/game05_hot_takes.json";
import { Btn, Shell, TEAM_COLORS, shuffle, typingTarget } from "./shared-a";

// Bedrock twin of Dopps Class game05_hot_takes. Four players race to BUZZ; 20-second timer auto-reveals if nobody
// buzzes. Correct = +pts, wrong = -half. Two correct in a row = streak (+100 on every question after).
type Q = { type: "hot" | "rapid" | "blitz"; q: string; a: string; fact: string; pts: number };
const QUESTIONS = data.QUESTIONS as Q[];
const SECS = 20;
const TYPE_LABEL = { hot: "Hot Take", rapid: "Rapid Fire", blitz: "60-Sec Blitz" } as const;

export function Game05HotTakes() {
  const [players, setPlayers] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [streaks, setStreaks] = useState([0, 0, 0, 0]);
  const [qs, setQs] = useState<Q[]>(QUESTIONS);
  const [qIdx, setQIdx] = useState(0);
  const [buzzed, setBuzzed] = useState(-1);
  const [revealed, setRevealed] = useState(false);
  const [left, setLeft] = useState(SECS);
  const [timerKey, setTimerKey] = useState(0); // bump to restart the 20s bar
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => { if (iv.current) clearInterval(iv.current); iv.current = null; };
  const init = () => { setQs(shuffle(QUESTIONS)); setQIdx(0); setScores([0, 0, 0, 0]); setStreaks([0, 0, 0, 0]); setBuzzed(-1); setRevealed(false); setTimerKey((k) => k + 1); };
  useEffect(() => { init(); return stop; }, []);

  const done = qIdx >= qs.length;
  // (Re)start the bar on every new question and on every buzz, exactly like the original render().
  useEffect(() => {
    if (done) return;
    stop(); setLeft(SECS);
    iv.current = setInterval(() => setLeft((l) => Math.max(0, l - 0.1)), 100);
    return stop;
  }, [timerKey, done]);
  useEffect(() => {
    if (left > 0 || !iv.current) return;
    stop();
    if (!revealed && buzzed < 0) setRevealed(true);
  }, [left, revealed, buzzed]);

  const q = qs[qIdx];
  const bonus = (p: number) => (p >= 0 && streaks[p] >= 2 ? 100 : 0);
  const pts = q ? q.pts + bonus(buzzed) : 0;

  const buzz = (i: number) => { if (buzzed >= 0 || revealed || done) return; setBuzzed(i); setTimerKey((k) => k + 1); };
  const reveal = () => { if (revealed || done) return; setRevealed(true); stop(); };
  const nextQ = () => { stop(); setQIdx((n) => n + 1); setBuzzed(-1); setRevealed(false); setTimerKey((k) => k + 1); };
  const scoreIt = (correct: boolean) => {
    if (buzzed < 0 || !revealed) return;
    const p = q.pts + bonus(buzzed);
    setScores((s) => s.map((v, i) => (i !== buzzed ? v : correct ? v + p : v - Math.round(p / 2))));
    setStreaks((s) => s.map((v, i) => (i !== buzzed ? v : correct ? v + 1 : 0)));
    nextQ();
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typingTarget(e) || done) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) buzz(n - 1);
      else if (e.key === " " && !revealed) { e.preventDefault(); reveal(); }
      else if (revealed && buzzed >= 0 && e.key.toLowerCase() === "c") scoreIt(true);
      else if (revealed && buzzed >= 0 && e.key.toLowerCase() === "w") scoreIt(false);
      else if (e.key.toLowerCase() === "n") nextQ();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (done) {
    const max = Math.max(...scores);
    const order = players.map((p, i) => ({ p, i })).sort((a, b) => scores[b.i] - scores[a.i]);
    return (
      <Shell title="Game Over" sub="Earth Science Hot Takes — Buzzer Battle" wide={false}>
        <div className="glass animate-rise rounded-3xl p-6">
          <div className="text-center font-display text-3xl font-extrabold">Final Scores</div>
          <div className="mt-4 space-y-2">
            {order.map(({ p, i }) => (
              <div key={i} className="flex items-center justify-between rounded-2xl px-5 py-3 text-xl"
                style={{ background: scores[i] === max ? "rgba(255,209,102,.18)" : "color-mix(in srgb, var(--color-fg) 4%, transparent)", boxShadow: scores[i] === max ? "0 0 30px -10px #ffd166" : undefined }}>
                <span className="font-bold" style={{ color: TEAM_COLORS[i] }}>{p}{scores[i] === max ? " WINNER!" : ""}</span>
                <span className="font-display font-extrabold text-gold">{scores[i]} pts</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center"><Btn big onClick={init}><RotateCcw className="mr-2 inline size-5" />Play Again</Btn></div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Earth Science Hot Takes" sub={`Buzzer Battle — Q ${qIdx + 1}/${qs.length}`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {players.map((p, i) => {
          const c = TEAM_COLORS[i], on = buzzed === i;
          return (
            <div key={i} className="rounded-3xl border-2 p-3 text-center transition"
              style={{ borderColor: on ? "#ffd166" : `${c}55`, background: `linear-gradient(180deg, ${c}30, ${c}10)`, boxShadow: on ? "0 0 40px -6px #ffd166" : undefined, transform: on ? "scale(1.03)" : undefined }}>
              <input value={p} maxLength={18} onChange={(e) => setPlayers(players.map((v, j) => (j === i ? e.target.value : v)))}
                className="w-full bg-transparent text-center text-sm font-bold uppercase tracking-widest outline-none" style={{ color: c }} />
              <div className="font-display text-4xl font-extrabold text-gold">{scores[i]}</div>
              <div className="h-5 text-xs font-bold text-amber">{streaks[i] >= 2 ? `🔥 Streak x${streaks[i]} (+100)` : ""}</div>
              <button onClick={() => buzz(i)} disabled={buzzed >= 0 || revealed}
                className="mt-1 w-full rounded-2xl py-4 font-display text-2xl font-extrabold text-ink transition enabled:hover:-translate-y-0.5 enabled:active:scale-95 disabled:opacity-35"
                style={{ background: c, boxShadow: `0 10px 30px -10px ${c}` }}>BUZZ! <span className="text-sm opacity-70">[{i + 1}]</span></button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-fg/10">
        <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${(left / SECS) * 100}%`, background: left < 5 ? "#ff3b5c" : "linear-gradient(90deg,#ffd166,#ff9f1c)" }} />
      </div>

      <div key={qIdx} className="cr-dark mt-5 animate-rise rounded-3xl border border-[#ff6b3d]/40 bg-gradient-to-b from-[#3a0d14] to-[#1a0710] p-6 text-center shadow-[0_0_60px_-25px_rgba(255,107,61,.9)] sm:p-10">
        <div className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.25em] text-[#ff8a5c]"><Flame className="size-4" />{TYPE_LABEL[q.type]}</div>
        <div className="mt-3 font-display text-3xl font-bold leading-snug text-white sm:text-5xl">{q.q}</div>
        <div className="mt-4 font-display text-xl font-extrabold text-gold">{pts} pts{buzzed >= 0 && streaks[buzzed] >= 2 ? " (streak bonus!)" : ""}</div>
      </div>

      {revealed && (
        <div className="mt-4 animate-rise rounded-3xl border border-emerald/40 bg-emerald/10 p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-fg/60">Correct answer:</div>
          <div className="mt-1 font-display text-2xl font-extrabold text-emerald sm:text-3xl">{q.a}</div>
          <div className="mt-2 text-lg text-fg/75">{q.fact}</div>
        </div>
      )}

      <p className="mt-4 text-center font-display text-2xl font-bold">
        {buzzed >= 0 ? <span style={{ color: TEAM_COLORS[buzzed] }}>{players[buzzed]} buzzed in!</span> : revealed ? "Score the answer above." : "Waiting for a buzz..."}
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {!revealed && <Btn tone="blue" big onClick={reveal}>Reveal Answer</Btn>}
        {revealed && buzzed >= 0 && <Btn tone="good" big onClick={() => scoreIt(true)}>Correct (+{pts})</Btn>}
        {revealed && buzzed >= 0 && <Btn tone="bad" big onClick={() => scoreIt(false)}>Wrong (-{Math.round(pts / 2)})</Btn>}
        {revealed && buzzed < 0 && <Btn big onClick={nextQ}>Next Question</Btn>}
        <Btn tone="ghost" big onClick={nextQ}>Skip</Btn>
      </div>
      <p className="mt-2 text-center text-xs text-muted">Keyboard: 1–4 buzz · Space reveal · C correct · W wrong · N skip</p>
    </Shell>
  );
}
