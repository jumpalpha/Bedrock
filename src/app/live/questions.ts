// ── wave-live ── question sources for the live games. Public data only: the review bank (src/data/review.ts),
// the glossary and the Pick a Side debates. Never questions.json (graded keys live only in the database).
import glossary from "@/data/content/glossary.json";
import pickASide from "@/data/content/pick_a_side.json";
import { asChoices, reviewFor } from "@/data/review";
import { chapters } from "@/data/site";
import { LETTERS } from "@/components/live/shared";

export const liveChapters = chapters.filter((c) => !c.bonus).map((c) => ({ n: c.n, title: c.title }));

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
const range = (a: number, b: number) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);

export type SdQuestion = { ch: number; prompt: string; opts: string[]; key: string; answer: string; why?: string };

/** Showdown / Raid questions. "review" = the review bank; "vocab" = a glossary definition, pick the key word. */
export function buildShowdown(from: number, to: number, count: number, source: "review" | "vocab"): SdQuestion[] {
  const chs = range(from, to);
  if (source === "review") {
    return shuffle(reviewFor(chs)).slice(0, count).map((q) => {
      const opts = asChoices(q);
      return { ch: Number(q.id.slice(1, 3)), prompt: q.q, opts, key: LETTERS[opts.indexOf(q.a)], answer: q.a, why: q.why };
    });
  }
  const G = glossary as { term: string; definition: string; chapter: number }[];
  const pool = G.filter((g) => chs.includes(g.chapter));
  return shuffle(pool).slice(0, count).map((t) => {
    const same = G.filter((x) => x.chapter === t.chapter && x.term.toLowerCase() !== t.term.toLowerCase());
    const others = shuffle(same.length >= 3 ? same : G.filter((x) => x.term !== t.term)).slice(0, 3).map((x) => x.term);
    const opts = shuffle([t.term, ...others]);
    const re = new RegExp(t.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const def = t.definition.replace(re, "_____");
    return { ch: t.chapter, prompt: `“${def.charAt(0).toUpperCase()}${def.slice(1)}”`, opts, key: LETTERS[opts.indexOf(t.term)], answer: t.term };
  });
}

/** Gold Rush Live bank: every review question in the chapters. */
export function buildGoldRushBank(from: number, to: number) {
  return reviewFor(range(from, to)).map((q) => ({ ch: Number(q.id.slice(1, 3)), prompt: q.q, choices: [q.a, ...q.wrong], answer: q.a, why: q.why }));
}

export type Debate = { id: string; chapter: number; question: string; sideA: string; sideB: string; rating: "Green" | "Yellow" | "Red" };
export const debates = (pickASide as unknown as { debates: Debate[] }).debates;

/** Realm Raid bosses, by the first chapter in the raid. */
export const BOSSES = [
  { upTo: 3, name: "The Compass Golem", body: "#8d9a6a", horn: "#4f5a32" },
  { upTo: 7, name: "The Crystal Hydra", body: "#a78bfa", horn: "#5b3db0" },
  { upTo: 11, name: "The Dust Devil", body: "#d9a45b", horn: "#8a5a1c" },
  { upTo: 16, name: "The Magma Titan", body: "#f2683d", horn: "#8f240c" },
  { upTo: 18, name: "The Trench Kraken", body: "#2fb5c9", horn: "#13606d" },
  { upTo: 22, name: "The Storm Wyrm", body: "#7aa2f7", horn: "#2f4f9c" },
  { upTo: 24, name: "The Fossil Rex", body: "#d4b58a", horn: "#7a5a33" },
  { upTo: 26, name: "The Smog Phantom", body: "#9aa3b5", horn: "#4b5263" },
  { upTo: 28, name: "The Comet Colossus", body: "#c084fc", horn: "#6b21a8" },
];
export const bossFor = (ch: number) => BOSSES.find((b) => ch <= b.upTo) ?? BOSSES[BOSSES.length - 1];
