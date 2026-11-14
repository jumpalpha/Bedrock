"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { bonusBadges, ranks, rankTexture, realms, realmTasks, SIDE_QUESTS_PER_TERM, XP_PER_DAY, XP_PER_SIDE_QUEST, XP_PER_TASK } from "@/data/site";
import { useProgress } from "@/lib/progress";
import { dbReady } from "@/lib/db";
import { Eyebrow, PageHead } from "@/components/ui";
import { PlayerCard } from "@/components/player-card";
import { TaskList } from "@/components/task-list";
import { AlienCard } from "@/components/alien-card"; // ── wave-pet ──
import { BeReadyCard } from "@/components/twinA/ready-card"; // ── wave-twinA ──

export default function Quest() {
  const { stats, state } = useProgress();
  const cleared = new Set(stats.cleared.map((r) => r.n));
  return (
    <>
      <PageHead eyebrow="My Quest" title="Mine your way to Diamond"
        sub={`${XP_PER_TASK} XP per task, ${XP_PER_DAY} XP for every day you log in, ${XP_PER_SIDE_QUEST} XP per approved side quest, plus XP from live class games. Clear a realm to rank up.`}>
        <div className="mt-8"><PlayerCard /></div>
        {/* ── wave-pet ── */}<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><AlienCard cleared={stats.cleared.length} /><Link href="/champions/" className="accent-card flex items-center justify-center gap-2 rounded-2xl p-4 font-extrabold" style={{ "--accent": "#f6c453" } as React.CSSProperties}>🏆 Hall of Champions</Link></div>
      </PageHead>
      <div className="mx-auto max-w-7xl space-y-14 px-6 pt-12">
        {!dbReady && <p className="block-panel p-4 font-bold">Preview: saving progress turns on once the class database is connected.</p>}

        {/* ── wave-live ── */}
        {stats.gameXp > 0 && (
          <section className="block-panel grid items-center gap-3 p-5 sm:grid-cols-[auto_1fr_auto] sm:gap-4" data-testid="game-xp">
            <span className="text-4xl">⚔️</span>
            <div className="min-w-0"><div className="font-display text-2xl font-extrabold">{stats.gameXp.toLocaleString()} XP from live games</div>
              <div className="text-sm text-muted">+5 for each right answer in Showdown, Realm Raid and Gold Rush Live, +25 for end-of-game wins. Already counted in your total.</div></div>
            <Link href="/live/" className="btn-block justify-self-start !text-sm">Join a live game</Link>
          </section>
        )}
        {/* ── end wave-live ── */}
        <section>
          <Eyebrow>Mining ranks</Eyebrow>
          <h2 className="pixel-title mb-5 text-3xl">Dirt Digger to Diamond</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ranks.map((r, i) => {
              const got = i <= stats.rankIndex;
              return (
                <div key={r.name} className={`block-panel p-3 text-center ${got ? "" : "opacity-55"}`}>
                  <div className="tex mx-auto size-14 rounded-xl border border-line" style={{ backgroundImage: `url(/tex/${rankTexture(i)}.svg)`, backgroundSize: "28px 28px" }} />
                  <div className="pixel-title mt-2 text-lg leading-tight">{r.name}</div>
                  <div className="mt-1 text-[11px] font-bold text-muted">{i === 0 ? "Start" : `${i} realm${i > 1 ? "s" : ""} cleared`}</div>
                  <div className="mt-1 text-[11px] italic text-muted">{r.flavor}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="badges" className="scroll-mt-24">
          <Eyebrow>Badges</Eyebrow>
          <h2 className="pixel-title mb-5 text-3xl">Realm badges</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
            {realms.map((r) => (
              <div key={r.n} className={`block-panel p-3 text-center ${cleared.has(r.n) ? "!border-emerald" : "opacity-60"}`}>
                <div className="text-3xl">{cleared.has(r.n) ? r.icon : <Lock className="mx-auto size-7 text-muted" />}</div>
                <div className="mt-1 text-sm font-extrabold leading-tight">{r.badge}</div>
                <div className="text-[11px] font-semibold text-muted">{r.name}</div>
              </div>
            ))}
          </div>
          <h3 className="pixel-title mb-4 mt-8 text-2xl">Bonus badges</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {bonusBadges.map((b) => {
              const tracked = b.badge in stats.bonus, got = stats.bonus[b.badge];
              return (
                <div key={b.badge} className={`block-panel p-4 ${got ? "!border-emerald" : "opacity-70"}`}>
                  <div className="font-extrabold">{got ? "🏅" : "🔒"} {b.badge}</div>
                  <div className="text-sm text-muted">{b.earnedBy}{!tracked && " (awarded by Mr. Dopp)"}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <Eyebrow>Side quests this term</Eyebrow>
          <p className="font-bold">{stats.termApproved} of {SIDE_QUESTS_PER_TERM} required side quests approved{state?.term ? ` for ${state.term}` : ""}. <Link href="/side-quests/" className="underline">Pick one</Link></p>
          {/* ── wave-twinA ── */}<BeReadyCard />
        </section>

        <section>
          <Eyebrow>Checklist</Eyebrow>
          <h2 className="pixel-title mb-5 text-3xl">Every task, every realm</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {realms.map((r) => (
              <div key={r.n} className="block-panel p-5">
                <div className="mb-3 flex items-center justify-between">
                  <Link href={`/realms/${r.n}/`} className="pixel-title text-xl hover:underline">{r.icon} {r.n}. {r.name}</Link>
                  <span className="font-pixel text-[9px] text-muted">{realmTasks(r).filter((t) => stats.done.has(t.key)).length}/{realmTasks(r).length}</span>
                </div>
                <TaskList realm={r} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
