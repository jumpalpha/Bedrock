"use client";

// ── wave-live ── Partner game boards. Pure pictures: the local games and the two-device games both draw with these.
// Tokens are minerals: Star Garnet (player 1) vs Sapphire (player 2); Connect 4 drops Magma vs Sulfur.
import { useState } from "react";
import { FOSSILS } from "@/games/wave-b/fossil-art";
import { DN, SN, winLine, type LineGame, type Seat } from "./logic";

export const GEM = {
  1: { name: "Star Garnet", short: "Garnet", col: "#e0475e", light: "#ffb3bf", dark: "#7a1226" },
  2: { name: "Sapphire", short: "Sapphire", col: "#3b8fe8", light: "#b9dcff", dark: "#123f7a" },
} as const;
export const DISC = {
  1: { name: "Magma", bg: "radial-gradient(circle at 35% 30%, #ffb38a, #f2542d 45%, #8f1d07)" },
  2: { name: "Sulfur", bg: "radial-gradient(circle at 35% 30%, #fff6b0, #f5d02e 45%, #a88a00)" },
} as const;
/** The board slab: dark basalt in both themes so the tokens always pop. */
export const SLAB = (accent: string) => ({
  background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 18%, #26221c), #12100c)`,
  boxShadow: `0 0 0 1px rgba(255,255,255,.08), 0 40px 100px -40px rgba(0,0,0,.9), 0 0 80px -30px ${accent}`,
});

/** A faceted gem (Tic-Tac-Toe and the score chips). */
export function GemToken({ p, size = 64 }: { p: Seat; size?: number }) {
  const g = GEM[p], id = `gem${p}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={g.name} role="img" className="drop-shadow-[0_8px_12px_rgba(0,0,0,.45)]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={g.light} /><stop offset=".45" stopColor={g.col} /><stop offset="1" stopColor={g.dark} /></linearGradient>
      </defs>
      {p === 1 ? (
        <>
          {/* round brilliant garnet with a six-ray star */}
          <circle cx="50" cy="50" r="40" fill={`url(#${id})`} stroke={g.dark} strokeWidth="4" />
          <polygon points="50,22 74,36 74,64 50,78 26,64 26,36" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" />
          <path d="M50 30 L50 70 M33 40 L67 60 M33 60 L67 40" stroke="rgba(255,255,255,.75)" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* emerald-cut sapphire */}
          <polygon points="30,14 70,14 86,30 86,70 70,86 30,86 14,70 14,30" fill={`url(#${id})`} stroke={g.dark} strokeWidth="4" strokeLinejoin="round" />
          <polygon points="36,28 64,28 72,36 72,64 64,72 36,72 28,64 28,36" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2.5" />
          <path d="M30 14 L36 28 M70 14 L64 28 M86 70 L72 64 M14 70 L28 64" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
        </>
      )}
      <ellipse cx="38" cy="32" rx="9" ry="5" fill="rgba(255,255,255,.55)" transform="rotate(-30 38 32)" />
    </svg>
  );
}
export const Disc = ({ p, size }: { p: Seat; size: number }) => (
  <span className="block rounded-full" style={{ width: size, height: size, background: DISC[p].bg, boxShadow: "inset 0 -4px 8px rgba(0,0,0,.35), 0 6px 14px rgba(0,0,0,.45)" }} />
);

// ---------- Tic-Tac-Toe ----------
export function TttBoard({ board, last, canPlay, onPlay, done }: { board: string; last: number; canPlay: boolean; onPlay: (i: number) => void; done: boolean }) {
  const w = done ? winLine("tictactoe", board) : null, wins = new Set(w?.cells ?? []);
  return (
    <div className="rounded-[28px] p-3 sm:p-4" style={SLAB("#e0475e")}>
      <div className="grid grid-cols-3 gap-2.5" data-testid="board-ttt">
        {[...board].map((v, i) => (
          <button key={i} data-cell={i} onClick={() => onPlay(i)} disabled={v !== "0" || !canPlay}
            className={`grid size-[86px] place-items-center rounded-2xl border transition sm:size-28 ${wins.has(i) ? "border-gold bg-gold/25" : "border-white/10 bg-white/[0.05] enabled:hover:bg-white/[0.12]"}`}>
            {v !== "0" && <span className={i === last ? "animate-[pop_.3s_ease]" : ""}><GemToken p={+v as Seat} size={66} /></span>}
          </button>
        ))}
      </div>
      <style>{`@keyframes pop{from{transform:scale(.3)}to{transform:none}}`}</style>
    </div>
  );
}

// ---------- Connect 4 ----------
export function C4Board({ board, last, canPlay, onPlay, done }: { board: string; last: number; canPlay: boolean; onPlay: (col: number) => void; done: boolean }) {
  const [hover, setHover] = useState(-1);
  const w = done ? winLine("connect4" as LineGame, board) : null, wins = new Set(w?.cells ?? []);
  return (
    <div className="rounded-[28px] p-2 sm:p-4" style={SLAB("#f2542d")}>
      <div className="flex gap-1 sm:gap-2" onMouseLeave={() => setHover(-1)} data-testid="board-c4">
        {Array.from({ length: 7 }, (_, c) => {
          const can = canPlay && board[c] === "0";
          return (
            <button key={c} data-col={c} onClick={() => can && onPlay(c)} onMouseEnter={() => setHover(c)} aria-label={`Drop in column ${c + 1}`}
              className={`flex flex-col gap-1 rounded-2xl p-0.5 transition sm:gap-2 sm:p-1 ${hover === c && can ? "bg-white/[0.08]" : ""}`}>
              {Array.from({ length: 6 }, (_, r) => {
                const i = r * 7 + c, v = board[i];
                return (
                  <span key={r} className="grid size-[38px] place-items-center rounded-full bg-[#0b0906] shadow-[inset_0_3px_8px_rgba(0,0,0,.7)] sm:size-14">
                    {v !== "0" && (
                      <span className={`block size-full rounded-full ${wins.has(i) ? "ring-4 ring-white/90" : ""}`}
                        style={{ background: DISC[+v as Seat].bg, boxShadow: "inset 0 -4px 8px rgba(0,0,0,.35), 0 4px 10px rgba(0,0,0,.4)",
                          animation: i === last ? "c4drop .45s cubic-bezier(.3,1.4,.6,1)" : undefined, ["--from" as string]: `-${(r + 1) * 115}%` }} />
                    )}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
      <style>{`@keyframes c4drop{from{transform:translateY(var(--from))}to{transform:none}}`}</style>
    </div>
  );
}

// ---------- Dots & Boxes ----------
const GAP = 72, M = 26, SIZE = M * 2 + GAP * DN;
function geom(i: number): [number, number, number, number] {
  if (i < 30) { const r = Math.floor(i / DN), c = i % DN; return [M + c * GAP, M + r * GAP, M + (c + 1) * GAP, M + r * GAP]; }
  const j = i - 30, r = Math.floor(j / (DN + 1)), c = j % (DN + 1);
  return [M + c * GAP, M + r * GAP, M + c * GAP, M + (r + 1) * GAP];
}
export function DotsBoard({ board, last, canPlay, onPlay, turn, labels }: { board: string; last: number; canPlay: boolean; onPlay: (i: number) => void; turn: Seat; labels: [string, string] }) {
  const [hover, setHover] = useState(-1);
  const col = (p: Seat) => GEM[p].col;
  return (
    <div className="w-full max-w-[460px] rounded-[28px] p-3 sm:p-4" style={SLAB(col(turn))}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full touch-manipulation select-none" onMouseLeave={() => setHover(-1)} data-testid="board-dots">
        <defs>
          {([1, 2] as const).map((p) => (
            <linearGradient key={p} id={`db${p}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={col(p)} stopOpacity=".7" /><stop offset="1" stopColor={col(p)} stopOpacity=".3" /></linearGradient>
          ))}
        </defs>
        {[...board.slice(60)].map((b, k) => {
          const r = Math.floor(k / DN), c = k % DN, x = M + c * GAP, y = M + r * GAP;
          return b !== "0" ? (
            <g key={k} style={{ animation: "dbpop .35s ease", transformOrigin: `${x + GAP / 2}px ${y + GAP / 2}px` }}>
              <rect x={x + 5} y={y + 5} width={GAP - 10} height={GAP - 10} rx="10" fill={`url(#db${b})`} />
              <text x={x + GAP / 2} y={y + GAP / 2} textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="900" fill="#fff" stroke="#1a1030" strokeWidth="5" paintOrder="stroke">{labels[+b - 1]}</text>
            </g>
          ) : null;
        })}
        {[...board.slice(0, 60)].map((v, i) => {
          const [x1, y1, x2, y2] = geom(i), hov = hover === i && v === "0" && canPlay;
          return (
            <g key={i}>
              <line data-line={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="26" strokeLinecap="round" className={v === "0" && canPlay ? "cursor-pointer" : ""}
                onMouseEnter={() => setHover(i)} onClick={() => v === "0" && canPlay && onPlay(i)} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} pointerEvents="none" strokeLinecap="round"
                stroke={v !== "0" ? col(+v as Seat) : hov ? `${col(turn)}cc` : "rgba(255,255,255,.16)"} strokeWidth={v !== "0" ? 9 : hov ? 8 : 6}
                strokeDasharray={v !== "0" || hov ? undefined : "2 12"} style={i === last && v !== "0" ? { filter: `drop-shadow(0 0 6px ${col(+v as Seat)})` } : undefined} />
            </g>
          );
        })}
        {Array.from({ length: (DN + 1) * (DN + 1) }, (_, d) => (
          <circle key={d} cx={M + (d % (DN + 1)) * GAP} cy={M + Math.floor(d / (DN + 1)) * GAP} r="7" fill="#f3ead8" pointerEvents="none" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" }} />
        ))}
      </svg>
      <style>{`@keyframes dbpop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}`}</style>
    </div>
  );
}

// ---------- Core Sample Hunt survey grid ----------
export type Plot = "rock" | "open" | "deposit" | "hit" | "miss" | "found" | "ghost";
export function SurveyGrid({ cells, onClick, active, last = -1, size }: { cells: (i: number) => Plot; onClick?: (i: number) => void; active?: boolean; last?: number; size: "lg" | "sm" }) {
  const sz = size === "lg" ? "size-[36px] sm:size-11" : "size-6 sm:size-7";
  return (
    <div className="rounded-3xl p-2.5" style={{ background: "linear-gradient(160deg,#5a4630,#2a2016)", boxShadow: "0 0 0 1px rgba(255,255,255,.08), 0 30px 80px -30px rgba(0,0,0,.9), 0 0 60px -25px #f6c453" }}>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${SN}, minmax(0, 1fr))` }} data-testid={size === "lg" ? "survey-target" : "survey-mine"}>
        {Array.from({ length: SN * SN }, (_, i) => {
          const k = cells(i), can = active && k === "open";
          return (
            <button key={i} data-plot={i} disabled={!can} onClick={() => onClick?.(i)} aria-label={`Plot ${String.fromCharCode(65 + Math.floor(i / SN))}${(i % SN) + 1}`}
              className={`${sz} relative grid place-items-center rounded-md text-sm transition ${
                k === "deposit" ? "bg-gradient-to-b from-[#f3d27a] to-[#b8862a] shadow-[inset_0_-3px_0_rgba(0,0,0,.25)]"
                : k === "hit" ? "bg-gradient-to-b from-[#ffd36b] to-[#e08a1a]"
                : k === "found" ? "bg-gradient-to-b from-[#7de3c4] to-[#0f8a63]"
                : k === "miss" ? "bg-[#1b140d]"
                : k === "ghost" ? "bg-[#f3d27a]/45 ring-2 ring-inset ring-[#f3d27a]"
                : "bg-[#8a6c48]/70 " + (can ? "cursor-crosshair hover:bg-gold/60" : "")
              } ${i === last ? "ring-2 ring-white" : ""}`}>
              {k === "hit" && "⛏️"}
              {k === "found" && "💎"}
              {k === "miss" && <span className="size-2 rounded-full bg-[#6b5a45]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Fossil Memory ----------
/** 16 cards. faces: card index -> fossil letter (A-M = FOSSILS[0..12]); owners: '0' face down, '1'/'2' matched. */
export function MemoryBoard({ faces, owners, canPlay, onPlay }: { faces: Record<string, string>; owners: string; canPlay: boolean; onPlay: (i: number) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3" data-testid="board-memory">
      {Array.from({ length: 16 }, (_, i) => {
        const f = faces[i], fossil = f ? FOSSILS[f.charCodeAt(0) - 65] : null, own = owners[i];
        return (
          <button key={i} data-card={i} disabled={!canPlay || !!f} onClick={() => onPlay(i)}
            className={`grid aspect-[3/4] w-[72px] place-items-center rounded-2xl border-2 p-1 transition sm:w-24 ${fossil ? "bg-[#f3e6cf]" : "bg-gradient-to-br from-[#6b5435] to-[#2f2417] enabled:hover:-translate-y-0.5"} ${own === "1" ? "border-[#e0475e]" : own === "2" ? "border-[#3b8fe8]" : "border-white/10"}`}>
            {fossil ? (
              <span className="flex flex-col items-center">
                <span className="block size-12 sm:size-16" dangerouslySetInnerHTML={{ __html: fossil.art }} />
                <b className="text-[10px] leading-tight text-[#3a2a17] sm:text-xs">{fossil.name}</b>
              </span>
            ) : <span className="font-display text-2xl font-extrabold text-[#f3d27a]/70">?</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Score chip: token + name + score. */
export function ScoreChip({ p, name, n, sub, active, right, game }: { p: Seat; name: string; n: number; sub?: string; active: boolean; right?: boolean; game: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2 transition ${right ? "flex-row-reverse text-right" : ""} ${active ? "border-gold/60 bg-gold/10" : "border-line bg-[var(--panel)]"}`} data-testid={`score-${p}`}>
      <span className="shrink-0">{game === "connect4" ? <Disc p={p} size={30} /> : <GemToken p={p} size={34} />}</span>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-muted">{name}{sub ? ` · ${sub}` : ""}</div>
        <div className="font-display text-2xl font-extrabold leading-none">{n}</div>
      </div>
    </div>
  );
}
