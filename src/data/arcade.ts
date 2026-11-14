// The Sprite Arcade lineup. Kept free of game code so any page (e.g. home) can list the cards cheaply.
// Cover art lives at /art/game-<slug>.png; cards fall back to the emoji while it's missing.
export type ArcadeGame = {
  slug: string; title: string; subtitle: string; emoji: string; color: string; goal: string;
  // ── wave-arcadeA ── which arcade-page shelf the card sits on; no group = the Sprite Arcade posters
  group?: "classics" | "brain";
  section?: "classic" | "team" | "partner" | "classroom"; // wave-arcadeB: which arcade shelf (none = Sprite Arcade)
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
  // ── wave-arcadeB ──
  { slug: "meteor-invaders", title: "Meteor Invaders", subtitle: "Blast comets and space rocks. Beat 3 swarms!", emoji: "☄️", color: "#FF8C42", goal: "Beat 3 waves", section: "classic" },
  { slug: "rock-breaker", title: "Rock Breaker", subtitle: "Bounce a magma ball around the rock cycle.", emoji: "🧱", color: "#E8A33D", goal: "Clear 2 walls", section: "classic" },
  { slug: "field-trip-day", title: "Field Trip Day", subtitle: "Lava dash, boulder hurdles, scarp jump and more.", emoji: "🏅", color: "#FCD34D", goal: "3,000 all-around", section: "classic" },
  { slug: "hazard-showdown", title: "Hazard Showdown", subtitle: "Prepared or not? Which is safer? Myth or fact?", emoji: "⚖️", color: "#F25C45", goal: "Get 10 right", section: "classic" },
  { slug: "mineral-2048", title: "Mineral 2048", subtitle: "Merge minerals up the Mohs scale to diamond.", emoji: "💎", color: "#38BDF8", goal: "Reach 512 Corundum", section: "classic" },
  { slug: "strata-stack", title: "Strata Stack", subtitle: "Stack falling rock layers and clear 10 lines.", emoji: "🟫", color: "#C2703D", goal: "Clear 10 lines", section: "classic" },
  { slug: "crater-pong", title: "Crater Pong", subtitle: "Land a meteorite in 10 famous craters.", emoji: "🌑", color: "#A78BFA", goal: "Hit all 10 craters", section: "classic" },
  { slug: "planet-defense", title: "Planet Defense", subtitle: "Tower defense with Earth's atmosphere vs meteors and solar wind.", emoji: "🛡️", color: "#5EEAD4", goal: "Survive 10 waves", section: "classic" },
  { slug: "quake-sweeper", title: "Quake Sweeper", subtitle: "Minesweeper on a fault zone. Flag the hidden quakes!", emoji: "🫨", color: "#F6C453", goal: "Clear zone 1", section: "classic" },
  { slug: "blast-blocks", title: "Blast Blocks", subtitle: "Drag gem blocks, blast full rows and columns, chain combos!", emoji: "🧊", color: "#34D399", goal: "Score 2,000", section: "classic" },
  { slug: "lava-snipes", title: "Lava Snipes", subtitle: "Maze shooter: cap the lava vents with computer teammates, co-op or red vs. blue.", emoji: "🌋", color: "#FF6B3D", goal: "Cap every vent", section: "team" },
  { slug: "team-hangman", title: "Team Hangman", subtitle: "Hangman for 2–4 teams with Earth science words.", emoji: "🪢", color: "#84CC16", goal: "2–4 teams", section: "team" },
  { slug: "fossil-memory", title: "Fossil Memory", subtitle: "Match pairs of fossils, from trilobites to the Hagerman Horse.", emoji: "🦴", color: "#E9DCC2", goal: "Most pairs wins", section: "partner" },
  { slug: "bedrock-spin", title: "Bedrock Spin", subtitle: "Spin for a quick Earth science challenge to kick off or close class.", emoji: "🌀", color: "#F28C28", goal: "8 spins", section: "classroom" },
  // ── end wave-arcadeB ──
];

export const arcadeGame = (slug: string) => arcadeGames.find((g) => g.slug === slug);
