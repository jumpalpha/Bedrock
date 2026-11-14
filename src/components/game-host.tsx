"use client";

import { ArcadeGame } from "@/games/engine/arcade-game";
import { arcadeRegistry } from "@/games/registry";

export function GameHost({ slug }: { slug: string }) {
  const game = arcadeRegistry[slug];
  if (!game) return null;
  return <ArcadeGame game={game} />;
}
