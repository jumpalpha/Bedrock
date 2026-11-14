// The Sprite Arcade lineup. Kept free of game code so any page (e.g. home) can list the cards cheaply.
// Cover art lives at /art/game-<slug>.png; cards fall back to the emoji while it's missing.
export type ArcadeGame = {
  slug: string; title: string; subtitle: string; emoji: string; color: string; goal: string;
  // ── wave-arcadeA ── which arcade-page shelf the card sits on; no group = the Sprite Arcade posters
  group?: "classics" | "brain";
};

export const arcadeGames: ArcadeGame[] = [
  { slug: "sprite-flap", title: "Sprite Flap", subtitle: "Fly through the volcanic vents!", emoji: "🌋", color: "#FF8C42", goal: "Score 15" },
  { slug: "sprite-dash", title: "Sprite Dash", subtitle: "Race across the Snake River Plain!", emoji: "☄️", color: "#FCD34D", goal: "Reach 1,000" },
  { slug: "sprite-run", title: "Sprite Run", subtitle: "Outrun the landslide!", emoji: "🪨", color: "#A78BFA", goal: "Run 1,000 m" },
  { slug: "sprite-snake", title: "Sprite Snake", subtitle: "Mine a chain of crystals!", emoji: "💎", color: "#22C55E", goal: "Score 150" },
  { slug: "sprite-sling", title: "Sprite Slingshot", subtitle: "Launch at the boulder fort!", emoji: "🎯", color: "#38BDF8", goal: "Clear 3 levels" },
  // ── wave-arcadeA ──
  { slug: "sprite-catch", title: "Sprite Catch", subtitle: "Catch falling crystals. Dodge the meteors, build combos!", emoji: "🧺", color: "#C48CFF", goal: "Score 1,000", group: "classics" },
  { slug: "sprite-slice", title: "Sprite Slice", subtitle: "Swipe to split flying space rocks. Don't slice the lava bombs!", emoji: "☄️", color: "#FF8C42", goal: "Score 800", group: "classics" },
  { slug: "sprite-maze", title: "Sprite Maze", subtitle: "Collect groundwater, dodge hazards. Star garnets turn the tables!", emoji: "💧", color: "#22D3EE", goal: "Clear the maze", group: "classics" },
  { slug: "sprite-climb", title: "Sprite Climb", subtitle: "Jump rolling boulders and climb to the Golden Geode!", emoji: "🧗", color: "#FCD34D", goal: "Grab the Golden Geode", group: "classics" },
  { slug: "sprite-dodge", title: "Sprite Dodge", subtitle: "The Magma King hurls lava bombs. Survive 60 seconds!", emoji: "👑", color: "#F25C45", goal: "Survive 60s", group: "classics" },
  { slug: "sprite-hoops", title: "Sprite Hoops", subtitle: "Toss rock samples into the bucket. Sink 7 of 10!", emoji: "🪣", color: "#F28C28", goal: "Sink 7 of 10", group: "classics" },
  { slug: "sprite-rider", title: "Sprite Rider", subtitle: "Dirt-bike Idaho's hills, ramps and lava fields!", emoji: "🏍️", color: "#84CC16", goal: "Finish track 1", group: "classics" },
  { slug: "sprite-memory", title: "Sprite Memory", subtitle: "Flip cards and match Earth science pairs before time runs out.", emoji: "🃏", color: "#A78BFA", goal: "Clear 2 levels", group: "classics" },
  { slug: "sprite-siege", title: "Sprite Siege", subtitle: "Defend your base from Earth's hazards. Answer questions for diamonds!", emoji: "🛡️", color: "#38BDF8", goal: "Reach wave 20", group: "classics" },
  { slug: "how-smart", title: "How Smart Am I?", subtitle: "Questions get harder when you're right. 3rd grade to grad school.", emoji: "🎓", color: "#F6C453", goal: "Beat a 10th grader", group: "brain" },
  { slug: "word-quest", title: "Word Quest", subtitle: "Guess the 5-letter Earth science word in 6 tries.", emoji: "🔤", color: "#34D399", goal: "Solve 3 words", group: "brain" },
  { slug: "vocab-slice", title: "Vocab Slice", subtitle: "Read the definition, slice the rock with the matching term.", emoji: "💎", color: "#5EEAD4", goal: "Match 10 terms", group: "brain" },
  // ── end wave-arcadeA ──
];

export const arcadeGame = (slug: string) => arcadeGames.find((g) => g.slug === slug);
