"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, RotateCcw, Search, Siren, Vote } from "lucide-react";
import data from "./data/game10_imposter.json";
import { OnTop } from "./theme";
import { BtnB, Card, FrameB, StatusB, beep, shuffleB } from "./shared-b";

// Bedrock twin of Dopps Class game10_imposter: six crewmates each make 2 Earth science statements. One secret imposter
// makes 2 false ones. Fact-check (+100 true / +200 busted), call a meeting, vote, eject (+500 if caught).
type Stmt = { speaker: number; wrong: boolean; text: string; fact: string };
const STATEMENTS = (data as { STATEMENTS: Stmt[] }).STATEMENTS;
const NAMES = ["Alex", "Sam", "Jordan", "Riley", "Morgan", "Casey"];
const COLORS = ["#3b82f6", "#ef4444", "#facc15", "#22c55e", "#a855f7", "#f97316"];
const TASKS = ["Check: What really causes the seasons?", "Check: Where do diamonds form?", "Check: Can lightning strike twice?", "Review earthquake safety (Drop, Cover, Hold On)", "Verify Earth's layers: solid or liquid?"];

const sndVerified = () => { beep(880, 0.12, "sine"); beep(1318.5, 0.15, "sine", 0.08); };
const sndBusted = () => { beep(300, 0.14, "square"); beep(220, 0.18, "square", 0.1); };
const sndMeeting = () => beep(160, 0.3, "sawtooth");
const sndCaught = () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => beep(f, 0.18, "square", i * 0.1));
const sndEscaped = () => [392, 349.23, 311.13, 261.63].forEach((f, i) => beep(f, 0.25, "triangle", i * 0.15));

function assignRoles(): { stmts: Stmt[]; imp: number } {
  const all = STATEMENTS.map((s) => ({ ...s }));
  const wrongPool = shuffleB(all.filter((s) => s.wrong));
  const truePool = all.filter((s) => !s.wrong);
  const imp = Math.floor(Math.random() * 6);
  const impStmts = wrongPool.slice(0, 2);
  const rest = shuffleB([...wrongPool.slice(2), ...truePool]);
  impStmts.forEach((s) => { s.speaker = imp; });
  [0, 1, 2, 3, 4, 5].filter((i) => i !== imp).forEach((p, idx) => { rest[idx * 2].speaker = p; rest[idx * 2 + 1].speaker = p; });
  return { stmts: shuffleB([...impStmts, ...rest]), imp };
}

function Crew({ i, size = 44, dim }: { i: number; size?: number; dim?: boolean }) {
  // the site's own sprite in a ring of the player's color
  const c = COLORS[i];
  return (
    <span className="relative inline-grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: `radial-gradient(circle at 50% 40%, ${c}55, ${c}11 70%)`, boxShadow: dim ? undefined : `0 0 0 2px ${c}, 0 0 14px ${c}88`, opacity: dim ? 0.35 : 1, filter: dim ? "grayscale(1)" : undefined }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/sprites/hero.png" alt="" width={Math.round(size * 0.86)} height={Math.round(size * 0.86)} style={{ filter: `hue-rotate(${i * 60}deg)` }} />
    </span>
  );
}

type Phase = "game" | "vote" | "ejecting" | "result";
type Susp = { busted: number; verified: number };

export function Game10Imposter() {
  const [stmts, setStmts] = useState<Stmt[]>([]);
  const [imp, setImp] = useState(0);
  const [statIdx, setStatIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("game");
  const [votes, setVotes] = useState<number[]>([]);
  const [ejected, setEjected] = useState<number[]>([]);
  const [tasksDone, setTasksDone] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [susp, setSusp] = useState<Susp[]>(NAMES.map(() => ({ busted: 0, verified: 0 })));
  const [flash, setFlash] = useState(false);
  const [msg, setMsg] = useState("");

  const newGame = () => {
    const r = assignRoles();
    setStmts(r.stmts); setImp(r.imp); setStatIdx(0); setPhase("game"); setVotes([]); setEjected([]); setTasksDone([]);
    setScore(0); setRevealed([]); setSusp(NAMES.map(() => ({ busted: 0, verified: 0 }))); setMsg("");
  };
  // roles are random, so assign on the client after mount
  useEffect(() => { const t = setTimeout(newGame, 0); return () => clearTimeout(t); }, []);

  const lastEjected = ejected[ejected.length - 1];
  const wasImposter = lastEjected === imp;
  useEffect(() => {
    if (phase !== "ejecting") return;
    const t = setTimeout(() => { setPhase("result"); if (wasImposter) sndCaught(); else sndEscaped(); }, 1100);
    return () => clearTimeout(t);
  }, [phase, wasImposter]);

  const inVote = phase === "vote" || (phase === "game" && stmts.length > 0 && statIdx >= stmts.length);

  const revealFact = () => {
    if (revealed.includes(statIdx)) return;
    const s = stmts[statIdx];
    setRevealed([...revealed, statIdx]);
    setSusp(susp.map((v, i) => (i === s.speaker ? (s.wrong ? { ...v, busted: v.busted + 1 } : { ...v, verified: v.verified + 1 }) : v)));
    if (s.wrong) { setScore((x) => x + 200); sndBusted(); } else { setScore((x) => x + 100); sndVerified(); }
  };
  const callMeeting = () => {
    sndMeeting(); setFlash(true);
    setTimeout(() => { setFlash(false); setMsg(""); setPhase("vote"); }, 550);
  };
  const eject = () => {
    if (!votes.length) { setMsg("No votes cast!"); return; }
    const t: Record<number, number> = {};
    votes.forEach((i) => { t[i] = (t[i] || 0) + 1; });
    const e = parseInt(Object.entries(t).sort((a, b) => b[1] - a[1])[0][0]);
    setEjected([...ejected, e]);
    if (e === imp) setScore((x) => x + 500);
    setPhase("ejecting");
  };

  useEffect(() => {
    if (phase !== "game" || inVote) return;
    const k = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") revealFact();
      else if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") setStatIdx((x) => x + 1);
      else if (e.key.toLowerCase() === "m") callMeeting();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (!stmts.length) return <div className="min-h-[60vh]" />;

  const Flash = flash && (<OnTop>
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-[#7f1d1d] p-5 text-center font-display text-4xl font-extrabold tracking-wide text-white sm:text-6xl" style={{ animation: "imFlash .55s ease-out forwards" }}>
      🚨 EMERGENCY MEETING 🚨
    </div>
  </OnTop>);
  const styles = <style>{`@keyframes imFlash{0%{opacity:0}25%{opacity:.92}100%{opacity:0}}@keyframes imEject{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(-90px) rotate(720deg);opacity:0}}@keyframes imConf{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(-160px) rotate(360deg);opacity:0}}@keyframes imPulse{0%,100%{border-color:#f59e0b}50%{border-color:#ef4444}}`}</style>;

  if (phase === "ejecting") {
    return (
      <FrameB title="Ejecting..." max="max-w-3xl">
        <div className="py-20 text-center">
          <div className="inline-block" style={{ animation: "imEject 1.1s ease-in forwards" }}><Crew i={lastEjected} size={110} /></div>
          <div className="mt-4 text-2xl text-muted">{NAMES[lastEjected]} was ejected...</div>
        </div>
        {styles}
      </FrameB>
    );
  }

  if (phase === "result") {
    const impLies = stmts.filter((s) => s.speaker === imp && s.wrong);
    const rank = score >= 2000 ? { label: "🕵️ Master Earth Detective", desc: "Elite fact-checking instincts — you barely missed a thing." }
      : score >= 1400 ? { label: "🔍 Sharp-Eyed Detective", desc: "You caught most of the misinformation out there." }
      : score >= 800 ? { label: "📋 Rookie Detective", desc: "Good start — review the myths you missed and try again." }
      : { label: "🤔 Keep Practicing", desc: "Fact-check every statement next time to sharpen your instincts!" };
    const c = wasImposter ? "#10b981" : "#ef4444";
    return (
      <FrameB title="Meeting Results" max="max-w-3xl">
        <div className="relative">
          {wasImposter && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={i} className="absolute top-0 text-3xl" style={{ left: `${(i * 37) % 94}%`, animation: `imConf 1.6s ease-out ${(i % 5) * 0.08}s forwards` }}>{["🎉", "✅", "🏆", "⭐", "🎊"][i % 5]}</span>
              ))}
            </div>
          )}
          <Card accent={c} className="animate-rise text-center">
            <div className="text-6xl">{wasImposter ? "🚀" : "😱"}</div>
            <div className="mt-2 font-display text-4xl font-extrabold" style={{ color: c }}>{wasImposter ? "IMPOSTER EJECTED!" : "WRONG PLAYER!"}</div>
            <div className="mt-3 flex items-center justify-center gap-3 font-display text-3xl font-extrabold text-fg"><Crew i={lastEjected} size={40} /> {NAMES[lastEjected]} was {wasImposter ? "THE IMPOSTER!" : "innocent!"}</div>
            <p className={`mt-3 text-lg ${wasImposter ? "text-[#6ee7b7]" : "text-[#fca5a5]"}`}>
              {wasImposter
                ? `The real imposter was ${NAMES[imp]} — spreading Earth science misinformation in statements ${impLies.map((s) => stmts.indexOf(s) + 1).join(", ")}. +500 bonus pts!`
                : `The real imposter was ${NAMES[imp]}! They escaped by spreading misinformation that went undetected.`}
            </p>
          </Card>
        </div>
        <Card className="mt-4 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-muted">Final Score</div>
          <div className="font-display text-5xl font-extrabold text-violet">{score} pts</div>
          <div className="mt-2 text-xl font-bold text-gold">{rank.label}</div>
          <div className="text-muted">{rank.desc}</div>
        </Card>
        <Card className="mt-4">
          <div className="font-bold text-violet">Misinformation Summary — what the imposter spread:</div>
          {impLies.map((s, i) => (
            <div key={i} className="mt-3 rounded-r-xl border-l-4 border-[#ef4444] bg-[#ef4444]/10 px-4 py-3">
              <div className="text-lg italic text-[#fca5a5]">&ldquo;{s.text}&rdquo;</div>
              <div className="mt-1 text-muted">{s.fact}</div>
            </div>
          ))}
        </Card>
        <div className="mt-5 text-center"><BtnB big onClick={newGame}><RotateCcw className="mr-2 inline size-5" />Play Again</BtnB></div>
        {styles}
      </FrameB>
    );
  }

  if (inVote) {
    return (
      <FrameB title="Emergency Meeting" sub="Vote out the Earth Imposter!" max="max-w-4xl">
        <div className="cr-dark rounded-2xl border border-[#ef4444] bg-[#7f1d1d]/90 px-4 py-3 text-center text-lg font-bold text-[#fca5a5]">Someone is spreading Earth science misinformation. VOTE THEM OUT!</div>
        <Card accent="#ef4444" className="mt-4 animate-rise">
          <div className="text-center font-display text-2xl font-extrabold tracking-wide text-[#ef4444]"><Vote className="mr-2 inline size-6" />WHO IS THE IMPOSTER?</div>
          <p className="mt-1 text-center text-muted">Based on the misinformation you heard — who do you suspect?</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NAMES.map((n, i) => {
              if (ejected.includes(i)) return null;
              const vc = votes.filter((v) => v === i).length;
              return (
                <button key={i} type="button" onClick={() => { setVotes([...votes, i]); setMsg(""); }}
                  className="flex flex-col items-center rounded-2xl border-2 px-3 py-4 transition hover:-translate-y-0.5"
                  style={{ borderColor: vc ? "#ef4444" : "var(--color-line)", background: vc ? "rgba(239,68,68,.12)" : "color-mix(in srgb, var(--color-fg) 3%, transparent)" }}>
                  <Crew i={i} size={48} />
                  <div className="mt-1 text-xl font-bold text-fg">{n}</div>
                  <div className="text-sm"><span className="text-[#ef4444]">🚫{susp[i].busted}</span> <span className="text-[#10b981]">✓{susp[i].verified}</span></div>
                  <div className="font-display text-xl font-extrabold text-[#ef4444]">{vc} vote{vc !== 1 ? "s" : ""}</div>
                </button>
              );
            })}
          </div>
        </Card>
        {msg && <div className="mt-4"><StatusB tone="bad">{msg}</StatusB></div>}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <BtnB big tone="bad" onClick={eject}>EJECT!</BtnB>
          <BtnB tone="ghost" onClick={() => setVotes([])} disabled={!votes.length}>Clear votes</BtnB>
          <BtnB tone="ghost" onClick={() => { setPhase("game"); setMsg(""); }}>Skip Voting</BtnB>
        </div>
        {styles}
      </FrameB>
    );
  }

  const s = stmts[statIdx], isRev = revealed.includes(statIdx);
  return (
    <FrameB title="Earth Imposter" sub="Spot the fake facts — find who is spreading them!"
      right={<div className="glass rounded-2xl px-5 py-2 text-center"><div className="text-xs font-bold uppercase tracking-widest text-muted">Score</div><div className="font-display text-3xl font-extrabold text-violet">{score}</div></div>}>
      <div className="cr-dark rounded-2xl border border-[#ef4444] bg-[#7f1d1d]/90 px-4 py-3 text-center text-lg font-bold text-[#fca5a5]">
        ⚠ ALERT: An Earth Imposter is spreading fake Earth science facts. Identify them before they corrupt the class!
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-fg/5">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ef4444] to-violet transition-all duration-500" style={{ width: `${Math.round((statIdx / stmts.length) * 100)}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {NAMES.map((n, i) => {
          const out = ejected.includes(i), speaking = s.speaker === i;
          return (
            <div key={i} className={`flex flex-col items-center rounded-2xl border-2 px-2 py-3 transition ${out ? "opacity-25" : ""}`}
              style={{ borderColor: speaking ? COLORS[i] : "var(--color-line)", background: speaking ? `${COLORS[i]}1a` : "color-mix(in srgb, var(--color-fg) 3%, transparent)", boxShadow: speaking ? `0 0 26px -8px ${COLORS[i]}` : undefined }}>
              <Crew i={i} size={40} dim={out} />
              <div className="mt-1 font-bold text-fg">{n}</div>
              <div className="text-xs text-muted">{out ? "Ejected" : "Player"}</div>
              {(susp[i].busted > 0 || susp[i].verified > 0) && (
                <div className="mt-1 flex gap-2 text-sm font-bold">
                  {susp[i].busted > 0 && <span className="text-[#ef4444]">🚫{susp[i].busted}</span>}
                  {susp[i].verified > 0 && <span className="text-[#10b981]">✓{susp[i].verified}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card key={statIdx} className="animate-rise">
          <div className="flex items-center gap-3 text-muted"><Crew i={s.speaker} size={34} /><strong className="text-xl text-fg">{NAMES[s.speaker]}</strong> says:</div>
          <div className="mt-3 rounded-2xl border-l-4 px-5 py-4 font-display text-2xl font-semibold italic leading-snug text-fg sm:text-3xl"
            style={{ borderColor: isRev ? (s.wrong ? "#ef4444" : "#10b981") : "color-mix(in srgb, var(--color-fg) 20%, transparent)", background: isRev ? (s.wrong ? "rgba(239,68,68,.09)" : "rgba(16,185,129,.09)") : "rgba(0,0,0,.25)" }}>
            &ldquo;{s.text}&rdquo;
          </div>
          {isRev && (
            <div className={`mt-3 animate-rise rounded-xl px-4 py-3 text-lg leading-relaxed ${s.wrong ? "cr-dark bg-[#7f1d1d]/90 text-[#fca5a5]" : "cr-dark bg-[#064e3b]/90 text-[#6ee7b7]"}`}>
              <b>{s.wrong ? "🚫 MISINFORMATION DETECTED" : "✅ FACT VERIFIED"}:</b> {s.fact}
            </div>
          )}
        </Card>
        <Card>
          <div className="flex items-center gap-2 font-bold text-violet"><ClipboardCheck className="size-5" />Fact-Check Tasks (click to complete)</div>
          <div className="mt-2 divide-y divide-line">
            {TASKS.map((t, i) => {
              const d = tasksDone.includes(i);
              return (
                <button key={i} type="button" onClick={() => !d && setTasksDone([...tasksDone, i])}
                  className={`flex w-full items-center gap-3 py-2.5 text-left ${d ? "text-[#10b981] line-through opacity-60" : "text-fg/85 hover:text-fg"}`}>
                  <span className={`grid size-5 shrink-0 place-items-center rounded border-2 text-xs ${d ? "border-[#10b981] bg-[#10b981] text-white" : "border-fg/20"}`}>{d ? "✓" : ""}</span>{t}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <StatusB tone={isRev ? (s.wrong ? "bad" : "good") : undefined}>
          {isRev ? (s.wrong ? "MISINFORMATION DETECTED! +200 pts for catching it!" : "True statement confirmed. +100 pts.") : `Statement ${statIdx + 1} of ${stmts.length}. Discuss with your team — is this true or false?`}
        </StatusB>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <BtnB tone="violet" onClick={revealFact} disabled={isRev}><Search className="mr-2 inline size-4" />Fact Check</BtnB>
        <BtnB tone="blue" onClick={() => setStatIdx(statIdx + 1)}>Next Statement <ArrowRight className="ml-1 inline size-4" /></BtnB>
        <BtnB big tone="bad" onClick={callMeeting}><Siren className="mr-2 inline size-5" />Call Meeting — Vote!</BtnB>
      </div>
      <p className="mt-3 text-center text-xs text-muted/80">Keys: F fact check · N / → next statement · M call meeting</p>
      {Flash}
      {styles}
    </FrameB>
  );
}
