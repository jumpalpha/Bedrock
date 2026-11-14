// Classic Arcade: Dopps Class arcade games that were never rebuilt in Next.js, brought over as static pages
// under public/classic-games/<slug>.html (rethemed to Earth science, best scores saved locally only).
export type ClassicGame = { slug: string; title: string; subtitle: string; emoji: string; color: string; href: string };

export const classicGames: ClassicGame[] = [
  {
    slug: "gold-rush",
    title: "Gold Rush",
    subtitle: "Answer Earth science questions to pan for gold, buy mining gear, and strike $5,000 in 7 minutes.",
    emoji: "⛏️",
    color: "#F6C453",
    href: "/classic-games/gold-rush.html",
  },
];
