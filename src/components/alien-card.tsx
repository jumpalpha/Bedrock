"use client";
// ── wave-pet: "My rock alien" card for the Quest page (Dopps Class quest.html sprite card) ──
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { dbReady, petGet, useStudent, type Pet } from "@/lib/db";
import { MOOD_TEXT, stageInfo, STAGES } from "@/data/pet";
import { Alien } from "@/components/alien";

export function AlienCard({ cleared }: { cleared: number }) {
  const { student } = useStudent();
  const [pet, setPet] = useState<Pet | null | undefined>(undefined);
  useEffect(() => { if (student && dbReady) petGet().then(setPet).catch(() => setPet(undefined)); }, [student, cleared]);
  const next = STAGES.find((s) => s.key !== "geode" && s.realms > cleared);
  return (
    <Link href="/pet/" aria-label="Go to my rock alien" className="accent-card group flex items-center gap-4 rounded-2xl p-4" style={{ "--accent": "#a78bfa" } as React.CSSProperties}>
      <Alien a={pet ?? { stage: "geode", color: "amethyst", alive: true }} size={96} anim={!!pet} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted">My rock alien</div>
        <div className="truncate font-display text-xl font-extrabold">{pet ? `${pet.name} · ${stageInfo(pet.stage).name}` : pet === null ? "Adopt your rock alien" : "A geode crash-landed…"}</div>
        <div className="text-sm text-muted">{pet ? (pet.stage === "geode" ? "Waiting to crack open." : MOOD_TEXT[pet.alive ? pet.mood_label : "dormant"](pet.name)) : "Name it, teach it words, and evolve it through the rock cycle."}
          {pet && next ? ` Clearing realms evolves it: ${next.name} at ${next.realms}.` : ""}</div>
        {pet && <div className="mt-1 text-xs font-bold text-gold">💎 {pet.crystals} crystals · ❤️ {pet.health} · 🔥 {pet.streak}</div>}
      </div>
      <ArrowRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-1" />
    </Link>
  );
}
// ── end wave-pet ──
