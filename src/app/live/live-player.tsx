"use client";

// ── wave-live ── Live class games, student phone screen (twin of Dopps Class live.html).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { dbReady, useStudent } from "@/lib/db";
import { liveAnswer, liveJoin, liveState, store, type LiveState } from "@/lib/live";
import { LETTERS, SHAPES, TEAMS, TILE, TeamPill, btn, btnGold, input, label } from "@/components/live/shared";

export const PKEY = "bedrock_live_player";
export type LivePlayer = { sid: string; pid: string; tok: string; code: string; game?: string; team?: number | null };

export function LivePlayerView() {
  const router = useRouter();
  const { student } = useStudent();
  const [code, setCode] = useState("");
  const [nick, setNick] = useState("");
  const [P, setP] = useState<LivePlayer | null>(null);
  const [st, setSt] = useState<LiveState | null>(null);
  const [err, setErr] = useState<React.ReactNode>("");
  const [gameErr, setGameErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const deadline = useRef(0);
  const sending = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("code")?.replace(/\D/g, "").slice(0, 6) ?? "";
    /* eslint-disable react-hooks/set-state-in-effect -- restore from the URL / this browser after hydration */
    if (q) setCode(q);
    setNick(store.get("bedrock_live_nick", ""));
    const saved = store.get<LivePlayer | null>(PKEY, null);
    if (saved?.sid && (!q || q === saved.code)) {
      if (saved.game === "coins") { router.replace("/gold-rush-live/"); return; }
      setP(saved);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [router]);

  const join = async (useLogin: boolean) => {
    setErr("");
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) return setErr("The code has 6 numbers.");
    if (!useLogin && !nick.trim()) return setErr("Type a nickname first.");
    setBusy(true);
    try {
      const r = await liveJoin(c, nick.trim() || "Player", useLogin);
      const p: LivePlayer = { sid: r.session_id, pid: r.player_id, tok: r.player_token, code: c, team: r.team, game: r.game_type };
      if (!useLogin) store.set("bedrock_live_nick", nick.trim());
      store.set(PKEY, p);
      if (r.game_type === "coins") { router.push("/gold-rush-live/"); return; }
      setP(p); setSt(null);
    } catch (e) {
      const m = (e as Error).message;
      setErr(/No game/.test(m) ? "No game with that code. Check the screen."
        : /needs your Bedrock login/.test(m) ? <>This game needs your Bedrock login. Log in (top right), then join again.</>
        : /Login expired/.test(m) ? "Your login expired. Log out and back in (top right)."
        : /full/.test(m) ? "This game is full." : m);
    } finally { setBusy(false); }
  };

  const leave = useCallback((msg?: string) => { store.set(PKEY, null); setP(null); setSt(null); setErr(msg ?? ""); }, []);

  const poll = useCallback(async () => {
    if (!P || sending.current) return;
    try {
      const s = await liveState(P.sid, P.pid, P.tok);
      setGameErr("");
      if (!s) return leave("That game is over.");
      if (!s.me) return leave("You were signed in on another device. Join again here.");
      if (s.game_type === "coins") { store.set(PKEY, { ...P, game: "coins" }); router.push("/gold-rush-live/"); return; }
      deadline.current = s.phase === "question" && s.seconds_left != null ? Date.now() + s.seconds_left * 1000 : 0;
      setSt(s);
      if (s.phase === "ended") store.set(PKEY, null);
    } catch { setGameErr("Connection trouble… retrying"); }
  }, [P, leave, router]);
  useEffect(() => {
    if (!P) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first poll now, then on a timer
    poll();
    const t = setInterval(() => { if (st?.phase !== "ended") poll(); }, 1000);
    return () => clearInterval(t);
  }, [P, poll, st?.phase]);
  useEffect(() => {
    const t = setInterval(() => setLeft(deadline.current ? Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)) : null), 250);
    return () => clearInterval(t);
  }, []);

  const vote = async (letter: string) => {
    if (!P || !st || st.phase !== "question" || sending.current) return;
    sending.current = true; setPending(letter);
    try {
      const ok = await liveAnswer(P.pid, P.tok, st.q_index, letter);
      if (!ok) setGameErr(st.game_type === "pick_a_side" ? "Voting is closed for that one." : "Time's up! That one already closed.");
      else setSt({ ...st, me: st.me ? { ...st.me, my_answer: letter } : st.me });
    } catch { setGameErr("Did not send. Tap again."); }
    finally { sending.current = false; setPending(null); poll(); }
  };

  if (!P) {
    return (
      <div className="mx-auto max-w-md px-4 pb-24 pt-28">
        <h1 className="text-center font-display text-4xl font-extrabold">⚔️ Live Game</h1>
        <p className="mt-2 text-center text-muted">Enter the code on the screen.</p>
        <div className="block-panel mt-6 space-y-3 p-6">
          {!dbReady && <p className="text-sm font-bold text-amber">Preview: the class database isn&apos;t connected yet.</p>}
          <div>
            <label className={label} htmlFor="code">Game code</label>
            <input id="code" className={`${input} text-center font-display text-3xl tracking-[0.3em]`} inputMode="numeric" maxLength={6} autoComplete="off" placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </div>
          {student && (
            <>
              <button className={`${btnGold} w-full`} disabled={busy} onClick={() => join(true)} data-testid="join-login">Join as {student.name}</button>
              <div className="text-center text-xs font-bold uppercase tracking-widest text-muted">or use a nickname</div>
            </>
          )}
          <div>
            <label className={label} htmlFor="nick">Nickname</label>
            <input id="nick" className={input} maxLength={20} autoComplete="off" placeholder="Pick a nickname" value={nick} onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join(false)} />
          </div>
          <button className={`${student ? btn : btnGold} w-full`} disabled={busy} onClick={() => join(false)} data-testid="join-nick">Join game</button>
          {err && <p className="text-sm font-bold text-crimson">{err}</p>}
        </div>
        <p className="mt-6 text-center text-sm text-muted"><Link href="/" className="font-bold text-gold">← Back to Bedrock</Link></p>
      </div>
    );
  }

  const s = st;
  const q = s?.question;
  const mine = pending ?? s?.me?.my_answer ?? null;
  const isPoll = s?.game_type === "pick_a_side";
  let screen: React.ReactNode = <p className="text-center text-muted">Connecting…</p>;
  if (s?.me) {
    if (s.phase === "lobby") {
      screen = (
        <Center emoji={s.game_type === "raid" ? "🐉" : "🪨"} big="You're in!">
          <TeamPill team={s.me.team} />
          <p className="mt-3 text-muted">{s.game_type === "raid" ? "Your team is raiding a boss. Every right answer is a hit!" : "Watch the screen. The question will pop up here."}</p>
        </Center>
      );
    } else if (s.phase === "question" && q) {
      screen = (
        <div>
          {q.revote && <div className="mb-2 text-center"><span className="rounded-full border border-line px-3 py-1 text-sm font-bold">🔁 Revote: did the discussion change your mind?</span></div>}
          {!isPoll && left != null && <div className={`text-center font-display text-5xl font-extrabold ${left <= 5 ? "text-crimson" : "text-gold"}`}>{left}</div>}
          <div className="my-4 text-center text-xl font-extrabold leading-snug" data-testid="phone-question">{q.prompt}</div>
          <div className="grid gap-3">
            {q.choices.map((c, i) => (
              <button key={i} data-letter={LETTERS[i]} disabled={!isPoll && !!mine} onClick={() => vote(LETTERS[i])}
                className={`flex min-h-[64px] items-center gap-3 rounded-2xl border-4 px-4 py-3 text-left text-lg font-extrabold text-white transition ${mine === LETTERS[i] ? "border-white" : mine ? "border-transparent opacity-40" : "border-transparent active:scale-[.98]"}`}
                style={{ background: isPoll ? (i ? TILE[1] : TILE[0]) : TILE[i] }}>
                {!isPoll && <span className="w-7 text-center text-xl">{SHAPES[i]}</span>}{c}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-sm text-muted">{mine ? (isPoll ? "✅ Vote in! You can change it until voting closes." : "✅ Answer locked in!") : "Tap your answer"}</p>
        </div>
      );
    } else if ((s.phase === "reveal" || s.phase === "leaderboard") && q) {
      const idx = mine ? LETTERS.indexOf(mine as (typeof LETTERS)[number]) : -1, pick = idx >= 0 ? q.choices[idx] : null;
      if (isPoll) {
        screen = (
          <Center emoji="🗳️" big="Voting closed">
            {pick ? <><p className="mt-2 text-muted">You picked</p><Pill>{pick}</Pill></> : <p className="mt-2 text-muted">You didn&apos;t vote this time.</p>}
            <p className="mt-4 text-muted">Look at the screen to see how the class voted.</p>
          </Center>
        );
      } else if (s.phase === "leaderboard") {
        screen = <Center emoji="🏆" big="Check the screen!"><p className="mt-2 text-muted">The leaderboard is up.</p><Pill>Your score: {s.me.score.toLocaleString()}</Pill></Center>;
      } else {
        const c = s.me.my_correct, ki = s.answer_key ? LETTERS.indexOf(s.answer_key as (typeof LETTERS)[number]) : -1, right = ki >= 0 ? q.choices[ki] : null;
        screen = (
          <Center emoji={c ? "🎉" : mine ? "💥" : "⏰"} big={c ? "Correct!" : mine ? "Not this time" : "Time's up"}>
            {!c && right && <><p className="mt-2 text-muted">The answer was</p><Pill>{right}</Pill></>}
            <div><Pill>Score: {s.me.score.toLocaleString()}</Pill></div>
            {s.game_type === "raid" && s.me.team && s.teams && (
              <p className="mt-3 text-muted">{c ? "⚔️ You hit the boss! " : ""}Your team: <b style={{ color: TEAMS[s.me.team].col }}>{s.teams[s.me.team] ?? 0} hits</b></p>
            )}
          </Center>
        );
      }
    } else if (s.phase === "ended") {
      screen = <Center emoji="🏁" big="Game over"><p className="mt-2 text-muted">Thanks for playing! Final score: {s.me.score.toLocaleString()}</p></Center>;
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col px-4 pb-16 pt-24">
      <div className="text-center text-sm text-muted">Playing as <b className="text-fg" data-testid="me-name">{s?.me?.nickname ?? "…"}</b>{s?.me?.team ? ` · ${TEAMS[s.me.team].name}` : ""}</div>
      <div className="block-panel mt-4 flex-1 p-5">{screen}</div>
      {gameErr && <p className="mt-2 text-center text-sm font-bold text-crimson">{gameErr}</p>}
      <button className={`${btn} mt-4`} onClick={() => leave()}>{s?.phase === "ended" ? "Join another game" : "Leave game"}</button>
    </div>
  );
}

function Center({ emoji, big, children }: { emoji: string; big: string; children?: React.ReactNode }) {
  return (
    <div className="py-6 text-center" data-testid="phone-screen">
      <div className="text-6xl">{emoji}</div>
      <div className="mt-2 font-display text-3xl font-extrabold">{big}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
const Pill = ({ children }: { children: React.ReactNode }) => <span className="mt-3 inline-block rounded-full border border-line bg-[var(--panel)] px-4 py-1.5 font-extrabold">{children}</span>;
