"use client";

import { ArcadeGame } from "@/games/engine/arcade-game";
import { arcadeRegistry, arcadeComponents } from "@/games/registry"; // wave-arcadeB: arcadeComponents

export function GameHost({ slug }: { slug: string }) {
  const game = arcadeRegistry[slug];
  // ── wave-arcadeB ──
  const Comp = arcadeComponents[slug];
  if (!game && Comp) return <Comp />;
  // ── end wave-arcadeB ──
  if (!game) return null;
  return <ArcadeGame game={game} />;
}
