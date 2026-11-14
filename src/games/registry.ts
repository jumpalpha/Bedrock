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
// ── wave-classroom ──
import { Game01Jeopardy } from "./classroom/game01_jeopardy";
import { Game02DealOrNoDeal } from "./classroom/game02_deal_or_no_deal";
import { Game03WheelOfFortune } from "./classroom/game03_wheel_of_fortune";
import { Game04Millionaire } from "./classroom/game04_millionaire";
import { Game05HotTakes } from "./classroom/game05_hot_takes";
import { Game06EscapeRoom } from "./classroom/game06_escape_room";
import { Game07Survivor } from "./classroom/game07_survivor";
import { Game08PriceIsRight } from "./classroom/game08_price_is_right";
import { Game09FamilyFeud } from "./classroom/game09_family_feud";
import { Game10Imposter } from "./classroom/game10_imposter";
import { Game11Taboo } from "./classroom/game11_taboo";
import { Game12WouldYouRather } from "./classroom/game12_would_you_rather";
import { Game13Pictionary } from "./classroom/game13_pictionary";
import { Game14SharkTank } from "./classroom/game14_shark_tank";
import { Game15MythBusters } from "./classroom/game15_myth_busters";
// ── end wave-classroom ──

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
  // ── wave-classroom ── (Dopps Class classroom / projector games, Earth science content)
  "bedrock-jeopardy": Game01Jeopardy,
  "deal-or-no-deal": Game02DealOrNoDeal,
  "wheel-of-fortune": Game03WheelOfFortune,
  "millionaire": Game04Millionaire,
  "hot-takes": Game05HotTakes,
  "escape-room": Game06EscapeRoom,
  "bedrock-survivor": Game07Survivor,
  "guess-the-number": Game08PriceIsRight,
  "earth-feud": Game09FamilyFeud,
  "earth-imposter": Game10Imposter,
  "earth-taboo": Game11Taboo,
  "would-you-rather": Game12WouldYouRather,
  "pictionary": Game13Pictionary,
  "shark-tank": Game14SharkTank,
  "myth-busters": Game15MythBusters,
  // ── end wave-classroom ──
};
