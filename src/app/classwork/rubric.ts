// Story rubric for live feedback. Same rules as public._b_cw_story_score / _b_cw_term_rx / _b_cw_cue
// in supabase/migrations/004_classwork_reflection.sql (the database score is the one that counts).
import type { StoryScore } from "@/lib/db";

export const RULES = { learnPass: 80, reviewPass: 80, minFinal: 70, minWords: 25, stories: 3, minSeconds: 45 };

/** Regex for one term: "-" and " " interchangeable, simple endings, "a/b c" → "a c" | "b c", "(XYZ)" → XYZ alone. */
export function termRx(term: string) {
  const abbr = (term.match(/\(([^)]+)\)/) || [])[1];
  const base = term.replace(/\s*\([^)]*\)/g, "").trim();
  let alts = [base];
  if (base.includes("/")) {
    const sp = base.indexOf(" ");
    const first = sp < 0 ? base : base.slice(0, sp), rest = sp < 0 ? "" : base.slice(sp + 1);
    const parts = first.split("/");
    alts = sp < 0 ? parts : alts.concat(parts.map((p) => (p + " " + rest).trim()));
  }
  if (abbr) alts.push(abbr.replace(/s$/, ""));
  const pieces = alts.map((v) => v.toLowerCase().trim()).filter(Boolean).map((v) => {
    let one = v.replace(/[.^$*+?()[\]{}|\\]/g, "\\$&").replace(/[- ]+/g, "[- ]?");
    if (/[a-z]$/.test(one)) one = "(" + one + "|" + one.replace(/[ey]$/, "") + "|" + one.replace(/e?s$/, "") + ")(s|es|e|ed|d|ing|ies|ly|ness)?";
    return one;
  });
  return new RegExp("(^|[^a-z0-9])(" + pieces.join("|") + ")(?![a-z0-9])", "i");
}

const CUE = new RegExp([
  "\\b(my|our) (mom|dad|mother|father|parents?|brothers?|sisters?|siblings?|friends?|best friend|grandma|grandpa|grandmother|grandfather|grandparents?|coach|teacher|cousins?|aunt|uncle|family|team|teammates?|boss|neighbors?|dog|cat|class|troop)\\b",
  "\\b(at|in|on|near|by) (the|my|our|a) [a-z]+",
  "\\b(home|school|practice|church|work|park|store|gym|field|class|game|camp|camping|vacation|trip|hike|hiking|trail|river|lake|creek|mountains?|canyon|desert|beach|cave|farm|ranch|backyard|yard|cabin|road|highway|boise|idaho|yellowstone|news)\\b",
  "\\b(yesterday|today|tonight|ago|once|weekend|morning|afternoon|evening|night|summer|winter|spring|fall|birthday|christmas|thanksgiving|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b",
  "\\blast (week|year|month|night|time)\\b", "\\bwhen i was\\b", "\\byears? old\\b", "\\b[0-9]{1,2}(st|nd|rd|th)? grade\\b", "\\b(19|20)[0-9]{2}\\b",
].join("|"));

export function scoreStory(text: string, a: string, b: string): StoryScore {
  const t = String(text || ""), lo = t.toLowerCase();
  const words = t.trim().split(/\s+/).filter((x) => /[A-Za-z]/.test(x)).length;
  const sentences = t.split(/[.!?]+/).filter((seg) => seg.trim().split(/\s+/).filter((x) => /[A-Za-z]/.test(x)).length >= 3).length;
  const has_a = !!a && termRx(a).test(lo), has_b = !!b && termRx(b).test(lo), cue = CUE.test(lo);
  const length = Math.min(40, Math.floor((40 * words) / RULES.minWords));
  const used = (has_a ? 15 : 0) + (has_b ? 15 : 0), detail = (sentences >= 2 ? 15 : 0) + (cue ? 15 : 0);
  return { words, sentences, has_a, has_b, cue, length, used, detail, total: length + used + detail };
}

export function hints(sc: StoryScore, a: string, b: string) {
  const h: string[] = [];
  if (sc.words < RULES.minWords) h.push(`Write at least ${RULES.minWords} words (you have ${sc.words}).`);
  if (a && !sc.has_a) h.push(`Use the word “${a}” in your story.`);
  if (b && !sc.has_b) h.push(`Use the word “${b}” in your story.`);
  if (sc.sentences < 2) h.push("Write at least 2 full sentences.");
  if (!sc.cue) h.push("Add a real detail: who was there, where it happened, or when (for example “last summer,” “my brother,” “on the trail at Bogus Basin”).");
  return h;
}

/** Splits text into plain and highlighted pieces wherever one of the terms appears. */
export function highlightParts(text: string, terms: string[]) {
  const rxs = terms.filter(Boolean).map((t) => new RegExp(termRx(t).source, "gi"));
  const marks: [number, number][] = [];
  for (const rx of rxs) for (const m of text.matchAll(rx)) { const s = (m.index ?? 0) + m[1].length; marks.push([s, s + m[2].length]); }
  marks.sort((x, y) => x[0] - y[0]);
  const out: { t: string; hl: boolean }[] = [];
  let at = 0;
  for (const [s, e] of marks) { if (s < at) continue; if (s > at) out.push({ t: text.slice(at, s), hl: false }); out.push({ t: text.slice(s, e), hl: true }); at = e; }
  if (at < text.length) out.push({ t: text.slice(at), hl: false });
  return out;
}
