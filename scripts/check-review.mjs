// Validates src/data/content/review.json and checks that no review stem repeats or closely
// paraphrases a graded stem in questions.json (graded file has no answers; only stems are read).
// Usage: node scripts/check-review.mjs [--top N]
import { readFileSync } from "node:fs";

const review = JSON.parse(readFileSync(new URL("../src/data/content/review.json", import.meta.url), "utf8"));
const graded = JSON.parse(readFileSync(new URL("../src/data/content/questions.json", import.meta.url), "utf8"));
const errors = [];

// ── structure ──
const ids = new Set();
let total = 0;
for (let n = 1; n <= 28; n++) {
  const list = review[String(n)];
  if (!Array.isArray(list) || list.length !== 12) { errors.push(`chapter ${n}: expected 12, got ${list?.length}`); continue; }
  list.forEach((q, i) => {
    total++;
    const want = `r${String(n).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    if (q.id !== want) errors.push(`${q.id}: expected id ${want}`);
    if (ids.has(q.id)) errors.push(`${q.id}: duplicate id`);
    ids.add(q.id);
    for (const k of ["q", "a", "why"]) if (typeof q[k] !== "string" || !q[k].trim()) errors.push(`${q.id}: empty ${k}`);
    if (!Array.isArray(q.wrong) || q.wrong.length !== 3) errors.push(`${q.id}: needs 3 wrong`);
    else {
      if (q.wrong.some((w) => typeof w !== "string" || !w.trim())) errors.push(`${q.id}: empty wrong`);
      const all = [q.a, ...q.wrong].map((s) => s.trim().toLowerCase());
      if (new Set(all).size !== 4) errors.push(`${q.id}: answers not distinct`);
      if (all.some((s) => /\b(all|none) of the above\b/.test(s))) errors.push(`${q.id}: all/none of the above`);
      const lens = [q.a, ...q.wrong].map((s) => s.length);
      const others = Math.max(...lens.slice(1));
      if (q.a.length > 1.25 * others + 4) errors.push(`${q.id}: correct answer stands out as longest`);
    }
    const extra = Object.keys(q).filter((k) => !["id", "q", "a", "wrong", "why"].includes(k));
    if (extra.length) errors.push(`${q.id}: unexpected keys ${extra}`);
  });
}

// ── duplicate stems inside review ──
const seenQ = new Map();
for (const list of Object.values(review)) for (const q of list) {
  const k = q.q.toLowerCase();
  if (seenQ.has(k)) errors.push(`${q.id}: same stem as ${seenQ.get(k)}`);
  seenQ.set(k, q.id);
}

// ── similarity to graded stems ──
const STOP = new Set("a an the of in on at to is are was be by for and or with what which why how does do that this it its from as you your about most usually called each".split(" "));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9° ]+/g, " ").replace(/\s+/g, " ").trim();
const toks = (s) => new Set(norm(s).split(" ").filter((t) => t && !STOP.has(t)).map((t) => t.replace(/s$/, "")));
const bigrams = (s) => { const t = norm(s).replace(/ /g, ""); const b = new Map(); for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); b.set(g, (b.get(g) || 0) + 1); } return b; };
const dice = (a, b) => { let inter = 0, sa = 0, sb = 0; for (const v of a.values()) sa += v; for (const v of b.values()) sb += v; for (const [g, v] of a) inter += Math.min(v, b.get(g) || 0); return (2 * inter) / (sa + sb || 1); };
const jac = (a, b) => { let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i || 1); };

const gradedStems = [];
for (const [scope, chs] of Object.entries(graded)) for (const [n, list] of Object.entries(chs)) for (const g of list) gradedStems.push({ id: `${scope}${n}:${g.id}`, q: g.q });
const pre = gradedStems.map((g) => ({ ...g, t: toks(g.q), b: bigrams(g.q) }));

const pairs = [];
for (const list of Object.values(review)) for (const r of list) {
  const rt = toks(r.q), rb = bigrams(r.q);
  let best = null;
  for (const g of pre) {
    const s = Math.max(jac(rt, g.t), dice(rb, g.b));
    if (!best || s > best.s) best = { s, j: jac(rt, g.t), d: dice(rb, g.b), g };
  }
  pairs.push({ r, ...best });
  if (norm(r.q) === norm(best.g.q)) errors.push(`${r.id}: identical to graded ${best.g.id}`);
  if (best.j >= 0.6 || best.d >= 0.8) errors.push(`${r.id}: too close to graded ${best.g.id} (jaccard ${best.j.toFixed(2)}, dice ${best.d.toFixed(2)})`);
}
pairs.sort((a, b) => b.s - a.s);
const top = Number(process.argv[process.argv.indexOf("--top") + 1]) || 15;
console.log(`review questions: ${total} across ${Object.keys(review).length} chapters; graded stems compared: ${gradedStems.length}`);
console.log(`closest review/graded stem pairs (max of word-Jaccard, char-bigram Dice):`);
for (const p of pairs.slice(0, top)) console.log(`  ${p.s.toFixed(2)}  ${p.r.id} "${p.r.q}"\n        ~ ${p.g.id} "${p.g.q}"`);
const mean = pairs.reduce((s, p) => s + p.s, 0) / pairs.length;
console.log(`mean best-match score: ${mean.toFixed(2)}; pairs ≥0.6: ${pairs.filter((p) => p.s >= 0.6).length}`);
if (errors.length) { console.error(`\n${errors.length} problem(s):\n` + errors.join("\n")); process.exit(1); }
console.log("OK");
