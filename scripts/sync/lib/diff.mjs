// Repo content (before) vs freshly parsed content (after) → structured changes + a plain-English report.

import { sectionSlugs } from "./parse.mjs";

const chId = (c) => c.id ?? String(c.n);
const label = (id) => String(id).toUpperCase();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const quote = (s, n = 70) => { s = String(s).replace(/\s+/g, " ").trim(); return `"${s.length > n ? s.slice(0, n - 1) + "…" : s}"`; };
const plural = (n, w, ws = w + "s") => `${n} ${n === 1 ? w : ws}`;

export function diffContent(before, after) {
  const lines = []; // report lines, in order
  const removals = []; // things that disappear (need --allow-removals)
  const changedText = new Set(); // chapter ids whose student-facing text changed (review bank may need a look)
  const newChapters = [];
  const realmName = (n) => after.realms.find((r) => r.n === n)?.name ?? `Realm ${n}`;

  // ── chapters ──
  const bMap = new Map(before.chapters.map((c) => [chId(c), c]));
  const aMap = new Map(after.chapters.map((c) => [chId(c), c]));
  for (const [id, a] of aMap) {
    const b = bMap.get(id);
    if (!b) {
      newChapters.push(id);
      const g = after.glossary.filter((x) => String(x.chapter) === id).length;
      const q = after.questions.chapter[id]?.length ?? 0;
      lines.push(`Chapter ${label(id)}: NEW chapter "${a.title}" (realm ${a.realm}: ${realmName(a.realm)}): ${plural(a.sections.length, "section")}, ${plural(q, "quiz question")}, ${plural(g, "glossary word")}, ${plural(a.keyWords.length, "key word")}.`);
      continue;
    }
    const parts = [];
    if (a.title !== b.title) { parts.push(`title changed from "${b.title}" to "${a.title}"`); changedText.add(id); }
    if (a.realm !== b.realm) parts.push(`MOVED from realm ${b.realm} to realm ${a.realm}`);
    const bs = sectionSlugs(b.sections), as = sectionSlugs(a.sections);
    const bSec = new Map(b.sections.map((s, i) => [bs[i], s])), aSec = new Map(a.sections.map((s, i) => [as[i], s]));
    const added = as.filter((s) => !bSec.has(s)), gone = bs.filter((s) => !aSec.has(s));
    const edited = as.filter((s) => bSec.has(s) && bSec.get(s).markdown !== aSec.get(s).markdown);
    const moved = as.filter((s) => bSec.has(s) && (bSec.get(s).part ?? null) !== (aSec.get(s).part ?? null));
    for (const s of added) {
      const i = as.indexOf(s); const after_ = i > 0 ? ` (after "${a.sections[i - 1].heading}")` : " (at the start)";
      parts.push(`1 new section "${aSec.get(s).heading}"${after_}`);
    }
    for (const s of gone) { parts.push(`section REMOVED "${bSec.get(s).heading}"`); removals.push(`Chapter ${label(id)} section "${bSec.get(s).heading}"`); }
    if (edited.length) parts.push(`text edited in ${edited.length === 1 ? "section" : "sections"} ${edited.map((s) => `"${aSec.get(s).heading}"`).join(", ")}`);
    if (moved.length) parts.push(`${plural(moved.length, "section")} moved to a different part`);
    const order = bs.filter((s) => aSec.has(s)); const order2 = as.filter((s) => bSec.has(s));
    if (!same(order, order2)) parts.push("sections reordered");
    if (added.length || gone.length || edited.length || !same(order, order2)) changedText.add(id);
    if (!same(a.thinkLikeAScientist, b.thinkLikeAScientist)) { parts.push("Think Like a Scientist prompt changed"); changedText.add(id); }
    listDiff(b.checklist, a.checklist, "checklist item", parts, () => changedText.add(id));
    listDiff(b.keyWords, a.keyWords, "key word", parts, () => changedText.add(id));
    if (parts.length) lines.push(`Chapter ${label(id)}: ${parts.join("; ")}.`);
  }
  for (const [id, b] of bMap) if (!aMap.has(id)) { lines.push(`Chapter ${label(id)}: REMOVED ("${b.title}").`); removals.push(`Chapter ${label(id)}`); }

  // ── realms ──
  for (const a of after.realms) {
    const b = before.realms.find((r) => r.n === a.n);
    if (!b) { lines.push(`Realm ${a.n}: NEW realm "${a.name}".`); continue; }
    const f = Object.keys({ ...a, ...b }).filter((k) => !same(a[k], b[k]));
    if (f.length) lines.push(`Realm ${a.n} (${a.name}): changed ${f.join(", ")}.`);
  }
  for (const b of before.realms) if (!after.realms.some((r) => r.n === b.n)) { lines.push(`Realm ${b.n}: REMOVED.`); removals.push(`Realm ${b.n}`); }

  // ── question banks ──
  const qChanges = { added: [], removed: [], reworded: [] };
  for (const kind of ["chapter", "unit"]) {
    const refs = new Set([...Object.keys(before.questions[kind] ?? {}), ...Object.keys(after.questions[kind] ?? {})]);
    for (const ref of [...refs].sort((x, y) => parseFloat(x) - parseFloat(y) || x.localeCompare(y))) {
      const bq = before.questions[kind][ref] ?? [], aq = after.questions[kind][ref] ?? [];
      const bIds = new Map(bq.map((q) => [q.id, q])), aIds = new Map(aq.map((q) => [q.id, q]));
      const add = aq.filter((q) => !bIds.has(q.id)), rem = bq.filter((q) => !aIds.has(q.id));
      const cho = aq.filter((q) => bIds.has(q.id) && !same([...q.choices].sort(), [...bIds.get(q.id).choices].sort()));
      const tweak = aq.filter((q) => bIds.has(q.id) && q.q !== bIds.get(q.id).q);
      const name = kind === "chapter" ? `Chapter quiz ${label(ref)}` : `Realm ${ref} test`;
      if (kind === "chapter" && newChapters.includes(ref)) { qChanges.added.push(...add.map((q) => q.id)); continue; }
      const parts = [];
      if (add.length) parts.push(`+${add.length} ${add.length === 1 ? "question" : "questions"} (${add.map((q) => quote(q.q, 60)).join(", ")})`);
      if (rem.length) parts.push(`-${rem.length} REMOVED (${rem.map((q) => quote(q.q, 60)).join(", ")})`);
      if (cho.length) parts.push(`answer choices edited in ${cho.map((q) => quote(q.q, 50)).join(", ")}`);
      if (tweak.length) parts.push(`punctuation/case tweaks in ${plural(tweak.length, "question")} (same id)`);
      if (add.length && rem.length) parts.push("a removed + added pair is usually a reworded question (it gets a new id)");
      if (!same(bq.filter((q) => aIds.has(q.id)).map((q) => q.id), aq.filter((q) => bIds.has(q.id)).map((q) => q.id))) parts.push("questions reordered (harmless: quizzes shuffle)");
      if (parts.length) lines.push(`${name}: ${parts.join("; ")}.`);
      qChanges.added.push(...add.map((q) => q.id)); qChanges.removed.push(...rem.map((q) => q.id));
      rem.forEach((q) => removals.push(`${name} question ${q.id} ${quote(q.q, 50)}`));
    }
  }

  // ── glossary ──
  const gk = (g) => `${g.term.toLowerCase()}|${g.chapter}`;
  const bG = new Map(before.glossary.map((g) => [gk(g), g])), aG = new Map(after.glossary.map((g) => [gk(g), g]));
  const gAdd = after.glossary.filter((g) => !bG.has(gk(g))), gRem = before.glossary.filter((g) => !aG.has(gk(g)));
  const gEd = after.glossary.filter((g) => bG.has(gk(g)) && (bG.get(gk(g)).definition !== g.definition || bG.get(gk(g)).term !== g.term));
  const gParts = [];
  if (gAdd.length) gParts.push(`+${plural(gAdd.length, "word")} (${gAdd.map((g) => `${g.term} [ch ${label(g.chapter)}]`).join(", ")})`);
  if (gRem.length) { gParts.push(`-${plural(gRem.length, "word")} REMOVED (${gRem.map((g) => g.term).join(", ")})`); gRem.forEach((g) => removals.push(`Glossary "${g.term}"`)); }
  if (gEd.length) gParts.push(`definition edited for ${gEd.map((g) => g.term).join(", ")}`);
  if (gParts.length) lines.push(`Glossary: ${gParts.join("; ")}.`);

  // ── pick a side / survey / side quests / theme ──
  itemDiff("Pick a Side", before.pick_a_side.debates, after.pick_a_side.debates, (d) => d.id, (d) => `${d.id} ${quote(d.question, 60)}`, lines, removals);
  itemDiff("Survey of the Day", before.survey.questions, after.survey.questions, (q) => q.n, (q) => `#${q.n} ${quote(q.question, 60)}${q.options ? ` options: ${q.options.join(" / ")}` : " (open-ended)"}`, lines, removals);
  itemDiff("Side Quests", before.side_quests.quests, after.side_quests.quests, (q) => q.n, (q) => `#${q.n} "${q.title}"`, lines, removals);
  for (const [name, k] of [["Pick a Side intro/rating key", ["intro", "ratingKey"]], ["Survey intro", ["intro"]], ["Side Quests intro/safety notes", ["intro", "safetyNotes"]]]) {
    const src = name.startsWith("Pick") ? "pick_a_side" : name.startsWith("Survey") ? "survey" : "side_quests";
    if (k.some((f) => !same(before[src][f], after[src][f]))) lines.push(`${name}: wording changed.`);
  }
  const thChanged = Object.keys({ ...before.theme, ...after.theme }).filter((k) => !same(before.theme[k], after.theme[k]));
  if (thChanged.length) lines.push(`Site Theme: changed ${thChanged.join(", ")}.`);

  return { lines, removals, changedText: [...changedText], newChapters, qChanges };
}

function listDiff(b, a, word, parts, mark) {
  const add = a.filter((x) => !b.includes(x)), rem = b.filter((x) => !a.includes(x));
  if (add.length) parts.push(`+${plural(add.length, word)} (${add.map((x) => quote(x, 40)).join(", ")})`);
  if (rem.length) parts.push(`-${plural(rem.length, word)} (${rem.map((x) => quote(x, 40)).join(", ")})`);
  if (add.length || rem.length) mark();
}

function itemDiff(name, before, after, key, show, lines, removals) {
  const b = new Map(before.map((x) => [key(x), x])), a = new Map(after.map((x) => [key(x), x]));
  const add = after.filter((x) => !b.has(key(x))), rem = before.filter((x) => !a.has(key(x)));
  const ed = after.filter((x) => b.has(key(x)) && !same(x, b.get(key(x))));
  const parts = [];
  if (add.length) parts.push(`+${add.length} new: ${add.map(show).join("; ")}`);
  if (rem.length) { parts.push(`-${rem.length} REMOVED: ${rem.map(show).join("; ")}`); rem.forEach((x) => removals.push(`${name} ${show(x)}`)); }
  if (ed.length) parts.push(`edited: ${ed.map(show).join("; ")}`);
  if (parts.length) lines.push(`${name}: ${parts.join(" | ")}.`);
}
