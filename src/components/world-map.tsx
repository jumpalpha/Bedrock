"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import { realms, realmTasks } from "@/data/site";
import { useProgress } from "@/lib/progress";

export function WorldMap() {
  const { stats } = useProgress();
  const clearedSet = new Set(stats.cleared.map((r) => r.n));
  const current = realms.find((r) => !clearedSet.has(r.n))?.n ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {realms.map((r) => {
        const tasks = realmTasks(r);
        const doneN = tasks.filter((t) => stats.done.has(t.key)).length;
        const state = clearedSet.has(r.n) ? "cleared" : r.n === current ? "current" : "locked";
        return (
          <Link key={r.n} href={`/realms/${r.n}/`} style={{ "--accent": r.color } as CSSProperties}
            className={`group relative flex min-h-44 flex-col overflow-hidden border-[3px] p-4 transition-transform hover:-translate-y-1 ${
              state === "cleared" ? "border-emerald shadow-[0_0_0_3px_#000,0_0_24px_4px_rgb(34_197_94/0.55)]"
              : state === "current" ? "border-gold shadow-[0_0_0_3px_#000,6px_6px_0_3px_#000]"
              : "border-dashed border-stone opacity-80 hover:opacity-100"}`}>
            <span className="tex absolute inset-0" style={{ backgroundImage: `url(/tex/${r.tex}.svg)`, backgroundSize: "40px 40px", opacity: state === "locked" ? 0.35 : 0.9 }} />
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
            <div className="relative flex items-start justify-between">
              <span className="grid size-11 place-items-center border-[3px] border-black bg-black/40 font-pixel text-sm text-white">{r.n}</span>
              {state === "cleared" && <span className="border-2 border-black bg-emerald px-2 py-0.5 font-pixel text-[9px] text-black">CLEARED</span>}
              {state === "current" && <span className="animate-bob border-2 border-black bg-gold px-2 py-0.5 font-pixel text-[9px] text-black">YOU ARE HERE</span>}
              {state === "locked" && <span className="inline-flex items-center gap-1 font-pixel text-[9px] text-white/80"><Lock className="size-3" /> LOCKED</span>}
            </div>
            <div className="relative mt-auto pt-6 text-white">
              <div className="text-2xl">{r.icon}</div>
              <h3 className="pixel-title text-2xl leading-tight [text-shadow:2px_2px_0_#000]">{r.name}</h3>
              <div className="mt-1 text-xs font-extrabold text-white/85 [text-shadow:1px_1px_0_#000]">
                Ch {r.chapters[0]}–{r.chapters[1]} · {r.biome} · {doneN}/{tasks.length} tasks
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
