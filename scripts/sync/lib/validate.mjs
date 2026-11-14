// Safety rules shared by sync.mjs (before anything is written) and check.mjs (every build).
// content = { chapters, realms, glossary, questions, pick_a_side, survey, side_quests, theme }
// keys    = optional private keys ({ chapter: {id: {ref, answer}}, unit: {...}, tls: {...} })

import { chapterRef, scramble, tlsId } from "./parse.mjs";

const chId = (c) => c.id ?? String(c.n);
const norm = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();

/** @returns {{ errors: string[], warnings: string[] }} */
export function validateContent(content, keys = null) {
  const errors = []; const warnings = [];
  const { chapters, realms, glossary, questions, pick_a_side, survey, side_quests } = content;

  // ── chapters ↔ realms ──
  const ids = chapters.map(chId);
  dupes(ids).forEach((d) => errors.push(`Chapter id "${d}" is used twice`));
  const realmNs = realms.map((r) => r.n);
  dupes(realmNs).forEach((d) => errors.push(`Realm ${d} appears twice`));
  for (const c of chapters) {
    if (!/^\d+[a-z]?$/.test(chId(c))) errors.push(`Chapter id "${chId(c)}" must look like 5 or 12a`);
    if (c.id && !c.id.startsWith(String(c.n))) errors.push(`Bonus chapter ${c.id} must have n = ${parseInt(c.id, 10)}`);
    if (!realmNs.includes(c.realm)) errors.push(`Chapter ${chId(c)} points to realm ${c.realm}, which doesn't exist`);
    const r = realms.find((x) => x.n === c.realm);
    if (r && !c.id && (c.n < r.chapters[0] || c.n > r.chapters[1])) errors.push(`Chapter ${c.n} is in realm ${r.n} but outside its range ${r.chapters.join("–")}`);
    if (!c.title) errors.push(`Chapter ${chId(c)} has no title`);
    if (!c.sections?.length) errors.push(`Chapter ${chId(c)} has no sections`);
    if (!c.thinkLikeAScientist?.prompt) errors.push(`Chapter ${chId(c)} has no Think Like a Scientist prompt`);
    if (!(questions.chapter[chId(c)]?.length)) errors.push(`Chapter ${chId(c)} has no quiz questions`);
    else if (questions.chapter[chId(c)].length !== 20) warnings.push(`Chapter ${chId(c).toUpperCase()} quiz has ${questions.chapter[chId(c)].length} questions (the others have 20)`);
    if (keys && !keys.tls?.[tlsId(chId(c))]) errors.push(`Chapter ${chId(c)} has no Think Like a Scientist answer key`);
  }
  for (const r of realms) {
    for (let n = r.chapters[0]; n <= r.chapters[1]; n++)
      if (!chapters.some((c) => !c.id && c.n === n)) errors.push(`Realm ${r.n} covers chapter ${n}, which doesn't exist`);
    if (!chapters.some((c) => c.realm === r.n)) errors.push(`Realm ${r.n} has no chapters`);
    if (!(questions.unit[String(r.n)]?.length)) errors.push(`Realm ${r.n} has no unit test questions`);
    else if (questions.unit[String(r.n)].length !== 30) warnings.push(`Realm ${r.n} test has ${questions.unit[String(r.n)].length} questions (the others have 30)`);
  }
  for (const [a, b] of realms.flatMap((r, i) => realms.slice(i + 1).map((s) => [r, s])))
    if (a.chapters[0] <= b.chapters[1] && b.chapters[0] <= a.chapters[1]) errors.push(`Realms ${a.n} and ${b.n} overlap (chapters ${a.chapters.join("–")} and ${b.chapters.join("–")})`);
  for (const k of Object.keys(questions.chapter)) if (!ids.includes(k)) errors.push(`Quiz bank for chapter ${k}, which doesn't exist`);
  for (const k of Object.keys(questions.unit)) if (!realmNs.includes(Number(k))) errors.push(`Unit test for realm ${k}, which doesn't exist`);
  for (const g of glossary) if (g.chapter != null && !ids.includes(String(g.chapter))) errors.push(`Glossary "${g.term}" points to chapter ${g.chapter}, which doesn't exist`);
  dupes(glossary.map((g) => `${norm(g.term)} (chapter ${g.chapter})`)).forEach((d) => warnings.push(`Glossary word listed twice: ${d}`));
  for (const d of pick_a_side.debates) if (!ids.includes(String(d.chapter))) errors.push(`Debate ${d.id} points to chapter ${d.chapter}, which doesn't exist`);
  dupes(pick_a_side.debates.map((d) => d.id)).forEach((d) => errors.push(`Debate id ${d} is used twice`));
  dupes(survey.questions.map((q) => q.n)).forEach((d) => errors.push(`Survey number ${d} is used twice`));
  dupes(side_quests.quests.map((q) => q.n)).forEach((d) => errors.push(`Side quest #${d} is used twice`));

  // ── questions: public shape, 4 distinct choices, unique ids, scrambled order ──
  const allIds = [];
  for (const kind of ["chapter", "unit"]) for (const [ref, list] of Object.entries(questions[kind] ?? {})) for (const q of list) {
    const where = `${kind === "chapter" ? "Chapter " + ref.toUpperCase() + " quiz" : "Realm " + ref + " test"} ${q.id}`;
    allIds.push(q.id);
    const extra = Object.keys(q).filter((k) => !["id", "q", "choices"].includes(k));
    if (extra.length) errors.push(`${where}: public question has extra fields (${extra.join(", ")}) — only id, q, choices may be public`);
    const want = kind === "chapter" ? new RegExp(`^c\\d\\d[a-z]?-[0-9a-f]{6}$`) : /^u\d+-[0-9a-f]{6}$/;
    if (!want.test(q.id)) errors.push(`${where}: id doesn't follow the content-hash format`);
    if (!Array.isArray(q.choices) || q.choices.length !== 4) errors.push(`${where}: needs exactly 4 choices, has ${q.choices?.length ?? 0}`);
    else {
      if (new Set(q.choices.map(norm)).size !== 4) errors.push(`${where}: two choices are the same`);
      if (q.choices.some((c) => !String(c).trim())) errors.push(`${where}: empty choice`);
      if (JSON.stringify(scramble(q.id, q.choices)) !== JSON.stringify(q.choices)) errors.push(`${where}: choices are not in the scrambled order (the doc's letter order would leak the key)`);
    }
    if (!q.q?.trim()) errors.push(`${where}: empty question`);
    if (keys) {
      const k = keys[kind]?.[q.id];
      if (!k) errors.push(`${where}: no answer key`);
      else {
        const hits = q.choices.filter((c) => norm(c) === norm(k.answer)).length;
        if (hits !== 1) errors.push(`${where}: the answer must match exactly one choice (matches ${hits})`);
        const wantRef = kind === "chapter" ? chapterRef(ref) : Number(ref);
        if (k.ref !== wantRef) errors.push(`${where}: key ref ${k.ref} should be ${wantRef}`);
      }
    }
  }
  dupes(allIds).forEach((d) => errors.push(`Question id ${d} is used twice`));
  if (keys) for (const kind of ["chapter", "unit"]) for (const id of Object.keys(keys[kind] ?? {})) if (!allIds.includes(id)) errors.push(`Answer key ${id} has no public question`);

  errors.push(...leaks(content, keys));
  return { errors, warnings };
}

/** Anything that would reveal an answer in a public file. */
export function leaks(content, keys = null) {
  const errors = [];
  const LETTER = /\[[A-D]\]/;
  const walk = (x, path) => {
    if (typeof x === "string") { if (LETTER.test(x)) errors.push(`${path}: contains an answer-letter mark like "[B]"`); }
    else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) {
      if (/^(answer|answers|correct|key|keys)$/i.test(k)) errors.push(`${path}.${k}: field name looks like an answer key`);
      walk(v, `${path}.${k}`);
    }
  };
  for (const [name, v] of Object.entries(content)) walk(v, name);
  if (keys?.tls) {
    const pub = norm(JSON.stringify(content).replace(/\\n/g, " "));
    for (const [id, k] of Object.entries(keys.tls)) {
      const sample = norm(k.answer.replace(/\*\*[^*]+\*\*/g, " ")).slice(0, 120);
      if (sample.length > 40 && pub.includes(sample)) errors.push(`Think Like a Scientist key ${id} appears in a public file`);
    }
  }
  return errors;
}

function dupes(arr) {
  const seen = new Set(); const d = new Set();
  for (const x of arr) (seen.has(x) ? d : seen).add(x);
  return [...d];
}
