// Server-side data for the Classwork pages: each realm's chapters, words (public glossary) and test question text.
// Question text only: the answers live in the database (b_keys) and never ship with the site.
import glossary from "@/data/content/glossary.json";
import questions from "@/data/content/questions.json";
import bank from "@/data/content/classwork_bank.json";
import skip from "@/data/classwork-story-skip.json";
import { chapterById, chaptersIn, realms, type Realm } from "@/data/site";

export type CwWord = { t: string; d: string; s: boolean };
export type CwChapter = { id: string; label: string; ref: number; title: string; words: CwWord[] };
export type CwQuestion = { q: string; choices: string[]; think: boolean };
export type CwRealmData = { n: number; name: string; color: string; icon: string; chapters: CwChapter[]; questions: Record<string, CwQuestion> };

const noStory = new Set(skip as string[]);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function wordsFor(chapterId: string): CwWord[] {
  return (glossary as { term: string; definition: string; chapter: number | string }[])
    .filter((g) => chapterById(String(g.chapter))?.id === chapterId)
    .map((g) => ({ t: g.term, d: cap(g.definition), s: !noStory.has(g.term.toLowerCase()) }));
}

/** Stories per chapter: 3, or fewer when the chapter has too few story words (same rule as _b_cw_need). */
export const storiesNeeded = (words: CwWord[]) => Math.min(3, Math.floor(words.filter((w) => w.s).length / 2));

export function realmData(r: Realm): CwRealmData {
  const chs = chaptersIn(r);
  const qs: Record<string, CwQuestion> = {};
  for (const c of chs) {
    for (const q of (questions.chapter as Record<string, { id: string; q: string; choices: string[] }[]>)[c.id] ?? []) qs[q.id] = { q: q.q, choices: q.choices, think: false };
    for (const q of (bank as Record<string, { id: string; q: string; choices: string[] }[]>)[c.id] ?? []) qs[q.id] = { q: q.q, choices: q.choices, think: true };
  }
  return {
    n: r.n, name: r.name, color: r.color, icon: r.icon,
    chapters: chs.map((c) => ({ id: c.id, label: c.label, ref: c.ref, title: c.title, words: wordsFor(c.id) })),
    questions: qs,
  };
}

export const allRealms = realms;
