// ── wave-live ── the Partner Games lineup (routes /partner/<slug>/). Two players: vs the computer, on one device,
// or on two devices with a 4-letter game code (supabase/migrations/006_live.sql).
import type { DuelGame } from "@/lib/live";

export type PartnerMeta = { slug: string; game: DuelGame; title: string; emoji: string; color: string; blurb: string; how: string; local: boolean };

export const partnerGames: PartnerMeta[] = [
  { slug: "tic-tac-toe", game: "tictactoe", title: "Tic-Tac-Toe", emoji: "💎", color: "#e0475e", local: true,
    blurb: "Star Garnet vs. Sapphire. Get three gems in a row.", how: "Take turns placing your gem. Three in a row (across, down or diagonal) wins." },
  { slug: "connect-4", game: "connect4", title: "Connect 4", emoji: "🌋", color: "#f2542d", local: true,
    blurb: "Magma vs. Sulfur. Drop four in a row before your partner does.", how: "Drop a disc into a column. It falls to the lowest open spot. Connect four across, down or diagonal." },
  { slug: "core-sample-hunt", game: "battleship", title: "Core Sample Hunt", emoji: "⛏️", color: "#f6c453", local: true,
    blurb: "Battleship for prospectors: hide 5 ore deposits, then drill to find your partner's.", how: "Hide your 5 deposits (4, 3, 3, 2, 2 plots, never touching). Take turns drilling one plot. Find every plot of all 5 deposits to win." },
  { slug: "dots-and-boxes", game: "dots", title: "Dots & Boxes", emoji: "🗺️", color: "#3b8fe8", local: true,
    blurb: "Stake survey claims: close a box to claim it and go again.", how: "Take turns drawing a line between two dots. Close the 4th side of a box to claim it and go again. Most claims wins." },
  { slug: "fossil-memory", game: "memory", title: "Fossil Memory", emoji: "🦴", color: "#d4a373", local: false,
    blurb: "Flip two cards and match fossil pairs, from trilobites to the Hagerman Horse.", how: "Flip two cards. A match is yours and you go again; a miss passes the turn. Most pairs wins." },
];
export const partnerBySlug = (s: string) => partnerGames.find((g) => g.slug === s);
export const partnerByGame = (g: string) => partnerGames.find((x) => x.game === g);
