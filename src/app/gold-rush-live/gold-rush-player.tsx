"use client";

// ── wave-live ── Gold Rush Live, student phone screen. The live twin of Gold Rush (public/classic-games/gold-rush.html)
// and of Dopps Class coin_live.html: answer at your own pace, dig gold, buy mining gear. The server checks every
// answer and prices every upgrade.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GEAR, coinAnswer, coinBuy, coinMe, money, store, type CoinView, type GearKey } from "@/lib/live";
import { TEAMS, TeamPill, btn, btnGold } from "@/components/live/shared";
import { PKEY, type LivePlayer } from "../live/live-player";

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
type Shown = { idx: number; ch: number | null; prompt: string; opts: string[] };
type Feedback = { picked: string; right: string | null; correct: boolean; why?: string; waiting: boolean };

export function GoldRushPlayer() {
  const router = useRouter();
  const [P, setP] = useState<LivePlayer | null>(null);
  const [me, setMe] = useState<CoinView | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [pops, setPops] = useState<{ id: number; txt: string; plus: boolean }[]>([]);
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");
  const [shopOpen, setShopOpen] = useState(false);
  const [nextReady, setNextReady] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const busy = useRef(false);
  const deadline = useRef(0);
  const done = useRef(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const p = store.get<LivePlayer | null>(PKEY, null);
    if (!p?.pid) { router.replace("/live/" + location.search); return; }
    setP(p); // eslint-disable-line react-hooks/set-state-in-effect -- the saved player lives in this browser
  }, [router]);

  const popId = useRef(0);
  const pop = (txt: string, plus: boolean) => {
    const id = ++popId.current;
    setPops((x) => [...x, { id, txt, plus }]);
    setTimeout(() => setPops((x) => x.filter((p) => p.id !== id)), 1000);
  };

  const apply = useCallback((v: CoinView, keepQuestion = false) => {
    setMe(v);
    if (v.seconds_left != null) deadline.current = Date.now() + v.seconds_left * 1000;
    if (v.phase === "ended" || (v.phase === "question" && !v.running)) { done.current = true; setOver(true); store.set(PKEY, null); return; }
    if (!keepQuestion && v.question) setShown((s) => (s && s.idx === v.question!.idx ? s : { ...v.question!, opts: shuffle(v.question!.choices) }));
  }, []);

  const poll = useCallback(async () => {
    if (!P || done.current || busy.current) return;
    try { const v = await coinMe(P.pid, P.tok); setNetErr(""); apply(v, !!fb?.waiting); }
    catch (e) {
      if (/Not in this game|Not a Gold Rush/.test((e as Error).message)) { store.set(PKEY, null); router.replace("/live/"); return; }
      setNetErr("Connection trouble… retrying");
    }
  }, [P, apply, fb, router]);
  useEffect(() => {
    if (!P) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first poll now, then on a timer
    poll();
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
  }, [P, poll]);
  useEffect(() => {
    const t = setInterval(() => {
      if (!deadline.current) return;
      const l = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0 && !done.current) setTimeout(poll, 2500);
    }, 250);
    return () => clearInterval(t);
  }, [poll]);

  const answer = async (opt: string) => {
    if (!P || !shown || busy.current || fb) return;
    busy.current = true; setErr("");
    try {
      const r = await coinAnswer(P.pid, P.tok, shown.idx, opt);
      if (r.stale) { busy.current = false; setShown(null); apply(r.me); return; }
      if (r.correct) {
        if (r.delta) pop("+" + money(r.delta), true);
        setFb({ picked: opt, right: r.answer ?? null, correct: true, waiting: false });
        setMe(r.me);
        setTimeout(() => { busy.current = false; setFb(null); setShown(null); apply(r.me); }, 600);
      } else {
        if (r.delta) pop("−" + money(-r.delta), false);
        setMe(r.me);
        setFb({ picked: opt, right: r.answer ?? null, correct: false, why: r.why, waiting: true });
        setNextReady(false); setTimeout(() => setNextReady(true), 1500);
        busy.current = false;
        if (r.me.phase === "ended" || !r.me.running) apply(r.me);
      }
    } catch (e) {
      busy.current = false;
      const m = (e as Error).message;
      if (/Too fast/.test(m)) { setTimeout(() => answer(opt), 700); return; }
      if (/Time is up/.test(m)) { poll(); return; }
      setErr("Did not send. Tap again.");
    }
  };
  const next = () => { if (!nextReady || !me) return; setFb(null); setShown(null); apply(me); };

  const buy = async (k: GearKey) => {
    if (!P || !me) return;
    const g = GEAR.find((x) => x.key === k)!, c = g.cost[(me.lv[k] ?? 0) + 1];
    try { const v = await coinBuy(P.pid, P.tok, k); pop("−" + money(c), false); setMe(v); }
    catch (e) { const m = (e as Error).message; setErr(/Not enough/.test(m) ? "Not enough gold yet." : /maxed/.test(m) ? "" : "Could not buy. Try again."); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shown || done.current) return;
      if (/^[1-4]$/.test(e.key) && !fb) { const o = shown.opts[+e.key - 1]; if (o) answer(o); }
      else if ((e.key === "Enter" || e.key === " ") && fb?.waiting) { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const top = (
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-24">
      <Link href="/live/" onClick={() => store.set(PKEY, null)} className="font-extrabold text-gold">← Leave</Link>
      <h1 className="font-display text-xl font-extrabold text-gold sm:text-2xl">⛏️ Gold Rush Live</h1>
      <span className="hidden text-sm font-bold text-muted sm:inline">{me ? me.nickname + (me.team ? " · " + TEAMS[me.team].name : "") : ""}</span>
    </div>
  );
  if (!me) return <>{top}<p className="mt-10 text-center text-muted">Connecting…</p></>;

  // ---- end ----
  if (over || me.phase === "ended") {
    const pct = me.answered ? Math.round((me.correct / me.answered) * 100) : 0;
    return (
      <>{top}
        <div className="mx-auto mt-6 max-w-xl px-4 pb-16">
          <div className="block-panel p-6 text-center" data-testid="gr-end">
            <div className="font-bold text-muted">Final gold</div>
            <div className="font-display text-6xl font-extrabold text-gold">{money(me.cash)}</div>
            <div className="mt-2 font-display text-2xl font-extrabold">{me.rank === 1 ? "🏆 1st place!" : `#${me.rank} of ${me.players}`}</div>
            {me.team && me.teams && <TeamRow teams={me.teams} mine={me.team} />}
            <div className="mt-4 flex flex-wrap justify-center gap-3 font-bold text-muted">
              <span>✅ {me.correct} / {me.answered} right ({pct}%)</span><span>💰 {money(me.earned)} dug</span>
            </div>
            <p className="mt-3 text-muted">Check the big screen for the final leaderboard.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link className={btnGold} href="/live/">Join another game</Link>
              <a className={btn} href="/classic-games/gold-rush.html">⛏️ Practice solo</a>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ---- lobby ----
  if (me.phase === "lobby") {
    return (
      <>{top}
        <div className="mx-auto mt-6 max-w-xl px-4">
          <div className="block-panel p-6 text-center" data-testid="gr-lobby">
            <div className="text-6xl">⛏️</div>
            <div className="mt-2 font-display text-3xl font-extrabold">You&apos;re in!</div>
            <div className="mt-2"><TeamPill team={me.team} /></div>
            <p className="mt-3 leading-relaxed text-muted">When your teacher starts the clock, answer Earth science questions at your own pace. Right answers dig gold. Spend gold on mining gear to dig faster. Most gold when time runs out wins!</p>
            <span className="mt-3 inline-block rounded-full border border-line px-4 py-1.5 font-extrabold">{me.players} miner{me.players === 1 ? "" : "s"} in the game</span>
          </div>
        </div>
      </>
    );
  }

  // ---- play ----
  const canBuy = GEAR.some((g) => { const l = me.lv[g.key] ?? 0; return l + 1 < g.vals.length && g.cost[l + 1] <= me.cash; });
  const goal = me.team && me.teams
    ? (() => { const tot = Object.values(me.teams).reduce((a, b) => a + +b, 0) || 1, mine = +(me.teams[me.team] ?? 0); return { lbl: <><span style={{ color: TEAMS[me.team].col }}>{TEAMS[me.team].name}</span> {money(mine)}</>, pct: Math.round((mine / tot) * 100), col: TEAMS[me.team].col }; })()
    : { lbl: <>Answered {me.answered} · {me.correct} right</>, pct: me.players > 1 ? Math.round(((me.players - me.rank) / (me.players - 1)) * 100) : 100, col: "" };
  const shop = (
    <div className={`block-panel p-4 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:max-h-[72vh] max-md:overflow-auto max-md:rounded-b-none max-md:bg-ink max-md:transition-transform ${shopOpen ? "" : "max-md:translate-y-full"}`} data-testid="gr-shop">
      <h3 className="mb-2 font-display text-xl font-extrabold">🛒 Assay Office</h3>
      {GEAR.map((g) => {
        const l = me.lv[g.key] ?? 0, maxed = l + 1 >= g.vals.length, c = maxed ? 0 : g.cost[l + 1];
        return (
          <div key={g.key} className="mb-2 rounded-xl border border-line bg-[var(--panel)] p-3">
            <div className="flex items-center justify-between font-extrabold"><span>{g.icon} {g.name}</span>
              <span className="flex gap-1">{g.vals.map((_, i) => <i key={i} className={`block size-2 rounded-full ${i <= l ? "bg-gold" : "bg-[var(--line)]"}`} />)}</span></div>
            <div className="mt-1 text-sm text-muted">{g.desc(g.vals[l])}{!maxed && <><br />Next: {g.desc(g.vals[l + 1]).replace(/\.$/, "")}.</>}</div>
            {maxed ? <button className={`${btn} mt-2 w-full !py-2 !text-sm`} disabled>MAXED</button>
              : <button data-gear={g.key} className={`${btnGold} mt-2 w-full !py-2 !text-sm`} disabled={c > me.cash} onClick={() => buy(g.key)}>Buy for {money(c)}</button>}
          </div>
        );
      })}
      <button className={`${btn} mt-1 w-full md:hidden`} onClick={() => setShopOpen(false)}>Back to questions</button>
    </div>
  );
  return (
    <>{top}
      <div className="mx-auto max-w-5xl px-4 pb-16">
        <div className="block-panel mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4 max-sm:grid-cols-[1fr_auto]">
          <div className="relative font-display text-3xl font-extrabold text-gold sm:text-4xl" data-testid="gr-cash">
            {money(me.cash)}
            {pops.map((p) => <span key={p.id} className={`pointer-events-none absolute -top-2 left-full ml-2 animate-[grpop_1s_ease-out_forwards] whitespace-nowrap text-xl ${p.plus ? "text-emerald" : "text-crimson"}`}>{p.txt}</span>)}
          </div>
          <div className="max-sm:col-span-2 max-sm:row-start-2">
            <div className="mb-1 flex justify-between text-sm font-extrabold text-muted"><span>{goal.lbl}</span><span className="text-sky">#{me.rank} of {me.players}</span></div>
            <div className="h-3.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-gradient-to-r from-sky to-gold transition-[width] duration-500" style={{ width: `${goal.pct}%`, ...(goal.col ? { background: goal.col } : {}) }} /></div>
          </div>
          <div className={`text-right font-display text-3xl font-extrabold ${left != null && left <= 30 ? "text-crimson" : ""}`}>{left == null ? "-:--" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</div>
          <button className={`${btnGold} col-span-full md:hidden`} onClick={() => setShopOpen(true)}>🛒 Open the Assay Office{canBuy && <span className="ml-2 inline-block size-3 rounded-full bg-emerald ring-4 ring-emerald/30" />}</button>
        </div>
        <div className="mt-3 grid items-start gap-4 md:grid-cols-[1fr_300px]">
          <div className="block-panel p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-extrabold text-muted">
              <span>Question {me.answered + 1}</span>
              {shown?.ch ? <span className="rounded-full border border-sky/40 bg-sky/10 px-2.5 py-0.5 text-sky">Chapter {shown.ch}</span> : null}
              <span className="text-gold">{me.streak >= 2 ? `🔥 ${me.streak} in a row` : ""}</span>
            </div>
            <div className="mb-4 text-xl font-extrabold leading-snug" data-testid="gr-question">{shown?.prompt ?? "…"}</div>
            <div className="grid gap-2.5">
              {shown?.opts.map((o, i) => {
                const isRight = fb && o === fb.right, isPicked = fb && o === fb.picked;
                return (
                  <button key={o} data-answer={o} disabled={!!fb} onClick={() => answer(o)}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left font-bold transition ${isRight ? "border-emerald bg-emerald/20" : isPicked ? "border-crimson bg-crimson/15" : "border-line bg-[var(--panel)] enabled:hover:border-gold/60"}`}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gold/20 text-sm font-extrabold text-gold">{i + 1}</span>{o}
                  </button>
                );
              })}
            </div>
            {fb?.waiting && (
              <>
                <div className="mt-3 rounded-xl border-l-4 border-gold bg-gold/10 p-3 text-sm leading-relaxed"><b className="block">The answer: {fb.right}</b>{fb.why}</div>
                <div className="mt-3 text-right"><button className={btnGold} disabled={!nextReady} onClick={next} data-testid="gr-next">Got it ▶</button></div>
              </>
            )}
            {err && <p className="mt-2 text-center text-sm font-bold text-crimson">{err}</p>}
          </div>
          {shop}
        </div>
        {netErr && <p className="mt-2 text-center text-sm font-bold text-crimson">{netErr}</p>}
      </div>
      <style>{`@keyframes grpop{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-28px)}}`}</style>
    </>
  );
}

export function TeamRow({ teams, mine }: { teams: Record<string, number>; mine?: number | null }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {Object.keys(teams).sort((a, b) => teams[b] - teams[a]).map((k) => TEAMS[+k] && (
        <span key={k} className="rounded-full border px-3 py-1 text-sm font-extrabold" style={{ borderColor: TEAMS[+k].col, color: TEAMS[+k].col }}>
          {+k === mine ? "★ " : ""}{TEAMS[+k].name} {money(teams[k])}
        </span>
      ))}
    </div>
  );
}
