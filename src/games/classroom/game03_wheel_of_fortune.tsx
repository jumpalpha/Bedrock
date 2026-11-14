"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import data from "./data/game03_wheel_of_fortune.json";
import { Btn, Scoreboard, Shell, TEAM_COLORS, shuffle, typingTarget } from "./shared-a";

// Bedrock twin of Dopps Class game03_wheel_of_fortune. Phrases are Earth science key terms. Spin for a value, guess a letter (value x hits), BANKRUPT
// zeroes the team, LOSE TURN passes, FREE SPIN forgives one miss. Solving = +$1,000.
type Puzzle = { phrase: string; cat: string };
const BASE = (data.PUZZLES as Puzzle[]);
type Wedge = { label: string; val: number | "bankrupt" | "free" | "lose"; color: string };
const WEDGES: Wedge[] = [
  { label: "$500", val: 500, color: "#1565C0" }, { label: "$300", val: 300, color: "#6A1B9A" },
  { label: "BANKRUPT", val: "bankrupt", color: "#B71C1C" }, { label: "$700", val: 700, color: "#1B5E20" },
  { label: "$400", val: 400, color: "#E65100" }, { label: "FREE SPIN", val: "free", color: "#F9A825" },
  { label: "$600", val: 600, color: "#0277BD" }, { label: "$250", val: 250, color: "#4A148C" },
  { label: "BANKRUPT", val: "bankrupt", color: "#B71C1C" }, { label: "$1000", val: 1000, color: "#1B5E20" },
  { label: "$350", val: 350, color: "#880E4F" }, { label: "$450", val: 450, color: "#1565C0" },
  { label: "$800", val: 800, color: "#2E7D32" }, { label: "LOSE TURN", val: "lose", color: "#37474F" },
  { label: "$550", val: 550, color: "#6A1B9A" }, { label: "$1500", val: 1500, color: "#BF360C" },
];
const ARC = (2 * Math.PI) / WEDGES.length;
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SIZE = 380;

function drawWheel(c: HTMLCanvasElement | null, rot: number) {
  const ctx = c?.getContext("2d"); if (!c || !ctx) return;
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 22;
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.save(); ctx.shadowColor = "rgba(255,209,102,.55)"; ctx.shadowBlur = 28;
  ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, 2 * Math.PI); ctx.fillStyle = "#ffd166"; ctx.fill(); ctx.restore();
  WEDGES.forEach((w, i) => {
    const s = rot + i * ARC;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, s, s + ARC); ctx.closePath();
    ctx.fillStyle = w.color; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(s + ARC / 2); ctx.textAlign = "right";
    ctx.fillStyle = "#fff"; ctx.font = `800 ${w.label.length > 5 ? 13 : 17}px system-ui, sans-serif`; ctx.fillText(w.label, r - 10, 5); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 2 * Math.PI); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.fillStyle = "#0d47a1"; ctx.font = "800 13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("SPIN", cx, cy + 5);
  // pointer on the right edge, pointing in
  ctx.beginPath(); ctx.moveTo(cx + r - 6, cy); ctx.lineTo(cx + r + 20, cy - 13); ctx.lineTo(cx + r + 20, cy + 13); ctx.closePath();
  ctx.fillStyle = "#ffd166"; ctx.fill(); ctx.strokeStyle = "#07071a"; ctx.lineWidth = 2; ctx.stroke();
}

export function Game03WheelOfFortune() {
  const [puzzles, setPuzzles] = useState<Puzzle[]>(BASE);
  const [teams, setTeams] = useState(["Team 1", "Team 2"]);
  const [scores, setScores] = useState([0, 0]);
  const [turn, setTurn] = useState(0);
  const [pIdx, setPIdx] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [usedL, setUsedL] = useState<string[]>([]);
  const [val, setVal] = useState(0);
  const [freeSpin, setFreeSpin] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState("Click Spin to start! Set teams below.");
  const [solveOpen, setSolveOpen] = useState(false);
  const [solveTxt, setSolveTxt] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const angle = useRef(0), target = useRef(0), raf = useRef(0);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const puzzle = puzzles[pIdx % puzzles.length];
  const solved = revealed.length > 0 && revealed.every(Boolean);

  const initPuzzle = useCallback((p: Puzzle) => {
    setRevealed(p.phrase.split("").map((c) => c === " ")); setUsedL([]); setVal(0); setSolveOpen(false);
    setStatus("Spin the wheel to get a value, then guess a letter!");
  }, []);

  useEffect(() => {
    const s = shuffle(BASE); setPuzzles(s); initPuzzle(s[0]);
    drawWheel(canvas.current, 0);
    setStatus("Click Spin to start! Set teams below.");
    return () => { cancelAnimationFrame(raf.current); if (statusTimer.current) clearTimeout(statusTimer.current); };
  }, [initPuzzle]);

  const nextTeam = () => setTurn((t) => (t + 1) % teams.length);

  const handleWedge = (w: Wedge) => {
    if (w.val === "bankrupt") { setScores((s) => s.map((v, i) => (i === turn ? 0 : v))); setStatus(`BANKRUPT! ${teams[turn]} loses everything. Turn passes.`); nextTeam(); }
    else if (w.val === "lose") { setStatus("LOSE A TURN! Pass."); nextTeam(); }
    else if (w.val === "free") { setFreeSpin(true); setStatus("FREE SPIN! Spin again or guess!"); }
    else { setVal(w.val); setStatus(`${teams[turn]} landed on $${w.val}! Guess a letter.`); }
  };

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    target.current = angle.current + Math.random() * Math.PI * 4 + Math.PI * 6;
    const step = () => {
      const diff = target.current - angle.current;
      if (diff < 0.01) {
        angle.current = target.current % (2 * Math.PI);
        const norm = (2 * Math.PI - angle.current) % (2 * Math.PI);
        drawWheel(canvas.current, angle.current);
        setSpinning(false);
        handleWedge(WEDGES[Math.floor(norm / ARC) % WEDGES.length]);
        return;
      }
      angle.current += Math.max(0.01, diff * 0.05);
      drawWheel(canvas.current, angle.current);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const guess = (L: string) => {
    if (usedL.includes(L) || spinning || solved) return;
    setUsedL([...usedL, L]);
    const ph = puzzle.phrase.split("");
    const hits = ph.filter((c, i) => c === L && !revealed[i]).length;
    const nr = ph.map((c, i) => revealed[i] || c === L);
    setRevealed(nr);
    if (hits > 0) {
      setScores((s) => s.map((v, i) => (i === turn ? v + val * hits : v)));
      setStatus(`${L} appears ${hits} time${hits > 1 ? "s" : ""}! +$${(val * hits).toLocaleString()}`);
      if (nr.every(Boolean)) { const t = teams[turn]; statusTimer.current = setTimeout(() => setStatus(`PUZZLE SOLVED! ${t} wins this round!`), 300); }
    } else {
      setStatus(`No ${L}s! ${freeSpin ? "FREE SPIN — spin again!" : "Turn passes."}`);
      if (!freeSpin) nextTeam();
      setFreeSpin(false);
    }
    setVal(0);
  };

  const checkSolve = () => {
    const g = solveTxt.trim().toUpperCase().replace(/\s+/g, " ");
    if (g === puzzle.phrase) {
      setScores((s) => s.map((v, i) => (i === turn ? v + 1000 : v)));
      setRevealed(puzzle.phrase.split("").map(() => true)); setStatus("CORRECT! +$1,000 bonus!");
    } else { setStatus("Wrong! Turn passes."); nextTeam(); }
    setSolveOpen(false); setSolveTxt("");
  };
  const nextPuzzle = () => { const n = pIdx + 1; setPIdx(n); initPuzzle(puzzles[n % puzzles.length]); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typingTarget(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === " ") { e.preventDefault(); spin(); return; }
      const L = e.key.toUpperCase();
      if (/^[A-Z]$/.test(L)) guess(L);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const words = puzzle.phrase.split(" ");
  let offset = 0;

  return (
    <Shell title="Wheel of Fortune" sub="Earth Science Edition — Bedrock">
      <Scoreboard names={teams} scores={scores} active={turn} onPick={setTurn} />

      <div className="mt-6 grid items-center gap-6 lg:grid-cols-[400px_1fr]">
        <div className="flex flex-col items-center">
          <canvas ref={canvas} width={SIZE} height={SIZE} className="w-full max-w-[380px]" />
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Btn big onClick={spin} disabled={spinning}>Spin the Wheel</Btn>
          </div>
        </div>

        <div>
          <div className="cr-dark rounded-3xl border bg-gradient-to-b from-[#17423a] to-[#0a1d19] p-5 text-center sm:p-7" style={{ borderColor: "rgba(255,209,102,.35)" }}>
            <div className="text-sm font-bold uppercase tracking-[0.25em] text-gold">{puzzle.cat}</div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-3">
              {words.map((w, wi) => {
                const start = offset; offset += w.length + 1;
                return (
                  <div key={wi} className="flex gap-0.5 sm:gap-1">
                    {w.split("").map((c, ci) => {
                      const rev = revealed[start + ci];
                      return (
                        <div key={ci} className={`grid h-9 w-[22px] place-items-center rounded-md border font-display text-base font-extrabold transition sm:h-14 sm:w-10 sm:rounded-lg sm:text-3xl lg:w-9 ${rev ? "border-white bg-white text-[#10302a] shadow-[0_0_18px_-4px_rgba(255,255,255,.8)]" : "border-gold/30 bg-[#2f7a66]/60"}`}
                          style={rev ? { animation: "wofpop .35s ease" } : undefined}>
                          {rev ? c : ""}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-4 min-h-8 text-center font-display text-2xl font-bold text-fg">{status}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Btn tone="good" onClick={() => setSolveOpen((o) => !o)}>Solve Puzzle</Btn>
            <Btn tone="ghost" onClick={nextPuzzle}>Next Puzzle</Btn>
          </div>
          {solveOpen && (
            <div className="mt-3 flex gap-2">
              <input autoFocus value={solveTxt} onChange={(e) => setSolveTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && checkSolve()} placeholder="Type full puzzle answer..."
                className="min-w-0 flex-1 rounded-xl border border-line bg-fg/5 px-4 py-3 text-lg text-fg outline-none focus:border-gold/60" />
              <Btn tone="good" onClick={checkSolve}>Submit</Btn>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]">
        {ABC.split("").map((L) => {
          const u = usedL.includes(L), hit = u && puzzle.phrase.includes(L);
          return (
            <button key={L} onClick={() => guess(L)} disabled={u}
              className={`h-12 rounded-xl font-display text-xl font-extrabold transition ${u ? (hit ? "bg-emerald/30 text-emerald" : "bg-fg/5 text-fg/25 line-through") : "bg-fg/10 text-fg hover:-translate-y-0.5 hover:bg-fg/20"}`}
              style={!u ? { boxShadow: `inset 0 -3px 0 ${TEAM_COLORS[turn % 4]}aa` } : undefined}>{L}</button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-muted">Keyboard: Space spins · type a letter to guess.</p>

      <div className="glass mt-6 rounded-3xl p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Teams</div>
        <div className="flex flex-wrap items-center gap-2">
          {teams.map((t, i) => (
            <input key={i} value={t} maxLength={20} onChange={(e) => setTeams(teams.map((v, j) => (j === i ? e.target.value : v)))}
              className="w-36 rounded-xl border bg-fg/5 px-3 py-2 font-semibold text-fg outline-none" style={{ borderColor: `${TEAM_COLORS[i]}88` }} />
          ))}
          {teams.length < 4 && (
            <Btn tone="ghost" className="!px-3 !py-2 !text-sm" onClick={() => { setTeams([...teams, `Team ${teams.length + 1}`]); setScores([...scores, 0]); }}><Plus className="mr-1 inline size-4" />Team</Btn>
          )}
        </div>
      </div>
      <style>{`@keyframes wofpop{from{transform:rotateY(90deg)}to{transform:none}}`}</style>
    </Shell>
  );
}
