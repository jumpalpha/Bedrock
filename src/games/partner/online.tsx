"use client";

// ── wave-live ── Partner games on two devices (twin of Dopps Class partner.html). One player makes a game and gets a
// 4-letter code; the partner types it in. Every move is checked and every winner decided by the database
// (supabase/migrations/006_live.sql); each tab polls the game about once a second.
import { useCallback, useEffect, useRef, useState } from "react";
import { useStudent } from "@/lib/db";
import { duelCreate, duelJoin, duelLeave, duelMove, duelRematch, duelSetup, duelState, randomToken, store, type DuelGame, type DuelView } from "@/lib/live";
import { btn, btnGold, input, label } from "@/components/live/shared";
import { C4Board, DotsBoard, MemoryBoard, ScoreChip, SurveyGrid, TttBoard, type Plot } from "./boards";
import { BOXES_OF, foundCount } from "./logic";
import { partnerByGame, partnerGames } from "./meta";
import { FOSSILS } from "@/games/wave-b/fossil-art";

const TOK = "bedrock_duel_tok", GID = "bedrock_duel_id";
function token() {
  let t = store.get<string | null>(TOK, null, true);
  if (!t) { t = randomToken(); store.set(TOK, t, true); }
  return t;
}

export function OnlineDuel({ fixed, onBack }: { fixed?: DuelGame; onBack?: () => void }) {
  const { student } = useStudent();
  const [game, setGame] = useState<DuelGame>(fixed ?? "connect4");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [S, setS] = useState<DuelView | null>(null);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [peek, setPeek] = useState<Record<string, string> | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moving = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore this browser's name, and a game in progress after a refresh
    setName(store.get("bedrock_duel_name", ""));
    const q = new URLSearchParams(location.search).get("code");
    if (q) setCode(q.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4));
    const saved = store.get<string | null>(GID, null, true);
    if (saved) duelState(saved, token()).then((n) => { if (n && n.status !== "done") setS(n); else store.set(GID, null, true); }).catch(() => store.set(GID, null, true));
  }, []);

  const enter = (v: DuelView) => { store.set(GID, v.id, true); setS(v); };
  const toLobby = useCallback(() => { store.set(GID, null, true); setS(null); setStatus(""); setConfirmLeave(false); }, []);

  const create = async () => {
    if (!student && !name.trim()) return setErr("Type your name first.");
    store.set("bedrock_duel_name", name.trim()); setErr(""); setBusy(true);
    try { enter(await duelCreate(game, token(), name.trim())); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const join = async () => {
    const c = code.trim();
    if (c.length !== 4) return setErr("Codes are 4 letters/numbers.");
    if (!student && !name.trim()) return setErr("Type your name first.");
    store.set("bedrock_duel_name", name.trim()); setErr(""); setBusy(true);
    try { enter(await duelJoin(c, token(), name.trim())); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  // remember a missed Fossil Memory pair for its full moment
  const take = useCallback((n: DuelView) => {
    if (n.game === "memory" && n.peek && n.peek_ms > 0) {
      const f: Record<string, string> = {};
      n.peek.split(",").forEach((k) => { if (n.faces[k]) f[k] = n.faces[k]; });
      setPeek(f);
      if (peekTimer.current) clearTimeout(peekTimer.current);
      peekTimer.current = setTimeout(() => setPeek(null), n.peek_ms + 40);
    }
    setS(n);
  }, []);

  const poll = useCallback(async () => {
    if (!S || moving.current) return;
    try { const n = await duelState(S.id, token()); if (!moving.current) take(n); }
    catch (e) { if (/not found|Not your game/i.test((e as Error).message)) toLobby(); }
  }, [S, take, toLobby]);
  useEffect(() => {
    if (!S) return;
    const t = setInterval(poll, 900);
    return () => clearInterval(t);
  }, [S?.id, poll]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = async (cell: number) => {
    if (!S || S.status !== "playing" || S.turn !== S.me || moving.current) return;
    moving.current = true; setStatus("");
    try { take(await duelMove(S.id, token(), cell)); } catch (e) { setStatus((e as Error).message); }
    moving.current = false;
  };
  const setup = async (a: "shuffle" | "ready") => {
    if (!S || moving.current) return;
    moving.current = true;
    try { take(await duelSetup(S.id, token(), a)); } catch (e) { setStatus((e as Error).message); }
    moving.current = false;
  };
  const leave = async () => { if (S) { try { await duelLeave(S.id, token()); } catch {} } toLobby(); };
  const rematch = async () => {
    if (!S) return;
    moving.current = true;
    try { take(await duelRematch(S.id, token())); } catch {}
    moving.current = false;
  };

  // ---------- lobby ----------
  if (!S) {
    const meta = partnerByGame(game)!;
    return (
      <div className="mx-auto max-w-md">
        <div className="block-panel p-6">
          <h2 className="text-center font-display text-3xl font-extrabold">Two devices</h2>
          <p className="mt-1 text-center text-sm text-muted">One of you makes a game and reads out the code. The other types it in.</p>
          {!fixed && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="game-pick">
              {partnerGames.map((g) => (
                <button key={g.game} onClick={() => setGame(g.game)} className={`rounded-2xl border-2 p-2.5 text-center font-extrabold transition ${game === g.game ? "border-gold bg-gold/10" : "border-line bg-[var(--panel)] hover:border-gold/50"}`}>
                  <span className="block text-2xl">{g.emoji}</span><span className="text-sm">{g.title}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 text-sm">
            {student ? <p className="rounded-xl border border-emerald/40 bg-emerald/10 p-2.5 font-bold text-emerald">✓ Logged in as {student.name}. Your partner will see this name.</p>
              : <div><label className={label} htmlFor="dname">Your name</label><input id="dname" className={input} maxLength={16} value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" /></div>}
          </div>
          <button className={`${btnGold} mt-4 w-full`} disabled={busy} onClick={create} data-testid="duel-create">New {meta.title} game</button>
          <div className="my-4 text-center text-xs font-bold uppercase tracking-widest text-muted">or join your partner&apos;s game</div>
          <div className="flex gap-2">
            <input className={`${input} text-center font-display text-2xl uppercase tracking-[0.3em]`} maxLength={4} placeholder="CODE" value={code} aria-label="Game code"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} onKeyDown={(e) => e.key === "Enter" && join()} />
            <button className={btn} disabled={busy} onClick={join} data-testid="duel-join">Join</button>
          </div>
          {err && <p className="mt-3 text-sm font-bold text-crimson">{err}</p>}
          {onBack && <button className={`${btn} mt-4 w-full`} onClick={onBack}>Change mode</button>}
        </div>
      </div>
    );
  }

  const meta = partnerByGame(S.game)!;
  if (S.status === "waiting") {
    return (
      <div className="mx-auto max-w-md">
        <div className="block-panel p-6 text-center">
          <h2 className="font-display text-3xl font-extrabold">{meta.emoji} {meta.title}</h2>
          <p className="mt-2 text-muted">Tell your partner to open <b className="text-fg">Partner Games</b> (or this page) and type this code:</p>
          <div className="my-4 font-display text-6xl font-extrabold tracking-[0.2em] text-gold" data-testid="duel-code">{S.code}</div>
          <p className="text-muted">Waiting for them to join…</p>
          <button className={`${btn} mt-4`} onClick={leave}>Cancel</button>
        </div>
      </div>
    );
  }

  const opp = (S.me === 1 ? S.p2_name : S.p1_name) ?? "…";
  const mine = S.status === "playing" && S.turn === S.me;
  const done = S.status === "done";
  const peeking = !!peek;
  let statusText = "";
  let board: React.ReactNode = null;
  let below: React.ReactNode = null;

  if (S.game === "tictactoe" || S.game === "connect4") {
    statusText = S.status === "playing" ? (mine ? "Your turn!" : `${opp} is thinking…`) : "";
    board = S.game === "tictactoe"
      ? <TttBoard board={S.board} last={S.last_move ?? -1} canPlay={mine} onPlay={move} done={done} />
      : <C4Board board={S.board} last={S.last_move ?? -1} canPlay={mine} onPlay={(c) => { if (S.board[c] !== "0") setStatus("That column is full."); else move(c); }} done={done} />;
  } else if (S.game === "dots") {
    const lm = S.last_move, bonus = lm != null && lm < 60 && S.board[lm] !== "0" && BOXES_OF[lm].some((k) => S.board[60 + k] === S.board[lm]);
    const n1 = [...S.board.slice(60)].filter((x) => x === "1").length, n2 = [...S.board.slice(60)].filter((x) => x === "2").length;
    statusText = S.status !== "playing" ? "" : mine ? (bonus ? "📦 Claim! Go again: draw another line" : "Your turn: draw a line") : `${opp}${bonus ? " got a claim and goes again…" : " is thinking…"}`;
    board = <DotsBoard board={S.board} last={S.last_move ?? -1} canPlay={mine} onPlay={move} turn={S.turn} labels={[ini(S.p1_name), ini(S.p2_name)]} />;
    below = <p className="mt-2 text-center text-sm font-bold text-muted">Claims: {S.p1_name} {n1} · {S.p2_name ?? "…"} {n2} ({25 - n1 - n2} left)</p>;
  } else if (S.game === "memory") {
    const faces = { ...(peek ?? {}), ...S.faces };
    const n1 = [...S.board].filter((x) => x === "1").length / 2, n2 = [...S.board].filter((x) => x === "2").length / 2;
    statusText = S.status !== "playing" ? "" : peeking ? "❌ No match!" : mine ? (S.flip1 != null ? "Your turn: flip one more" : "Your turn: flip two cards") : `${opp} is flipping…`;
    board = <MemoryBoard faces={faces} owners={S.board} canPlay={mine && !peeking} onPlay={move} />;
    const lastMatch = S.last_move != null && S.board[S.last_move] !== "0" ? FOSSILS[(S.faces[S.last_move] ?? "A").charCodeAt(0) - 65] : null;
    below = <p className="mt-3 text-center text-sm font-bold text-muted">Pairs: {S.p1_name} {n1} · {S.p2_name ?? "…"} {n2}{lastMatch ? <><br /><span className="font-semibold">🦴 {lastMatch.fact}</span></> : null}</p>;
  } else if (S.game === "battleship") {
    const off = { mine: S.me === 1 ? 0 : 64, theirs: S.me === 1 ? 64 : 0 };
    const myLog = S.board.slice(off.mine, off.mine + 64), theirLog = S.board.slice(off.theirs, off.theirs + 64);
    const map = S.my_fleet ?? "", theirMap = S.opp_fleet ?? "";
    const setupPhase = S.status === "playing" && !(S.ready1 && S.ready2);
    const meReady = S.me === 1 ? S.ready1 : S.ready2;
    if (setupPhase) {
      statusText = meReady ? `⏳ Waiting for ${opp} to hide their deposits…` : "⛏️ Hide your deposits, then tap Ready";
      board = (
        <div className="flex flex-col items-center">
          <div className="mb-2 font-display text-lg font-extrabold">Your claim <span className="text-sm font-semibold text-muted">5 deposits · 4, 3, 3, 2, 2 plots</span></div>
          <SurveyGrid size="lg" cells={(i) => (map[i] !== "0" ? "deposit" : "rock")} />
          <p className="mt-2 max-w-sm text-center text-sm text-muted">Your partner can&apos;t see your deposits. Don&apos;t like this layout? Shuffle until you do.</p>
          {!meReady && <div className="mt-3 flex gap-3"><button className={btn} onClick={() => setup("shuffle")} data-testid="bs-shuffle">🔀 Shuffle</button><button className={btnGold} onClick={() => setup("ready")} data-testid="bs-ready">✅ Ready</button></div>}
        </div>
      );
    } else {
      statusText = S.status !== "playing" ? "" : mine ? "🎯 Your turn: tap a plot to drill!" : `🔭 ${opp} is picking a plot…`;
      const lm = S.last_move;
      let lastMsg = "";
      if (lm != null) {
        const mineShot = (S.me === 1) === (lm < 64), ch = S.board[lm], who = mineShot ? "You" : opp;
        lastMsg = ch === "s" ? `💎 ${who} found a whole deposit!` : ch === "h" ? `⛏️ ${who} struck ore${mineShot ? "!" : " in your claim!"}` : `🪨 ${who} drilled a dry hole.`;
      }
      const plot = (log: string, i: number, fleetMap: string, showDeposits: boolean, ghost: boolean): Plot =>
        log[i] === "m" ? "miss" : log[i] === "h" ? "hit" : log[i] === "s" ? "found" : ghost && fleetMap[i] && fleetMap[i] !== "0" ? "ghost" : showDeposits && fleetMap[i] !== "0" ? "deposit" : showDeposits ? "rock" : "open";
      board = (
        <div className="grid w-full items-start gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col items-center">
            <div className="mb-1 min-h-6 text-center font-bold">{lastMsg}</div>
            <div className="mb-2 text-sm font-semibold text-muted">🎯 {opp}&apos;s claim · found <b className="text-gold">{foundCount(myLog)}</b> of 5</div>
            <SurveyGrid size="lg" active={mine} onClick={move} last={lm == null ? -1 : lm - off.mine} cells={(i) => plot(myLog, i, theirMap, false, done)} />
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 text-sm font-semibold text-muted">⛏️ Your claim · {foundCount(theirLog)} of 5 found</div>
            <SurveyGrid size="sm" last={lm == null ? -1 : lm - off.theirs} cells={(i) => plot(theirLog, i, map, true, false)} />
          </div>
        </div>
      );
    }
  }

  const resultText = !done ? "" : S.winner === 0 ? "🤝 It's a draw!"
    : S.winner === S.me ? (S.reason === "left" ? `🏆 ${opp} left. You win!` : S.reason === "timeout" ? `🏆 ${opp} disconnected. You win!` : "🏆 You win!")
    : S.reason === "left" || S.reason === "expired" ? "Game over" : `😬 ${opp} wins!`;
  const canRe = done && S.reason !== "left" && S.reason !== "expired";
  const asked = S.me === 1 ? S.rematch1 : S.rematch2, they = S.me === 1 ? S.rematch2 : S.rematch1;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center" data-testid="duel-game" data-status={S.status} data-turn={S.turn} data-me={S.me}>
      <div className="mb-4 grid w-full max-w-xl grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ScoreChip p={1} game={S.game} name={S.p1_name + (S.me === 1 ? " (you)" : "")} n={S.score1} active={S.status === "playing" && S.turn === 1} />
        <span className="font-display text-sm font-extrabold text-muted">vs</span>
        <ScoreChip p={2} game={S.game} name={(S.p2_name ?? "…") + (S.me === 2 ? " (you)" : "")} n={S.score2} active={S.status === "playing" && S.turn === 2} right />
      </div>
      <div className={`mb-3 min-h-8 text-center font-display text-xl font-extrabold ${mine ? "text-emerald" : ""}`} data-testid="duel-status">{status || statusText}</div>
      {S.status === "playing" && !S.opp_online && <p className="mb-2 text-center text-sm font-bold text-amber">⚠ {opp} seems disconnected. If they don&apos;t come back within a minute, you win.</p>}
      {board}
      {below}
      {done ? (
        <div className="mt-5 text-center">
          <div className="font-display text-3xl font-extrabold" data-testid="duel-result">{resultText}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            {canRe && <button className={btnGold} disabled={asked} onClick={rematch} data-testid="duel-rematch">{asked ? `Waiting for ${opp}…` : they ? `${opp} wants a rematch!` : "Rematch"}</button>}
            <button className={btn} onClick={leave}>Leave</button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          {confirmLeave
            ? <span className="flex gap-2"><button className={btn} onClick={leave}>Leave (your partner wins)</button><button className={btn} onClick={() => setConfirmLeave(false)}>Keep playing</button></span>
            : <button className={btn} onClick={() => setConfirmLeave(true)}>Leave game</button>}
        </div>
      )}
      <p className="mt-3 text-center text-xs text-muted">{S.both_signed_in ? "🏆 Both players are logged in: wins count on the Partner leaderboard." : "Practice game: wins only count when both players are logged in."} Round {S.round}.</p>
    </div>
  );
}
const ini = (n: string | null) => (n || "?").trim().charAt(0).toUpperCase();
