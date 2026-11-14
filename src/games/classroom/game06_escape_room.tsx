"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, LockOpen, RotateCcw, Timer, Lightbulb, DoorOpen } from "lucide-react";
import data from "./data/game06_escape_room.json";
import { BtnB, Card, FrameB, Stat, StatusB } from "./shared-b";

// Bedrock twin of Dopps Class game06_escape_room: 3 rooms, 5 clues each, solved in order, 5:00 per room.
// Each room is a puzzle chain: the last clue is a door code built from the earlier answers.
type Clue = { label: string; q: string; ans: string[]; hint: string; exp: string };
type Room = { title: string; icon: string; scenario: string; clues: Clue[] };
const ROOMS = (data as { ROOMS: Room[] }).ROOMS;
const ROOM_SECS = 300;
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
const matches = (c: Clue, raw: string) => {
  const val = raw.trim().toLowerCase();
  if (!val) return false;
  return c.ans.some((a) => val.includes(a) || a.split(" ").every((w) => val.includes(w)));
};

export function Game06EscapeRoom() {
  const [roomIdx, setRoomIdx] = useState(0);
  const [clueIdx, setClueIdx] = useState(0);
  const [solved, setSolved] = useState<number[]>([]);
  const [hints, setHints] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(ROOM_SECS);
  const [roomHints, setRoomHints] = useState(0);
  const [totalHints, setTotalHints] = useState(0);
  const [roomsDone, setRoomsDone] = useState<number[]>([]);
  const [status, setStatus] = useState<{ t: string; tone?: "good" | "bad" | "gold" } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [won, setWon] = useState(false);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const room = ROOMS[roomIdx];
  const allSolved = solved.length === room.clues.length;

  const init = (idx: number) => {
    setRoomIdx(idx); setClueIdx(0); setSolved([]); setHints([]); setRunning(false); setSeconds(ROOM_SECS);
    setRoomHints(0); setStatus(null); setTimedOut(false); setInput(""); setWon(false);
  };

  // countdown
  const live = useRef({ seconds, solved: solved.length, clues: room.clues.length });
  useEffect(() => { live.current = { seconds, solved: solved.length, clues: room.clues.length }; });
  useEffect(() => {
    if (!running || allSolved) return;
    const t = setInterval(() => {
      const s = Math.max(0, live.current.seconds - 1);
      live.current.seconds = s;
      setSeconds(s);
      if (s <= 0) {
        clearInterval(t);
        const L = live.current;
        setStatus({ t: `TIME'S UP! ${L.solved}/${L.clues} clues solved. Answers revealed below.`, tone: "bad" });
        setSolved(Array.from({ length: L.clues }, (_, i) => i)); setTimedOut(true); setRunning(false);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [running, allSolved]);

  useEffect(() => { if (running) inputRef.current?.focus(); }, [clueIdx, running]);

  const check = (i: number) => {
    const c = room.clues[i];
    if (matches(c, input)) {
      const ns = solved.includes(i) ? solved : [...solved, i];
      setSolved(ns); setClueIdx(Math.max(clueIdx, i + 1)); setInput("");
      setStatus({ t: `CORRECT! ${i < room.clues.length - 1 ? `Clue ${i + 2} unlocked! Keep going!` : "ALL CLUES SOLVED! Hit Escaped!"}`, tone: "good" });
    } else {
      setStatus({ t: "Not quite — check your spelling or try a different phrasing!", tone: "bad" });
      setWrong(true); setTimeout(() => setWrong(false), 1200);
    }
  };

  const toggleHint = (i: number) => {
    if (hints.includes(i)) setHints(hints.filter((h) => h !== i));
    else { setHints([...hints, i]); setRoomHints((n) => n + 1); setTotalHints((n) => n + 1); }
  };

  const escape = () => {
    const done = roomsDone.includes(roomIdx) ? roomsDone : [...roomsDone, roomIdx];
    setRoomsDone(done);
    if (roomIdx < ROOMS.length - 1) init(roomIdx + 1);
    else setWon(true);
  };
  const playAgain = () => { setRoomsDone([]); setTotalHints(0); init(0); };

  if (won) {
    const clues = ROOMS.reduce((a, r) => a + r.clues.length, 0);
    return (
      <FrameB title="Earth Escape Room" sub="Earth Science Edition" max="max-w-3xl">
        <Card accent="#00e5a0" className="animate-rise text-center">
          <DoorOpen className="mx-auto size-16 text-emerald drop-shadow-[0_0_18px_rgba(0,229,160,.7)]" />
          <div className="mt-3 font-display text-5xl font-extrabold text-emerald">ALL ROOMS ESCAPED!</div>
          <p className="mt-3 text-xl text-muted">Your team solved all {clues} clues across {ROOMS.length} rooms!</p>
          <div className="mt-5 font-display text-3xl font-extrabold text-gold">
            {totalHints === 0 ? "PERFECT RUN — Zero hints!" : totalHints <= 3 ? "Excellent work!" : totalHints <= 6 ? "Great effort!" : "Well done!"}
          </div>
          <p className="mt-2 text-muted">Total hints used: {totalHints}</p>
          <BtnB big className="mt-6" onClick={playAgain}><RotateCcw className="mr-2 inline size-5" />Play Again</BtnB>
        </Card>
      </FrameB>
    );
  }

  const low = running && seconds <= 60;
  return (
    <FrameB title="Earth Escape Room" sub={`Room ${roomIdx + 1} / ${ROOMS.length}`}
      right={
        <div className={`glass flex items-center gap-3 rounded-2xl px-5 py-3 font-display text-5xl font-extrabold tabular-nums ${low ? "animate-pulse text-crimson" : "text-[#ff6b6b]"}`}
          style={{ textShadow: "0 0 24px rgba(255,59,92,.55)" }}>
          <Timer className="size-8" />{fmt(seconds)}
        </div>
      }>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Clues solved" value={`${solved.length} / ${room.clues.length}`} color="#00e5a0" />
        <Stat label="Hints used" value={roomHints} color="#ffd166" />
        <Stat label="Rooms escaped" value={`${roomsDone.length} / ${ROOMS.length}`} color="#38bfff" />
      </div>

      <Card className="mt-4 animate-rise" accent="#38bfff">
        <div className="text-center font-display text-3xl font-extrabold text-sky">{room.icon} {room.title}</div>
        <p className="mx-auto mt-3 max-w-3xl text-center text-xl leading-relaxed text-fg/85">{room.scenario}</p>
      </Card>

      <div className="mt-4 flex gap-2">
        {room.clues.map((_, i) => (
          <div key={i} className="h-3 flex-1 rounded-full transition-colors duration-300"
            style={{ background: solved.includes(i) ? "#00e5a0" : i === clueIdx ? "#38bfff" : "color-mix(in srgb, var(--color-fg) 8%, transparent)", boxShadow: solved.includes(i) ? "0 0 12px #00e5a0" : i === clueIdx ? "0 0 12px #38bfff" : undefined }} />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {room.clues.map((c, i) => {
          const isSolved = solved.includes(i), isActive = i === clueIdx && !isSolved, isLocked = i > clueIdx && !isSolved;
          const border = isSolved ? "#00e5a0" : isActive ? "#ff9f1c" : "color-mix(in srgb, var(--color-fg) 9%, transparent)";
          return (
            <div key={i} className={`rounded-3xl border p-5 transition ${isLocked ? "opacity-35" : ""}`}
              style={{ borderColor: border, background: isSolved ? "rgba(0,229,160,.07)" : isActive ? "rgba(255,159,28,.06)" : "color-mix(in srgb, var(--color-fg) 3%, transparent)", boxShadow: isActive ? "0 0 30px -12px #ff9f1c" : undefined }}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-lg font-extrabold text-sky">{c.label}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold tracking-widest ${isSolved ? "bg-emerald text-ink" : isLocked ? "bg-fg/10 text-muted" : "bg-amber text-ink"}`}>
                  {isSolved ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
                  {isSolved ? "SOLVED" : isLocked ? "LOCKED" : "ACTIVE"}
                </span>
              </div>
              <p className="mt-2 text-xl leading-relaxed text-fg">{c.q}</p>
              {isSolved && (
                <div className="mt-3 border-t border-line pt-3 text-lg leading-snug text-emerald">
                  ✓ {timedOut && <b className="text-gold">{c.ans[0]} — </b>}{c.exp}
                </div>
              )}
              {isActive && (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && check(i)}
                      placeholder="Type your answer..." autoComplete="off"
                      className="min-w-[200px] flex-1 rounded-xl border bg-fg/5 px-4 py-3 text-xl font-semibold text-fg outline-none transition focus:border-sky"
                      style={{ borderColor: wrong ? "#ff3b5c" : undefined }} />
                    <BtnB tone="blue" onClick={() => check(i)}>Submit</BtnB>
                    <BtnB tone="ghost" onClick={() => toggleHint(i)}><Lightbulb className="mr-1 inline size-4" />{hints.includes(i) ? "Hide Hint" : "Get Hint"}</BtnB>
                  </div>
                  {hints.includes(i) && <div className="mt-3 text-lg font-semibold text-amber">Hint: {c.hint}</div>}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <StatusB tone={status?.tone}>
          {status?.t ?? (running ? "Solve each clue in order. Each answer unlocks the next!" : 'Click "Start Timer" when your team is ready!')}
        </StatusB>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {!running && !allSolved && <BtnB big onClick={() => { setRunning(true); setStatus(null); }}><Timer className="mr-2 inline size-5" />Start Timer</BtnB>}
        {allSolved && <BtnB big tone="good" onClick={escape}><DoorOpen className="mr-2 inline size-5" />ESCAPED! {roomIdx < ROOMS.length - 1 ? `Enter Room ${roomIdx + 2}` : "Finish!"}</BtnB>}
        <BtnB tone="ghost" onClick={() => init(roomIdx)}><RotateCcw className="mr-2 inline size-4" />Reset Room</BtnB>
      </div>
    </FrameB>
  );
}
