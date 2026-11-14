"use client";

import { useEffect, useState } from "react";
import { Briefcase, RotateCcw } from "lucide-react";
import data from "./data/game02_deal_or_no_deal.json";
import { Btn, Shell, shuffle } from "./shared-a";

// Bedrock twin of Dopps Class game02_deal_or_no_deal. 25 briefcases: point values, Earth HAZARDS (estimation
// challenges that cost points) and BONUS challenges (+500). Pick your case, open 6/5/4/3/2/1/1/1/1,
// the Banker offers 70% of the average remaining point case (rounded to 50) after each round.
type Case = { val: number; type: "pts" | "hazard" | "bonus"; label: string; desc?: string; fact?: string };
const CASES_DATA = data.CASES_DATA as Case[];
const OPENS = [6, 5, 4, 3, 2, 1, 1, 1, 1];
const PT_VALS = CASES_DATA.filter((c) => c.type === "pts").sort((a, b) => a.val - b.val);

type End = { kind: "deal"; offer: number } | { kind: "kept" } | null;

export function Game02DealOrNoDeal() {
  const [cases, setCases] = useState<Case[]>(CASES_DATA);
  const [mine, setMine] = useState(-1);
  const [opened, setOpened] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [openedThisPhase, setOpenedThisPhase] = useState(0);
  const [lastReveal, setLastReveal] = useState<Case | null>(null);
  const [end, setEnd] = useState<End>(null);

  const init = () => { setCases(shuffle(CASES_DATA)); setMine(-1); setOpened([]); setScore(0); setPhaseIdx(0); setOpenedThisPhase(0); setLastReveal(null); setEnd(null); };
  useEffect(init, []);

  const remaining = cases.filter((_, i) => i !== mine && !opened.includes(i));
  const pts = remaining.filter((c) => c.type === "pts").map((c) => c.val);
  const offer = pts.length ? Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 0.7 / 50) * 50 : 0;
  const toOpen = OPENS[Math.min(phaseIdx, OPENS.length - 1)];
  const gameOver = end !== null;
  const canOffer = openedThisPhase >= toOpen && remaining.length > 0 && !gameOver;
  const opensLeft = Math.max(0, toOpen - openedThisPhase);

  const openCase = (i: number) => {
    if (opened.includes(i) || i === mine || gameOver || openedThisPhase >= toOpen) return;
    const c = cases[i];
    setOpened([...opened, i]); setLastReveal(c); setOpenedThisPhase(openedThisPhase + 1);
    if (c.type === "hazard") setScore((s) => s + c.val);
    if (c.type === "bonus") setScore((s) => s + 500);
  };
  const openFinal = () => { setScore((s) => s + (cases[mine].val || 0)); setEnd({ kind: "kept" }); };
  const noDeal = () => {
    setOpenedThisPhase(0); setPhaseIdx(Math.min(phaseIdx + 1, OPENS.length - 1));
    if (remaining.length === 0) openFinal();
  };
  const takeDeal = () => { setScore((s) => s + offer); setEnd({ kind: "deal", offer }); };

  // ---------- end screens ----------
  if (end) {
    const yours = cases[mine];
    return (
      <Shell title={end.kind === "deal" ? "You took the deal!" : "You kept your case!"} sub="Deal or No Deal — Earth Science Edition" wide={false}>
        <div className="cr-dark animate-rise rounded-3xl border-2 border-gold/60 bg-gradient-to-b from-[#4a2a12]/80 to-[#22130a]/80 p-8 text-center shadow-[0_0_60px_-15px_rgba(255,209,102,.7)]">
          {end.kind === "deal" ? (
            <>
              <div className="text-sm font-bold uppercase tracking-widest text-gold/80">You banked</div>
              <div className="mt-2 font-display text-6xl font-extrabold text-gold">{end.offer.toLocaleString()} pts</div>
              <p className="mt-4 text-lg text-fg/70">Your case (#{mine + 1}) held: <strong className="text-fg">{yours.label}</strong></p>
              <p className="mt-1 text-lg font-semibold text-fg">{end.offer > (yours.val || 0) ? "Smart move!" : "Your case was worth more — but a safe call pays too!"}</p>
            </>
          ) : (
            <>
              <div className="text-sm font-bold uppercase tracking-widest text-gold/80">Case #{mine + 1} contained</div>
              <div className="mt-2 font-display text-6xl font-extrabold text-gold">{yours.label}</div>
              <div className="mt-6 text-sm font-bold uppercase tracking-widest text-fg/60">Final Score</div>
              <div className="font-display text-4xl font-extrabold text-fg">{score.toLocaleString()} pts</div>
            </>
          )}
          <Btn big className="mt-7" onClick={init}><RotateCcw className="mr-2 inline size-5" />Play Again</Btn>
        </div>
      </Shell>
    );
  }

  // ---------- pick your case ----------
  if (mine === -1) {
    return (
      <Shell title="Deal or No Deal" sub="Earth Science Edition — Bedrock">
        <p className="text-center font-display text-2xl font-bold text-gold">Step 1: Choose YOUR briefcase to protect!</p>
        <CaseGrid>
          {cases.map((_, i) => (
            <button key={i} onClick={() => { setMine(i); setOpenedThisPhase(0); }} className="case-btn case-closed group">
              <Briefcase className="size-6 text-gold/70 transition group-hover:scale-110" />
              <span className="font-display text-3xl font-extrabold text-gold">{i + 1}</span>
            </button>
          ))}
        </CaseGrid>
        <CaseStyle />
      </Shell>
    );
  }

  const tone = lastReveal ? (lastReveal.type === "pts" ? (lastReveal.val > 0 ? "good" : "bad") : "hazard") : null;
  const isGoodBonus = lastReveal?.type === "bonus";
  return (
    <Shell title="Deal or No Deal" sub="Earth Science Edition — Bedrock">
      <div className="glass grid grid-cols-2 gap-3 rounded-3xl p-4 sm:grid-cols-4">
        <Stat label="Score" v={`${score.toLocaleString()} pts`} />
        <Stat label="Cases Left" v={String(remaining.length + 1)} />
        <Stat label="Banker's Offer" v={canOffer ? `${offer.toLocaleString()} pts` : "???"} />
        <Stat label="Opens Left" v={String(opensLeft)} />
      </div>

      {lastReveal && (
        <div key={opened.length} className={`mt-4 animate-rise rounded-2xl border p-5 text-lg ${tone === "good" ? "border-emerald/60 bg-emerald/15" : tone === "bad" ? "cr-dark border-[#ff5252] bg-[#7f0000]/80" : isGoodBonus ? "border-sky/60 bg-sky/10" : "border-amber/70 bg-amber/15"}`}>
          <strong className="font-display text-2xl">
            {lastReveal.type === "pts" ? `Case revealed: ${lastReveal.label}` : lastReveal.type === "hazard" ? "⚠️ EARTH HAZARD!" : "🌟 BONUS CHALLENGE!"}
          </strong>
          <div className="mt-1">{lastReveal.type !== "pts" ? lastReveal.desc : "That value is now off the board!"}</div>
          {lastReveal.type !== "pts" && <em className="mt-1 block text-fg/75">{lastReveal.fact}</em>}
        </div>
      )}

      {canOffer && (
        <div className="cr-dark mt-4 animate-rise rounded-3xl border-2 border-gold bg-gradient-to-b from-[#4a2a12] to-[#22130a] p-6 text-center shadow-[0_0_70px_-15px_rgba(255,209,102,.8)]">
          <div className="text-sm font-bold uppercase tracking-[0.25em] text-gold/80">The Banker offers...</div>
          <div className="mt-1 font-display text-6xl font-extrabold text-gold">{offer.toLocaleString()} pts</div>
          <div className="mt-5 flex flex-wrap justify-center gap-4">
            <Btn tone="good" big onClick={takeDeal}>DEAL</Btn>
            <Btn tone="bad" big onClick={noDeal}>NO DEAL</Btn>
          </div>
        </div>
      )}
      {!canOffer && remaining.length > 0 && (
        <p className="mt-4 text-center font-display text-2xl font-bold text-fg">Open {opensLeft} more case{opensLeft !== 1 ? "s" : ""}. Your case: <span className="text-gold">#{mine + 1}</span></p>
      )}
      {remaining.length === 0 && (
        <div className="mt-4 flex justify-center"><Btn tone="good" big onClick={openFinal}>Open Your Case!</Btn></div>
      )}

      <div className="mt-2 grid gap-5 lg:grid-cols-[1fr_260px]">
        <CaseGrid>
          {cases.map((c, i) => {
            if (i === mine) return (
              <div key={i} className="case-btn cursor-default border-gold bg-[#8a4a1a]/70 shadow-[0_0_30px_-6px_rgba(255,209,102,.8)]">
                <span className="font-display text-3xl font-extrabold text-gold">{i + 1}</span><span className="text-xs font-bold tracking-widest">YOURS</span>
              </div>
            );
            if (opened.includes(i)) return (
              <div key={i} className="case-btn cursor-default border-fg/5 bg-black/75">
                <span className="font-display text-xl font-extrabold text-fg/30">{i + 1}</span>
                <span className={`text-center text-sm font-bold leading-tight ${c.type === "hazard" ? "text-amber" : c.type === "bonus" ? "text-sky" : "text-fg/70"}`}>{c.label}</span>
              </div>
            );
            const can = !canOffer && openedThisPhase < toOpen;
            return (
              <button key={i} disabled={!can} onClick={() => openCase(i)} className="case-btn case-closed group disabled:opacity-50">
                <Briefcase className="size-6 text-gold/70 transition group-enabled:group-hover:scale-110" />
                <span className="font-display text-3xl font-extrabold text-gold">{i + 1}</span>
              </button>
            );
          })}
        </CaseGrid>
        <div className="mt-4 grid grid-cols-2 content-start gap-2">
          {PT_VALS.map((c, i) => {
            const gone = opened.some((j) => cases[j] === c);
            return <div key={i} className={`rounded-xl px-2 py-2 text-center font-bold ${gone ? "bg-fg/[.03] text-fg/20 line-through" : "bg-gradient-to-r from-[#4a2a12] to-[#3a200e] text-gold"}`}>{c.label}</div>;
          })}
        </div>
      </div>
      <CaseStyle />
    </Shell>
  );
}

function CaseGrid({ children }: { children: React.ReactNode }) {
  return <div className="cr-dark mt-4 grid grid-cols-5 gap-2 sm:gap-3 md:grid-cols-7 lg:grid-cols-9">{children}</div>;
}
function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="text-center">
      <div className="text-xs font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className="font-display text-2xl font-extrabold text-gold sm:text-3xl">{v}</div>
    </div>
  );
}
function CaseStyle() {
  return <style>{`.case-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:5.5rem;border-radius:1rem;border-width:1.5px;border-style:solid;transition:transform .15s,box-shadow .15s;cursor:pointer}.case-closed{border-color:rgba(242,140,40,.55);background:linear-gradient(180deg,rgba(92,52,22,.8),rgba(54,30,12,.85))}.case-closed:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 0 26px -6px rgba(242,140,40,.9)}`}</style>;
}
