"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, Trophy } from "lucide-react";
import data from "./data/game08_price_is_right.json";
import { BtnB, Card, FrameB, Stat, StatusB, shuffleOpts } from "./shared-b";

// Bedrock twin of Dopps Class game08_price_is_right ("The Price Is Right" → "Guess the Number"): 4 mini-games
// with real Earth science numbers. Guess games score by how close you are
// (exact 500, ≤5% 400, ≤15% 300, ≤30% 200, ≤50% 100); cart games are +300 for the right pick.
type GuessItem = { name: string; desc: string; price: number; unit: string; note?: string };
type CartItem = { q: string; opts: string[]; ans: number; fact?: string };
type Item = GuessItem | CartItem;
type Mini = { name: string; icon: string; desc: string; items: Item[] };
const MINI_GAMES = (data as { MINI_GAMES: Mini[] }).MINI_GAMES;
const isCart = (it: Item): it is CartItem => "opts" in it;
const n = (x: number) => x.toLocaleString();

type Reveal = { cls: "win" | "close" | "lose"; label: string; price?: string; diff?: string; note?: string };
const REVEAL_STYLE = {
  win: { border: "#00e5a0", bg: "rgba(0,229,160,.14)", fg: "var(--color-emerald)" },
  close: { border: "#a3e635", bg: "rgba(163,230,53,.12)", fg: "var(--cr-close)" },
  lose: { border: "#ff3b5c", bg: "rgba(255,59,92,.13)", fg: "var(--cr-lose)" },
};

export function Game08PriceIsRight() {
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [mini, setMini] = useState(-1);
  const [qIdx, setQIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [status, setStatus] = useState("");
  const [cart, setCart] = useState<CartItem | null>(null);
  const [picked, setPicked] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const game = mini >= 0 ? MINI_GAMES[mini] : null;
  const item = game ? game.items[qIdx] : null;

  const loadItem = (m: number, q: number) => {
    const it = MINI_GAMES[m].items[q];
    setQIdx(q); setGuess(""); setReveal(null); setPicked(-1);
    if (isCart(it)) { setCart({ ...it, ...shuffleOpts(it.opts, it.ans) }); setStatus("Choose the correct answer!"); }
    else { setCart(null); setStatus("Type your best guess and click Submit!"); }
  };
  const startMini = (i: number) => { setMini(i); loadItem(i, 0); };
  const menu = () => { setMini(-1); setReveal(null); };

  const checkGuess = () => {
    if (!item || isCart(item) || reveal) return;
    const g = parseInt(guess) || 0;
    const diff = Math.abs(g - item.price), pct = diff / item.price;
    let pts = 0, cls: Reveal["cls"] = "lose", label = "";
    if (pct === 0) { pts = 500; cls = "win"; label = "EXACT! 500 pts!"; }
    else if (pct <= 0.05) { pts = 400; cls = "win"; label = "Within 5%! 400 pts!"; }
    else if (pct <= 0.15) { pts = 300; cls = "close"; label = "Close! Within 15%. 300 pts!"; }
    else if (pct <= 0.3) { pts = 200; cls = "close"; label = "Within 30%. 200 pts!"; }
    else if (pct <= 0.5) { pts = 100; cls = "lose"; label = "Off by more than 30%. 100 pts."; }
    else { pts = 0; cls = "lose"; label = "Way off! 0 pts this round."; }
    setTotal((t) => t + pts);
    setReveal({ cls, label, price: `${n(item.price)} ${item.unit}`, diff: `Your guess: ${n(g)} — Difference: ${n(diff)}`, note: item.note });
    setStatus(`Actual number: ${n(item.price)} ${item.unit}. +${pts} pts added to your score!`);
  };

  const pickCart = (i: number) => {
    if (!cart || picked >= 0) return;
    const ok = i === cart.ans;
    setPicked(i);
    if (ok) setTotal((t) => t + 300);
    setStatus(ok ? "Correct! +300 pts!" : "Wrong! See the correct answer above.");
    setReveal({ cls: ok ? "win" : "lose", label: ok ? "Correct! +300 pts" : "Wrong! 0 pts" });
  };

  const nextItem = () => {
    if (!game) return;
    const q = qIdx + 1;
    if (q >= game.items.length) { if (!done.includes(mini)) setDone([...done, mini]); menu(); }
    else loadItem(mini, q);
  };
  const reset = () => { setTotal(0); setDone([]); menu(); };

  useEffect(() => { if (item && !isCart(item) && !reveal) inputRef.current?.focus(); }, [item, reveal]);
  useEffect(() => {
    if (mini < 0) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter" && reveal) { e.preventDefault(); nextItem(); return; }
      if (cart && !reveal) { const i = "ABCD".indexOf(e.key.toUpperCase()); const d = "1234".indexOf(e.key); const j = i >= 0 ? i : d; if (j >= 0 && j < cart.opts.length) pickCart(j); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (!game || !item) {
    const all = done.length === MINI_GAMES.length;
    return (
      <FrameB title="Guess the Number" sub="Earth Science Edition — Bedrock">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total Score" value={`${n(total)} pts`} color="#ffd166" />
          <Stat label="Games Completed" value={`${done.length} / ${MINI_GAMES.length}`} color="#00e5a0" />
        </div>
        <p className="mt-5 text-center text-lg text-muted">Choose a mini-game to play!</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {MINI_GAMES.map((g, i) => {
            const d = done.includes(i);
            return (
              <button key={i} type="button" onClick={() => startMini(i)}
                className={`glass animate-rise rounded-3xl p-6 text-center transition hover:-translate-y-1 hover:border-gold/60 ${d ? "opacity-60" : ""}`}
                style={{ animationDelay: `${i * 70}ms`, borderColor: d ? "#00e5a0" : undefined }}>
                <div className="text-5xl">{g.icon}</div>
                <div className="mt-2 font-display text-2xl font-extrabold text-gold">{g.name}</div>
                <div className="mt-1 text-muted">{g.desc}</div>
                {d && <div className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-emerald"><CheckCircle2 className="size-4" /> COMPLETED</div>}
              </button>
            );
          })}
        </div>
        {all && (
          <Card accent="#00e5a0" className="mt-5 animate-rise text-center">
            <Trophy className="mx-auto size-12 text-gold" />
            <div className="mt-2 font-display text-4xl font-extrabold text-gold">ALL GAMES COMPLETE!</div>
            <div className="mt-1 text-2xl text-fg">Final Score: <strong>{n(total)} pts</strong></div>
          </Card>
        )}
        <div className="mt-5 text-center"><BtnB tone="ghost" onClick={reset}><RotateCcw className="mr-2 inline size-4" />Reset All</BtnB></div>
      </FrameB>
    );
  }

  const rs = reveal ? REVEAL_STYLE[reveal.cls] : null;
  return (
    <FrameB title={game.name} sub={<>{game.icon} {game.desc}</>} max="max-w-4xl"
      right={<div className="glass rounded-2xl px-5 py-2 text-center"><div className="text-xs font-bold uppercase tracking-widest text-muted">Score</div><div className="font-display text-3xl font-extrabold text-gold">{n(total)}</div></div>}>
      <div className="flex justify-center gap-2">
        {game.items.map((_, i) => (
          <div key={i} className="size-3.5 rounded-full" style={{ background: i < qIdx ? "#00e5a0" : i === qIdx ? "#ffd166" : "color-mix(in srgb, var(--color-fg) 12%, transparent)", boxShadow: i === qIdx ? "0 0 12px #ffd166" : undefined }} />
        ))}
      </div>

      {!isCart(item) ? (
        <>
          <Card accent="#ffd166" className="mt-4 animate-rise text-center" key={`g${qIdx}`}>
            <div className="font-display text-3xl font-extrabold text-gold sm:text-4xl">{item.name}</div>
            <div className="mt-2 text-lg text-muted">{item.desc}</div>
          </Card>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <label htmlFor="pir-guess" className="text-lg font-semibold text-fg/85">Your guess (in {item.unit}):</label>
            <input id="pir-guess" ref={inputRef} type="number" min={0} placeholder="0" value={guess} disabled={!!reveal}
              onChange={(e) => setGuess(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !reveal) { e.stopPropagation(); e.preventDefault(); checkGuess(); } }}
              className="w-48 rounded-2xl border-2 border-line bg-fg/5 px-4 py-3 text-center font-display text-3xl font-extrabold text-gold outline-none focus:border-gold" />
          </div>
        </>
      ) : cart && (
        <Card className="mt-4 animate-rise" key={`c${qIdx}`}>
          <div className="font-display text-2xl font-extrabold leading-snug text-gold sm:text-3xl">{cart.q}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {cart.opts.map((o, i) => {
              const right = picked >= 0 && i === cart.ans, bad = picked === i && i !== cart.ans;
              return (
                <button key={i} type="button" disabled={picked >= 0} onClick={() => pickCart(i)}
                  className="rounded-2xl border-2 px-4 py-5 text-center text-xl font-semibold transition enabled:hover:-translate-y-0.5 enabled:hover:border-gold"
                  style={{ borderColor: right ? "#00e5a0" : bad ? "#ff3b5c" : "rgba(56,191,255,.35)", background: right ? "rgba(0,229,160,.16)" : bad ? "rgba(255,59,92,.16)" : "rgba(56,191,255,.06)" }}>
                  <span className="mr-2 font-display font-extrabold text-gold">{"ABCD"[i]}:</span>{o}
                </button>
              );
            })}
          </div>
          {picked >= 0 && cart.fact && <div className="mt-4 rounded-r-xl border-l-4 border-gold bg-fg/5 px-4 py-3 text-lg leading-relaxed text-fg/85">{cart.fact}</div>}
        </Card>
      )}

      {reveal && rs && (
        <div className="mt-4 animate-rise rounded-3xl border-2 px-5 py-4 text-center" style={{ borderColor: rs.border, background: rs.bg, boxShadow: `0 0 34px -12px ${rs.border}` }}>
          <div className="text-xl font-bold" style={{ color: rs.fg }}>{reveal.label}</div>
          {reveal.price && <div className="mt-1 font-display text-4xl font-extrabold text-gold sm:text-5xl">{reveal.price}</div>}
          {reveal.diff && <div className="mt-1 text-lg text-fg/75">{reveal.diff}</div>}
          {reveal.note && <div className="mx-auto mt-3 max-w-2xl text-lg leading-relaxed text-fg/90">{reveal.note}</div>}
        </div>
      )}

      <div className="mt-4"><StatusB>{status}</StatusB></div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {!isCart(item) && !reveal && <BtnB big tone="bad" onClick={checkGuess}>Submit Guess</BtnB>}
        {reveal && <BtnB big tone="blue" onClick={nextItem}>{isCart(item) ? "Next Question" : "Next Item"} <ArrowRight className="ml-1 inline size-5" /></BtnB>}
        <BtnB tone="ghost" onClick={menu}><ArrowLeft className="mr-2 inline size-4" />Back to Menu</BtnB>
      </div>
    </FrameB>
  );
}
