#!/usr/bin/env node
// Bedrock doc XML → site content JSON + a PRIVATE answer-key file.
//   node scripts/sync/parse-doc.mjs page1.xml page2.xml … --out <dir outside the repo> [--prev src/data/content]
// Pass the XML pages in the order they were read from the doc (overlapping pages are fine; blocks dedupe by id).
// --prev keeps Pick a Side / Survey ids stable when new items are inserted (sync.mjs always passes it).
// Writes <out>/{chapters,realms,glossary,questions,pick_a_side,survey,side_quests,theme}.json (public)
// and <out>/keys.json (PRIVATE: never copy it into the repo).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { blocksFromFiles, CONTENT_FILES, parseBlocks, toJson } from "./lib/parse.mjs";
import { assertOutsideRepo } from "./lib/paths.mjs";

export function parseDocFiles(files, prevDir) {
  const prev = {};
  if (prevDir) for (const f of ["pick_a_side", "survey", "theme"]) {
    try { prev[f] = JSON.parse(readFileSync(path.join(prevDir, f + ".json"), "utf8")); } catch {}
  }
  return parseBlocks(blocksFromFiles(files), prev);
}

export function writeParsed(out, parsed) {
  assertOutsideRepo(out);
  mkdirSync(out, { recursive: true });
  for (const f of CONTENT_FILES) writeFileSync(path.join(out, f + ".json"), toJson(parsed.content[f]));
  writeFileSync(path.join(out, "keys.json"), toJson(parsed.keys));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2); const files = []; let out = null; let prevDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") out = args[++i];
    else if (args[i] === "--prev") prevDir = args[++i];
    else files.push(args[i]);
  }
  if (!files.length || !out) { console.error("usage: parse-doc.mjs <xml pages…> --out <dir outside the repo> [--prev <content dir>]"); process.exit(2); }
  try {
    assertOutsideRepo(out);
    const parsed = parseDocFiles(files, prevDir);
    writeParsed(out, parsed);
    const c = parsed.content;
    console.log(`Parsed ${c.chapters.length} chapters, ${c.realms.length} realms, ${c.glossary.length} glossary words, ` +
      `${Object.values(c.questions.chapter).flat().length} chapter questions, ${Object.values(c.questions.unit).flat().length} unit questions → ${out}`);
    if (parsed.problems.length) { console.error(`\n${parsed.problems.length} PROBLEM(S):\n- ` + parsed.problems.join("\n- ")); process.exit(1); }
  } catch (e) { console.error("ERROR: " + e.message); process.exit(1); }
}
