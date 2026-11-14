"use client";

// ── wave-live ── Partner games on one device: vs the computer (easy / hard) or two players taking turns.
// Same rules as the two-device games (and as Dopps Class duel.tsx, battleship.tsx and dots-boxes.tsx).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { store } from "@/lib/live";
import { btn, btnGold } from "@/components/live/shared";
import { C4Board, DotsBoard, ScoreChip, SurveyGrid, TttBoard, type Plot } from "./boards";
import { DEPOSITS, cpuDrill, dotsCpuMove, dotsMove, dotsScore, drill, foundCount, full, hitsIn, lineCpuMove, lineMove, randomMap, winLine, type LineGame, type Seat } from "./logic";

export type LocalMode = "cpu-easy" | "cpu-hard" | "local";
const blank = (g: LineGame | "dots") => "0".repeat(g === "tictactoe" ? 9 : g === "connect4" ? 42 : 85);
const statKey = (g: string) => `bedrock_partner_${g}`;
export const cpuStats = (g: string) => store.get(statKey(g), { wins: 0, plays: 0 });
function record(g: string, won: boolean) {
  const s = cpuStats(g);
  store.set(statKey(g), { wins: s.wins + (won ? 1 : 0), plays: s.plays + 1 });
}

/** Tic-Tac-Toe, Connect 4 and Dots & Boxes on one device. */
export function LocalDuel({ game, mode, onBack }: { game: LineGame | "dots"; mode: LocalMode; onBack: () => void }) {
  const vsCpu = mode !== "local", hard = mode === "cpu-hard";
  const [board, setBoard] = useState(() => blank(game));
  const [turn, setTurn] = useState<Seat>(1);
  const [starter, setStarter] = useState<Seat>(1);
  const [last, setLast] = useState(-1);
  const [bonus, setBonus] = useState(false);
  const [tally, setTally] = useState({ 1: 0, 2: 0, draw: 0 });
  const recorded = useRef(false);
  const names = { 1: vsCpu ? "You" : "Player 1", 2: vsCpu ? "Computer" : "Player 2" } as const;

  const result = useMemo((): { w: 0 | Seat } | null => {
    if (game === "dots") {
      const s = dotsScore(board);
      return s[1] + s[2] === 25 ? { w: s[1] === s[2] ? 0 : s[1] > s[2] ? 1 : 2 } : null;
    }
    const w = winLine(game, board);
    if (w) return { w: w.p };
    return full(board) ? { w: 0 } : null;
  }, [board, game]);

  const play = useCallback((m: number) => {
    if (result) return;
    if (game === "dots") {
      const r = dotsMove(board, turn, m);
      if (!r) return;
      setBoard(r.board); setLast(m); setBonus(r.got > 0);
      if (!r.got) setTurn(turn === 1 ? 2 : 1);
      return;
    }
    const r = lineMove(game, board, turn, m);
    if (!r) return;
    setBoard(r.board); setLast(r.idx); setTurn(turn === 1 ? 2 : 1);
  }, [board, turn, result, game]);

  useEffect(() => {
    if (!vsCpu || result || turn !== 2) return;
    const t = setTimeout(() => play(game === "dots" ? dotsCpuMove(board, hard) : lineCpuMove(game, board, 2, hard)), game === "dots" && bonus ? 380 : 450 + Math.random() * 300);
    return () => clearTimeout(t);
  }, [vsCpu, result, turn, board, game, hard, bonus, play]);

  useEffect(() => {
    if (!result || recorded.current) return;
    recorded.current = true;
    setTally((t) => (result.w === 0 ? { ...t, draw: t.draw + 1 } : { ...t, [result.w]: t[result.w] + 1 }));
    if (vsCpu) record(game, result.w === 1);
  }, [result, vsCpu, game]);

  const rematch = () => {
    const s: Seat = starter === 1 ? 2 : 1;
    setStarter(s); setTurn(s); setBoard(blank(game)); setLast(-1); setBonus(false); recorded.current = false;
  };
  const myTurn = !result && !(vsCpu && turn === 2);
  const sc = game === "dots" ? dotsScore(board) : null;
  const status = result
    ? result.w === 0 ? (game === "dots" ? "It's a tie!" : "It's a draw!") : `${names[result.w]} ${vsCpu && result.w === 1 ? "win" : "wins"}${sc ? ` ${sc[1]}–${sc[2]}` : ""}! 🎉`
    : vsCpu && turn === 2 ? (game === "dots" && bonus ? "Computer got a claim. It goes again…" : "Computer is thinking…")
    : game === "dots" && bonus ? `📦 Claim! ${vsCpu ? "Go" : names[turn] + ", go"} again` : vsCpu ? "Your turn" : `${names[turn]}'s turn`;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center" data-testid="local-game">
      <div className="mb-5 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ScoreChip p={1} game={game} name={names[1]} n={sc ? sc[1] : tally[1]} sub={sc ? `${tally[1]} won` : undefined} active={!result && turn === 1} />
        <div className="text-center text-[11px] font-semibold uppercase tracking-widest text-muted">{game === "dots" ? "Ties" : "Draws"} {tally.draw}</div>
        <ScoreChip p={2} game={game} name={names[2]} n={sc ? sc[2] : tally[2]} sub={sc ? `${tally[2]} won` : undefined} active={!result && turn === 2} right />
      </div>
      {game === "tictactoe" && <TttBoard board={board} last={last} canPlay={myTurn} onPlay={play} done={!!result} />}
      {game === "connect4" && <C4Board board={board} last={last} canPlay={myTurn} onPlay={play} done={!!result} />}
      {game === "dots" && <DotsBoard board={board} last={last} canPlay={myTurn} onPlay={play} turn={turn} labels={vsCpu ? ["★", "●"] : ["1", "2"]} />}
      <div className="mt-5 text-center font-display text-2xl font-extrabold" data-testid="local-status">{status}</div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {result && <button className={btnGold} onClick={rematch}>Rematch</button>}
        <button className={btn} onClick={onBack}>Change mode</button>
      </div>
    </div>
  );
}

/** Core Sample Hunt vs the computer. */
export function LocalCoreSample({ hard, onBack }: { hard: boolean; onBack: () => void }) {
  const [mine, setMine] = useState(() => randomMap());
  const [theirs, setTheirs] = useState("");
  const [myLog, setMyLog] = useState("0".repeat(64));
  const [cpuLog, setCpuLog] = useState("0".repeat(64));
  const [phase, setPhase] = useState<"place" | "play" | "done">("place");
  const [turn, setTurn] = useState<"me" | "cpu">("me");
  const [msg, setMsg] = useState("");
  const [last, setLast] = useState<{ who: "me" | "cpu"; i: number } | null>(null);
  const iWon = phase !== "place" && hitsIn(myLog) >= 14, cpuWon = phase !== "place" && hitsIn(cpuLog) >= 14;

  useEffect(() => {
    if (phase !== "play" || (!iWon && !cpuWon)) return;
    /* eslint-disable react-hooks/set-state-in-effect -- the round just ended */
    setPhase("done");
    setMsg(iWon ? "🏆 You found every deposit!" : "💥 The computer found all your deposits.");
    /* eslint-enable react-hooks/set-state-in-effect */
    record("battleship", iWon);
  }, [iWon, cpuWon, phase]);

  useEffect(() => {
    if (phase !== "play" || turn !== "cpu" || iWon || cpuWon) return;
    const t = setTimeout(() => {
      const i = cpuDrill(cpuLog, hard), nl = drill(cpuLog, mine, i);
      setCpuLog(nl); setLast({ who: "cpu", i });
      setMsg(nl[i] === "s" ? "💎 The computer found one of your deposits!" : nl[i] === "h" ? "⛏️ The computer struck ore in your claim!" : "🪨 The computer drilled a dry hole.");
      setTurn("me");
    }, 700);
    return () => clearTimeout(t);
  }, [phase, turn, cpuLog, mine, hard, iWon, cpuWon]);

  const fire = (i: number) => {
    if (phase !== "play" || turn !== "me" || myLog[i] !== "0") return;
    const nl = drill(myLog, theirs, i);
    setMyLog(nl); setLast({ who: "me", i });
    const d = DEPOSITS[+theirs[i] - 1];
    setMsg(nl[i] === "s" ? `💎 You found the whole ${d.name.toLowerCase()} (${d.len} plots)!` : nl[i] === "h" ? "⛏️ Ore!" : "🪨 Dry hole.");
    setTurn("cpu");
  };
  const start = () => { setTheirs(randomMap()); setMyLog("0".repeat(64)); setCpuLog("0".repeat(64)); setPhase("play"); setTurn("me"); setLast(null); setMsg("Your turn! Tap a plot in the computer's claim."); };
  const again = () => { setMine(randomMap()); setPhase("place"); setMsg(""); };
  const plot = (log: string, i: number, map: string, show: boolean, ghost: boolean): Plot =>
    log[i] === "m" ? "miss" : log[i] === "h" ? "hit" : log[i] === "s" ? "found" : ghost && map[i] !== "0" ? "ghost" : show ? (map[i] !== "0" ? "deposit" : "rock") : "open";

  if (phase === "place") {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center" data-testid="local-game">
        <h2 className="font-display text-3xl font-extrabold">Your claim</h2>
        <p className="mt-1 text-center text-sm text-muted">5 deposits: {DEPOSITS.map((d) => `${d.name} (${d.len})`).join(", ")}. Shuffle until you like the layout.</p>
        <div className="mt-4"><SurveyGrid size="lg" cells={(i) => (mine[i] !== "0" ? "deposit" : "rock")} /></div>
        <div className="mt-4 flex gap-3"><button className={btn} onClick={() => setMine(randomMap())}>🔀 Shuffle</button><button className={btnGold} onClick={start}>✅ Ready</button></div>
        <button className={`${btn} mt-3`} onClick={onBack}>Change mode</button>
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center" data-testid="local-game">
      <div className="mb-4 min-h-8 text-center font-display text-xl font-extrabold">{msg}</div>
      <div className="grid w-full items-start gap-6 md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col items-center">
          <div className="mb-2 text-sm font-semibold text-muted">🎯 The computer&apos;s claim · found <b className="text-gold">{foundCount(myLog)}</b> of 5</div>
          <SurveyGrid size="lg" onClick={fire} active={phase === "play" && turn === "me"} last={last?.who === "me" ? last.i : -1} cells={(i) => plot(myLog, i, theirs, false, phase === "done")} />
        </div>
        <div className="flex flex-col items-center">
          <div className="mb-2 text-sm font-semibold text-muted">⛏️ Your claim · lost <b className="text-crimson">{foundCount(cpuLog)}</b> of 5</div>
          <SurveyGrid size="sm" last={last?.who === "cpu" ? last.i : -1} cells={(i) => plot(cpuLog, i, mine, true, false)} />
        </div>
      </div>
      <div className="mt-5 flex gap-3">
        {phase === "done" && <button className={btnGold} onClick={again}>Play again</button>}
        <button className={btn} onClick={onBack}>Change mode</button>
      </div>
    </div>
  );
}
