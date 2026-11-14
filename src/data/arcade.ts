// The Sprite Arcade lineup. Kept free of game code so any page (e.g. home) can list the cards cheaply.
// Cover art lives at /art/game-<slug>.png; cards fall back to the emoji while it's missing.
export type ArcadeGame = {
  slug: string; title: string; subtitle: string; emoji: string; color: string; goal: string;
  section?: "classic" | "team" | "partner" | "classroom"; // wave-arcadeB: which arcade shelf (none = Sprite Arcade)
};

export const arcadeGames: ArcadeGame[] = [
  { slug: "sprite-flap", title: "Sprite Flap", subtitle: "Fly through the volcanic vents!", emoji: "🌋", color: "#FF8C42", goal: "Score 15" },
  { slug: "sprite-dash", title: "Sprite Dash", subtitle: "Race across the Snake River Plain!", emoji: "☄️", color: "#FCD34D", goal: "Reach 1,000" },
  { slug: "sprite-run", title: "Sprite Run", subtitle: "Outrun the landslide!", emoji: "🪨", color: "#A78BFA", goal: "Run 1,000 m" },
  { slug: "sprite-snake", title: "Sprite Snake", subtitle: "Mine a chain of crystals!", emoji: "💎", color: "#22C55E", goal: "Score 150" },
  { slug: "sprite-sling", title: "Sprite Slingshot", subtitle: "Launch at the boulder fort!", emoji: "🎯", color: "#38BDF8", goal: "Clear 3 levels" },
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
