"use client";

import { ArcadeGame } from "@/games/engine/arcade-game";
import { arcadeRegistry } from "@/games/registry";
// ── wave-arcadeA ──
import { arcadeComponents } from "@/games/registry";
// ── end wave-arcadeA ──

export function GameHost({ slug }: { slug: string }) {
  // ── wave-arcadeA ──
  const Custom = arcadeComponents[slug];
  if (Custom) return <Custom />;
  // ── end wave-arcadeA ──
  const game = arcadeRegistry[slug];
  if (!game) return null;
  return <ArcadeGame game={game} />;
}
