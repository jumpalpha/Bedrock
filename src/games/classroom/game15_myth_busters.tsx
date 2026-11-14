"use client";

// Bedrock twin of Dopps Class game15_myth_busters — two teams alternate myths, calling TRUE or FALSE.
// Correct = +100 (+50 bonus while on a 2+ streak); wrong resets the streak. Optional 20s timed mode:
// when time runs out the answer is revealed with no points.
import { useCallback, useState } from "react";
import { ArrowRight, RotateCcw, Timer } from "lucide-react";
import data from "./data/game15_myth_busters.json";
import { Btn, Hint, Shell, TEAM_COLORS, TeamCard, TimerBadge, sfx, shuffle, useDeck, useCountdown, useKeys } from "./shared-c";

type Myth = { myth: string; answer: boolean; cat: string; explanation: string };
type Log = { myth: string; answer: boolean; correct: boolean; cat: string };
const MYTHS = (data as { MYTHS: Myth[] }).MYTHS;
const SECS = 20;

export function Game15MythBusters() {
  const [teams, setTeams] = useState(["Team 1", "Team 2"]);
  const [scores, setScores] = useState([0, 0]);
  const [streaks, setStreaks] = useState([0, 0]);
  const [cur, setCur] = useState(0);
  const [deck, setDeck] = useDeck(MYTHS);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [log, setLog] = useState<Log[]>([]);
  const [timed, setTimed] = useState(false);
  const [timer, setTimer] = useState(SECS);
  const [last, setLast] = useState<null | { correct: boolean; pts: number }>(null);

  const init = () => {
    setDeck(shuffle(MYTHS)); setIdx(0); setScores([0, 0]); setStreaks([0, 0]); setCur(0); setAnswered(false); setLog([]); setTimed(false); setTimer(SECS); setLast(null);
  };

  const done = idx >= deck.length;
  const m = deck[Math.min(idx, deck.length - 1)];

  const autoAnswer = useCallback(() => { setAnswered(true); setLast(null); sfx.buzz(); }, []);
  useCountdown(timed && !answered && !done, setTimer, timer, autoAnswer);

  const answer = (b: boolean) => {
    if (answered || done) return;
    setAnswered(true);
    const correct = b === m.answer;
    const pts = correct ? 100 + (streaks[cur] >= 2 ? 50 : 0) : 0;
    if (correct) { setScores((s) => s.map((v, i) => (i === cur ? v + pts : v))); setStreaks((s) => s.map((v, i) => (i === cur ? v + 1 : v))); sfx.good(); }
    else { setStreaks((s) => s.map((v, i) => (i === cur ? 0 : v))); sfx.bad(); }
    setLast({ correct, pts });
    setLog((l) => [...l, { myth: m.myth, answer: b, correct, cat: m.cat }]);
  };
  const nextQ = () => { setAnswered(false); setIdx((i) => i + 1); setCur((c) => (c + 1) % teams.length); setTimer(SECS); setLast(null); };
  const startTimer = () => { setTimed(true); setTimer(SECS); sfx.click(); };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (done) { if (k === "enter") init(); return; }
    if (!answered && (k === "t" || k === "arrowleft")) answer(true);
    else if (!answered && (k === "f" || k === "arrowright")) answer(false);
    else if (answered && (k === "enter" || k === "n" || k === " ")) { e.preventDefault(); nextQ(); }
    else if (!answered && !timed && k === "m") startTimer();
  });

  if (done) {
    const total = log.length, correct = log.filter((l) => l.correct).length, pct = total ? Math.round((correct / total) * 100) : 0;
    const best = Math.max(...scores);
    return (
      <Shell title="Myth Busters — Final" max="max-w-3xl">
        <div className="cr-dark animate-rise rounded-3xl border-2 border-emerald/50 bg-gradient-to-b from-[#0d2a1f]/90 to-[#0b110e]/90 p-6 text-center shadow-[0_0_50px_-20px_#00e5a0] sm:p-8">
          <div className="font-display text-4xl font-extrabold text-emerald">Results</div>
          <p className="mt-1 text-lg text-muted">{correct} of {total} myths correctly identified ({pct}%)</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {teams.map((t, i) => (
              <div key={i} className="rounded-2xl border-2 p-4" style={{ borderColor: `${TEAM_COLORS[i]}88`, background: `${TEAM_COLORS[i]}14`, boxShadow: scores[i] === best ? `0 0 30px -8px ${TEAM_COLORS[i]}` : undefined }}>
                <div className="text-sm font-extrabold uppercase tracking-widest" style={{ color: TEAM_COLORS[i] }}>{t}{scores[i] === best && best > 0 ? " 🏆" : ""}</div>
                <div className="font-display text-4xl font-extrabold text-fg">{scores[i]} pts</div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass mt-5 rounded-3xl p-6">
          <div className="text-sm font-extrabold uppercase tracking-widest text-emerald">Your Answers:</div>
          <div className="mt-3 space-y-2">
            {log.map((l, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-fg/[.03] px-3 py-2">
                <span className={`size-3 shrink-0 rounded-full ${l.correct ? "bg-emerald" : "bg-crimson"}`} />
                <span className="flex-1 text-sm text-fg/85">{l.myth.length > 80 ? `${l.myth.substring(0, 80)}...` : l.myth}</span>
                <span className={`shrink-0 text-sm font-bold ${l.correct ? "text-emerald" : "text-crimson"}`}>{l.correct ? "✓" : "✗"} {l.answer ? "TRUE" : "FALSE"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-center"><Btn big onClick={init}><RotateCcw className="size-6" /> Play Again</Btn></div>
      </Shell>
    );
  }

  const pct = Math.round((idx / deck.length) * 100);
  const vc = m.answer ? "#00E5A0" : "#FF3B5C";

  return (
    <Shell title="Myth Busters" sub="True or false? Bust the Earth science myth!" max="max-w-4xl"
      right={<div className="flex items-center gap-3"><div className="glass rounded-full px-4 py-2 font-bold tabular-nums">{idx + 1}/{deck.length}</div>{timed && !answered && <TimerBadge secs={timer} warnAt={10} dangerAt={5} />}</div>}>
      <div className="grid grid-cols-2 gap-3">
        {teams.map((t, i) => (
          <TeamCard key={i} name={t} score={scores[i]} color={TEAM_COLORS[i]} active={i === cur} onName={(v) => setTeams((ts) => ts.map((x, j) => (j === i ? v : x)))}
            extra={<div className="h-5 text-sm font-bold text-amber">{streaks[i] >= 2 ? `🔥 Streak x${streaks[i]}` : ""}</div>} />
        ))}
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald to-sky transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>

      <div key={idx} className="cr-dark mt-5 animate-rise rounded-3xl border-2 p-6 text-center transition-colors sm:p-8"
        style={{ borderColor: answered ? vc : "color-mix(in srgb, var(--color-fg) 14%, transparent)", background: answered ? `linear-gradient(180deg, ${vc}1a, rgba(11,17,14,.92))` : "linear-gradient(180deg, rgba(22,32,27,.92), rgba(11,17,14,.92))", boxShadow: answered ? `0 0 50px -18px ${vc}` : undefined }}>
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-muted">Myth {idx + 1} of {deck.length} · <span style={{ color: TEAM_COLORS[cur] }}>{teams[cur]}</span></div>
        <span className="mt-3 inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1 text-sm font-bold text-gold">{m.cat}</span>
        <div className="mx-auto mt-4 max-w-3xl font-display text-2xl font-bold leading-snug text-fg sm:text-4xl">{m.myth}</div>
      </div>

      {answered && (
        <div className="mt-4 animate-rise rounded-3xl border-2 p-5 text-center sm:p-6" style={{ borderColor: `${vc}aa`, background: `${vc}14` }}>
          <div className="font-display text-3xl font-extrabold sm:text-4xl" style={{ color: vc }}>{m.answer ? "✅ CONFIRMED — TRUE!" : "🚫 BUSTED — FALSE!"}</div>
          {last ? (
            <div className="mt-1 text-lg font-bold" style={{ color: last.correct ? "var(--color-emerald)" : "var(--cr-lose)" }}>{teams[cur]}: {last.correct ? `Correct! +${last.pts}` : "Wrong — streak reset"}</div>
          ) : (
            <div className="mt-1 text-lg font-bold text-amber">Time&apos;s up — no points!</div>
          )}
          <div className="mx-auto mt-3 max-w-3xl text-lg leading-relaxed text-fg/90">{m.explanation}</div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <button onClick={() => answer(true)} disabled={answered} className="rounded-3xl bg-emerald px-6 py-6 font-display text-3xl font-extrabold text-ink transition enabled:hover:-translate-y-1 disabled:opacity-35 sm:text-4xl" style={{ boxShadow: "0 16px 40px -14px #00e5a0" }}>TRUE ✓</button>
        <button onClick={() => answer(false)} disabled={answered} className="rounded-3xl bg-crimson px-6 py-6 font-display text-3xl font-extrabold text-white transition enabled:hover:-translate-y-1 disabled:opacity-35 sm:text-4xl" style={{ boxShadow: "0 16px 40px -14px #ff3b5c" }}>FALSE ✗</button>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {answered ? <Btn big onClick={nextQ} kbd="Enter">Next Myth <ArrowRight className="size-6" /></Btn>
          : !timed && <Btn tone="ghost" onClick={startTimer} className="!border-emerald/60 !text-emerald" kbd="M"><Timer className="size-5" /> Timed Mode (20s)</Btn>}
        <Btn tone="ghost" onClick={init}><RotateCcw className="size-4" /> Restart</Btn>
      </div>
      <Hint>Keys: T true · F false · Enter next myth · M timed mode</Hint>
    </Shell>
  );
}
