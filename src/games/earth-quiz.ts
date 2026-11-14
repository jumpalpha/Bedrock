// Question sources for the wave-arcadeA question games (How Smart, Sprite Siege, Vocab Slice, Word Quest).
//
// ── SWITCH: review bank ─────────────────────────────────────────────────────────────────────────────
// src/data/content/review.json is the public review bank ({ "1": [{ id, q, a, wrong[3], why }], ... }).
// It isn't in the repo yet, so REVIEW_SOURCE is null and multiple-choice games build questions from
// glossary.json instead. When review.json lands, replace the null below with:
//
//   () => import("@/data/content/review.json").then((m) => m.default as unknown as ReviewBank)
//
// and nothing else changes: How Smart and Sprite Siege pick it up automatically. Word/definition games
// (Vocab Slice, Word Quest) always use the glossary. NEVER point any of this at questions.json: graded
// answer keys must not reach the site.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
type ReviewItem = { id: string; q: string; a: string; wrong: string[]; why?: string };
type ReviewBank = Record<string, ReviewItem[]>;
const REVIEW_SOURCE: (() => Promise<ReviewBank>) | null = null;

export const reviewEnabled = () => REVIEW_SOURCE !== null;

export type Term = { term: string; def: string; ch: number };
export type ReviewQ = { id: string; ch: number; q: string; right: string; wrong: string[]; why: string };

let termsP: Promise<Term[]> | null = null;
let reviewP: Promise<ReviewQ[] | null> | null = null;
let metaP: Promise<{ titles: Record<number, string>; realmOf: (ch: number) => string }> | null = null;

/** Glossary terms (lazy chunk, cached). */
export function loadTerms(): Promise<Term[]> {
  termsP ??= import("@/data/content/glossary.json").then((m) =>
    (m.default as unknown as { term: string; definition: string; chapter: number }[]).map((g) => ({ term: g.term, def: g.definition, ch: g.chapter }))
  );
  return termsP;
}

/** The review bank flattened, or null while review.json isn't wired in (see SWITCH above). */
export function loadReview(): Promise<ReviewQ[] | null> {
  reviewP ??= REVIEW_SOURCE
    ? REVIEW_SOURCE().then((bank) =>
        Object.entries(bank).flatMap(([ch, items]) =>
          items.filter((r) => r.q && r.a && r.wrong?.length >= 3).map((r) => ({ id: r.id, ch: +ch, q: r.q, right: r.a, wrong: r.wrong.slice(0, 3), why: r.why ?? "" }))
        )
      )
    : Promise.resolve(null);
  return reviewP;
}

/** Chapter titles and realm names. */
export function loadMeta() {
  metaP ??= import("@/data/site").then(({ chapters, realmForChapter }) => ({
    titles: Object.fromEntries(chapters.map((c) => [c.n, c.title])) as Record<number, string>,
    realmOf: (ch: number) => realmForChapter(ch)?.name ?? "",
  }));
  return metaP;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Hide the term inside its own definition so the answer isn't given away. */
export const maskTerm = (def: string, term: string) => def.replace(new RegExp(escapeRe(term), "ig"), "_____");
export const shuffle = <T,>(a: T[]) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** Three wrong terms for `t`, drawn from the same chapter, the same realm or anywhere (closer = harder). */
export function decoys(t: Term, terms: Term[], closeness: "chapter" | "realm" | "far", realmOf: (ch: number) => string) {
  const ok = (o: Term) => o.term.toLowerCase() !== t.term.toLowerCase();
  const pools =
    closeness === "chapter" ? [terms.filter((o) => o.ch === t.ch && ok(o)), terms.filter((o) => realmOf(o.ch) === realmOf(t.ch) && ok(o))]
      : closeness === "realm" ? [terms.filter((o) => o.ch !== t.ch && realmOf(o.ch) === realmOf(t.ch) && ok(o))]
        : [terms.filter((o) => realmOf(o.ch) !== realmOf(t.ch) && ok(o))];
  pools.push(terms.filter(ok));
  const out: string[] = [];
  for (const p of pools) for (const o of shuffle(p)) { if (out.length >= 3) break; if (!out.some((x) => x.toLowerCase() === o.term.toLowerCase())) out.push(o.term); }
  return out;
}

// ── How Smart: a bank with difficulty floors 1–15 ──
export type SmartQ = { id: number; lvl: number; topic: string; ch: number; q: string; right: string; wrong: string[]; why: string };

export async function loadSmartBank(): Promise<SmartQ[]> {
  const [review, meta] = await Promise.all([loadReview(), loadMeta()]);
  if (review?.length) {
    // The review bank has no difficulty field: rank questions by how much reading/vocabulary they ask for
    // (question + answer + choices length) and spread them evenly across the 15 floors.
    const ranked = review.map((r, i) => ({ r, i, w: r.q.length + r.right.length * 2 + r.wrong.join("").length / 2 })).sort((a, b) => a.w - b.w);
    return ranked.map(({ r }, k) => ({
      id: k, lvl: 1 + Math.floor((k * 15) / ranked.length), topic: meta.realmOf(r.ch), ch: r.ch, q: r.q, right: r.right, wrong: r.wrong, why: r.why,
    }));
  }
  // Glossary fallback: "Which term means …?" Higher floors use look-alike decoys from the same chapter,
  // lower floors use decoys from other realms, so floors really do get harder.
  const terms = await loadTerms();
  return terms.map((t, id) => {
    const lvl = 1 + (hash(t.term) % 15);
    const wrong = decoys(t, terms, lvl >= 11 ? "chapter" : lvl >= 6 ? "realm" : "far", meta.realmOf);
    return {
      id, lvl, topic: meta.realmOf(t.ch), ch: t.ch,
      q: `Which term means: “${maskTerm(t.def, t.term)}”`,
      right: t.term, wrong, why: `${t.term}: ${t.def}`,
    };
  });
}

// ── Vocab Slice: terms grouped by chapter ──
export type Vocab = Record<string, { title: string; terms: [string, string][] }>;
export async function loadVocab(): Promise<Vocab> {
  const [terms, meta] = await Promise.all([loadTerms(), loadMeta()]);
  const v: Vocab = {};
  terms.forEach((t) => {
    (v[t.ch] ??= { title: meta.titles[t.ch] ?? `Chapter ${t.ch}`, terms: [] }).terms.push([t.term, t.def]);
  });
  return v;
}
