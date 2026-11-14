"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Gamepad2, RotateCcw, Users } from "lucide-react";
import { FOSSILS, fossilByName } from "./fossil-art";

// Twin of Dopps Class "Dopp Memory": the same turn-based pairs game, with fossil cards instead of hairstyles.
type Card = { style: string; owner: 0 | 1 | 2 };
type Mode = "cpu" | "local";

const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function deal(): Card[] {
  const styles = FOSSILS.map((f) => f.name).sort(() => Math.random() - 0.5).slice(0, 8);
  const cards = [...styles, ...styles].map((style) => ({ style, owner: 0 as const }));
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

export function FossilMemory() {
  const ready = true;
  const [mode, setMode] = useState<Mode | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [up, setUp] = useState<number[]>([]);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [stats, setStats] = useState({ wins: 0, plays: 0 });
  const seen = useRef(new Map<number, string>());
  const recorded = useRef(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- read saved stats after hydration (static export)
  useEffect(() => setStats({ wins: store.get("bedrock_fossil_memory_wins", 0), plays: store.get("bedrock_fossil_memory_plays", 0) }), []);

  const score = (p: 1 | 2) => cards.filter((c) => c.owner === p).length / 2;
  const done = cards.length > 0 && cards.every((c) => c.owner);
  const names = { 1: mode === "cpu" ? "You" : "Player 1", 2: mode === "cpu" ? "Computer" : "Player 2" } as const;

  const flip = useCallback(
    (i: number) => {
      if (busy || done || cards[i].owner || up.includes(i)) return;
      seen.current.set(i, cards[i].style);
      const next = [...up, i];
      setUp(next);
      if (next.length < 2) return;
      setBusy(true);
      const [a, b] = next;
      if (cards[a].style === cards[b].style) {
        setTimeout(() => {
          setCards((cs) => cs.map((c, k) => (k === a || k === b ? { ...c, owner: turn } : c)));
          seen.current.delete(a);
          seen.current.delete(b);
          setUp([]);
          setBusy(false);
          setMsg(`✅ ${names[turn]} found the ${cards[a].style} pair! ${fossilByName(cards[a].style)?.fact ?? ""} Go again!`);
        }, 650);
      } else {
        setMsg("❌ No match!");
        setTimeout(() => {
          setUp([]);
          setBusy(false);
          setTurn((t) => (t === 1 ? 2 : 1));
          setMsg("");
        }, 1100);
      }
    },
    [busy, done, cards, up, turn, names]
  );

  // computer turn: uses what it has seen (with a little forgetfulness)
  useEffect(() => {
    if (mode !== "cpu" || turn !== 2 || busy || done || !cards.length) return;
    const t = setTimeout(() => {
      const open = cards.map((c, i) => (c.owner ? -1 : i)).filter((i) => i >= 0 && !up.includes(i));
      const known = [...seen.current.entries()].filter(([i]) => !cards[i].owner && Math.random() < 0.85);
      if (up.length === 0) {
        const pair = known.find(([i, s]) => known.some(([j, s2]) => j !== i && s2 === s));
        flip(pair ? pair[0] : open[Math.floor(Math.random() * open.length)]);
      } else {
        const first = up[0];
        const match = known.find(([i, s]) => i !== first && s === cards[first].style);
        flip(match ? match[0] : open[Math.floor(Math.random() * open.length)]);
      }
    }, 750);
    return () => clearTimeout(t);
  }, [mode, turn, busy, done, cards, up, flip]);

  useEffect(() => {
    if (!done || recorded.current || mode !== "cpu") return;
    recorded.current = true;
    const plays = store.get("bedrock_fossil_memory_plays", 0) + 1, wins = store.get("bedrock_fossil_memory_wins", 0) + (score(1) > score(2) ? 1 : 0);
    store.set("bedrock_fossil_memory_plays", plays);
    store.set("bedrock_fossil_memory_wins", wins);
    setStats({ wins, plays });
  });

  const start = (m: Mode) => {
    setMode(m);
    setCards(deal());
    setUp([]);
    setTurn(1);
    setBusy(false);
    setMsg("");
    seen.current.clear();
    recorded.current = false;
  };
  const face = (s: string) => fossilByName(s)?.art ?? "";

  if (!mode) {
    return (
      <div className="block-panel mx-auto max-w-md p-7 text-center">
        <div className="mx-auto size-24 rounded-2xl bg-[#f3e6cf] p-2" dangerouslySetInnerHTML={{ __html: face("Ammonite") }} />
        <h1 className="text-gradient mt-2 font-display text-4xl font-extrabold tracking-tight">Fossil Memory</h1>
        <p className="mt-2 text-muted">Take turns flipping cards to match pairs of fossils, from trilobites to Idaho&apos;s Hagerman Horse. Most pairs wins!</p>
        <div className="mt-6 space-y-2.5">
          {[
            { m: "cpu" as Mode, t: "vs Computer", s: "It remembers cards it has seen", i: <Bot className="size-5" /> },
            { m: "local" as Mode, t: "2 Players · Same device", s: "Take turns with a friend", i: <Users className="size-5" /> },
          ].map((o) => (
            <button key={o.t} disabled={!ready} onClick={() => start(o.m)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-fg/[0.04] p-3.5 text-left text-fg transition hover:border-gold/50 hover:bg-gold/10 disabled:opacity-50">
              <span className="grid size-10 place-items-center rounded-xl bg-gold/15 text-gold">{o.i}</span>
              <span><span className="block font-bold">{o.t}</span><span className="block text-xs text-muted">{o.s}</span></span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-xs text-muted/80">Wins vs the computer on this device: <b className="text-gold">{stats.wins}</b> of {stats.plays}</p>
      </div>
    );
  }

  const winner = done ? (score(1) === score(2) ? "It's a tie!" : `${score(1) > score(2) ? names[1] : names[2]} ${mode === "cpu" && score(1) > score(2) ? "win" : "wins"}! 🎉`) : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center">
      <div className="mb-4 grid w-full grid-cols-2 gap-3">
        {([1, 2] as const).map((p) => (
          <div key={p} className={`rounded-2xl border px-4 py-2.5 transition ${!done && turn === p ? "border-gold/50 bg-gold/10" : "border-line bg-fg/[0.03]"} ${p === 2 ? "text-right" : ""}`}>
            <div className="text-xs font-semibold text-muted">{names[p]}</div>
            <div className="font-display text-2xl font-extrabold">{score(p)} <span className="text-sm font-semibold text-muted">pairs</span></div>
          </div>
        ))}
      </div>
      <div className="mb-4 min-h-7 max-w-lg text-center font-display text-lg font-extrabold">
        {winner ?? (msg || (mode === "cpu" && turn === 2 ? "Computer is thinking…" : `${names[turn]}${mode === "cpu" ? "r" : "'s"} turn — flip two cards`))}
      </div>
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3" style={{ perspective: 900 }}>
        {cards.map((c, i) => {
          const shown = !!c.owner || up.includes(i);
          return (
            <button
              key={i}
              onClick={() => !(mode === "cpu" && turn === 2) && flip(i)}
              className="relative size-20 sm:size-28"
              style={{ transformStyle: "preserve-3d", transition: "transform .45s cubic-bezier(.2,.7,.2,1)", transform: shown ? "rotateY(180deg)" : "none" }}
              aria-label={shown ? c.style : "Hidden card"}
            >
              <span className="absolute inset-0 grid place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-[#a0643a] to-[#4a2a18] font-display text-3xl font-extrabold text-[#f6c453] shadow-[0_10px_24px_-10px_rgba(0,0,0,.8)] [backface-visibility:hidden]">
                🦴
              </span>
              <span
                className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl border bg-[#f3e6cf] p-1 [backface-visibility:hidden] ${
                  c.owner === 1 ? "border-sky ring-2 ring-sky/60" : c.owner === 2 ? "border-crimson ring-2 ring-crimson/60" : "border-white/30"
                }`}
                style={{ transform: "rotateY(180deg)" }}
              >
                <span className="block size-14 sm:size-20" dangerouslySetInnerHTML={{ __html: face(c.style) }} />
                <b className="mt-0.5 line-clamp-1 text-[9px] font-bold text-[#2a1a14] sm:text-[11px]">{c.style}</b>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {done && (
          <button onClick={() => start(mode)} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-6 py-3 font-bold text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)]">
            <RotateCcw className="size-4" /> Play again
          </button>
        )}
        <button onClick={() => setMode(null)} className="glass rounded-2xl px-5 py-3 font-semibold transition hover:bg-white/10">Change mode</button>
        <Link href="/arcade/" className="glass inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold transition hover:bg-white/10"><Gamepad2 className="size-4" /> More games</Link>
      </div>
    </div>
  );
}
