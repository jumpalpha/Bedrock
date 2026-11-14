"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import data from "./data/game04_millionaire.json";
import { Btn, Shell, shuffle, typingTarget } from "./shared-a";

// Bedrock twin of Dopps Class game04_millionaire. 15 questions up the money tree (Dopps used 12), safe havens at Q5 and Q10 (★),
// lifelines 50:50 / Phone a Friend / Ask the Class, walk away any time. Options shuffle per question.
type Q = { q: string; opts: string[]; ans: number; val: string; exp?: string };
const BASE = data.QS as Q[];
const SAFE = [4, 9];
const L4 = ["A", "B", "C", "D"];

const shufOpts = (q: Q): Q => { const idx = shuffle([0, 1, 2, 3]); return { ...q, opts: idx.map((i) => q.opts[i]), ans: idx.indexOf(q.ans) }; };

type Over = null | "walk" | "end";

export function Game04Millionaire() {
  const [qs, setQs] = useState<Q[]>(BASE);
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState("$0");
  const [used, setUsed] = useState({ fifty: false, phone: false, poll: false });
  const [elim, setElim] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [status, setStatus] = useState("Choose an answer, or use a lifeline!");
  const [poll, setPoll] = useState<number[] | null>(null);
  const [over, setOver] = useState<Over>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const init = () => {
    if (timer.current) clearTimeout(timer.current);
    setQs(BASE.map((q, i) => (i === 0 ? shufOpts(q) : q)));
    setQIdx(0); setScore("$0"); setUsed({ fifty: false, phone: false, poll: false }); setElim([]); setPicked(null); setPoll(null);
    setStatus("Choose an answer, or use a lifeline!"); setOver(null);
  };
  useEffect(() => { init(); return () => { if (timer.current) clearTimeout(timer.current); }; }, []);

  const q = qs[qIdx];
  const answered = picked !== null;

  const pick = (i: number) => {
    if (answered || over || elim.includes(i)) return;
    setPicked(i);
    if (i === q.ans) {
      setScore(q.val); setStatus(`Correct! You've won ${q.val}! ${q.exp || ""}`);
      timer.current = setTimeout(() => {
        setPicked(null); setElim([]); setPoll(null);
        if (qIdx === qs.length - 1) setOver("end");
        else { setQs((all) => all.map((x, j) => (j === qIdx + 1 ? shufOpts(x) : x))); setQIdx(qIdx + 1); setStatus("Choose an answer, or use a lifeline!"); }
      }, 2600);
    } else {
      const safe = SAFE.filter((s) => s < qIdx).pop();
      const safePts = safe !== undefined ? qs[safe].val : "$0";
      setStatus(`Wrong! Correct: ${L4[q.ans]}. ${q.exp || ""} You leave with ${safePts}.`);
      setScore(safePts);
      timer.current = setTimeout(() => setOver("end"), 3200);
    }
  };
  const fifty = () => {
    if (used.fifty || answered) return;
    setUsed({ ...used, fifty: true });
    const wrongs = [0, 1, 2, 3].filter((i) => i !== q.ans && !elim.includes(i));
    setElim([...elim, ...shuffle(wrongs).slice(0, 2)]); setStatus("50/50 used!");
  };
  const phone = () => {
    if (used.phone || answered) return;
    setUsed({ ...used, phone: true });
    setStatus(`Your friend says: "I'm pretty sure it's ${L4[q.ans]}... but not 100% sure!"`);
  };
  const askClass = () => {
    if (used.poll || answered) return;
    setUsed({ ...used, poll: true });
    const norm = [0, 1, 2, 3].map((i) => (i === q.ans ? 52 + Math.floor(Math.random() * 20) : Math.floor(Math.random() * 18)));
    const tot = norm.reduce((a, b) => a + b, 0);
    const pcts = norm.map((p) => Math.round((p / tot) * 100));
    setPoll(pcts); setStatus("Class poll: " + L4.map((l, i) => `${l}: ${pcts[i]}%`).join(" | "));
  };
  const walk = () => { if (timer.current) clearTimeout(timer.current); setOver("walk"); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typingTarget(e) || over) return;
      const i = L4.indexOf(e.key.toUpperCase());
      if (i >= 0) pick(i);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (over) {
    const million = over === "end" && qIdx === qs.length - 1 && score === qs[qs.length - 1].val;
    return (
      <Shell title={over === "walk" ? "You walked away" : million ? "ONE MILLION DOLLARS!" : "Game Over"} sub="Who Wants to Be a Millionaire? — Earth Science Edition" wide={false}>
        <div className="cr-dark animate-rise rounded-3xl border border-gold/40 bg-gradient-to-b from-[#17423a] to-[#08130f]/90 p-10 text-center shadow-[0_0_80px_-20px_rgba(255,209,102,.6)]">
          <div className="text-lg text-fg/60">{over === "walk" ? "You walked away with" : million ? "CONGRATULATIONS!" : "You finished with:"}</div>
          <div className="mt-2 font-display text-7xl font-extrabold text-gold [text-shadow:0_0_30px_rgba(255,209,102,.5)]">{score}</div>
          <Btn big className="mt-8" onClick={init}><RotateCcw className="mr-2 inline size-5" />Play Again</Btn>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Who Wants to Be a Millionaire?" sub="Earth Science Edition — Bedrock">
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="cr-dark grid grid-cols-3 gap-3">
            {([["fifty", "50:50", "50/50", fifty], ["phone", "📞", "Phone a Friend", phone], ["poll", "📊", "Ask the Class", askClass]] as const).map(([key, icon, label, fn]) => (
              <button key={key} onClick={fn} disabled={used[key] || answered}
                className={`rounded-2xl border px-3 py-3 text-center transition ${used[key] ? "border-fg/5 bg-[#123029] opacity-30" : "border-[#4c9a83] bg-[#123029] hover:-translate-y-0.5 hover:shadow-[0_0_24px_-6px_rgba(92,107,192,.9)]"}`}>
                <div className="font-display text-2xl font-extrabold">{icon}</div>
                <div className="text-sm font-semibold text-fg/70">{label}</div>
              </button>
            ))}
          </div>

          <div className="cr-dark mt-5 rounded-3xl border-2 border-[#2f7a66] bg-gradient-to-b from-[#10302a] to-[#08130f] p-6 text-center shadow-[0_0_50px_-20px_rgba(47,122,102,.9)] sm:p-8">
            <div className="text-xs font-bold uppercase tracking-widest text-fg/50">Question {qIdx + 1} of {qs.length}</div>
            <div className="mt-3 font-display text-2xl font-bold leading-snug text-white sm:text-4xl">{q.q}</div>
            <div className="mt-3 font-display text-xl font-extrabold text-gold">{q.val}</div>
          </div>

          <div className="cr-dark mt-4 grid gap-3 sm:grid-cols-2">
            {q.opts.map((o, i) => {
              const gone = elim.includes(i);
              const isCorrect = answered && i === q.ans, isWrong = answered && i === picked && i !== q.ans;
              return (
                <button key={i} onClick={() => pick(i)} disabled={gone || answered}
                  className={`flex items-start gap-3 rounded-2xl border-2 px-5 py-4 text-left text-lg font-semibold transition sm:text-xl ${gone ? "border-transparent bg-[#123029] opacity-20" : isCorrect ? "border-emerald bg-[#0f4d3a] shadow-[0_0_30px_-6px_rgba(0,229,160,.9)]" : isWrong ? "border-[#ff5252] bg-[#b71c1c]/90" : "border-[#2f7a66] bg-[#123029] enabled:hover:bg-[#17423a]"}`}>
                  <span className="font-display font-extrabold text-gold">{L4[i]}:</span>
                  <span className="flex-1">{gone ? "" : o}</span>
                  {poll && !gone && <span className="text-sm font-bold text-sky">{poll[i]}%</span>}
                </button>
              );
            })}
          </div>

          {poll && (
            <div className="mt-4 flex h-28 items-end justify-center gap-6">
              {poll.map((p, i) => (
                <div key={i} className="flex w-14 flex-col items-center">
                  <div className="text-sm font-bold text-sky">{p}%</div>
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-sky/40 to-sky" style={{ height: `${Math.max(4, p * 0.8)}px` }} />
                  <div className="mt-1 font-display font-extrabold text-gold">{L4[i]}</div>
                </div>
              ))}
            </div>
          )}

          <div className="glass mt-4 min-h-14 rounded-2xl px-5 py-3 text-center text-lg text-fg/85">{status}</div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Btn tone="orange" onClick={walk}>Walk Away (keep {score})</Btn>
            <Btn tone="ghost" onClick={init}>Restart</Btn>
          </div>
          <p className="mt-2 text-center text-xs text-muted">Keyboard: press A, B, C or D to lock in an answer.</p>
        </div>

        <div className="glass flex flex-col gap-1 self-start rounded-3xl p-3">
          {qs.map((qq, i) => ({ qq, i })).reverse().map(({ qq, i }) => {
            const cls = i < qIdx ? "bg-emerald/15 text-emerald" : i === qIdx ? "bg-gradient-to-r from-gold/30 to-amber/20 font-extrabold text-gold shadow-[0_0_20px_-6px_rgba(255,209,102,.8)]" : "text-fg/40";
            return (
              <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-1.5 font-display text-lg ${cls}`}>
                <span className="w-5 text-gold">{SAFE.includes(i) ? "★" : ""}</span>
                <span className="flex-1 pl-2">{i + 1}. {qq.val}</span>
                <span className="text-sm">{i === qIdx ? "← you" : ""}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
