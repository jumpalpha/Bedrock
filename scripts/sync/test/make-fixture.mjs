#!/usr/bin/env node
// Test fixture: takes the real doc XML pages and adds, the way Orion would in the doc,
//   • Chapter 12A "Idaho's Hot Springs" (a bonus chapter placed after Chapter 12, so inside realm 4) with its own
//     glossary words (3), quiz bank (5 questions) and Think Like a Scientist answer key,
//   • a new section in Chapter 3 ("Rock Hounding Close to Home", before Think Like a Scientist),
//   • 2 new questions at the end of the Chapter 3 quiz bank.
// The doc pages hold answer keys, so they stay outside the repo; so does the output.
//   node scripts/sync/test/make-fixture.mjs <doc pages…> --out <dir outside the repo>

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertOutsideRepo } from "../lib/paths.mjs";

const args = process.argv.slice(2); const files = []; let out = null;
for (let i = 0; i < args.length; i++) args[i] === "--out" ? (out = args[++i]) : files.push(args[i]);
if (!files.length || !out) { console.error("usage: make-fixture.mjs <doc pages…> --out <dir>"); process.exit(2); }
assertOutsideRepo(out);

const P = "m6ajgxrg90z"; let next = 900000;
const id = () => `${P}.${next++}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const runs = (t) => t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((r) => r.startsWith("**") ? `<text id='${id()}'><bold>${esc(r.slice(2, -2))}</bold></text>` : `<text id='${id()}'>${esc(r)}</text>`).join("");
const para = (t, heading) => `<paragraph id='${id()}' h='00000000'${heading ? ` heading='${heading}'` : ""}>${runs(t)}</paragraph>`;
const items = (ts) => ts.map((t) => `<listItem id='${id()}' h='00000000'>${para(t)}</listItem>`).join("");
const list = (ts, kind = "bullet") => `<list id='${id()}' h='00000000' kind='${kind}'>${items(ts)}</list>`;

const CH12A = [
  para("Chapter 12A: Idaho's Hot Springs", 2),
  para("Hot Water From Deep Down", 3),
  para("Idaho has more soakable hot springs than almost any other state. The water starts as rain and snowmelt that sinks deep into cracks in the crust. Down there, rock is hot, so the water heats up. Hot water is less dense, so it rises back up along **faults** and bubbles out as a spring."),
  para("Why Idaho?", 3),
  para("Southern Idaho sits on the track of the **Yellowstone hotspot**, and much of the state is broken by faults. Hot rock close to the surface plus plenty of cracks for water to travel through makes a perfect recipe for **geothermal** water. Boise has heated buildings with hot spring water since 1892."),
  para("Think Like a Scientist", 3),
  para("Two hot springs sit 10 miles apart. One is 40 °C, the other 85 °C. Propose two measurements that could explain the difference, and say what result would prove your idea wrong."),
  para("**Idaho Standards:** HS-ESS-2.1 (Earth's internal and surface processes)."),
  para("Survival Checklist", 3),
  list(["I can explain how groundwater gets heated.", "I can say why Idaho has so many hot springs."]),
  para("Key Words", 3),
  para("hot spring, geothermal, fault"),
];
const CH3_SECTION = [
  para("Rock Hounding Close to Home", 3),
  para("You don't need a lab to study matter. Idaho's rivers and road cuts are full of rocks you can pick up and test. Bring a hand lens, a notebook, and a streak plate, and you're doing real Earth science."),
];
const GLOSS_12A = [para("Chapter 12A: Idaho's Hot Springs", 3), list(["Hot spring: a natural spring where groundwater heated deep underground flows out at the surface.", "Geothermal: heat that comes from inside Earth.", "Hotspot: a place where a plume of hot mantle rock melts the crust above it."])];
const Q_CH3 = [
  "Which state of matter has a fixed volume but no fixed shape? A) Solid B) Liquid C) Gas D) Plasma [B]",
  "Which sphere includes all of Earth's water? A) Hydrosphere B) Geosphere C) Biosphere D) Atmosphere [A]",
];
const Q_12A = [para("Chapter 12A: Idaho's Hot Springs", 3), list([
  "Hot spring water is heated by: A) the Sun B) hot rock deep underground C) lightning D) the Moon [B]",
  "Hot water rises because it is: A) heavier B) saltier C) less dense D) frozen [C]",
  "Hot water reaches the surface along: A) faults and cracks B) clouds C) tree roots D) rivers only [A]",
  "Southern Idaho sits on the track of the: A) Hawaii hotspot B) Iceland ridge C) San Andreas Fault D) Yellowstone hotspot [D]",
  "Since 1892, Boise has used hot spring water to: A) make snow B) heat buildings C) grow rice D) power cars [B]",
], "ordered")];
const KEY_12A = [para("Chapter 12A: Idaho's Hot Springs", 3), para("**Target answer:** Measure (1) how deep each spring's water circulates (water chemistry or a nearby well's temperature with depth) and (2) how fast the water flows out. A deep, fast path stays hot. **You'd be proven wrong** if both springs have the same depth and flow rate but still differ by 45 °C.")];

const ops = [
  { anchor: "33882", before: true, xml: CH3_SECTION.join(""), what: "Chapter 3 section (before its Think Like a Scientist)" },
  { anchor: "55513", before: true, xml: CH12A.join(""), what: "Chapter 12A" },
  { anchor: "173747", before: true, xml: GLOSS_12A.join(""), what: "Glossary 12A" },
  { anchor: "204391", appendToListAfter: true, xml: items(Q_CH3), what: "Chapter 3 +2 questions" },
  { anchor: "225966", before: true, xml: Q_12A.join(""), what: "Quiz bank 12A" },
  { anchor: "268616", before: true, xml: KEY_12A.join(""), what: "Answer key 12A" },
];

mkdirSync(out, { recursive: true });
const pages = files.map((f) => readFileSync(f, "utf8"));
for (const op of ops) {
  const re = new RegExp(`<(paragraph|list) id='(?:${P})?\\.${op.anchor}'`);
  const pi = pages.findIndex((s) => re.test(s));
  if (pi < 0) throw new Error("anchor not found: " + op.what);
  let s = pages[pi]; const at = s.search(re);
  if (op.before) s = s.slice(0, at) + op.xml + s.slice(at);
  else { const l = s.indexOf("<list", at); const end = s.indexOf("</list>", l); s = s.slice(0, end) + op.xml + s.slice(end); }
  pages[pi] = s;
  console.log(`+ ${op.what} → ${path.basename(files[pi])}`);
}
pages.forEach((s, i) => writeFileSync(path.join(out, path.basename(files[i])), s));
console.log(`Fixture pages written to ${out}`);
