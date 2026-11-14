"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, RotateCcw, Shuffle, Timer, X, Zap } from "lucide-react";
import data from "./data/game09_family_feud.json";
import { OnTop } from "./theme";
import { BtnB, Card, FrameB, StatusB, beep, shuffleB } from "./shared-b";

// Bedrock twin of Dopps Class game09_family_feud: two teams, answer board, strikes, pass, steal, reveal all,
// plus a Fast Money list. Teacher drives everything from the board.
// Dopps used real survey data. Bedrock has no survey behind these boards, so every board is labeled as the
// teacher's estimate of the most common answers (points = estimated share), never as survey results.
type Ans = { text: string; pts: number };
type Q = { survey: string; answers: Ans[] };
type FM = { q: string; a: string; pts: number };
const GD = (data as { _GD9: { QUESTIONS: Q[]; FAST_MONEY_Q: FM[] } })._GD9;
const FAST_MONEY_Q = GD.FAST_MONEY_Q;
const TEAM_C = ["#38bfff", "#ff3b5c"];

const sndDing = () => { beep(988, 0.12, "triangle"); beep(1319, 0.22, "triangle", 0.1); };
const sndBuzz = () => { beep(110, 0.5, "sawtooth"); beep(116, 0.5, "square"); };

export function Game09FamilyFeud() {
  const [questions, setQuestions] = useState<Q[]>(GD.QUESTIONS);
  const [teams, setTeams] = useState(["Team 1", "Team 2"]);
  const [scores, setScores] = useState([0, 0]);
  const [cur, setCur] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [strikes, setStrikes] = useState(0);
  const [roundPts, setRoundPts] = useState(0);
  const [banked, setBanked] = useState(false);
  const [msg, setMsg] = useState("");
  const [bigX, setBigX] = useState(0);
  const [fast, setFast] = useState(false);
  const [fastShown, setFastShown] = useState<boolean[]>([]);
  const [fastLeft, setFastLeft] = useState<number | null>(null);

  const q = questions[qIdx];
  const init = () => {
    setQuestions(shuffleB(GD.QUESTIONS)); setQIdx(0); setRevealed([]); setStrikes(0); setRoundPts(0);
    setCur(0); setScores([0, 0]); setBanked(false); setMsg(""); setFast(false);
  };
  // shuffle once on mount (the original shuffles at load)
  useEffect(() => { const t = setTimeout(() => setQuestions(shuffleB(GD.QUESTIONS)), 0); return () => clearTimeout(t); }, []);

  const revealAnswer = (i: number) => {
    if (revealed[i] || !q.answers[i]?.text) return;
    setRevealed((rv) => { const r = [...rv]; r[i] = true; return r; });
    if (!banked) setRoundPts((p) => p + q.answers[i].pts);
    setMsg(""); sndDing();
  };
  const addStrike = () => {
    const s = strikes + 1; setStrikes(s); sndBuzz(); setBigX(Math.min(s, 3));
    setTimeout(() => setBigX(0), 900);
    setMsg(s >= 3 ? "3 STRIKES! Other team can steal!" : "");
  };
  const passTurn = () => { setCur((c) => (c + 1) % 2); setStrikes(0); setMsg(""); };
  const steal = () => {
    if (banked) return;
    const pts = roundPts;
    setScores((s) => s.map((v, i) => (i === cur ? v + pts : v)));
    setRevealed(q.answers.map(() => true)); setBanked(true);
    setMsg(`${teams[cur]} steals ${pts} points!`); sndDing();
  };
  const revealAll = () => {
    setRevealed(q.answers.map(() => true));
    if (!banked) setRoundPts(q.answers.reduce((s, a) => s + a.pts, 0));
  };
  const nextQuestion = () => {
    if (!banked) setScores((s) => s.map((v, i) => (i === cur ? v + roundPts : v)));
    setQIdx((qIdx + 1) % questions.length); setRevealed([]); setStrikes(0); setRoundPts(0);
    setCur((c) => (c + 1) % 2); setBanked(false); setMsg("");
  };

  useEffect(() => {
    if (fastLeft === null || fastLeft <= 0) { if (fastLeft === 0) sndBuzz(); return; }
    const t = setTimeout(() => setFastLeft((l) => (l ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [fastLeft]);

  useEffect(() => {
    if (fast) return;
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const d = parseInt(e.key);
      if (d >= 1 && d <= 9) revealAnswer(d - 1);
      else if (e.key.toLowerCase() === "x") addStrike();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (fast) {
    return (
      <FrameB title="Fast Money Round" sub="Speed round — 30 seconds!" max="max-w-4xl"
        right={
          <button type="button" onClick={() => setFastLeft(30)}
            className={`glass flex items-center gap-2 rounded-2xl px-5 py-3 font-display text-4xl font-extrabold tabular-nums ${fastLeft !== null && fastLeft <= 5 ? "animate-pulse text-crimson" : "text-gold"}`}>
            <Timer className="size-7" />{fastLeft === null ? "0:30" : `0:${String(fastLeft).padStart(2, "0")}`}
          </button>
        }>
        <Card accent="#ffd166" className="animate-rise">
          <div className="text-center text-lg font-bold text-gold">Teacher reads questions fast — reveal answers one by one!</div>
          <div className="mt-4 divide-y divide-line">
            {FAST_MONEY_Q.map((f, i) => (
              <button key={i} type="button" onClick={() => setFastShown(FAST_MONEY_Q.map((_, j) => (j === i ? !fastShown[j] : !!fastShown[j])))}
                className="block w-full py-3 text-left transition hover:bg-fg/[0.03]">
                <div className="flex items-start justify-between gap-3 text-xl text-fg">
                  <span>{i + 1}. {f.q}</span>
                  <span className="shrink-0 rounded-full bg-gold px-3 py-0.5 text-sm font-extrabold text-ink">{f.pts} pts</span>
                </div>
                {fastShown[i] && <div className="mt-1 animate-rise text-lg font-semibold text-emerald">✓ {f.a}</div>}
              </button>
            ))}
          </div>
        </Card>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <BtnB tone="orange" onClick={() => setFastLeft(30)}><Timer className="mr-2 inline size-4" />Start 30s</BtnB>
          <BtnB onClick={init}><RotateCcw className="mr-2 inline size-4" />New Game</BtnB>
          <BtnB tone="ghost" onClick={() => { setFast(false); setFastLeft(null); }}><ArrowLeft className="mr-2 inline size-4" />Back to Game</BtnB>
        </div>
      </FrameB>
    );
  }

  const shownPts = q.answers.reduce((s, a, i) => s + (revealed[i] ? a.pts : 0), 0);
  return (
    <FrameB title="Earth Science Feud" sub="Top answers — teacher’s estimate">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {[0, 1].map((t) => {
          const on = cur === t, c = TEAM_C[t];
          const card = (
            <div key={t} className="rounded-3xl border-2 px-4 py-3 text-center transition"
              style={{ borderColor: on ? c : "var(--color-line)", background: on ? `${c}1f` : "color-mix(in srgb, var(--color-fg) 3%, transparent)", boxShadow: on ? `0 0 34px -8px ${c}` : undefined }}>
              <input value={teams[t]} maxLength={20} onChange={(e) => setTeams(teams.map((v, j) => (j === t ? e.target.value : v)))}
                className="w-full bg-transparent text-center text-lg font-bold uppercase tracking-widest outline-none" style={{ color: c }} />
              <div className="font-display text-5xl font-extrabold text-fg">{scores[t]}</div>
            </div>
          );
          return t === 0 ? card : [
            <div key="mid" className="rounded-2xl bg-gradient-to-b from-gold to-amber px-5 py-3 text-center text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)]">
              <div className="text-[10px] font-extrabold uppercase tracking-widest">Round</div>
              <div className="font-display text-4xl font-extrabold">{roundPts || "?"}</div>
            </div>,
            card,
          ];
        })}
      </div>

      <Card className="mt-4 text-center" accent="#ffd166">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-gold/80">Question {qIdx + 1} of {questions.length}</div>
        <div className="mt-2 font-display text-2xl font-extrabold leading-snug text-gold sm:text-3xl">{q.survey}</div>
        <div className="mt-2 text-xs font-semibold text-muted">Top answers are the teacher’s estimate, not real survey results. Accept any reasonable match.</div>
      </Card>

      <div className="cr-dark mt-4 grid gap-3 sm:grid-cols-2" style={{ perspective: 900 }}>
        {q.answers.map((a, i) => {
          const r = !!revealed[i], empty = !a.text;
          return (
            <button key={`${qIdx}-${i}`} type="button" onClick={() => revealAnswer(i)} disabled={r || empty}
              className={`relative flex min-h-20 items-center justify-between gap-3 rounded-2xl border-2 px-5 py-3 text-left transition ${empty ? "opacity-30" : "enabled:hover:border-gold"}`}
              style={{ borderColor: r ? "#00e5a0" : "rgba(255,209,102,.25)", background: r ? "linear-gradient(180deg,#14543f,#0c3528)" : "linear-gradient(180deg,#17423a,#0a1d19)", animation: r ? "ffFlip .45s ease" : undefined }}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fg/10 font-display text-xl font-extrabold text-gold">{i + 1}</span>
              {r ? (
                <>
                  <span className="flex-1 font-display text-xl font-extrabold text-fg sm:text-2xl">{a.text}</span>
                  <span className="rounded-xl bg-gold px-3 py-1 font-display text-2xl font-extrabold text-ink">{a.pts}</span>
                </>
              ) : (
                <span className="flex-1 text-center text-lg font-semibold text-muted">{empty ? "" : `${a.pts} pts hidden`}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid size-14 place-items-center rounded-full border-2 transition"
            style={{ borderColor: i < strikes ? "#ff3b5c" : "color-mix(in srgb, var(--color-fg) 12%, transparent)", background: i < strikes ? "#ff3b5c" : "transparent", boxShadow: i < strikes ? "0 0 24px -4px #ff3b5c" : undefined }}>
            <X className={`size-8 ${i < strikes ? "text-white" : "text-fg/15"}`} strokeWidth={4} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <StatusB tone={msg ? (msg.includes("STRIKES") ? "bad" : "gold") : undefined}>
          {msg || `${teams[cur]}'s turn. Click tiles to reveal. Revealed: ${shownPts} pts so far.`}
        </StatusB>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <BtnB tone="bad" onClick={addStrike}><X className="mr-1 inline size-5" strokeWidth={3} />Strike</BtnB>
        <BtnB tone="orange" onClick={passTurn}><Shuffle className="mr-2 inline size-4" />Pass Turn</BtnB>
        <BtnB tone="blue" onClick={steal} disabled={banked}><Zap className="mr-2 inline size-4" />STEAL!</BtnB>
        <BtnB tone="good" onClick={revealAll}><Eye className="mr-2 inline size-4" />Reveal All</BtnB>
        <BtnB onClick={nextQuestion}>Next Question <ArrowRight className="ml-1 inline size-4" /></BtnB>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <BtnB tone="ghost" onClick={() => { setFastShown(FAST_MONEY_Q.map(() => false)); setFastLeft(null); setFast(true); }}><Zap className="mr-2 inline size-4" />Fast Money Round</BtnB>
        <BtnB tone="ghost" onClick={init}><RotateCcw className="mr-2 inline size-4" />New Game</BtnB>
      </div>
      <p className="mt-3 text-center text-xs text-muted/80">Keys: 1–8 reveal an answer · X adds a strike. Next Question banks the round points to the team whose turn it is.</p>

      {bigX > 0 && (<OnTop>
        <div className="pointer-events-none fixed inset-0 z-[100] grid place-items-center">
          <div className="flex gap-4" style={{ animation: "ffX .9s ease-out forwards" }}>
            {Array.from({ length: bigX }).map((_, i) => <X key={i} className="size-48 text-crimson drop-shadow-[0_0_40px_rgba(255,59,92,.9)]" strokeWidth={5} />)}
          </div>
        </div>
      </OnTop>)}
      <style>{`@keyframes ffFlip{from{transform:rotateX(90deg)}to{transform:none}}@keyframes ffX{0%{transform:scale(.4);opacity:0}20%{transform:scale(1.08);opacity:1}75%{opacity:1}100%{transform:scale(1);opacity:0}}`}</style>
    </FrameB>
  );
}
