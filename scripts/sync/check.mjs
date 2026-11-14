#!/usr/bin/env node
// Build-time safety check for the public content (runs in `npm run build`; a failure stops the build).
//  • no answer-letter marks ("[B]") or answer-ish fields in public files
//  • no Think Like a Scientist key text, if a local private keys file is around ($BEDROCK_KEYS_FILE or <sync work>/parsed/keys.json)
//  • every graded question: content-hash id, exactly 4 distinct choices, in the scrambled order; ids unique
//  • every chapter in exactly one existing realm, every realm's chapters exist, every chapter has a quiz bank
// If the private keys file is present it also checks every question has exactly one matching answer.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CONTENT_FILES } from "./lib/parse.mjs";
import { CONTENT_DIR, DEFAULT_WORK } from "./lib/paths.mjs";
import { validateContent } from "./lib/validate.mjs";

const content = Object.fromEntries(CONTENT_FILES.map((f) => [f, JSON.parse(readFileSync(path.join(CONTENT_DIR, f + ".json"), "utf8"))]));
const keyFile = process.env.BEDROCK_KEYS_FILE || path.join(DEFAULT_WORK, "parsed", "keys.json");
let keys = null;
if (existsSync(keyFile)) { try { keys = JSON.parse(readFileSync(keyFile, "utf8")); } catch { keys = null; } }

const { errors, warnings } = validateContent(content, null);
// With a local keys file: answers must match exactly one choice, and TLS key text must not be public.
// (A stale keys file from an older doc can mismatch; that's reported as a warning, not a build failure.)
if (keys) {
  const withKeys = validateContent(content, keys).errors.filter((e) => !errors.includes(e));
  const leak = withKeys.filter((e) => e.includes("appears in a public file"));
  errors.push(...leak);
  warnings.push(...withKeys.filter((e) => !leak.includes(e)).slice(0, 5).map((e) => `keys file ${keyFile}: ${e}`));
}
for (const w of warnings) console.warn("⚠ content check: " + w);
if (errors.length) {
  console.error(`✖ content check failed (${errors.length}):\n- ` + errors.slice(0, 40).join("\n- "));
  process.exit(1);
}
const q = Object.values(content.questions.chapter).flat().length + Object.values(content.questions.unit).flat().length;
console.log(`✔ content check: ${content.chapters.length} chapters in ${content.realms.length} realms, ${q} graded questions, no keys in public files${keys ? " (checked against local keys)" : ""}.`);
