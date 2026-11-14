"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame, RotateCcw, Star, Trophy, Vote } from "lucide-react";
import data from "./data/game07_survivor.json";
import { BtnB, Card, FrameB, StatusB, shuffleB, shuffleOpts } from "./shared-b";

// Bedrock twin of Dopps Class game07_survivor: answer an Earth science question, award immunity, vote someone out at
// Tribal Council. Last player standing is the Sole Survivor.
type Q = { q: string; opts: string[]; ans: number; pts: number; debate?: string };
const QUESTIONS = (data as { QUESTIONS: Q[] }).QUESTIONS;
const AVATARS = ["🧑", "👩", "👦", "👧", "🧔", "👱", "👵", "👨"];
const DEFAULT_NAMES = ["Alex", "Jordan", "Sam", "Riley", "Morgan", "Casey"];
const TORCH = "#ffb347";
type Phase = "setup" | "question" | "immunity" | "voting" | "tribal" | "win";

export function Game07Survivor() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [players, setPlayers] = useState<string[]>(DEFAULT_NAMES);
  const [scores, setScores] = useState<number[]>([]);
  const [eliminated, setEliminated] = useState<number[]>([]);
  const [immune, setImmune] = useState(-1);
  const [votes, setVotes] = useState<number[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [deck, setDeck] = useState<Q[]>(QUESTIONS);
  const [cur, setCur] = useState<Q>(QUESTIONS[0]);
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState(-1);
  const [awarded, setAwarded] = useState<number[]>([]);
  const [loser, setLoser] = useState(-1);
  const [msg, setMsg] = useState("");

  const active = players.map((_, i) => i).filter((i) => !eliminated.includes(i));

  const setup = () => {
    const ps = names.map((n, i) => n.trim() || DEFAULT_NAMES[i]);
    const d = shuffleB(QUESTIONS);
    setPlayers(ps); setScores(ps.map(() => 0)); setImmune(-1); setEliminated([]); setVotes([]); setQIdx(0);
    setDeck(d); setCur({ ...d[0], ...shuffleOpts(d[0].opts, d[0].ans) });
    setAnswered(false); setPicked(-1); setAwarded([]); setMsg(""); setPhase("question");
  };

  const pick = useCallback((i: number) => { if (answered) return; setPicked(i); setAnswered(true); }, [answered]);
  const toggleAward = (i: number) => {
    if (!answered || eliminated.includes(i)) return;
    const on = awarded.includes(i);
    setAwarded((aw) => (on ? aw.filter((x) => x !== i) : [...aw, i]));
    setScores((s) => s.map((v, j) => (j === i ? v + (on ? -cur.pts : cur.pts) : v)));
  };

  useEffect(() => {
    if (phase !== "question") return;
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const n = "ABCD".indexOf(e.key.toUpperCase()), d = "1234".indexOf(e.key);
      const i = n >= 0 ? n : d;
      if (i >= 0 && i < cur.opts.length) pick(i);
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!answered) setAnswered(true); else setPhase("immunity"); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [phase, cur, answered, pick]);

  const tally = () => {
    if (!votes.length) { setMsg("No votes cast!"); return; }
    const t: Record<number, number> = {};
    votes.forEach((i) => { t[i] = (t[i] || 0) + 1; });
    const sorted = Object.entries(t).sort((a, b) => b[1] - a[1]);
    const l = parseInt(sorted[0][0]);
    setEliminated([...eliminated, l]); setLoser(l); setVotes([]); setImmune(-1); setMsg(""); setPhase("tribal");
  };

  const nextRound = () => {
    const n = qIdx + 1, q = deck[n % deck.length];
    setQIdx(n); setCur({ ...q, ...shuffleOpts(q.opts, q.ans) }); setAnswered(false); setPicked(-1); setAwarded([]); setPhase("question");
  };

  if (phase === "setup") {
    return (
      <FrameB title="Bedrock Survivor" sub="Earth Science Edition" max="max-w-3xl">
        <Card className="animate-rise" accent={TORCH}>
          <div className="flex items-center gap-3 font-display text-2xl font-extrabold text-gold"><Flame className="size-7 text-amber" /> How to Play</div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-lg leading-relaxed text-fg/90">
            <li>Each round, all active players answer an Earth science question (teacher scores).</li>
            <li>The teacher optionally opens a class debate on the prompt.</li>
            <li>Award immunity to the top scorer.</li>
            <li>The class votes someone out at Tribal Council.</li>
            <li>Last player standing is the Sole Survivor!</li>
          </ol>
          <div className="mt-5 text-xs font-bold uppercase tracking-widest text-muted">Tribe members</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {names.map((n, i) => (
              <label key={i} className="flex items-center gap-2 rounded-xl border border-line bg-fg/5 px-3 py-2">
                <span className="text-2xl">{AVATARS[i]}</span>
                <input value={n} maxLength={16} onChange={(e) => setNames(names.map((v, j) => (j === i ? e.target.value : v)))}
                  className="w-full bg-transparent text-lg font-semibold text-fg outline-none" />
              </label>
            ))}
          </div>
          <div className="mt-6 text-center"><BtnB big onClick={setup}><Flame className="mr-2 inline size-5" />Start the Game</BtnB></div>
        </Card>
      </FrameB>
    );
  }

  const tribe = (onClick?: (i: number) => void) => (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {players.map((p, i) => {
        const out = eliminated.includes(i), vc = votes.filter((v) => v === i).length, isImm = immune === i, got = awarded.includes(i);
        const border = out ? "color-mix(in srgb, var(--color-fg) 6%, transparent)" : isImm ? "#ffd166" : vc ? "#ff3b5c" : got ? "#00e5a0" : "var(--color-line)";
        return (
          <button key={i} type="button" disabled={out || !onClick} onClick={() => onClick?.(i)}
            className={`relative rounded-2xl border-2 px-2 py-3 text-center transition enabled:hover:-translate-y-0.5 ${out ? "opacity-30 line-through" : ""}`}
            style={{ borderColor: border, background: got ? "rgba(0,229,160,.08)" : "color-mix(in srgb, var(--color-fg) 3%, transparent)", boxShadow: !out && (isImm || vc || got) ? `0 0 22px -8px ${border}` : undefined }}>
            {isImm && <Star className="absolute left-2 top-2 size-4 fill-gold text-gold" />}
            {vc > 0 && !out && <span className="absolute right-1.5 top-1.5 rounded-md bg-crimson px-1.5 py-0.5 text-[11px] font-extrabold text-white">{vc} vote{vc > 1 ? "s" : ""}</span>}
            <div className="text-4xl">{AVATARS[i % AVATARS.length]}</div>
            <div className="mt-1 truncate font-bold text-gold">{p}</div>
            <div className="font-display text-2xl font-extrabold text-fg">{scores[i]}</div>
          </button>
        );
      })}
    </div>
  );

  if (phase === "immunity") {
    return (
      <FrameB title="Immunity Challenge" sub="Who earns protection this round?" max="max-w-4xl">
        <Card accent="#ffd166" className="animate-rise">
          <div className="text-center font-display text-2xl font-extrabold text-gold"><Star className="mr-2 inline size-6 fill-gold" />Award Immunity to:</div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {active.map((i) => (
              <button key={i} type="button" onClick={() => setImmune(i)}
                className="rounded-2xl border-2 px-3 py-4 text-center transition hover:-translate-y-0.5"
                style={{ borderColor: immune === i ? "#ffd166" : "var(--color-line)", background: immune === i ? "rgba(255,209,102,.14)" : "color-mix(in srgb, var(--color-fg) 3%, transparent)", boxShadow: immune === i ? "0 0 26px -6px #ffd166" : undefined }}>
                <div className="text-4xl">{AVATARS[i % AVATARS.length]}</div>
                <div className="mt-1 text-xl font-bold text-fg">{players[i]}</div>
                <div className="text-sm text-muted">{scores[i]} pts</div>
              </button>
            ))}
          </div>
        </Card>
        <div className="mt-4"><StatusB>The player with immunity CANNOT be voted out this round.</StatusB></div>
        <div className="mt-4 flex justify-center gap-3">
          <BtnB tone="ghost" onClick={() => setPhase("question")}>Back</BtnB>
          <BtnB big disabled={immune < 0} onClick={() => { setVotes([]); setMsg(""); setPhase("voting"); }}>Proceed to Tribal Council</BtnB>
        </div>
      </FrameB>
    );
  }

  if (phase === "voting") {
    return (
      <FrameB title="Tribal Council" sub={`Vote someone out — ${immune >= 0 ? `${players[immune]} has immunity` : ""}`} max="max-w-4xl">
        <Card accent="#ff3b5c" className="animate-rise">
          <div className="text-center font-display text-2xl font-extrabold tracking-wide text-crimson"><Vote className="mr-2 inline size-6" />CAST YOUR VOTE</div>
          <p className="mt-1 text-center text-muted">Teacher tallies class votes. Click to add a vote to each player.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {players.map((p, i) => {
              if (eliminated.includes(i) || i === immune) return null;
              const vc = votes.filter((v) => v === i).length;
              return (
                <button key={i} type="button" onClick={() => setVotes([...votes, i])}
                  className="rounded-2xl border-2 px-3 py-4 text-center transition hover:-translate-y-0.5"
                  style={{ borderColor: vc ? "#ff3b5c" : "var(--color-line)", background: vc ? "rgba(255,59,92,.13)" : "color-mix(in srgb, var(--color-fg) 3%, transparent)" }}>
                  <div className="text-4xl">{AVATARS[i % AVATARS.length]}</div>
                  <div className="mt-1 text-xl font-bold text-fg">{p}</div>
                  <div className="font-display text-xl font-extrabold text-crimson">{vc} vote{vc !== 1 ? "s" : ""}</div>
                </button>
              );
            })}
          </div>
        </Card>
        <div className="mt-4"><StatusB tone={msg ? "bad" : undefined}>{msg || "Add votes from the class, then click Snuff the Torch to eliminate the player with the most votes."}</StatusB></div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <BtnB big tone="bad" onClick={tally}><Flame className="mr-2 inline size-5" />Snuff the Torch</BtnB>
          <BtnB tone="ghost" onClick={() => setVotes([])} disabled={!votes.length}>Clear votes</BtnB>
          <BtnB tone="ghost" onClick={() => setPhase("question")}>Back</BtnB>
        </div>
      </FrameB>
    );
  }

  if (phase === "tribal") {
    return (
      <FrameB title="Tribal Council" max="max-w-3xl">
        <Card accent="#ff3b5c" className="animate-rise text-center">
          <div className="text-6xl" style={{ animation: "svSnuff 1.4s ease-out forwards" }}>🔥</div>
          <div className="mt-3 font-display text-4xl font-extrabold text-crimson">{players[loser]}, the tribe has spoken.</div>
          <p className="mt-2 text-xl text-muted">{players[loser]} has been voted out. {active.length} players remain.</p>
          {active.length === 1 && <div className="mt-4 font-display text-3xl font-extrabold text-gold">SOLE SURVIVOR: {players[active[0]]}! 🏆</div>}
        </Card>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {active.length > 1 && <BtnB big onClick={nextRound}>Continue to Next Round</BtnB>}
          {active.length === 1 && <BtnB big onClick={() => setPhase("win")}><Trophy className="mr-2 inline size-5" />See Final Results</BtnB>}
          <BtnB tone="ghost" onClick={setup}><RotateCcw className="mr-2 inline size-4" />New Game</BtnB>
        </div>
        <style>{`@keyframes svSnuff{0%{transform:scale(1.3);opacity:1;filter:drop-shadow(0 0 24px #ff9f1c)}70%{opacity:1}100%{transform:scale(.6) translateY(10px);opacity:.15;filter:grayscale(1)}}`}</style>
      </FrameB>
    );
  }

  if (phase === "win") {
    const w = active[0];
    return (
      <FrameB title="Bedrock Survivor" max="max-w-3xl">
        <Card accent="#ffd166" className="animate-rise text-center">
          <Trophy className="mx-auto size-16 text-gold drop-shadow-[0_0_20px_rgba(255,209,102,.8)]" />
          <div className="mt-2 font-display text-3xl font-extrabold tracking-widest text-gold">SOLE SURVIVOR</div>
          <div className="mt-2 font-display text-5xl font-extrabold text-fg">{AVATARS[w % AVATARS.length]} {players[w]}</div>
          <div className="mt-2 text-lg text-muted">Final score: {scores[w]} pts</div>
          <div className="mx-auto mt-5 max-w-md text-left">
            <div className="mb-2 text-sm font-bold uppercase tracking-widest text-gold">All Scores</div>
            {players.map((p, i) => {
              const r = eliminated.indexOf(i);
              return (
                <div key={i} className={`flex justify-between border-b border-line py-1.5 text-lg ${r >= 0 ? "text-muted/60" : "font-bold text-gold"}`}>
                  <span>{p}: {scores[i]} pts</span><span>{r >= 0 ? `(voted out round ${r + 1})` : "WINNER"}</span>
                </div>
              );
            })}
          </div>
          <BtnB big className="mt-6" onClick={setup}><RotateCcw className="mr-2 inline size-5" />Play Again</BtnB>
        </Card>
      </FrameB>
    );
  }

  // question
  return (
    <FrameB title="Bedrock Survivor" sub={`Round ${qIdx + 1} — ${active.length} players remaining`}>
      {tribe(answered ? toggleAward : undefined)}
      <Card className="mt-4 animate-rise" accent={TORCH}>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber">Round {qIdx + 1} — Earth Science Challenge · {cur.pts} pts</div>
        <p className="mt-2 font-display text-2xl font-bold leading-snug text-fg sm:text-3xl">{cur.q}</p>
        {cur.debate && (
          <div className="mt-3 rounded-r-xl border-l-4 border-gold bg-gold/10 px-4 py-3 text-lg leading-relaxed text-gold">🗣 Debate prompt: &ldquo;{cur.debate}&rdquo;</div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {cur.opts.map((o, i) => {
            const right = answered && i === cur.ans, bad = answered && i === picked && i !== cur.ans;
            return (
              <button key={i} type="button" disabled={answered} onClick={() => pick(i)}
                className="rounded-2xl border-2 px-4 py-4 text-left text-xl font-semibold transition enabled:hover:-translate-y-0.5 enabled:hover:border-gold"
                style={{ borderColor: right ? "#00e5a0" : bad ? "#ff3b5c" : "var(--color-line)", background: right ? "rgba(0,229,160,.16)" : bad ? "rgba(255,59,92,.16)" : "color-mix(in srgb, var(--color-fg) 3%, transparent)", opacity: answered && !right && !bad ? 0.55 : 1 }}>
                <span className="mr-2 font-display font-extrabold text-gold">{"ABCD"[i]}:</span>{o}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="mt-4 rounded-r-xl border-l-4 border-emerald bg-emerald/10 px-4 py-3 text-lg text-emerald">
            The correct answer is: <strong>{"ABCD"[cur.ans]}: {cur.opts[cur.ans]}</strong>
          </div>
        )}
      </Card>
      <div className="mt-4">
        <StatusB tone={answered ? "good" : undefined}>
          {answered
            ? `Correct answer revealed! Tap each player who got it right (+${cur.pts}). Debate if prompted, then conduct tribal council.`
            : `Each active player answers — teacher scores each one. Worth ${cur.pts} pts. (Keys: A–D)`}
        </StatusB>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {!answered && <BtnB big onClick={() => setAnswered(true)}>Reveal Answer</BtnB>}
        {answered && <BtnB big onClick={() => setPhase("immunity")}><Star className="mr-2 inline size-5" />Award Immunity</BtnB>}
        <BtnB tone="ghost" onClick={setup}><RotateCcw className="mr-2 inline size-4" />Restart</BtnB>
      </div>
    </FrameB>
  );
}
