"use client";

// Bedrock twin of Dopps Class game13_pictionary — teams (3 by default, up to 5) take 60-second drawing turns.
// Drawer privately reveals the word, starts the timer and draws; teacher clicks Correct (+1) or Skip.
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, Play, Plus, RotateCcw, SkipForward, Trash2, Users } from "lucide-react";
import data from "./data/game13_pictionary.json";
import { Btn, Hint, Shell, TEAM_COLORS, TeamCard, TimerBadge, sfx, shuffle, useDeck, useCountdown, useKeys } from "./shared-c";

type Word = { word: string; cat: string; hint: string };
const WORDS = (data as { WORDS: Word[] }).WORDS;
const TURN = 60, CW = 1280, CH = 560;
const COLORS = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#ffffff"];
const SIZES = [3, 6, 12, 20];

export function Game13Pictionary() {
  const [phase, setPhase] = useState<"setup" | "game">("setup");
  const [teams, setTeams] = useState(["Team 1", "Team 2", "Team 3"]);
  const [scores, setScores] = useState([0, 0, 0]);
  const [cur, setCur] = useState(0);
  const [deck, setDeck] = useDeck(WORDS);
  const [idx, setIdx] = useState(0);
  const [timer, setTimer] = useState(TURN);
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState("");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(6);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const w = deck[idx % deck.length];

  const clearCanvas = () => { const c = canvasRef.current; c?.getContext("2d")?.clearRect(0, 0, CW, CH); };
  // The original redraws the whole screen (wiping the canvas) on each new word / reveal / timer start.
  useEffect(() => { clearCanvas(); }, [idx, cur, visible, phase]);

  const newWord = () => {
    if (idx + 1 >= deck.length) { setDeck(shuffle(WORDS)); setIdx(0); } else setIdx(idx + 1);
    setVisible(false); setStatus("");
  };

  const init = () => {
    setDeck(shuffle(WORDS)); setIdx(0); setScores(teams.map(() => 0)); setCur(0); setRunning(false); setTimer(TURN); setVisible(false); setStatus(""); setPhase("setup");
  };

  const endRound = useCallback(() => {
    setRunning(false); sfx.buzz();
    setStatus(`Time's up! ${teams[cur]} earned points this round.`);
  }, [teams, cur]);
  useCountdown(running, setTimer, timer, endRound);

  const reveal = () => { setVisible(true); setStatus(""); sfx.click(); };
  const startTimer = () => { setRunning(true); setTimer(TURN); setStatus(""); clearCanvas(); sfx.click(); };
  const correct = () => { if (!running) return; setScores((s) => s.map((v, i) => (i === cur ? v + 1 : v))); newWord(); sfx.good(); };
  const skip = () => { if (!running) return; newWord(); sfx.click(); };
  const nextTeam = () => { setRunning(false); setTimer(TURN); setVisible(false); setStatus(""); setCur((c) => (c + 1) % teams.length); };

  useKeys((e) => {
    if (phase !== "game") return;
    const k = e.key.toLowerCase();
    if (k === "r" && !visible) reveal();
    else if (k === " " && visible && !running) { e.preventDefault(); startTimer(); }
    else if ((k === "c" || k === "enter") && running) { e.preventDefault(); correct(); }
    else if (k === "s" && running) skip();
    else if (k === "n") nextTeam();
    else if (k === "backspace" || k === "delete") clearCanvas();
  });

  // ---------- drawing ----------
  const pt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * CW) / r.width, y: ((e.clientY - r.top) * CH) / r.height };
  };
  const stroke = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    ctx.lineWidth = size * 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); const p = pt(e); last.current = p; stroke(p, p); };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!last.current) return; const p = pt(e); stroke(last.current, p); last.current = p; };
  const up = () => { last.current = null; };

  if (phase === "setup") {
    return (
      <Shell title="Earth Science Pictionary Blitz" sub="Draw it · guess it · 60 seconds" max="max-w-2xl" right={<TimerBadge secs={TURN} />}>
        <div className="glass animate-rise rounded-3xl p-6 sm:p-8">
          <div className="rounded-2xl border-l-4 border-sky bg-sky/10 p-5 text-lg leading-relaxed text-fg">
            <strong className="text-sky">How to play:</strong>
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              <li>Click <em>Reveal Word</em> — only the drawer sees the word!</li>
              <li>Draw on the canvas — NO letters, numbers, or talking!</li>
              <li>Teammates shout guesses — teacher clicks Correct when they get it!</li>
              <li>Get as many words right in 60 seconds!</li>
            </ol>
          </div>
          <div className="mt-6 text-xs font-bold uppercase tracking-widest text-muted">Teams (edit names):</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {teams.map((t, i) => (
              <input key={i} value={t} maxLength={20} onChange={(e) => setTeams((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))}
                className="w-36 rounded-xl border-2 bg-fg/5 px-3 py-2 font-bold outline-none" style={{ borderColor: `${TEAM_COLORS[i]}88`, color: TEAM_COLORS[i] }} />
            ))}
            {teams.length < 5 && (
              <Btn tone="ghost" onClick={() => { setTeams((t) => [...t, `Team ${t.length + 1}`]); setScores((s) => [...s, 0]); }}><Plus className="size-4" /> Team</Btn>
            )}
          </div>
          <div className="mt-7 flex justify-center">
            <Btn big onClick={() => { setScores(teams.map(() => 0)); setPhase("game"); }}><Users className="size-6" /> Start Game</Btn>
          </div>
        </div>
      </Shell>
    );
  }

  const cols = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-2 sm:grid-cols-4", "grid-cols-3 sm:grid-cols-5"][teams.length];

  return (
    <Shell title="Earth Science Pictionary" max="max-w-5xl" right={<TimerBadge secs={timer} warnAt={15} dangerAt={5} />}>
      <div className={`grid gap-2 ${cols}`}>
        {teams.map((t, i) => (
          <TeamCard key={i} name={t} score={scores[i]} color={TEAM_COLORS[i]} active={i === cur} onName={(v) => setTeams((ts) => ts.map((x, j) => (j === i ? v : x)))} />
        ))}
      </div>

      <div key={`${idx}-${visible}`} className="cr-dark mt-4 animate-rise rounded-3xl border-2 border-sky/60 bg-gradient-to-b from-[#0f2d47]/90 to-[#0a1424]/90 p-5 text-center shadow-[0_0_40px_-16px_#38bfff]">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-sky/80 sm:text-sm">{w.cat}</div>
        {visible ? (
          <>
            <div className="mt-1 font-display text-4xl font-extrabold tracking-wide text-fg sm:text-6xl">{w.word}</div>
            <div className="mt-1 text-base text-sky/90 sm:text-lg">{w.hint}</div>
          </>
        ) : (
          <>
            <div className="mx-auto mt-2 inline-block rounded-xl bg-sky px-6 py-2 font-display text-2xl font-extrabold tracking-[0.4em] text-ink">? ? ? ? ?</div>
            <div className="mt-2 text-sm text-sky/80">Only the drawer should click Reveal!</div>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`} className="size-9 rounded-full border-2 transition hover:scale-110"
            style={{ background: c, borderColor: color === c ? "#ffd166" : "color-mix(in srgb, var(--color-fg) 25%, transparent)", boxShadow: color === c ? "0 0 0 3px rgba(255,209,102,.4)" : undefined }} />
        ))}
        <span className="ml-2 text-sm font-bold text-muted">Size:</span>
        {SIZES.map((s) => (
          <button key={s} onClick={() => setSize(s)} className={`rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition ${size === s ? "border-gold bg-gold/15 text-gold" : "border-line bg-fg/5 text-fg hover:bg-fg/10"}`}>{s}</button>
        ))}
        <Btn tone="bad" className="ml-auto !px-4 !py-2 !text-sm" onClick={clearCanvas}><Trash2 className="size-4" /> Clear</Btn>
      </div>

      <canvas ref={canvasRef} width={CW} height={CH} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        className="mt-3 block aspect-[1280/560] w-full cursor-crosshair touch-none rounded-2xl bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)]" />

      <div className="glass mt-4 min-h-12 rounded-2xl px-4 py-3 text-center font-semibold sm:text-lg">
        {status || (running ? <><span style={{ color: TEAM_COLORS[cur] }}>{teams[cur]}</span> is drawing! Guess the word!</> : "Click Reveal Word, then Start Timer!")}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {!visible && <Btn big tone="sky" onClick={reveal} kbd="R"><Eye className="size-6" /> Reveal Word (Drawer Only)</Btn>}
        {visible && !running && <Btn big onClick={startTimer} kbd="Space"><Play className="size-6" /> Start Timer</Btn>}
        {running && <Btn big tone="good" onClick={correct} kbd="C"><Check className="size-6" /> Correct! +1</Btn>}
        {running && <Btn big tone="ghost" onClick={skip} kbd="S"><SkipForward className="size-6" /> Skip Word</Btn>}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <Btn tone="sky" onClick={nextTeam} kbd="N">Next Team&apos;s Turn</Btn>
        <Btn tone="ghost" onClick={init}><RotateCcw className="size-4" /> New Game</Btn>
      </div>
      <Hint>Keys: R reveal · Space start timer · C correct · S skip · N next team · Backspace clear canvas</Hint>
    </Shell>
  );
}
