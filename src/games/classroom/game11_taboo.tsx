"use client";

// Bedrock twin of Dopps Class game11_taboo — two teams, 60-second turns. Describe the word without the forbidden
// words: Got It +1, Taboo -1 (never below 0), Skip = no change. Time's up passes to the other team.
import { useCallback, useState } from "react";
import { Ban, Check, RotateCcw, SkipForward, Play } from "lucide-react";
import data from "./data/game11_taboo.json";
import { Btn, Hint, Modal, Shell, TEAM_COLORS, TeamCard, TimerBadge, sfx, shuffle, useDeck, useCountdown, useKeys } from "./shared-c";

type Card = { word: string; forbidden: string[] };
const CARDS = (data as { CARDS: Card[] }).CARDS;
const TURN = 60;

export function Game11Taboo() {
  const [teams, setTeams] = useState(["Team 1", "Team 2"]);
  const [scores, setScores] = useState([0, 0]);
  const [cur, setCur] = useState(0);
  const [deck, setDeck] = useDeck(CARDS);
  const [idx, setIdx] = useState(0);
  const [timer, setTimer] = useState(TURN);
  const [running, setRunning] = useState(false);
  const [roundScore, setRoundScore] = useState(0);
  const [modal, setModal] = useState<null | { title: string; msg: string }>(null);
  const [flash, setFlash] = useState<null | "good" | "bad">(null);

  const card = deck[idx % deck.length];

  const advance = () => {
    if (idx + 1 >= deck.length) { setDeck(shuffle(CARDS)); setIdx(0); } else setIdx(idx + 1);
  };
  const pulse = (k: "good" | "bad") => { setFlash(k); setTimeout(() => setFlash(null), 350); };

  const init = () => {
    setDeck(shuffle(CARDS)); setIdx(0); setScores([0, 0]); setCur(0); setRoundScore(0); setRunning(false); setTimer(TURN); setModal(null);
  };

  const endTurn = useCallback(() => {
    setRunning(false); sfx.buzz();
    const other = (cur + 1) % 2;
    setModal({ title: "Time's Up!", msg: `${teams[cur]} earned ${roundScore} points this round.\n${teams[other]}'s turn next!` });
  }, [cur, teams, roundScore]);
  useCountdown(running, setTimer, timer, endTurn);

  const closeModal = useCallback(() => { setModal(null); setCur((c) => (c + 1) % 2); setTimer(TURN); }, []);

  const startTurn = () => { if (running || modal) return; setRunning(true); setTimer(TURN); setRoundScore(0); sfx.click(); };
  const correct = () => {
    if (!running) return;
    setRoundScore((r) => r + 1); setScores((s) => s.map((v, i) => (i === cur ? v + 1 : v))); advance(); sfx.good(); pulse("good");
  };
  const taboo = () => {
    if (!running) return;
    setRoundScore((r) => r - 1); setScores((s) => s.map((v, i) => (i === cur ? Math.max(0, v - 1) : v))); advance(); sfx.bad(); pulse("bad");
  };
  const skip = () => { if (running) { advance(); sfx.click(); } };

  useKeys((e) => {
    if (modal) return;
    const k = e.key.toLowerCase();
    if (!running && (k === " " || k === "enter")) { e.preventDefault(); startTurn(); }
    else if (running && (k === "g" || k === "arrowright" || k === "enter")) { e.preventDefault(); correct(); }
    else if (running && (k === "t" || k === "x")) taboo();
    else if (running && (k === "s" || k === "arrowdown")) skip();
  });

  const border = flash === "good" ? "#00E5A0" : flash === "bad" ? "#FF3B5C" : "rgba(232,121,249,.55)";

  return (
    <Shell title="Earth Science Taboo" sub="Describe it — don't say it!">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {[0, 1].map((i) => (
          <div key={i} className={i === 1 ? "order-3" : ""}>
            <TeamCard name={teams[i]} score={scores[i]} color={TEAM_COLORS[i]} active={cur === i} onName={(v) => setTeams((t) => t.map((x, j) => (j === i ? v : x)))} />
          </div>
        ))}
        <div className="order-2"><TimerBadge secs={timer} /></div>
      </div>

      <p className="mt-4 text-center text-sm font-semibold text-muted sm:text-base">
        Card {idx + 1} · <span style={{ color: TEAM_COLORS[cur] }}>{teams[cur]}</span>&apos;s turn · Round score: {roundScore >= 0 ? "+" : ""}{roundScore}
      </p>

      <div key={running ? card.word : "hidden"} className="cr-dark mx-auto mt-3 flex min-h-80 max-w-2xl animate-rise flex-col items-center justify-center rounded-3xl border-2 bg-gradient-to-b from-[#24123f]/90 to-[#0f0a24]/90 p-6 text-center transition-colors sm:p-8"
        style={{ borderColor: border, boxShadow: `0 0 50px -18px ${border}` }}>
        <div className="font-display text-5xl font-extrabold tracking-wide text-[#f0abfc] sm:text-7xl" style={{ textShadow: "0 0 30px rgba(232,121,249,.5)" }}>
          {running ? card.word : "???"}
        </div>
        {running && (
          <>
            <div className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-muted sm:text-sm">Do NOT say:</div>
            <div className="mt-3 flex w-full max-w-md flex-col gap-2">
              {card.forbidden.map((w) => (
                <div key={w} className="flex items-center justify-center gap-2 rounded-xl border-2 border-crimson/60 bg-crimson/10 px-4 py-2 text-xl font-extrabold tracking-wide text-[#fca5a5] sm:text-2xl">
                  <Ban className="size-5 opacity-70" />{w.toUpperCase()}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="glass mx-auto mt-4 max-w-2xl rounded-2xl px-4 py-3 text-center font-semibold text-fg sm:text-lg">
        {running ? "Describe the word WITHOUT using any forbidden words!" : "Press Start Turn to begin the 60-second timer!"}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {!running && <Btn big onClick={startTurn} kbd="Space"><Play className="size-6" /> Start Turn</Btn>}
        {running && <Btn big tone="good" onClick={correct} kbd="G"><Check className="size-6" /> Got It! +1</Btn>}
        {running && <Btn big tone="bad" onClick={taboo} kbd="T"><Ban className="size-6" /> Taboo! -1</Btn>}
        {running && <Btn big tone="ghost" onClick={skip} kbd="S"><SkipForward className="size-6" /> Skip</Btn>}
      </div>
      <div className="mt-4 flex justify-center"><Btn tone="ghost" onClick={init}><RotateCcw className="size-4" /> New Game</Btn></div>
      <Hint>Keys: Space start · G got it · T taboo · S skip. Click a team name to rename it.</Hint>

      {modal && <Modal title={modal.title} onClose={closeModal}>{modal.msg}</Modal>}
    </Shell>
  );
}
