// Word/definition questions for the wave-B arcade games (Planet Defense quiz breaks, Team Hangman words).
// Built from the public glossary. HOOK: when src/data/content/review.json lands, add review-question support
// here (prefer it for reviewQuestion) — the games only call the functions below.
// Never import src/data/content/questions.json here: graded answer keys must stay out of the site.
import glossary from "@/data/content/glossary.json";
import { chapters } from "@/data/site";

type Entry = { term: string; definition: string; chapter: number };
const GLOSSARY = glossary as Entry[];

export const chapterTitle = (n: number) => chapters.find((c) => c.n === n)?.title ?? `Chapter ${n}`;

const byChapter = new Map<number, Entry[]>();
GLOSSARY.forEach((e) => { if (!byChapter.has(e.chapter)) byChapter.set(e.chapter, []); byChapter.get(e.chapter)!.push(e); });

export type Quest = { ch: number; title: string; term: string; prompt: string; opts: string[] };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** "Which word fits this definition?" with 4 choices from the same chapter. Half the time from `focus` chapters. */
export function glossaryQuestion(focus: number[] = []): Quest | null {
  const all = [...byChapter.keys()].filter((k) => byChapter.get(k)!.length >= 4);
  if (!all.length) return null;
  const f = focus.filter((c) => all.includes(c));
  const ch = Math.random() < 0.5 && f.length ? pick(f) : pick(all);
  const terms = byChapter.get(ch)!, right = pick(terms);
  const others = shuffle(terms.filter((t) => t.term.toLowerCase() !== right.term.toLowerCase())).slice(0, 3);
  const re = new RegExp(right.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
  const def = right.definition.replace(re, "_____");
  return { ch, title: chapterTitle(ch), term: right.term, prompt: def.charAt(0).toUpperCase() + def.slice(1), opts: shuffle([right, ...others]).map((t) => t.term) };
}

/** Glossary words grouped by chapter, for word games: { "4": { title, terms: [[term, definition], ...] } }. */
export function vocabByChapter(): Record<string, { title: string; terms: [string, string][] }> {
  const out: Record<string, { title: string; terms: [string, string][] }> = {};
  byChapter.forEach((list, ch) => { out[String(ch)] = { title: chapterTitle(ch), terms: list.map((e) => [e.term, e.definition] as [string, string]) }; });
  return out;
}
