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
};

// ── wave-arcadeA ──
// slug -> games that bring their own React UI around the engine (question cards, shops, chapter pickers),
// like Dopps' { component } registry entries. GameHost checks this before arcadeRegistry.
export const arcadeComponents: Record<string, ComponentType> = {
  "sprite-siege": SpriteSiege,
  "how-smart": HowSmart,
  "vocab-slice": VocabSlice,
};
// ── end wave-arcadeA ──
