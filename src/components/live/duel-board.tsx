"use client";

// ── wave-live ── Partner leaderboard (this term): wins in partner games where both players were logged in.
import { useEffect, useState } from "react";
import { dbReady } from "@/lib/db";
import { duelBoard, type DuelBoardRow } from "@/lib/live";

const NAMES: Record<string, string> = { tictactoe: "Tic-Tac-Toe", connect4: "Connect 4", battleship: "Core Sample Hunt", dots: "Dots & Boxes", memory: "Fossil Memory" };

export function DuelBoard({ limit = 10 }: { limit?: number }) {
  const [rows, setRows] = useState<DuelBoardRow[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (dbReady) duelBoard().then(setRows).catch((e) => setErr(e.message)); }, []);
  return (
    <section className="block-panel p-5" data-testid="duel-board">
      <h2 className="font-display text-2xl font-extrabold">🤝 Partner leaderboard</h2>
      <p className="mt-1 text-sm text-muted">Wins in Partner Games this term. A round counts when both players are logged in.</p>
      {err ? <p className="mt-3 text-sm text-muted">The leaderboard isn&apos;t available yet.</p>
        : !rows ? <p className="mt-3 text-sm text-muted">{dbReady ? "Loading…" : "Appears once the class database is connected."}</p>
        : !rows.length ? <p className="mt-3 text-sm text-muted">No ranked partner games yet. Log in and challenge a classmate!</p>
        : (
          <ol className="mt-3 space-y-1.5">
            {rows.slice(0, limit).map((r, i) => (
              <li key={r.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-line bg-[var(--panel)] px-3 py-2">
                <span className="text-center font-display font-extrabold text-muted">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                <span className="min-w-0"><b className="block truncate">{r.name} <span className="text-xs font-semibold text-muted">{r.period}</span></b>
                  <span className="block truncate text-xs text-muted">{Object.entries(r.games).filter(([, v]) => v.wins).map(([g, v]) => `${NAMES[g] ?? g} ${v.wins}`).join(" · ") || "—"}</span></span>
                <span className="text-right font-display font-extrabold text-gold">{r.wins} win{r.wins === 1 ? "" : "s"}<span className="block text-[11px] font-sans font-semibold text-muted">{r.plays} played</span></span>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}
