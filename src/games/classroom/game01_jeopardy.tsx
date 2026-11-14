"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Users } from "lucide-react";
import data from "./data/game01_jeopardy.json";
import { OnTop } from "./theme";
import { Btn, Scoreboard, SetupCard, Shell, TeamNames, money, shuffle, typingTarget } from "./shared-a";

// Bedrock twin of Dopps Class game01_jeopardy. 5x5 board (columns shuffled each game), one Daily Double per category,
// teams rotate after every scored clue, Final Jeopardy with per-team wagers.
// Bedrock: one category per realm (9 written); the host picks which 5 realms make the board (random 5 by default).
type Q = { q: string; a: string; dd: boolean };
type Realm = { name: string; realm: number; clues: Q[] };
const { REALMS, VALS, FJ } = data as { REALMS: Realm[]; VALS: number[]; FJ: { cat: string; q: string; a: string } };
const pickFive = () => shuffle(REALMS.map((_, i) => i)).slice(0, 5).sort((a, b) => a - b);

type Active = { ci: number; ri: number; val: number };
type FjStage = "hidden" | "wager" | "judge" | "done";

export function Game01Jeopardy() {
  const [phase, setPhase] = useState<"setup" | "game">("setup");
  const [draft, setDraft] = useState(["Team 1", "Team 2", "", ""]);
  const [teams, setTeams] = useState<string[]>([]);
  const [scores, setScores] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([0, 1, 2, 3, 4]);
  const [cats, setCats] = useState<string[]>([]);
  const [board, setBoard] = useState<Q[][]>([]);
  const [used, setUsed] = useState<boolean[][]>([]);
  const [turn, setTurn] = useState(0);
  const [active, setActive] = useState<Active | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [wager, setWager] = useState("");
  const [lockedWager, setLockedWager] = useState(0);
  const [err, setErr] = useState("");
  const [fj, setFj] = useState<FjStage>("hidden");
  const [fjW, setFjW] = useState<string[]>([]);
  const [fjJudged, setFjJudged] = useState<(boolean | null)[]>([]);

  // random realms only after mount (SSR-safe)
  useEffect(() => { setPicked(pickFive()); }, []);
  const toggleRealm = (i: number) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length >= 5 ? p : [...p, i].sort((a, b) => a - b)));

  const start = () => {
    const names = draft.map((n) => n.trim()).filter(Boolean);
    if (names.length < 2) { setErr("Please enter at least 2 team names."); return; }
    if (picked.length !== 5) { setErr("Pick exactly 5 realms for the board."); return; }
    setErr(""); setTeams(names); setScores(names.map(() => 0));
    setUsed(Array.from({ length: 5 }, () => Array(5).fill(false)));
    setCats(picked.map((i) => REALMS[i].name));
    setBoard(picked.map((i) => shuffle(REALMS[i].clues)));
    setTurn(0); setActive(null); setFj("hidden"); setPhase("game");
  };

  const boardDone = used.length > 0 && used.every((c) => c.every(Boolean));
  const q = active ? board[active.ci][active.ri] : null;
  const ddMax = active ? Math.max(active.val, scores[turn] ?? 0) : 0;

  const openQ = (ci: number, ri: number) => {
    if (used[ci][ri]) return;
    setActive({ ci, ri, val: VALS[ri] }); setRevealed(false); setWager(String(VALS[ri]));
  };
  const reveal = () => {
    if (!active || !q) return;
    const w = q.dd ? Math.min(ddMax, Math.max(0, parseInt(wager) || active.val)) : active.val;
    setLockedWager(w); setRevealed(true);
  };
  const markUsed = (a: Active) => setUsed((u) => u.map((col, ci) => col.map((v, ri) => v || (ci === a.ci && ri === a.ri))));
  const award = (correct: boolean) => {
    if (!revealed || !active) return;
    setScores((s) => s.map((v, i) => (i === turn ? v + (correct ? 1 : -1) * lockedWager : v)));
    markUsed(active); setActive(null);
    setTurn((t) => (t + 1) % teams.length);
  };
  const closeQ = () => { if (active) markUsed(active); setActive(null); };

  useEffect(() => {
    if (!active) return;
    const k = (e: KeyboardEvent) => {
      if (typingTarget(e) && e.key !== "Enter" && e.key !== "Escape") return;
      if (e.key === "Escape") closeQ();
      else if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
      else if (revealed && e.key.toLowerCase() === "c") award(true);
      else if (revealed && e.key.toLowerCase() === "w") award(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const showFJ = () => { setFjW(scores.map((s) => String(Math.max(0, s)))); setFjJudged(teams.map(() => null)); setFj("wager"); };
  const fjWagers = fjW.map((w, i) => Math.min(Math.max(0, scores[i]), Math.max(0, parseInt(w) || 0)));
  const fjScore = (i: number, correct: boolean) => {
    const prev = fjJudged[i];
    const w = fjWagers[i];
    setScores((s) => s.map((v, j) => (j !== i ? v : v - (prev === null ? 0 : (prev ? 1 : -1) * w) + (correct ? 1 : -1) * w)));
    setFjJudged((f) => f.map((v, j) => (j === i ? correct : v)));
  };

  if (phase === "setup") {
    return (
      <Shell title="Bedrock Jeopardy" sub="Earth Science — Classroom Edition">
        <SetupCard title="Team Setup" blurb="Enter team names (2–4 teams). Pick a dollar value, read the clue, and answer in the form of a question!">
          <TeamNames names={draft} setNames={setDraft} placeholders={["Team 1", "Team 2", "Team 3 (optional)", "Team 4 (optional)"]} />
          <div className="mt-5 text-xs font-bold uppercase tracking-widest text-muted">Board categories: pick 5 realms ({picked.length}/5)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {REALMS.map((r, i) => {
              const on = picked.includes(i);
              return (
                <button key={r.name} type="button" onClick={() => toggleRealm(i)} aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-sm font-bold transition ${on ? "border-gold bg-gold/15 text-gold" : "border-line text-muted hover:text-fg"}`}>
                  {r.realm}. {r.name}
                </button>
              );
            })}
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-crimson">{err}</p>}
          <Btn big className="mt-5 w-full" onClick={start}><Users className="mr-2 inline size-5" /> Start Game</Btn>
        </SetupCard>
      </Shell>
    );
  }

  const max = Math.max(...scores);
  return (
    <Shell title="Bedrock Jeopardy" sub="Earth Science — Classroom Edition">
      <Scoreboard names={teams} scores={scores} active={turn} onPick={setTurn} />
      <p className="mt-2 text-center text-xs text-muted">Click a team to change whose turn it is.</p>

      <div className="cr-dark mt-5 grid grid-cols-5 gap-2 sm:gap-3">
        {cats.map((c) => (
          <div key={c} className="cr-jcat grid min-h-20 place-items-center rounded-2xl border border-line bg-gradient-to-b from-[#1d4a40]/70 to-[#10302a]/70 p-1 text-center font-display text-[11px] font-extrabold uppercase leading-tight tracking-wide text-fg hyphens-auto [overflow-wrap:anywhere] sm:p-2 sm:text-lg">{c}</div>
        ))}
        {VALS.map((v, ri) => cats.map((_, ci) => {
          const u = used[ci]?.[ri];
          return (
            <button key={`${ci}-${ri}`} disabled={u} onClick={() => openQ(ci, ri)}
              className={`cr-jtile grid min-h-16 place-items-center rounded-2xl border font-display text-base font-extrabold transition sm:min-h-24 sm:text-4xl ${u ? "border-fg/5 bg-fg/[.02] text-transparent" : "border-gold/25 bg-gradient-to-b from-[#17423a]/80 to-[#0c2621]/80 text-gold [text-shadow:0_0_18px_rgba(255,209,102,.45)] hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-[0_0_30px_-8px_rgba(255,209,102,.7)]"}`}>
              {u ? "" : money(v)}
            </button>
          );
        }))}
      </div>

      <p className="mt-4 text-center font-semibold text-muted">
        {boardDone ? "Board complete! Play Final Jeopardy below." : "Click any dollar value to begin. Daily Double is hidden on the board!"}
      </p>

      {/* Final Jeopardy */}
      <div className="glass mt-6 rounded-3xl border-gold/40 p-6" style={{ borderColor: "rgba(255,209,102,.4)" }}>
        <div className="font-display text-xl font-extrabold text-gold">Final Jeopardy — Category: {FJ.cat}</div>
        {fj === "hidden" && (
          <>
            <p className="mt-1 text-muted">Complete the board first, then play Final Jeopardy.</p>
            <Btn tone="blue" className="mt-4" onClick={showFJ}>Reveal Final Jeopardy Clue</Btn>
          </>
        )}
        {fj !== "hidden" && fj !== "done" && (
          <div className="cr-dark mt-4 rounded-2xl bg-[#0a1d19] p-5">
            <div className="text-xs font-bold uppercase tracking-widest text-gold">Final Jeopardy Clue</div>
            <div className="mt-2 font-display text-2xl font-bold leading-snug text-fg sm:text-3xl">{FJ.q}</div>
          </div>
        )}
        {fj === "wager" && (
          <>
            <div className="mt-4 font-bold text-gold">Enter wagers, then reveal answer:</div>
            <div className="mt-2 space-y-2">
              {teams.map((t, i) => (
                <label key={i} className="flex items-center gap-3">
                  <span className="min-w-28 font-semibold">{t}</span>
                  <input type="number" min={0} max={Math.max(0, scores[i])} value={fjW[i]} onChange={(e) => setFjW(fjW.map((v, j) => (j === i ? e.target.value : v)))}
                    className="w-36 rounded-xl border border-gold/40 bg-fg/5 px-3 py-2 text-lg font-bold text-gold outline-none" />
                  <span className="text-xs text-muted">max {money(Math.max(0, scores[i]))}</span>
                </label>
              ))}
            </div>
            <Btn tone="blue" className="mt-4" onClick={() => setFj("judge")}>Reveal Answer</Btn>
          </>
        )}
        {fj === "judge" && (
          <>
            <div className="cr-dark mt-4 rounded-2xl bg-[#0a1d19] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-gold">Correct response</div>
              <div className="mt-2 font-display text-2xl font-bold text-emerald">{FJ.a}</div>
            </div>
            <div className="mt-4 space-y-2">
              {teams.map((t, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-28 font-semibold">{t}</span>
                  <span className="text-gold">wager: {money(fjWagers[i])}</span>
                  <Btn tone="good" className={`!px-4 !py-2 ${fjJudged[i] === true ? "ring-2 ring-white" : ""}`} onClick={() => fjScore(i, true)}>Correct</Btn>
                  <Btn tone="bad" className={`!px-4 !py-2 ${fjJudged[i] === false ? "ring-2 ring-white" : ""}`} onClick={() => fjScore(i, false)}>Wrong</Btn>
                </div>
              ))}
            </div>
            <Btn className="mt-5" onClick={() => setFj("done")}>Show Final Scores</Btn>
          </>
        )}
        {fj === "done" && (
          <div className="animate-rise py-4 text-center">
            <div className="font-display text-4xl font-extrabold text-gold">FINAL SCORES</div>
            <div className="mt-3 space-y-1">
              {teams.map((t, i) => (
                <div key={i} className={scores[i] === max ? "font-display text-3xl font-extrabold text-gold" : "text-xl text-muted"}>
                  {t}: {money(scores[i])}{scores[i] === max ? " WINNER!" : ""}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Btn onClick={start}><RotateCcw className="mr-2 inline size-4" />Play again</Btn>
              <Btn tone="ghost" onClick={() => setPhase("setup")}>Change teams</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Clue overlay */}
      {active && q && (<OnTop>
        <div className="fixed inset-0 z-[100] grid place-items-center bg-[#050b08]/85 p-4 backdrop-blur-md">
          <div className="cr-dark max-h-full w-full max-w-4xl animate-rise overflow-y-auto rounded-3xl border border-gold/30 bg-gradient-to-b from-[#17423a] to-[#0a1d19] shadow-[0_40px_120px_-20px_rgba(0,0,0,.9)]">
            <div className="flex items-center justify-between border-b border-fg/10 px-6 py-4">
              <span className="text-sm font-bold uppercase tracking-widest text-fg/70">{cats[active.ci]}</span>
              <span className="font-display text-2xl font-extrabold text-gold">{q.dd ? "DAILY DOUBLE" : money(active.val)}</span>
            </div>
            <div className="p-6 sm:p-10">
              {q.dd && !revealed && (
                <label className="mb-6 flex flex-wrap items-center justify-center gap-3 text-lg">
                  <span className="text-fg/80">Wager (max {money(ddMax)}):</span>
                  <input type="number" min={100} max={ddMax} value={wager} onChange={(e) => setWager(e.target.value)}
                    className="w-40 rounded-xl border border-gold/50 bg-fg/10 px-3 py-2 text-2xl font-bold text-gold outline-none" />
                </label>
              )}
              <div className="text-center font-display text-3xl font-bold leading-snug text-white sm:text-5xl">{q.q}</div>
              {revealed && (
                <div className="mt-8 animate-rise border-t border-fg/15 pt-6 text-center text-2xl text-emerald sm:text-3xl">
                  Correct response: <strong>{q.a}</strong>
                </div>
              )}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {!revealed && <Btn tone="blue" big onClick={reveal}>Reveal Answer</Btn>}
                {revealed && <Btn tone="good" big onClick={() => award(true)}>Correct (+{money(lockedWager)})</Btn>}
                {revealed && <Btn tone="bad" big onClick={() => award(false)}>Wrong (-{money(lockedWager)})</Btn>}
                <Btn tone="ghost" big onClick={closeQ}>Close</Btn>
              </div>
              <div className="mt-5 text-center text-sm text-fg/50">
                Current turn: <strong className="text-gold">{teams[turn]}</strong> · Keys: Space reveal · C correct · W wrong · Esc close
              </div>
            </div>
          </div>
        </div>
      </OnTop>)}
    </Shell>
  );
}
