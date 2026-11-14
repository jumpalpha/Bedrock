"use client";

import Link from "next/link";
import { useState } from "react";
import { allTasks, rankTexture } from "@/data/site";
import { useProgress } from "@/lib/progress";
import { LoginDialog } from "@/components/login";

export function PlayerCard() {
  const { student, ready, stats, error } = useProgress();
  const [login, setLogin] = useState(false);
  const next = allTasks.find((t) => !stats.done.has(t.key));
  const pct = Math.round((stats.xp / Math.max(stats.maxXp, 1)) * 100);

  return (
    <div className="block-panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
      <div className="tex size-24 shrink-0 border-[3px] border-black" style={{ backgroundImage: `url(/tex/${rankTexture(stats.rankIndex)}.svg)`, backgroundSize: "48px 48px" }} aria-hidden />
      <div className="min-w-0 flex-1">
        {ready && student ? (
          <>
            <div className="pixel-title text-2xl sm:text-3xl">Welcome back, {student.name}.</div>
            <div className="mt-1 font-extrabold text-muted">Rank: <span className="text-fg">{stats.rank.name}</span> · {stats.rank.flavor}</div>
          </>
        ) : (
          <>
            <div className="pixel-title text-2xl sm:text-3xl">You just spawned.</div>
            <div className="mt-1 font-extrabold text-muted">Log in to save XP, climb from Dirt Digger to Diamond, and earn realm badges.</div>
          </>
        )}
        {error && <div className="mt-1 text-sm font-bold text-crimson">{error}</div>}
        <div className="mt-3 text-sm font-bold">
          Today: {next ? <Link href={next.href} className="underline decoration-grass decoration-2 underline-offset-4">{next.label}</Link> : "every task is done. Legend."} · <Link href="/survey/" className="underline decoration-gold decoration-2 underline-offset-4">Survey of the Day</Link> is open.
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs font-extrabold">
            <span>XP {stats.xp.toLocaleString()}</span>
            <span className="text-muted">{stats.next ? `Next rank: ${stats.next.name} (clear the next realm)` : "Max rank"}</span>
          </div>
          <div className="xp-bar"><div className="xp-fill" style={{ width: `${Math.max(pct, 1)}%` }} /></div>
        </div>
      </div>
      {ready && !student && <button onClick={() => setLogin(true)} className="btn-block btn-grass shrink-0">Log in / Join</button>}
      {login && <LoginDialog onClose={() => setLogin(false)} />}
    </div>
  );
}
