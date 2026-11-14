import type { GameModule } from "./engine/types";
import { spriteFlap } from "./sprite-flap";
import { spriteDash } from "./sprite-dash";
import { spriteRun } from "./sprite-run";
import { spriteSnake } from "./sprite-snake";
import { spriteSling } from "./sprite-sling";

// slug (see src/data/arcade.ts) -> canvas game
export const arcadeRegistry: Record<string, GameModule> = {
  "sprite-flap": spriteFlap,
  "sprite-dash": spriteDash,
  "sprite-run": spriteRun,
  "sprite-snake": spriteSnake,
  "sprite-sling": spriteSling,
};
