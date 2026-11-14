import type { GameModule } from "./engine/types";
import { spriteFlap } from "./sprite-flap";
import { spriteDash } from "./sprite-dash";
import { spriteRun } from "./sprite-run";
import { spriteSnake } from "./sprite-snake";
import { spriteSling } from "./sprite-sling";
// ── wave-arcadeA ──
import type { ComponentType } from "react";
import { spriteCatch } from "./sprite-catch";
import { spriteClimb } from "./sprite-climb";
import { spriteDodge } from "./sprite-dodge";
import { spriteHoops } from "./sprite-hoops";
import { spriteMaze } from "./sprite-maze";
import { spriteMemory } from "./sprite-memory";
import { spriteRider } from "./sprite-rider";
import { spriteSlice } from "./sprite-slice";
import { wordQuest } from "./word-quest";
import { SpriteSiege } from "./sprite-siege";
import { HowSmart } from "./how-smart";
import { VocabSlice } from "./vocab-slice";
// ── end wave-arcadeA ──
// ── wave-arcadeB ──
import { meteorInvaders } from "./wave-b/meteor-invaders";
import { quakeSweeper } from "./wave-b/quake-sweeper";
import { rockBreaker } from "./wave-b/rock-breaker";
import { hazardShowdown } from "./wave-b/hazard-showdown";
import { mineral2048 } from "./wave-b/mineral-2048";
import { strataStack } from "./wave-b/strata-stack";
import { blastBlocks } from "./wave-b/blast-blocks";
import { craterPong } from "./wave-b/crater-pong";
import { fieldTripDay } from "./wave-b/field-trip-day";
import { LavaSnipes } from "./wave-b/lava-snipes";
import { PlanetDefense } from "./wave-b/planet-defense";
import { FossilMemory } from "./wave-b/fossil-memory";
import { BedrockSpin } from "./wave-b/bedrock-spin";
import { TeamHangman } from "./wave-b/team-hangman";
// ── end wave-arcadeB ──

// slug (see src/data/arcade.ts) -> canvas game
export const arcadeRegistry: Record<string, GameModule> = {
  "sprite-flap": spriteFlap,
  "sprite-dash": spriteDash,
  "sprite-run": spriteRun,
  "sprite-snake": spriteSnake,
  "sprite-sling": spriteSling,
  // ── wave-arcadeA ──
  "sprite-catch": spriteCatch,
  "sprite-climb": spriteClimb,
  "sprite-dodge": spriteDodge,
  "sprite-hoops": spriteHoops,
  "sprite-maze": spriteMaze,
  "sprite-memory": spriteMemory,
  "sprite-rider": spriteRider,
  "sprite-slice": spriteSlice,
  "word-quest": wordQuest,
  // ── end wave-arcadeA ──
  // ── wave-arcadeB ──
  "meteor-invaders": meteorInvaders,
  "quake-sweeper": quakeSweeper,
  "rock-breaker": rockBreaker,
  "hazard-showdown": hazardShowdown,
  "mineral-2048": mineral2048,
  "strata-stack": strataStack,
  "blast-blocks": blastBlocks,
  "crater-pong": craterPong,
  "field-trip-day": fieldTripDay,
  // ── end wave-arcadeB ──
};

// slug -> games that bring their own React UI (question cards, shops, chapter pickers, team screens).
// GameHost checks this before arcadeRegistry.
export const arcadeComponents: Record<string, ComponentType> = {
  // ── wave-arcadeA ──
  "sprite-siege": SpriteSiege,
  "how-smart": HowSmart,
  "vocab-slice": VocabSlice,
  // ── wave-arcadeB ──
  "lava-snipes": LavaSnipes,
  "planet-defense": PlanetDefense,
  "fossil-memory": FossilMemory,
  "bedrock-spin": BedrockSpin,
  "team-hangman": TeamHangman,
};
