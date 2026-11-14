"use client";

// ── wave-live ── Live class games, teacher (projector) screen. Twin of Dopps Class live_host.html:
// Pick a Side Live (class vote, revote after discussion), Showdown (speed quiz with points), Realm Raid (teams vs. a boss).
// Gold Rush Live is set up here too and then runs on /gold-rush-live/host/.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dbReady } from "@/lib/db";
import {
  coinSetup, liveCreate, liveResults, liveSetHp, liveSetPhase, liveSetQuestion, liveState, store,
  type HostSession, type LiveGameType, type LiveResults, type LiveState,
} from "@/lib/live";
import { JoinBanner, LETTERS, SHAPES, TEAMS, TILE, Timer, btn, btnGold, btnRed, input, label, useTwoTap } from "@/components/live/shared";
import { bossFor, buildGoldRushBank, buildShowdown, debates, liveChapters, type Debate, type SdQuestion } from "../questions";

const HKEY = "bedrock_live_host";
export const GR_HKEY = "bedrock_gold_rush_host";

type Vote = { q: { id: string; q: string; a: string; b: string; ch?: number; light: string }; qi: number; revote: boolean };
type Sd = {
  questions: SdQuestion[]; seconds: number; from: number; to: number; idx: number;
  stage: "lobby" | "question" | "reveal" | "board" | "final"; tallies: Record<number, Record<string, number>>; qStart: number;
  raid?: boolean; teams?: number; boss?: { name: string; body: string; horn: string }; hp?: number;
  prevHits?: Record<string, number>; dmgMsg?: string; slainBy?: string; lastDmgIdx?: number;
};
type Saved = { S: HostSession; game: LiveGameType; sd: Sd | null; vote: Vote | null; rounds: Record<number, { A: number; B: number }>; used: string[] };

export function LiveHost() {
  const router = useRouter();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [st, setSt] = useState<LiveState | null>(null);
  const [res, setRes] = useState<LiveResults | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // setup form
  const [game, setGame] = useState<LiveGameType>("showdown");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [count, setCount] = useState(10);
  const [secs, setSecs] = useState(20);
  const [source, setSource] = useState<"review" | "vocab">("review");
  const [raidTeams, setRaidTeams] = useState(3);
  const [coinMins, setCoinMins] = useState(7);
  const [coinTeams, setCoinTeams] = useState(0);
  const [needLogin, setNeedLogin] = useState(true);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = store.get<Saved | null>(HKEY, null, true);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pick a running game back up after a refresh
    if (s?.S) setSaved(s);
    try { const t = sessionStorage.getItem("bedrock_teacher"); if (t) setPass(t); } catch {}
  }, []);
  const save = useCallback((s: Saved | null) => { setSaved(s); store.set(HKEY, s, true); }, []);

  const start = async () => {
    setErr(""); setMsg("");
    if (!pass) return setErr("Enter the teacher code or a sub code.");
    setBusy(true);
    try {
      let a = from, b = to; if (a > b) [a, b] = [b, a];
      if (game === "coins") {
        const qs = buildGoldRushBank(a, b);
        if (qs.length < 4) throw new Error("No questions found for those chapters.");
        const settings: Record<string, string> = { require_login: needLogin ? "true" : "false" };
        if (coinTeams) settings.teams = String(coinTeams);
        const S = await liveCreate(pass, "coins", settings);
        await coinSetup(S, qs);
        store.set(GR_HKEY, { S, secs: coinMins * 60, from: a, to: b, teams: coinTeams, n: qs.length }, true);
        router.push("/gold-rush-live/host/");
        return;
      }
      let sd: Sd | null = null;
      const settings: Record<string, string> = { require_login: needLogin ? "true" : "false" };
      if (game === "showdown" || game === "raid") {
        const questions = buildShowdown(a, b, count, source);
        if (!questions.length) throw new Error("No questions found for those chapters.");
        sd = { questions, seconds: secs, from: a, to: b, idx: -1, stage: "lobby", tallies: {}, qStart: 0 };
        if (game === "raid") { sd.raid = true; sd.teams = raidTeams; sd.boss = bossFor(a); settings.teams = String(raidTeams); }
      }
      const S = await liveCreate(pass, game, settings);
      save({ S, game, sd, vote: null, rounds: {}, used: [] });
    } catch (e) {
      const m = (e as Error).message;
      setErr(/passcode|sub code/i.test(m) ? "That teacher code or sub code isn't right. (Sub codes stop working after their last day.)" : "Could not start: " + m);
    } finally { setBusy(false); }
  };

  // polling
  const inFlight = useRef(false);
  const poll = useCallback(async () => {
    if (!saved || inFlight.current) return;
    inFlight.current = true;
    try {
      const [s, r] = await Promise.all([liveState(saved.S.session_id), liveResults(saved.S)]);
      if (!s || !r || s.phase === "ended") { save(null); setMsg("Game over. Start a new one whenever you're ready."); return; }
      setSt(s); setRes(r); setErr("");
    } catch (e) { setErr("Connection problem, retrying… (" + (e as Error).message + ")"); }
    finally { inFlight.current = false; }
  }, [saved, save]);
  useEffect(() => {
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first poll now, then on a timer
    poll();
    const t = setInterval(poll, 1000);
    return () => clearInterval(t);
  }, [saved?.S.session_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); poll(); }
  };
  const two = useTwoTap();
  const end = () => {
    if (!saved || !two.tap()) return;
    act(async () => { await liveSetPhase(saved.S, "ended"); save(null); setMsg("Game ended."); });
  };

  if (!saved) {
    const isSd = game === "showdown" || game === "raid";
    return (
      <div className="mx-auto max-w-xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">⚔️ Live Class Games</h1>
        <p className="mt-2 text-muted">Teacher screen. Put this on the projector. Students join on their phones at <b className="text-fg">/live/</b>.</p>
        <div className="block-panel mt-6 space-y-4 p-6">
          {!dbReady && <p className="text-sm font-bold text-amber">Preview: the class database isn&apos;t connected yet.</p>}
          <div>
            <label className={label} htmlFor="game">Game</label>
            <select id="game" className={input} value={game} onChange={(e) => setGame(e.target.value as LiveGameType)}>
              <option value="pick_a_side">🗳️ Pick a Side Live: class vote</option>
              <option value="showdown">⚡ Showdown: speed quiz with scores</option>
              <option value="raid">🐉 Realm Raid: teams vs. a boss</option>
              <option value="coins">⛏️ Gold Rush Live: answer for gold, buy mining gear</option>
            </select>
          </div>
          {game !== "pick_a_side" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label} htmlFor="from">From chapter</label>
                <select id="from" className={input} value={from} onChange={(e) => setFrom(+e.target.value)}>{liveChapters.map((c) => <option key={c.n} value={c.n}>{c.n}: {c.title}</option>)}</select></div>
              <div><label className={label} htmlFor="to">To chapter</label>
                <select id="to" className={input} value={to} onChange={(e) => setTo(+e.target.value)}>{liveChapters.map((c) => <option key={c.n} value={c.n}>{c.n}: {c.title}</option>)}</select></div>
              {isSd && <>
                <div><label className={label} htmlFor="count">Questions</label>
                  <select id="count" className={input} value={count} onChange={(e) => setCount(+e.target.value)}>{[5, 10, 15, 20].map((n) => <option key={n}>{n}</option>)}</select></div>
                <div><label className={label} htmlFor="secs">Seconds each</label>
                  <select id="secs" className={input} value={secs} onChange={(e) => setSecs(+e.target.value)}>{[10, 20, 30].map((n) => <option key={n}>{n}</option>)}</select></div>
                <div className="col-span-2"><label className={label} htmlFor="source">Questions from</label>
                  <select id="source" className={input} value={source} onChange={(e) => setSource(e.target.value as "review" | "vocab")}>
                    <option value="review">Review questions (the chapter review bank)</option>
                    <option value="vocab">Key words (read the definition, pick the word)</option>
                  </select></div>
              </>}
              {game === "raid" && <div><label className={label} htmlFor="rteams">Teams</label>
                <select id="rteams" className={input} value={raidTeams} onChange={(e) => setRaidTeams(+e.target.value)}>{[2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></div>}
              {game === "coins" && <>
                <div><label className={label} htmlFor="mins">Minutes</label>
                  <select id="mins" className={input} value={coinMins} onChange={(e) => setCoinMins(+e.target.value)}>{[5, 7, 10, 15].map((n) => <option key={n}>{n}</option>)}</select></div>
                <div><label className={label} htmlFor="cteams">Teams</label>
                  <select id="cteams" className={input} value={coinTeams} onChange={(e) => setCoinTeams(+e.target.value)}>
                    <option value={0}>Everyone for themselves</option>{[2, 3, 4].map((n) => <option key={n} value={n}>{n} teams</option>)}</select></div>
              </>}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm font-bold text-muted">
            <input type="checkbox" checked={needLogin} onChange={(e) => setNeedLogin(e.target.checked)} className="size-5 accent-[var(--color-gold)]" />
            Students must use their Bedrock login (scores show real names)
          </label>
          <div>
            <label className={label} htmlFor="pass">Teacher code or sub code</label>
            <input id="pass" type="password" className={input} value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && start()} placeholder="The Dopps Class teacher code, or a sub code" autoComplete="off" />
          </div>
          <button className={btnGold} disabled={busy || !dbReady} onClick={start}>Start game</button>
          {(err || msg) && <p className={`text-sm font-bold ${err ? "text-crimson" : "text-emerald"}`}>{err || msg}</p>}
        </div>
      </div>
    );
  }

  const S = saved.S;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-24 sm:px-6">
      <JoinBanner path="/live/" code={S.join_code}>
        <div className="text-right">
          <div className="text-xl font-extrabold"><b className="font-display text-3xl text-emerald" data-testid="player-count">{st?.player_count ?? 0}</b> joined</div>
          {st?.phase === "question" && <div className="text-xl font-extrabold"><b className="font-display text-3xl text-emerald">{st.answer_count}</b> {saved.game === "pick_a_side" ? "voted" : "answered"}</div>}
          {S.role === "sub" && <div className="mt-1 text-xs font-bold text-muted">Started with a sub code</div>}
        </div>
      </JoinBanner>
      {saved.game === "pick_a_side"
        ? <VoteHost saved={saved} save={save} st={st} res={res} act={act} busy={busy} end={end} endArmed={two.armed} />
        : <ShowdownHost saved={saved} save={save} st={st} res={res} setRes={setRes} act={act} busy={busy} end={end} endArmed={two.armed} />}
      {err && <p className="mt-3 font-bold text-crimson">{err}</p>}
    </div>
  );
}

type HostProps = {
  saved: Saved; save: (s: Saved) => void; st: LiveState | null; res: LiveResults | null;
  act: (fn: () => Promise<void>) => Promise<void>; busy: boolean; end: () => void; endArmed: boolean;
};
const EndBtn = ({ end, armed }: { end: () => void; armed: boolean }) => <button className={btnRed} onClick={end}>{armed ? "Tap again to end" : "End game"}</button>;

// ───────────────────────── Pick a Side Live ─────────────────────────
const LIGHT: Record<string, string> = { Green: "bg-emerald text-[#04261a]", Yellow: "bg-gold text-[#2a1d00]", Red: "bg-crimson text-white", custom: "bg-sky text-[#04202f]" };

function VoteHost({ saved, save, st, res, act, busy, end, endArmed }: HostProps) {
  const [set, setSet] = useState<string>("1");
  const [sel, setSel] = useState<Debate | null>(null);
  const [cq, setCq] = useState({ q: "", a: "", b: "" });
  const [hide, setHide] = useState(true);
  const phase = st?.phase ?? "lobby";
  const vote = saved.vote;
  const onStage = !!vote && (phase === "question" || phase === "reveal");
  const list = set === "custom" ? [] : debates.filter((d) => d.chapter === +set);
  const tally = { A: res?.tally.A ?? 0, B: res?.tally.B ?? 0 };

  const startVote = (q: Vote["q"], revote: boolean) => act(async () => {
    const qi = Math.max(st?.q_index ?? -1, vote?.qi ?? -1) + 1;
    const ok = await liveSetQuestion(saved.S, qi, { prompt: q.q, choices: [q.a, q.b], light: q.light, revote, chapter: q.ch }, null, null);
    if (!ok) throw new Error("The server did not accept that. The game may have ended.");
    save({ ...saved, vote: { q, qi, revote }, used: [...new Set([...saved.used, q.id])] });
  });
  const picked = (): Vote["q"] | null => {
    if (set === "custom") return cq.q.trim() && cq.a.trim() && cq.b.trim() ? { id: "custom-" + cq.q.trim().slice(0, 40), q: cq.q.trim(), a: cq.a.trim(), b: cq.b.trim(), light: "custom" } : null;
    return sel ? { id: sel.id, q: sel.question, a: sel.sideA, b: sel.sideB, ch: sel.chapter, light: sel.rating } : null;
  };

  if (!onStage) {
    return (
      <div className="block-panel mt-5 p-5">
        <h2 className="font-display text-2xl font-extrabold text-gold">Choose a question</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
          <div>
            <label className={label} htmlFor="set">Question set</label>
            <select id="set" className={input} value={set} onChange={(e) => { setSet(e.target.value); setSel(null); }}>
              <option value="custom">✏️ Your own question</option>
              {liveChapters.map((c) => <option key={c.n} value={c.n}>Chapter {c.n}: {c.title}</option>)}
            </select>
            {set === "custom" && (
              <div className="mt-3 space-y-2">
                <input className={input} placeholder="Your question" maxLength={160} value={cq.q} onChange={(e) => setCq({ ...cq, q: e.target.value })} />
                <input className={input} placeholder="Side A" maxLength={60} value={cq.a} onChange={(e) => setCq({ ...cq, a: e.target.value })} />
                <input className={input} placeholder="Side B" maxLength={60} value={cq.b} onChange={(e) => setCq({ ...cq, b: e.target.value })} />
              </div>
            )}
            <p className="mt-3 text-sm text-muted">Talking points and evidence: <a className="font-bold text-gold underline" href="/pick-a-side/" target="_blank" rel="noopener">open Pick a Side</a> in another tab.</p>
          </div>
          <div className="flex max-h-[420px] flex-col gap-2 overflow-auto pr-1">
            {set === "custom" ? <p className="text-sm text-muted">Type a question and two sides, then press Start vote.</p>
              : list.map((d) => (
                <button key={d.id} onClick={() => setSel(d)} className={`rounded-xl border p-3 text-left font-bold transition ${sel?.id === d.id ? "border-gold ring-2 ring-gold/40" : "border-line bg-[var(--panel)] hover:border-gold/50"}`}>
                  <span className={`mr-2 inline-block rounded-full px-2 py-0.5 align-[2px] text-[11px] font-extrabold ${LIGHT[d.rating]}`}>{d.rating.toUpperCase()}</span>
                  {d.question}{saved.used.includes(d.id) && <span className="ml-2 text-xs text-muted">✓ used</span>}
                </button>
              ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className={btnGold} disabled={busy || !picked()} onClick={() => { const q = picked(); if (q) startVote(q, false); }}>Start vote ▶</button>
          <label className="flex items-center gap-2 text-sm font-bold text-muted"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-5" /> Hide results until voting closes</label>
          <span className="flex-1" />
          <EndBtn end={end} armed={endArmed} />
        </div>
      </div>
    );
  }

  const q = vote!.q;
  const fin = saved.rounds[vote!.qi] ?? tally;
  const before = vote!.revote ? saved.rounds[vote!.qi - 1] : undefined;
  const pctA = (t: { A: number; B: number }) => (t.A + t.B ? Math.round((100 * t.A) / (t.A + t.B)) : null);
  return (
    <div className="block-panel mt-5 p-5">
      <div className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted">{vote!.revote ? "🔁 Revote · " : ""}{q.light === "custom" ? "Class question" : `Chapter ${q.ch} · ${liveChapters.find((c) => c.n === q.ch)?.title ?? ""}`}</div>
      <div className="mt-2 mb-6 font-display text-3xl font-extrabold leading-tight sm:text-5xl">{q.q}</div>
      {phase === "question"
        ? hide ? <div className="rounded-2xl border border-dashed border-line p-6 text-center text-xl font-extrabold text-muted">🤫 Results hidden until voting closes · {tally.A + tally.B} of {st?.player_count ?? 0} voted</div>
          : <Bars q={q} t={tally} />
        : before ? (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <div><h3 className="mb-2 font-display text-lg font-bold text-muted">Before discussion</h3><Bars q={q} t={before} /></div>
              <div><h3 className="mb-2 font-display text-lg font-bold text-muted">After discussion</h3><Bars q={q} t={fin} /></div>
            </div>
            <div className="mt-4 text-center text-2xl font-extrabold text-gold">
              {(() => { const b = pctA(before), a = pctA(fin); if (b == null || a == null) return ""; const d = a - b;
                return d === 0 ? "No change overall." : `“${q.a}” went from ${b}% to ${a}% ${d > 0 ? "⬆" : "⬇"}`; })()}
            </div>
          </>
        ) : <Bars q={q} t={fin} />}
      <div className="mt-6 flex flex-wrap gap-3">
        {phase === "question" && <button className={btnGold} disabled={busy} onClick={() => act(async () => {
          const r = await liveResults(saved.S);
          const t = { A: r?.tally.A ?? 0, B: r?.tally.B ?? 0 };
          if (!(await liveSetPhase(saved.S, "reveal"))) throw new Error("Could not close voting.");
          save({ ...saved, rounds: { ...saved.rounds, [vote!.qi]: t } });
        })}>Close voting</button>}
        {phase === "reveal" && !vote!.revote && <button className={btn} disabled={busy} onClick={() => startVote(q, true)}>Revote after discussion 🔁</button>}
        {phase === "reveal" && <button className={btnGold} disabled={busy} onClick={() => act(async () => { await liveSetPhase(saved.S, "lobby"); save({ ...saved, vote: null }); })}>Next question</button>}
        <span className="flex-1" />
        <EndBtn end={end} armed={endArmed} />
      </div>
    </div>
  );
}

function Bars({ q, t }: { q: { a: string; b: string }; t: { A: number; B: number } }) {
  const n = t.A + t.B, pa = n ? Math.round((100 * t.A) / n) : 0, pb = n ? 100 - pa : 0;
  return (
    <div className="flex flex-col gap-4" data-testid="vote-bars">
      {[[q.a, pa, t.A, "#1d7fb0"], [q.b, pb, t.B, "#c2334a"]].map(([lab, p, c, col], i) => (
        <div key={i} className="relative min-h-[76px] overflow-hidden rounded-2xl border border-line bg-[var(--panel)]">
          <div className="absolute inset-y-0 left-0 transition-[width] duration-700" style={{ width: `${p}%`, background: col as string, opacity: 0.85 }} />
          <div className="relative flex items-center justify-between gap-3 px-5 py-4 font-display text-xl font-extrabold sm:text-3xl">
            <span>{lab}</span><span className="whitespace-nowrap">{p}% · {c}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Showdown + Realm Raid ─────────────────────────
function ShowdownHost({ saved, save, st, res, setRes, act, busy, end, endArmed }: HostProps & { setRes: (r: LiveResults) => void }) {
  const sd = saved.sd!;
  const players = res?.players ?? [];
  const [now, setNow] = useState(() => Date.now());
  const closing = useRef(false);
  const left = sd.stage === "question" ? Math.max(0, Math.ceil(sd.seconds - (now - sd.qStart) / 1000)) : 0;
  const upd = (patch: Partial<Sd>) => save({ ...saved, sd: { ...sd, ...patch } });

  const hits = useMemo(() => {
    const o: Record<string, number> = {};
    for (let i = 1; i <= (sd.teams ?? 0); i++) o[i] = +(res?.teams[i] ?? 0);
    return o;
  }, [res, sd.teams]);
  const totalHits = Object.values(hits).reduce((a, b) => a + b, 0);

  const ask = () => act(async () => {
    const idx = sd.idx + 1, q = sd.questions[idx];
    const patch: Partial<Sd> = {};
    if (sd.raid) {
      if (idx === 0) {
        const n = Math.max(1, st?.player_count ?? 1);
        patch.hp = Math.max(5, Math.round(0.7 * n * sd.questions.length));
        await liveSetHp(saved.S, patch.hp);
      }
      patch.prevHits = hits;
    }
    const ok = await liveSetQuestion(saved.S, idx, { prompt: q.prompt, choices: q.opts, chapter: q.ch }, q.key, sd.seconds);
    if (!ok) throw new Error("The server did not accept that. The game may have ended.");
    save({ ...saved, sd: { ...sd, ...patch, idx, stage: "question", qStart: Date.now() } });
  });

  const closeQ = useCallback(async () => {
    if (closing.current || sd.stage !== "question") return;
    closing.current = true;
    await act(async () => {
      const r = await liveResults(saved.S);
      if (r) setRes(r);
      await liveSetPhase(saved.S, "reveal");
      const patch: Partial<Sd> = { stage: "reveal", tallies: { ...sd.tallies, [sd.idx]: r?.tally ?? {} } };
      if (sd.raid && r) {
        const h: Record<string, number> = {};
        for (let i = 1; i <= (sd.teams ?? 0); i++) h[i] = +(r.teams[i] ?? 0);
        const round: Record<string, number> = {};
        Object.keys(h).forEach((k) => (round[k] = h[k] - (sd.prevHits?.[k] ?? 0)));
        const dealt = Object.values(round).reduce((a, b) => a + b, 0), total = Object.values(h).reduce((a, b) => a + b, 0);
        patch.dmgMsg = dealt ? `⚔️ ${dealt} hit${dealt === 1 ? "" : "s"} this round!` : "🛡️ The boss blocked every attack!";
        if (total >= (sd.hp ?? 1) && !sd.slainBy) {
          const best = Object.keys(round).sort((a, b) => round[b] - round[a])[0];
          patch.slainBy = best; patch.dmgMsg = `💥 FINAL BLOW by the ${TEAMS[+best].name}!`;
        }
        patch.lastDmgIdx = sd.idx;
      }
      save({ ...saved, sd: { ...sd, ...patch } });
    });
    closing.current = false;
  }, [act, saved, save, sd, setRes]);

  // the question clock: closes on time, or as soon as everyone has answered
  useEffect(() => {
    if (sd.stage !== "question") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [sd.stage]);
  useEffect(() => {
    if (sd.stage !== "question") return;
    const allIn = st?.phase === "question" && st.q_index === sd.idx && st.player_count > 0 && st.answer_count >= st.player_count;
    if (left <= 0 || allIn) closeQ();
  }, [left, st, sd.stage, sd.idx, closeQ]);

  const q = sd.idx >= 0 ? sd.questions[sd.idx] : null;
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const raidTop = sd.raid && (
    <div className="mb-5 grid items-center gap-5 md:grid-cols-[minmax(220px,320px)_1fr]">
      <div className="text-center">
        <div className={sd.stage === "reveal" && sd.lastDmgIdx === sd.idx && sd.dmgMsg?.startsWith("⚔") ? "animate-[shake_.6s_ease]" : ""}>
          <BossSvg boss={sd.boss!} frac={sd.stage === "lobby" ? 1 : Math.max(0, (sd.hp ?? 1) - totalHits) / (sd.hp ?? 1)} />
        </div>
        <div className="font-display text-2xl font-extrabold text-crimson">{sd.boss!.name}</div>
        <div className="relative mt-2 h-6 overflow-hidden rounded-full border-2 border-crimson/50 bg-[var(--panel)]">
          <div className="h-full bg-gradient-to-r from-[#b0213c] to-crimson transition-[width] duration-700" style={{ width: `${sd.stage === "lobby" ? 100 : (100 * Math.max(0, (sd.hp ?? 1) - totalHits)) / (sd.hp ?? 1)}%` }} />
          <span className="absolute inset-0 grid place-items-center text-sm font-extrabold">{sd.stage === "lobby" ? "Full HP" : `${Math.max(0, (sd.hp ?? 1) - totalHits)} / ${sd.hp} HP`}</span>
        </div>
      </div>
      <div>
        <div className="flex flex-col gap-2.5">
          {Object.keys(hits).map((k) => {
            const max = Math.max(1, ...Object.values(hits));
            return (
              <div key={k} className="grid grid-cols-[minmax(0,190px)_1fr_60px] items-center gap-3 text-lg font-extrabold">
                <span style={{ color: TEAMS[+k].col }}>{TEAMS[+k].icon} {TEAMS[+k].name}</span>
                <div className="h-5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(100 * hits[k]) / max}%`, background: TEAMS[+k].col }} /></div>
                <span className="text-right font-display">{hits[k]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 min-h-[1.5em] text-center font-display text-2xl font-extrabold text-gold">{["reveal", "board", "final"].includes(sd.stage) ? sd.dmgMsg : ""}</div>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:none}20%{transform:translate(-8px,2px)}40%{transform:translate(7px,-3px)}60%{transform:translate(-5px,3px)}80%{transform:translate(4px,-1px)}}`}</style>
    </div>
  );

  if (sd.stage === "lobby") {
    const groups: Record<number, typeof players> = {};
    for (let i = 1; i <= (sd.teams ?? 0); i++) groups[i] = players.filter((p) => p.team === i);
    return (
      <div className="block-panel mt-5 p-5">
        {raidTop}
        <h2 className="font-display text-2xl font-extrabold text-gold">{sd.raid ? "🐉 Realm Raid" : "⚡ Showdown"}</h2>
        <p className="text-sm text-muted">Chapters {sd.from}{sd.to !== sd.from ? `–${sd.to}` : ""} · {sd.questions.length} questions · {sd.seconds} seconds each{sd.raid ? ` · ${sd.teams} teams vs. ${sd.boss!.name}` : ""}</p>
        {sd.raid ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.keys(groups).map((k) => (
              <div key={k} className="rounded-2xl border border-line bg-[var(--panel)] p-3">
                <h3 className="font-display font-extrabold" style={{ color: TEAMS[+k].col }}>{TEAMS[+k].icon} {TEAMS[+k].name} ({groups[+k].length})</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">{groups[+k].map((p) => <span key={p.id} className="rounded-full border border-line px-2.5 py-0.5 text-sm font-bold">{p.nickname}</span>)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex min-h-10 flex-wrap gap-2" data-testid="lobby-players">
            {players.length ? players.map((p) => <span key={p.id} className="rounded-full border border-line bg-[var(--panel)] px-3 py-1 font-extrabold">{p.nickname}</span>) : <span className="text-sm text-muted">Waiting for players to join…</span>}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={btnGold} disabled={busy || !players.length} onClick={ask}>Start the {sd.raid ? "Raid" : "Showdown"} ▶</button>
          <span className="flex-1" /><EndBtn end={end} armed={endArmed} />
        </div>
      </div>
    );
  }

  if ((sd.stage === "question" || sd.stage === "reveal") && q) {
    const reveal = sd.stage === "reveal", counts = sd.tallies[sd.idx] ?? {};
    return (
      <div className="block-panel mt-5 p-5">
        {raidTop}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted">Question {sd.idx + 1} of {sd.questions.length} · Chapter {q.ch}</div>
          {!reveal && <Timer left={left} />}
        </div>
        <div className="mt-2 mb-5 font-display text-2xl font-extrabold leading-tight sm:text-4xl" data-testid="host-question">{q.prompt}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {q.opts.map((o, i) => (
            <div key={i} className={`flex min-h-[80px] items-center gap-3 rounded-2xl border-4 px-5 py-4 text-xl font-extrabold text-white transition sm:text-2xl ${reveal ? (LETTERS[i] === q.key ? "border-white shadow-[0_0_30px_rgba(255,255,255,.45)]" : "border-transparent opacity-35") : "border-transparent"}`} style={{ background: TILE[i] }}>
              <span className="w-8 text-center text-2xl">{SHAPES[i]}</span><span>{o}</span>
              {reveal && <span className="ml-auto font-display text-2xl">{counts[LETTERS[i]] ?? 0}</span>}
            </div>
          ))}
        </div>
        {reveal && <div className="mt-4 text-center text-xl font-extrabold text-emerald">✅ {q.answer}{q.why ? <span className="mt-1 block text-base font-semibold text-muted">{q.why}</span> : null}</div>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!reveal && <button className={btnGold} disabled={busy} onClick={closeQ}>Close now</button>}
          {!reveal && <span className="text-sm font-bold text-muted">{st?.answer_count ?? 0} of {st?.player_count ?? 0} answered</span>}
          {reveal && <button className={btnGold} disabled={busy} onClick={() => act(async () => { await liveSetPhase(saved.S, "leaderboard"); upd({ stage: sd.idx + 1 >= sd.questions.length ? "final" : "board" }); })}>Leaderboard ▶</button>}
          <span className="flex-1" /><EndBtn end={end} armed={endArmed} />
        </div>
      </div>
    );
  }

  const final = sd.stage === "final";
  const mvp = ranked[0];
  const order = Object.keys(hits).sort((a, b) => hits[b] - hits[a]);
  const slain = totalHits >= (sd.hp ?? Infinity);
  return (
    <div className="block-panel mt-5 p-5">
      {raidTop}
      <h2 className="font-display text-3xl font-extrabold text-gold">{sd.raid ? (final ? "🐉 Raid Results" : "⚔️ Team Standings") : final ? "🏆 Final Results" : "🏆 Leaderboard"}</h2>
      {sd.raid ? (
        <>
          {final && (slain
            ? <div className="my-3 text-center font-display text-4xl font-extrabold text-emerald">🏆 {sd.boss!.name} is defeated!{sd.slainBy && <p className="mt-1 text-xl">Final blow: <span style={{ color: TEAMS[+sd.slainBy].col }}>{TEAMS[+sd.slainBy].name}</span></p>}</div>
            : <div className="my-3 text-center font-display text-4xl font-extrabold text-crimson">💨 {sd.boss!.name} escapes!<p className="mt-1 text-lg font-semibold text-muted">{(sd.hp ?? 0) - totalHits} HP left. Study up and raid again!</p></div>)}
          <div className="mt-3 flex flex-col gap-2">
            {order.map((k, i) => <Row key={k} rank={i + 1} name={<span style={{ color: TEAMS[+k].col }}>{TEAMS[+k].icon} {TEAMS[+k].name}</span>} pts={`${hits[k]} hits`} />)}
          </div>
          {final && mvp && <p className="mt-3 text-center text-xl font-extrabold">⭐ MVP: {mvp.nickname} · {mvp.score.toLocaleString()} pts</p>}
        </>
      ) : (
        <>
          {final && (
            <div className="mt-5 flex items-end justify-center gap-3" data-testid="podium">
              {[[ranked[1], 2, 120, "#c9d1e0"], [ranked[0], 1, 170, "#f6c453"], [ranked[2], 3, 90, "#d9935b"]].map(([p, n, h, c]) => {
                const pl = p as (typeof ranked)[number] | undefined;
                return (
                  <div key={n as number} className="max-w-[240px] flex-1 text-center">
                    {pl && <>
                      <div className="mb-2 break-words text-lg font-extrabold sm:text-2xl">{pl.nickname}</div>
                      <div className="rounded-t-2xl pt-3 font-display text-4xl font-extrabold text-[#1a1030]" style={{ height: h as number, background: c as string }}>{n as number}</div>
                      <div className="mt-1 font-display text-lg text-gold">{pl.score.toLocaleString()}</div>
                    </>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {ranked.slice(final ? 3 : 0, final ? 10 : 5).map((p, i) => <Row key={p.id} rank={i + 1 + (final ? 3 : 0)} name={p.nickname} pts={p.score.toLocaleString()} />)}
            {!final && !ranked.length && <p className="text-sm text-muted">No points yet.</p>}
          </div>
        </>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {!final && <button className={btnGold} disabled={busy} onClick={() => (sd.idx + 1 >= sd.questions.length ? upd({ stage: "final" }) : ask())}>{sd.idx + 1 >= sd.questions.length ? "Final results 🏆" : "Next question ▶"}</button>}
        <span className="flex-1" /><EndBtn end={end} armed={endArmed} />
      </div>
    </div>
  );
}

function Row({ rank, name, pts }: { rank: number; name: React.ReactNode; pts: string }) {
  const rc = rank === 1 ? "text-gold" : rank === 2 ? "text-[#b8c0cf]" : rank === 3 ? "text-[#d9935b]" : "text-muted";
  return (
    <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-2xl border border-line bg-[var(--panel)] px-4 py-3 text-xl font-extrabold sm:text-2xl">
      <span className={`text-center font-display ${rc}`}>{rank}</span><span className="min-w-0 truncate">{name}</span><span className="font-display text-gold">{pts}</span>
    </div>
  );
}

function BossSvg({ boss, frac }: { boss: { name: string; body: string; horn: string }; frac: number }) {
  const dead = frac <= 0;
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={boss.name} className="mx-auto block h-auto w-full max-w-[260px]">
      <ellipse cx="100" cy="186" rx="64" ry="9" fill="rgba(0,0,0,.3)" />
      <g opacity={dead ? 0.45 : 1}>
        <path d="M48 60 L38 18 L72 50 Z" fill={boss.horn} stroke="#1a1030" strokeWidth="4" strokeLinejoin="round" />
        <path d="M152 60 L162 18 L128 50 Z" fill={boss.horn} stroke="#1a1030" strokeWidth="4" strokeLinejoin="round" />
        <path d="M30 120 q-22 -10 -18 -40 q14 16 30 18" fill={boss.horn} stroke="#1a1030" strokeWidth="4" />
        <path d="M170 120 q22 -10 18 -40 q-14 16 -30 18" fill={boss.horn} stroke="#1a1030" strokeWidth="4" />
        <ellipse cx="100" cy="112" rx="70" ry="66" fill={boss.body} stroke="#1a1030" strokeWidth="5" />
        {/* rocky plates */}
        <path d="M58 70 l14 -6 l10 8 M120 64 l14 4 l6 12 M70 150 l12 -4 M124 152 l10 4" stroke="#1a1030" strokeOpacity=".35" strokeWidth="3" fill="none" />
        <ellipse cx="100" cy="138" rx="42" ry="30" fill="rgba(255,255,255,.22)" />
        {dead
          ? <path d="M70 92 l18 16 M88 92 l-18 16 M112 92 l18 16 M130 92 l-18 16" stroke="#1a1030" strokeWidth="6" strokeLinecap="round" />
          : <>
            <path d="M66 88 l26 10" stroke="#1a1030" strokeWidth="6" strokeLinecap="round" /><path d="M134 88 l-26 10" stroke="#1a1030" strokeWidth="6" strokeLinecap="round" />
            <circle cx="80" cy="106" r="10" fill="#fff" stroke="#1a1030" strokeWidth="4" /><circle cx="82" cy="108" r="4" fill="#d00" />
            <circle cx="120" cy="106" r="10" fill="#fff" stroke="#1a1030" strokeWidth="4" /><circle cx="118" cy="108" r="4" fill="#d00" />
          </>}
        {frac < 0.5 && !dead && <><path d="M54 70 l12 14 l-6 4 l10 12" stroke="#1a1030" strokeWidth="3" fill="none" /><path d="M146 130 l-10 8 l6 4 l-12 8" stroke="#1a1030" strokeWidth="3" fill="none" /></>}
        <path d={`M70 140 q30 ${dead ? -10 : 22} 60 0`} fill="#3a0d1c" stroke="#1a1030" strokeWidth="4" />
        {!dead && <path d="M78 142 l6 10 l6 -9 M96 145 l5 10 l5 -10 M112 143 l6 9 l5 -10" fill="#fff" stroke="#1a1030" strokeWidth="2" />}
        <ellipse cx="62" cy="182" rx="20" ry="9" fill={boss.horn} stroke="#1a1030" strokeWidth="4" />
        <ellipse cx="138" cy="182" rx="20" ry="9" fill={boss.horn} stroke="#1a1030" strokeWidth="4" />
      </g>
    </svg>
  );
}
