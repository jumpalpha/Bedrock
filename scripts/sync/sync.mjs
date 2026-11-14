#!/usr/bin/env node
// Sync Bedrock from the doc.
//   node scripts/sync/sync.mjs --xml page1.xml page2.xml …            dry run: parse, validate, print the change report
//   node scripts/sync/sync.mjs --xml … --apply                         also write src/data/content/*.json + keys-to-load.sql
// Options:
//   --work <dir>         private folder for parsed output and SQL (default $BEDROCK_SYNC_DIR or <tmp>/bedrock-sync). Never inside a repo.
//   --db-hashes <file>   JSON {id: md5(kind|ref|answer)} from the database (see the sync-from-doc skill). Lets the report name
//                        changed answer keys and keeps keys-to-load.sql down to just the changes.
//   --allow-removals     let things disappear (chapters, sections, questions, words…). Without it, any removal stops the sync.
//   --quiet-report       print only the report lines (for pasting)
// Exit codes: 0 ok, 1 validation failed / removals blocked, 2 usage.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { diffContent } from "./lib/diff.mjs";
import { CONTENT_FILES, refToChapterId, toJson } from "./lib/parse.mjs";
import { assertOutsideRepo, CONTENT_DIR, DEFAULT_WORK, REPO } from "./lib/paths.mjs";
import { validateContent } from "./lib/validate.mjs";
import { parseDocFiles, writeParsed } from "./parse-doc.mjs";

const args = process.argv.slice(2);
const opt = { xml: [], apply: false, allowRemovals: false, work: DEFAULT_WORK, dbHashes: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--xml") { while (args[i + 1] && !args[i + 1].startsWith("--")) opt.xml.push(args[++i]); }
  else if (a === "--apply") opt.apply = true;
  else if (a === "--allow-removals") opt.allowRemovals = true;
  else if (a === "--work") opt.work = args[++i];
  else if (a === "--db-hashes") opt.dbHashes = args[++i];
  else { console.error("Unknown option " + a); process.exit(2); }
}
if (!opt.xml.length) { console.error("usage: sync.mjs --xml <doc pages in reading order…> [--apply] [--allow-removals] [--work dir] [--db-hashes file]"); process.exit(2); }

const say = (s = "") => console.log(s);
const fail = (msg) => { console.error("\n✖ SYNC STOPPED: " + msg); process.exit(1); };

try { assertOutsideRepo(opt.work, "Work folder"); } catch (e) { fail(e.message); }
const read = (dir) => Object.fromEntries(CONTENT_FILES.map((f) => [f, JSON.parse(readFileSync(path.join(dir, f + ".json"), "utf8"))]));
const before = read(CONTENT_DIR);

// 1. parse
let parsed;
try { parsed = parseDocFiles(opt.xml, CONTENT_DIR); } catch (e) { fail("Couldn't read the doc pages: " + e.message); }
const after = parsed.content; const keys = parsed.keys;
const parsedDir = path.join(opt.work, "parsed");
writeParsed(parsedDir, parsed);

// 2. validate
const { errors, warnings } = validateContent(after, keys);
errors.unshift(...parsed.problems);

// 3. diff
const d = diffContent(before, after);
const currentIds = new Set([...Object.keys(keys.chapter), ...Object.keys(keys.unit), ...Object.keys(keys.tls)]);
const repoIds = [
  ...Object.values(before.questions.chapter).flat().map((q) => q.id), ...Object.values(before.questions.unit).flat().map((q) => q.id),
  ...before.chapters.map((c) => { const id = c.id ?? String(c.n); return `tls-${String(c.n).padStart(2, "0")}${id.replace(/^\d+/, "")}`; }),
];
const removedKeyIds = repoIds.filter((id) => !currentIds.has(id));

// answer keys: exact change list when the database's key hashes are given
const allKeys = Object.entries({ ...keys.chapter, ...keys.unit, ...keys.tls }).map(([id, k]) => ({ id, kind: id.startsWith("tls-") ? "tls" : id.startsWith("u") ? "unit" : "chapter", ...k }));
const keyHash = (k) => createHash("md5").update(`${k.kind}|${k.ref}|${k.answer}`, "utf8").digest("hex").slice(0, 8);
let dbH = null;
if (opt.dbHashes) { try { dbH = JSON.parse(readFileSync(opt.dbHashes, "utf8")); if (dbH.h) dbH = dbH.h; } catch (e) { fail("Couldn't read --db-hashes: " + e.message); } }
const qText = new Map([...Object.values(after.questions.chapter).flat(), ...Object.values(after.questions.unit).flat()].map((q) => [q.id, q.q]));
const keyLines = [];
let toLoad = allKeys;
let toDelete = removedKeyIds;
if (dbH) {
  const added = allKeys.filter((k) => !(k.id in dbH));
  const changed = allKeys.filter((k) => k.id in dbH && String(dbH[k.id]).slice(0, 8) !== keyHash(k));
  const stale = Object.keys(dbH).filter((id) => !currentIds.has(id));
  toLoad = [...added, ...changed];
  toDelete = [...new Set([...removedKeyIds, ...stale])];
  if (added.length) keyLines.push(`Answer keys: ${added.length} new to load.`);
  for (const k of changed) {
    const where = k.kind === "tls" ? `Think Like a Scientist key for chapter ${refToChapterId(k.ref).toUpperCase()}` : `${k.kind === "chapter" ? "Chapter quiz " + refToChapterId(k.ref).toUpperCase() : "Realm " + k.ref + " test"} question "${(qText.get(k.id) ?? k.id).slice(0, 70)}"`;
    keyLines.push(`ANSWER KEY CHANGED: ${where}. Past scores stay as they were; future attempts are graded with the new answer.`);
  }
  if (toDelete.length) keyLines.push(`Answer keys: ${toDelete.length} to delete (${toDelete.join(", ")}).`);
} else {
  const newIds = allKeys.filter((k) => !repoIds.includes(k.id));
  if (newIds.length) keyLines.push(`Answer keys: ${newIds.length} new to load.`);
  if (removedKeyIds.length) keyLines.push(`Answer keys: ${removedKeyIds.length} to delete.`);
  keyLines.push(`(No --db-hashes given, so keys-to-load.sql re-sends all ${allKeys.length} keys; unchanged ones are no-ops. Changed answers can't be listed here.)`);
}

// 4. report
say("════════ Bedrock sync: change report ════════");
const lines = [...d.lines];
if (!lines.length) say("No content changes: the site already matches the doc.");
for (const l of lines) say("• " + l);
for (const l of keyLines) say("• " + l);
const review = d.changedText.filter((id) => !d.newChapters.includes(id));
if (review.length) say(`• Review bank (review.json, written by Claude, not the doc): chapter text changed in ${review.map((x) => x.toUpperCase()).join(", ")}, so revisit those chapters' review questions.`);
if (d.newChapters.length) say(`• Review bank: new chapter ${d.newChapters.map((x) => x.toUpperCase()).join(", ")} has no review questions yet (games skip it until some are written).`);
if (lines.length) say("• Nothing else changed.");
for (const w of warnings) say("⚠ " + w);
say("Progress: no student progress or scores change. New chapters and questions only add new tasks; cleared realms stay cleared (b_cleared).");

if (errors.length) fail(`${errors.length} problem(s) in the doc. Nothing was written to the site.\n- ` + errors.join("\n- "));
if (d.removals.length && !opt.allowRemovals)
  fail(`these would be REMOVED from the site:\n- ${d.removals.join("\n- ")}\nIf that's intended (e.g. a reworded question or a renamed section), rerun with --allow-removals.`);

// 5. SQL (always written to the private work folder, never the repo)
mkdirSync(opt.work, { recursive: true });
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const values = (ks) => ks.map((k) => `(${lit(k.id)}, ${lit(k.kind)}, ${k.ref}, ${lit(k.answer)})`).join(",\n");
const MAX = 30000;
const parts = []; let cur = [];
for (const k of toLoad) { cur.push(k); if (values(cur).length > MAX) { cur.pop(); parts.push(cur); cur = [k]; } }
if (cur.length) parts.push(cur);
const upsert = (ks, del) => `-- PRIVATE: Bedrock answer keys. Run with Supabase execute_sql on project gmeyamrlqfrabtslsweu. Never commit this file.
with v(id, kind, ref, answer) as (values
${ks.length ? values(ks) : "(null::text, null::text, null::int, null::text)"}
), up as (
  insert into public.b_keys (id, kind, ref, answer) select id, kind, ref, answer from v where id is not null
  on conflict (id) do update set kind = excluded.kind, ref = excluded.ref, answer = excluded.answer
    where (b_keys.kind, b_keys.ref, b_keys.answer) is distinct from (excluded.kind, excluded.ref, excluded.answer)
  returning id, (xmax = 0) as inserted
), del as (
  delete from public.b_keys where id in (${del.length ? del.map(lit).join(", ") : "null"}) returning id
)
select jsonb_build_object(
  'added', (select coalesce(jsonb_agg(id order by id), '[]') from up where inserted),
  'changed', (select coalesce(jsonb_agg(id order by id), '[]') from up where not inserted),
  'deleted', (select coalesce(jsonb_agg(id order by id), '[]') from del),
  'total_keys_after', (select count(*) from public.b_keys) + (select count(*) from up where inserted) - (select count(*) from del)
) as result;
`;
const sqlFiles = [];
if (opt.apply) {
  const chunks = parts.length ? parts : [[]];
  if (toLoad.length || toDelete.length) chunks.forEach((ks, i) => {
    const f = path.join(opt.work, chunks.length === 1 ? "keys-to-load.sql" : `keys-to-load.part${i + 1}.sql`);
    writeFileSync(f, upsert(ks, i === chunks.length - 1 ? toDelete : [])); sqlFiles.push(f);
  });
  // 6. public content into the repo
  const changed = [];
  for (const f of CONTENT_FILES) {
    const p = path.join(CONTENT_DIR, f + ".json"); const s = toJson(after[f]);
    if (readFileSync(p, "utf8") !== s) { writeFileSync(p, s); changed.push(path.relative(REPO, p)); }
  }
  say("\n✔ Applied.");
  say(changed.length ? "Updated in the repo: " + changed.join(", ") : "No site files needed changing.");
  say(sqlFiles.length ? `Answer keys SQL (PRIVATE, outside the repo): ${sqlFiles.join(", ")}` : "No answer-key changes to load.");
  say("Next: npm run build → commit → push → confirm deploy → run the keys SQL with Supabase execute_sql.");
} else {
  say(`\nDry run: nothing written to the site. Parsed files are in ${parsedDir}. Rerun with --apply to write.`);
}
