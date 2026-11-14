"use client";

// Bedrock twin of Dopps Class game12_would_you_rather — whole-class vote on Earth science dilemmas. First click votes and
// reveals the split; teacher can keep tallying (+1 A / +1 B), open the debate prompt and Earth science fact.
import { useState } from "react";
import { ArrowRight, Lightbulb, MessagesSquare, RotateCcw } from "lucide-react";
import data from "./data/game12_would_you_rather.json";
import { Btn, Hint, Shell, shuffle, useDeck, sfx, useKeys } from "./shared-c";

type Q = { a: string; b: string; cat: string; debate: string; fact: string };
const QS = (data as { QS: Q[] }).QS;
const A = "#4ade80", B = "#3b82f6";

export function Game12WouldYouRather() {
  const [qs, setQs] = useDeck(QS);
  const [qIdx, setQIdx] = useState(0);
  const [votesA, setVotesA] = useState(0);
  const [votesB, setVotesB] = useState(0);
  const [voted, setVoted] = useState(false);
  const [showDebate, setShowDebate] = useState(false);
  const [showFact, setShowFact] = useState(false);

  const q = qs[qIdx];
  const total = votesA + votesB;
  const pctA = total ? Math.round((votesA / total) * 100) : 50;
  const pctB = total ? Math.round((votesB / total) * 100) : 50;

  const voteA = () => { setVotesA((v) => v + 1); setVoted(true); sfx.click(); };
  const voteB = () => { setVotesB((v) => v + 1); setVoted(true); sfx.click(); };
  const clear = () => { setVoted(false); setVotesA(0); setVotesB(0); setShowDebate(false); setShowFact(false); };
  const next = () => { setQIdx((i) => (i + 1) % qs.length); clear(); };
  const init = () => { setQs(shuffle(QS)); setQIdx(0); clear(); };

  useKeys((e) => {
    const k = e.key.toLowerCase();
    if (k === "a" || k === "arrowleft") voteA();
    else if (k === "b" || k === "arrowright") voteB();
    else if (k === "d") setShowDebate((s) => !s);
    else if (k === "f") setShowFact((s) => !s);
    else if (k === "n" || k === "enter") next();
  });

  const Option = ({ label, text, color, pct, onClick }: { label: string; text: string; color: string; pct: number; onClick: () => void }) => (
    <button onClick={voted ? undefined : onClick}
      className={`cr-dark group relative flex min-h-56 flex-col items-center justify-center rounded-3xl border-2 p-6 text-center transition ${voted ? "cursor-default" : "hover:-translate-y-1"}`}
      style={{ borderColor: `${color}aa`, background: `linear-gradient(180deg, ${color}1f, rgba(11,17,14,.88))`, boxShadow: `0 0 40px -16px ${color}` }}>
      <div className="text-sm font-extrabold uppercase tracking-[0.25em]" style={{ color }}>{label}</div>
      <div className="mt-3 text-xl font-bold leading-snug text-fg sm:text-2xl">{text}</div>
      {voted && <div className="mt-4 font-display text-5xl font-extrabold" style={{ color }}>{pct}%</div>}
    </button>
  );

  return (
    <Shell title="Would You Rather?" sub="Earth Science Edition — Bedrock">
      <div className="text-center text-sm font-semibold uppercase tracking-widest text-muted">Question {qIdx + 1} of {qs.length}</div>
      <div className="mt-2 text-center"><span className="inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1 text-sm font-bold text-gold">{q.cat}</span></div>

      <div key={qIdx} className="mt-5 grid animate-rise items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <Option label="Option A" text={q.a} color={A} pct={pctA} onClick={voteA} />
        <div className="grid place-items-center">
          <div className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-gold to-[#ff6b3d] font-display text-xl font-extrabold text-ink shadow-[0_0_30px_-6px_rgba(255,159,28,.9)]">OR</div>
        </div>
        <Option label="Option B" text={q.b} color={B} pct={pctB} onClick={voteB} />
      </div>

      {voted && (
        <div className="glass mt-5 animate-rise rounded-3xl p-5">
          <div className="flex justify-between text-base font-bold sm:text-lg">
            <span style={{ color: A }}>A: {votesA} votes</span><span className="text-muted">Total: {total}</span><span style={{ color: B }}>B: {votesB} votes</span>
          </div>
          {([["A", pctA, A], ["B", pctB, B]] as const).map(([l, p, c]) => (
            <div key={l} className="mt-3 flex items-center gap-3">
              <div className="w-6 font-display text-xl font-extrabold" style={{ color: c }}>{l}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${p}%`, background: c, boxShadow: `0 0 16px ${c}` }} /></div>
              <div className="w-14 text-right font-bold tabular-nums">{p}%</div>
            </div>
          ))}
        </div>
      )}

      {showDebate && (
        <div className="mt-4 animate-rise rounded-2xl border-l-4 border-gold bg-gold/10 p-5 text-lg leading-relaxed text-fg">
          <div className="mb-1 text-xs font-extrabold uppercase tracking-widest text-gold">Debate Prompt</div>{q.debate}
        </div>
      )}
      {showFact && (
        <div className="mt-4 animate-rise rounded-2xl border-l-4 border-emerald bg-emerald/10 p-5 text-lg leading-relaxed text-fg">
          <div className="mb-1 text-xs font-extrabold uppercase tracking-widest text-emerald">Earth Science Fact</div>{q.fact}
        </div>
      )}

      <div className="glass mt-5 rounded-2xl px-4 py-3 text-center font-semibold sm:text-lg">
        {voted ? "Voted! Open a class debate or see the Earth science fact." : "Click your choice — then compare with the class!"}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button onClick={voteA} className="rounded-2xl px-6 py-3 font-display text-lg font-extrabold text-ink transition hover:-translate-y-0.5" style={{ background: A }}>{voted ? "+1 A" : "A"}</button>
        <button onClick={voteB} className="rounded-2xl px-6 py-3 font-display text-lg font-extrabold text-white transition hover:-translate-y-0.5" style={{ background: B }}>{voted ? "+1 B" : "B"}</button>
        <Btn tone="ghost" onClick={() => setShowDebate((s) => !s)}><MessagesSquare className="size-5" /> Debate Prompt</Btn>
        <Btn tone="ghost" onClick={() => setShowFact((s) => !s)}><Lightbulb className="size-5" /> Earth Science Fact</Btn>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <Btn big onClick={next}>Next Question <ArrowRight className="size-6" /></Btn>
        <Btn tone="ghost" onClick={init}><RotateCcw className="size-4" /> Restart</Btn>
      </div>
      <Hint>Keys: A / B vote · D debate · F fact · N next question</Hint>
    </Shell>
  );
}
