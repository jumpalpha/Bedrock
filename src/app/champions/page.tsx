"use client";
// ── wave-pet: Hall of Champions (Dopps Class leaderboard.html "Hall of Heroes" + home champions) ──
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { champions, dbReady, type Champion } from "@/lib/db";
import { ranks } from "@/data/site";
import { PageHead } from "@/components/ui";
import { ChampionsStrip } from "@/components/champions-strip";
import { DuelBoard } from "@/components/live/duel-board"; // wave-live

export default function Hall() {
  const [rows, setRows] = useState<Champion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [at, setAt] = useState<Date | null>(null);
  const load = useCallback(() => {
    if (!dbReady) return;
    champions().then((r) => { setRows(r); setErr(null); setAt(new Date()); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000); return () => clearInterval(t); }, [load]);
  const periods = useMemo(() => [...new Set((rows ?? []).map((r) => r.period))].sort(), [rows]);
  const list = (rows ?? []).filter((r) => (period === "all" || r.period === period) && (showAll || r.xp > 0 || r.days > 0));
  const pod = [list[1], list[0], list[2]];

  return (
    <>
      <PageHead eyebrow="Hall of Champions" title={<>The greatest <span className="text-gradient">miners</span> of Bedrock</>}
        sub="Ranked by Verified XP: tasks the class database graded itself (chapter quizzes, unit tests and Classwork, 25 XP each). Quest XP adds reading, Think Like a Scientist, login days and side quests. XP from live class games counts in both." />
      <div className="mx-auto max-w-7xl space-y-8 px-4 pb-10 sm:px-6">
        {!dbReady && <p className="block-panel p-4 font-bold">Preview: champions appear once the class database is connected.</p>}
        {err && <p className="block-panel p-4 font-bold text-crimson">Could not load the Hall: {err}</p>}

        <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
          {pod.map((s, j) => {
            const place = [2, 1, 3][j];
            return (
              <div key={j} className={`block-panel p-3 text-center sm:p-5 ${place === 1 ? "!border-gold pb-8 sm:pb-12" : place === 2 ? "pb-5" : ""}`}>
                <div className="text-3xl sm:text-4xl">{["🥇", "🥈", "🥉"][place - 1]}</div>
                <div className="mt-1 truncate font-display text-base font-extrabold sm:text-xl">{s?.name ?? "—"}</div>
                <div className="truncate text-xs font-bold text-muted">{s ? s.period : ""}</div>
                <div className="mt-1 font-display text-sm font-extrabold text-gold sm:text-lg">{s ? `${s.verified_xp.toLocaleString()} XP` : "—"}</div>
                {s && <div className="truncate text-[11px] font-bold text-muted">⛏ {ranks[Math.min(s.cleared, ranks.length - 1)].name}</div>}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["all", ...periods].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`rounded-full border px-3.5 py-1.5 text-sm font-extrabold ${period === p ? "border-gold bg-gold/15" : "border-line"}`}>{p === "all" ? "All periods" : p}</button>
          ))}
          <button onClick={load} className="ml-auto inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm font-bold"><RefreshCw className="size-3.5" /> Refresh</button>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-muted"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-4" /> Show students with no progress yet</label>

        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="w-12 p-3 text-center">#</th><th className="p-3">Miner</th><th className="p-3">Period</th><th className="p-3" title="Graded by the database">Verified XP</th><th className="p-3">Quest XP</th><th className="p-3">Rank</th><th className="p-3">Streak</th></tr>
            </thead>
            <tbody>
              {rows === null && dbReady ? <tr><td colSpan={7} className="p-6 text-center text-muted">⛏ Digging up champions…</td></tr>
                : list.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted">{showAll ? "No students in this group yet." : "No progress yet in this group. Tick the box to see everyone."}</td></tr>
                : list.map((s, i) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="p-3 text-center font-extrabold">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                    <td className="p-3 font-extrabold">{s.name}</td>
                    <td className="p-3 text-xs text-muted">{s.period}</td>
                    <td className="p-3 font-display font-extrabold text-emerald">{s.verified_xp.toLocaleString()}{s.units > 0 && <span className="ml-1 font-sans text-[11px] text-muted">🏆{s.units}</span>}</td>
                    <td className="p-3 text-muted">{s.xp.toLocaleString()}</td>
                    <td className="p-3 font-bold">{ranks[Math.min(s.cleared, ranks.length - 1)].name}</td>
                    <td className={`p-3 font-bold ${s.streak ? "text-emerald" : "text-muted"}`}>{s.streak ? `🔥 ${s.streak}` : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {/* ── wave-live ── */}<DuelBoard />
        {at && <p className="text-center text-xs text-muted">Updated {at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · refreshes every 5 minutes</p>}

        <section>
          <h2 className="pixel-title mb-4 text-2xl">This week&apos;s champions</h2>
          <ChampionsStrip />
          <p className="mt-3 text-sm text-muted">Looking for the rock aliens? <Link href="/pets/" className="font-bold underline">Open the Alien Gallery</Link>.</p>
        </section>
      </div>
    </>
  );
}
// ── end wave-pet ──
