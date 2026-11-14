"use client";

import { ArcadeGame } from "@/games/engine/arcade-game";
import { arcadeRegistry, arcadeComponents } from "@/games/registry";

export function GameHost({ slug }: { slug: string }) {
  // ── wave-arcadeA ──
  const Custom = arcadeComponents[slug];
  if (Custom) return <Custom />;
  // ── end wave-arcadeA ──
  const game = arcadeRegistry[slug];
  // ── wave-arcadeB ──
  const Comp = arcadeComponents[slug];
  if (!game && Comp) return <Comp />;
  // ── end wave-arcadeB ──
  if (!game) return null;
  return <ArcadeGame game={game} />;
}
