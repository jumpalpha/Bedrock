"use client";
// ── wave-twinA ── "Be Ready" side quests on My Quest: Quake Ready progress, the paper Family Disaster Plan, the Hazard PSA turn-in.
import Link from "next/link";
import { useEffect, useState } from "react";
import { dbReady, projectGet, psaMine, useStudent, type ProjectRow, type Psa } from "@/lib/db";
import { readLocal } from "@/lib/twinA-save";

export function BeReadyCard() {
  const { student, ready } = useStudent();
  const [quake, setQuake] = useState<{ steps: number; done: boolean; drill: boolean } | null>(null);
  const [psa, setPsa] = useState<Psa | null>(null);
  useEffect(() => {
    if (!ready) return;
    const fromData = (d: Record<string, unknown> | undefined, done: boolean, drill: boolean) =>
      setQuake({ steps: ["protect", "spot", "hold", "after", "quiz"].filter((k) => d?.[k]).length, done, drill });
    const local = readLocal("quake_ready");
    fromData(local?.data, !!local?.done, false);
    if (!student || !dbReady) return;
    projectGet("quake_ready").then((r: ProjectRow | null) => { if (r) fromData(r.data, !!r.done_at, r.drill_ok); }).catch(() => {});
    psaMine().then(setPsa).catch(() => {});
  }, [ready, student]);
  const tile = "accent-card flex flex-col rounded-2xl p-4";
  return (
    <div className="mt-4">
      <h3 className="pixel-title mb-3 text-xl">Be Ready side quests</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/quake-ready/" className={tile} style={{ "--accent": "#f28c28" } as React.CSSProperties}>
          <span className="font-extrabold">🌎 Quake Ready</span>
          <span className="mt-1 text-sm text-muted">{quake?.done ? "✓ Quest complete" : quake?.steps ? `${quake.steps} of 5 steps done` : "Drop, Cover, Hold On, then the quick check"}</span>
          {quake?.drill && <span className="mt-1 text-sm font-bold text-emerald">✓ Drill checked off by Mr. Dopp</span>}
        </Link>
        <Link href="/disaster-plan/" className={tile} style={{ "--accent": "#34d399" } as React.CSSProperties}>
          <span className="font-extrabold">🏠 Family Disaster Plan</span>
          <span className="mt-1 text-sm text-muted">4-day family project. Your map and plan card stay on paper at home.</span>
        </Link>
        <Link href="/hazard-psa/" className={tile} style={{ "--accent": "#f25c45" } as React.CSSProperties}>
          <span className="font-extrabold">🎬 Hazard PSA</span>
          <span className="mt-1 text-sm text-muted">{psa ? (psa.graded_at ? `Scored: ${psa.total} / 100` : `“${psa.title}” turned in`) : "Group video about a natural hazard"}</span>
        </Link>
      </div>
    </div>
  );
}
