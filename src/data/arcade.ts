// The Sprite Arcade lineup. Kept free of game code so any page (e.g. home) can list the cards cheaply.
// Cover art lives at /art/game-<slug>.png; cards fall back to the emoji while it's missing.
export type ArcadeGame = { slug: string; title: string; subtitle: string; emoji: string; color: string; goal: string };

export const arcadeGames: ArcadeGame[] = [
  { slug: "sprite-flap", title: "Sprite Flap", subtitle: "Fly through the volcanic vents!", emoji: "🌋", color: "#FF8C42", goal: "Score 15" },
  { slug: "sprite-dash", title: "Sprite Dash", subtitle: "Race across the Snake River Plain!", emoji: "☄️", color: "#FCD34D", goal: "Reach 1,000" },
  { slug: "sprite-run", title: "Sprite Run", subtitle: "Outrun the landslide!", emoji: "🪨", color: "#A78BFA", goal: "Run 1,000 m" },
  { slug: "sprite-snake", title: "Sprite Snake", subtitle: "Mine a chain of crystals!", emoji: "💎", color: "#22C55E", goal: "Score 150" },
  { slug: "sprite-sling", title: "Sprite Slingshot", subtitle: "Launch at the boulder fort!", emoji: "🎯", color: "#38BDF8", goal: "Clear 3 levels" },
];

export const arcadeGame = (slug: string) => arcadeGames.find((g) => g.slug === slug);
