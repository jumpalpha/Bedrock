// Bedrock doc (Claude Doc XML pages) → site content JSON + private answer keys.
// Deterministic: the same XML pages always give byte-identical output.
// A port of the original one-time extractor, extended with stable ids and bonus chapters.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { elements, itertext, iter, parseXml } from "./xml.mjs";

// ───────────────────────── ids ─────────────────────────
export const md5 = (s) => createHash("md5").update(s, "utf8").digest("hex");
const sha1 = (s) => createHash("sha1").update(s, "utf8").digest("hex");
export const pad2 = (n) => String(n).padStart(2, "0");

/** Chapter id as used in URLs, task keys and JSON keys: "5", "12a". */
export const chapterId = (n, suffix = "") => `${n}${suffix.toLowerCase()}`;
/** Splits "12a" → { n: 12, suffix: "a" }. */
export function splitChapterId(id) {
  const m = String(id).match(/^(\d+)([a-z]?)$/);
  if (!m) throw new Error("Bad chapter id " + id);
  return { n: Number(m[1]), suffix: m[2] };
}
/** Integer ref stored in b_keys/b_attempts for a chapter: 12 → 12, "12a" → 1201, "12b" → 1202. */
export function chapterRef(id) {
  const { n, suffix } = splitChapterId(id);
  return suffix ? n * 100 + (suffix.charCodeAt(0) - 96) : n;
}
/** Inverse of chapterRef. */
export const refToChapterId = (ref) => (ref >= 100 ? `${Math.floor(ref / 100)}${String.fromCharCode(96 + (ref % 100))}` : String(ref));
export const tlsId = (chId) => { const { n, suffix } = splitChapterId(chId); return `tls-${pad2(n)}${suffix}`; };

/** Normalized question stem: case, quotes, punctuation and spacing don't change the id. */
export const normStem = (s) =>
  s.normalize("NFKC").toLowerCase().replace(/[‘’ʼ`]/g, "'").replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const HASH_LEN = 6;
export const questionHash = (stem) => sha1(normStem(stem)).slice(0, HASH_LEN);
/** Fixed, hash-scrambled choice order: the doc's letter order (which leaks the key) never reaches the site. */
export const scramble = (id, choices) => [...choices].sort((a, b) => (md5(id + "|" + a) < md5(id + "|" + b) ? -1 : md5(id + "|" + a) > md5(id + "|" + b) ? 1 : 0));

export const slug = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
/** Section slugs for a chapter, de-duplicated with -2, -3… in doc order. */
export function sectionSlugs(sections) {
  const seen = new Map();
  return sections.map((s) => {
    const b = slug(s.heading); const k = (seen.get(b) ?? 0) + 1; seen.set(b, k);
    return k === 1 ? b : `${b}-${k}`;
  });
}

// ───────────────────────── XML pages → flat block list ─────────────────────────
function runs(p) {
  let out = "";
  for (const t of elements(p)) {
    if (t.tag === "text") {
      let s = "";
      for (const c of t.children) {
        if (typeof c === "string") { s += c; continue; }
        const inner = itertext(c);
        if (c.tag === "bold") s += "**" + inner + "**";
        else if (c.tag === "italic") s += inner.startsWith("*") ? "\\" + inner : "*" + inner + "*"; // "*" footnote lines: escape, don't italicize
        else if (c.tag === "link") s += "[" + inner + "](" + (c.attrs.href ?? "") + ")";
        else s += inner;
      }
      out += s;
    } else if (t.tag === "link") out += "[" + itertext(t) + "](" + (t.attrs.href ?? t.attrs.url ?? "") + ")";
    else out += itertext(t);
  }
  return out;
}

function makeConv(fid) {
  const conv = (e) => {
    const d = { id: fid(e.attrs.id), type: e.tag };
    if (e.tag === "paragraph") {
      d.heading = e.attrs.heading ? parseInt(e.attrs.heading, 10) : 0;
      d.text = runs(e); d.plain = itertext(e);
    } else if (e.tag === "list") {
      d.kind = e.attrs.kind; d.items = [];
      for (const li of elements(e)) {
        if (li.tag !== "listItem") continue;
        d.items.push({ id: fid(li.attrs.id), blocks: elements(li).map(conv) });
      }
    } else if (e.tag === "table") {
      d.rows = [...iter(e, "row")].map((row) => elements(row).map((c) => [...iter(c, "paragraph")].map(runs).join(" ")));
    } else {
      d.attrib = { ...e.attrs }; d.text = itertext(e);
    }
    return d;
  };
  return conv;
}

/** Reads Claude Docs XML pages (in the order they were read) and merges them into one block list, deduped by block id. */
export function blocksFromXml(xmlTexts) {
  const blocks = []; const idx = new Map();
  for (const xml of xmlTexts) {
    const root = parseXml(xml);
    if (!root || root.tag !== "doc") throw new Error("Not a Claude Docs XML page (no <doc> root)");
    let prefix = "";
    // Short ids (".123") are relative to the most recent full id ("m6ajgxrg90z.0") in document order.
    const fid = (i) => {
      if (!i) return i;
      if (i.startsWith(".")) { if (!prefix) throw new Error("XML page has a relative id before any full id: " + i); return prefix + i; }
      const dot = i.lastIndexOf("."); if (dot > 0) prefix = i.slice(0, dot);
      return i;
    };
    if (root.attrs.parent) fid(root.attrs.parent);
    const conv = makeConv(fid);
    for (const c of elements(root)) {
      if (c.tag === "gap") continue;
      const d = conv(c);
      const ex = idx.get(d.id);
      if (ex) {
        if (ex.type === "list" && d.type === "list") {
          const seen = new Set(ex.items.map((i) => i.id));
          ex.items.push(...d.items.filter((i) => !seen.has(i.id)));
        }
      } else { idx.set(d.id, d); blocks.push(d); }
    }
  }
  return blocks;
}
export const blocksFromFiles = (files) => blocksFromXml(files.map((f) => readFileSync(f, "utf8")));

// ───────────────────────── blocks → content ─────────────────────────
const fix = (s) => s.replaceAll("****", "");
function md(b) {
  if (b.type === "paragraph") return (b.heading ? "#".repeat(b.heading) + " " : "") + fix(b.text);
  if (b.type === "list") {
    const out = [];
    b.items.forEach((it, i) => {
      const mark = b.kind === "bullet" ? "- " : `${i + 1}. `;
      it.blocks.forEach((s, k) => out.push((k === 0 ? mark : "   ") + md(s)));
    });
    return out.join("\n");
  }
  if (b.type === "table") {
    const r = b.rows;
    const o = ["| " + r[0].map(fix).join(" | ") + " |", "|" + "---|".repeat(r[0].length)];
    return [...o, ...r.slice(1).map((x) => "| " + x.map(fix).join(" | ") + " |")].join("\n");
  }
  return b.text ?? "";
}
const plain = (b) => b.plain || b.text || "";
const isPara = (b) => b.type === "paragraph";

function h3split(blocks) {
  const secs = []; const pre = [];
  for (const b of blocks) {
    if (isPara(b) && b.heading === 3) secs.push({ heading: b.plain, blocks: [] });
    else if (secs.length) secs[secs.length - 1].blocks.push(b);
    else pre.push(b);
  }
  return { pre, secs };
}
function table(blocks) {
  const rows = [];
  for (const b of blocks) {
    if (b.type !== "table") continue;
    const hdr = b.rows[0];
    for (const r of b.rows.slice(1)) {
      if (JSON.stringify(r) === JSON.stringify(hdr)) continue;
      rows.push(Object.fromEntries(hdr.map((h, i) => [h, r[i]]).filter((_, i) => i < r.length)));
    }
  }
  return rows;
}
const intro = (blocks) => blocks.filter((b) => b.type !== "table").map(md).join("\n\n");
const UNIT_RE = /^Unit (\d+): ([^.\n]+)\. (.*)/;
const CHAPTER_RE = /^Chapter (\d+)([A-Za-z]?): (.*)/;
const CH_HEAD_RE = /^Chapter (\d+)([A-Za-z]?)\b/;
const QRE = /^([\s\S]*?)\s+A\)\s+([\s\S]*?)\s+B\)\s+([\s\S]*?)\s+C\)\s+([\s\S]*?)\s+D\)\s+([\s\S]*?)\s*\[([A-D])\]\s*$/;

/**
 * @param blocks  merged block list (blocksFromXml)
 * @param prev    optional current site content ({ pick_a_side, survey }) so debate/survey ids stay put when items are inserted
 * @returns { content: {chapters, realms, glossary, questions, pick_a_side, survey, side_quests, theme}, keys, problems }
 */
export function parseBlocks(blocks, prev = {}) {
  const problems = [];
  const H2 = [];
  for (const b of blocks) {
    if (isPara(b) && (b.heading === 1 || b.heading === 2)) H2.push({ title: b.plain, blocks: [] });
    else if (H2.length) H2[H2.length - 1].blocks.push(b);
    else problems.push("block before the doc title: " + plain(b).slice(0, 60));
  }
  const sec = Object.fromEntries(H2.map((s) => [s.title, s]));
  const need = (t) => { if (!sec[t]) throw new Error(`The doc has no "${t}" heading`); return sec[t]; };

  // ── chapters (realm by position: the latest "Unit N: Name." line above the chapter) ──
  const units = {}; let curUnit = 0; const chapters = []; const realmByPos = {};
  for (const s of H2) {
    const m = s.title.match(CHAPTER_RE);
    if (m) {
      const n = Number(m[1]); const suffix = m[2].toLowerCase(); const id = chapterId(n, suffix);
      realmByPos[id] = curUnit;
      const { pre, secs } = h3split(s.blocks);
      const ch = { n, id, suffix, title: m[3], sections: [], thinkLikeAScientist: null, checklist: [], keyWords: [] };
      let part = null;
      for (const x of secs) {
        const bl = x.blocks.filter((b) => !(isPara(b) && /^\*?(Unit \d+:|End of Bedrock)/.test(b.plain || "")));
        const h = x.heading;
        if (h.startsWith("Part ") && !bl.length) { part = h; continue; }
        if (h === "Think Like a Scientist") {
          const prompt = []; const std = [];
          for (const b of bl) {
            const t = md(b);
            if (isPara(b) && (b.plain.startsWith("Idaho Standards") || std.length)) std.push(t); else prompt.push(t);
          }
          ch.thinkLikeAScientist = { prompt: prompt.join("\n\n"), standards: std.join("\n\n").replace(/^\*\*Idaho Standards:\*\*\s*/, "") };
        } else if (h === "Survival Checklist") {
          for (const b of bl) {
            if (b.type === "list") ch.checklist.push(...b.items.map((it) => fix(it.blocks[0].text)));
            else problems.push(`Chapter ${id}: checklist has a non-list block`);
          }
        } else if (h === "Key Words") {
          ch.keyWords = bl.map((b) => b.plain).join(" ").split(",").map((w) => w.trim()).filter(Boolean);
        } else {
          const d = { heading: h, markdown: bl.map(md).join("\n") };
          if (part) d.part = part;
          ch.sections.push(d);
        }
      }
      if (pre.length) problems.push(`Chapter ${id} has text before its first section heading`);
      chapters.push(ch);
    }
    for (const b of s.blocks) {
      if (!isPara(b)) continue;
      const u = b.plain.match(UNIT_RE);
      if (u) { const k = Number(u[1]); units[k] ??= { name: u[2], tagline: u[3].trim(), line: b.plain }; curUnit = k; }
    }
  }

  // ── theme ──
  const th = h3split(need("Site Theme: Ranks, Badges, and Realms").blocks); const S = Object.fromEntries(th.secs.map((x) => [x.heading, x]));
  const ranks = table(S["Ranks"].blocks).map((r) => ({ order: parseInt(r["Rank"], 10), name: r["Title"], xpPlaceholder: parseInt(r["XP (placeholder)"].replaceAll(",", ""), 10), flavor: r["Flavor line"] }));
  const rb = table(S["Realm Badges"].blocks).map((r) => ({ realm: parseInt(r["Realm"].split(".")[0], 10), realmName: r["Realm"].split(". ").slice(1).join(". "), badge: r["Badge"], earnedBy: r["Earned by"] }));
  const bb = table(S["Bonus Badges"].blocks).map((r) => ({ badge: r["Badge"], earnedBy: r["Earned by"] }));
  const rdesc = {};
  for (const b of S["Realm Descriptions"].blocks) if (b.type === "list") for (const it of b.items) {
    const t = it.blocks[0].plain; const i = t.indexOf(":"); rdesc[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  const lookItem = (sec["Build Handoff for Claude Code"]?.blocks ?? []).flatMap((b) => (b.type === "list" ? b.items : [])).map((it) => it.blocks[0]?.plain ?? "").find((t) => t.startsWith("Look:"));
  const theme = {
    intro: intro(th.pre),
    ranks: { note: intro(S["Ranks"].blocks), list: ranks },
    realmBadges: { note: intro(S["Realm Badges"].blocks), list: rb },
    bonusBadges: { note: intro(S["Bonus Badges"].blocks), list: bb },
    realmDescriptions: { note: intro(S["Realm Descriptions"].blocks.filter((b) => b.type !== "list")), byRealm: rdesc },
    lookNotes: { fromBuildHandoff: lookItem ? lookItem.replace(/^Look:\s*/, "").replace(/\s*[^.]*mock-up[^.]*\.\s*$/, "") : null, fromSiteLook: null },
  };

  // ── realms (chapter ranges from the Unit Tests headings) ──
  const ranges = {};
  const ut = h3split(need("Unit Tests").blocks);
  for (const x of ut.secs) {
    const m = x.heading.match(/^Realm (\d+) Test: (.*) \(Chapters (\d+) (?:to|and) (\d+)\)/);
    if (!m) { problems.push("Unit test heading not understood: " + x.heading); continue; }
    ranges[Number(m[1])] = [m[2], Number(m[3]), Number(m[4])];
  }
  for (const ch of chapters) {
    const byRange = Object.keys(ranges).map(Number).find((k) => ranges[k][1] <= ch.n && ch.n <= ranges[k][2]);
    if (ch.suffix) {
      ch.realm = realmByPos[ch.id];
      if (!ch.realm) problems.push(`Chapter ${ch.id.toUpperCase()} is not below any "Unit N:" line, so it has no realm`);
    } else {
      ch.realm = byRange;
      if (byRange == null) problems.push(`Chapter ${ch.n} is outside every unit test's chapter range`);
      else if (realmByPos[ch.id] && realmByPos[ch.id] !== byRange) problems.push(`Chapter ${ch.n} sits under Unit ${realmByPos[ch.id]} in the doc but Realm ${byRange}'s test covers it`);
    }
  }
  const realms = Object.keys(ranges).map(Number).sort((a, b) => a - b).map((k) => {
    const [name, a, b] = ranges[k]; const u = units[k];
    if (!u) { problems.push(`No "Unit ${k}: …" line in the doc`); return null; }
    if (u.name !== name) problems.push(`Unit ${k} is called "${u.name}" but its test says "${name}"`);
    const badge = rb.find((x) => x.realm === k);
    if (!badge) problems.push(`No realm badge for realm ${k}`);
    if (rdesc[name] == null) problems.push(`No realm description for "${name}"`);
    return { n: k, name, tagline: u.tagline, unitIntro: u.line, chapters: [a, b], description: rdesc[name], badge: badge?.badge, badgeEarnedBy: badge?.earnedBy, testTitle: `Realm ${k} Test: ${name}` };
  }).filter(Boolean);
  const chaptersOut = chapters.map((c) => {
    const o = { n: c.n };
    if (c.suffix) o.id = c.id;
    Object.assign(o, { realm: c.realm, title: c.title, sections: c.sections, thinkLikeAScientist: c.thinkLikeAScientist, checklist: c.checklist, keyWords: c.keyWords });
    return o;
  });
  const chIdOfHeading = (h) => { const m = h.match(CH_HEAD_RE); return m ? chapterId(Number(m[1]), m[2]) : null; };
  const chJson = (id) => { const { n, suffix } = splitChapterId(id); return suffix ? id : n; };

  // ── glossary ──
  const glossary = [];
  for (const x of h3split(need("Glossary").blocks).secs) {
    const id = chIdOfHeading(x.heading);
    if (!id) { problems.push("Glossary heading not understood: " + x.heading); continue; }
    for (const b of x.blocks) {
      if (b.type !== "list") { problems.push("Glossary: stray text: " + plain(b).slice(0, 60)); continue; }
      for (const it of b.items) {
        const t = it.blocks[0].plain; const m = t.match(/^([\s\S]+?):\s+([\s\S]*)$/);
        if (!m) { problems.push("Glossary entry not understood: " + t.slice(0, 80)); continue; }
        glossary.push({ term: m[1].trim(), definition: m[2].trim(), chapter: chJson(id) });
      }
    }
  }

  // ── question banks + unit tests (content-hash ids, scrambled choices) ──
  const questions = { chapter: {}, unit: {} };
  const keys = { chapter: {}, unit: {}, tls: {} }; // id → { ref, answer }
  const items = (bs, where) => {
    const out = [];
    for (const b of bs) {
      if (b.type === "list") out.push(...b.items.map((it) => it.blocks[0]?.plain ?? ""));
      else if (isPara(b) && b.plain.trim()) problems.push(`${where}: stray paragraph: ${b.plain.slice(0, 80)}`);
    }
    return out;
  };
  const parseQ = (t, where) => {
    for (const L of "ABCD") {
      const c = (t.match(new RegExp(`(?:^|\\s)${L}\\)\\s`, "g")) ?? []).length;
      if (c !== 1) problems.push(`${where}: choice ${L}) appears ${c} times: ${t.slice(0, 100)}`);
    }
    const m = t.trim().match(QRE);
    if (!m) { problems.push(`${where}: question not understood (needs "Question? A) .. B) .. C) .. D) .. [X]"): ${t.slice(0, 120)}`); return null; }
    const [, q, a, b, c, d, L] = m;
    return { q: q.trim(), choices: [a, b, c, d].map((s) => s.trim()), letter: L };
  };
  const bank = (heading, kind, prefix, ref, where, list) => {
    const out = []; const seen = new Map();
    list.forEach((t, i) => {
      const r = parseQ(t, `${where} #${i + 1}`); if (!r) return;
      let id = prefix + questionHash(r.q);
      if (seen.has(id)) { // same stem twice in one bank: tell them apart by their choices
        id = prefix + sha1(normStem(r.q) + "|" + [...r.choices].map(normStem).sort().join("|")).slice(0, HASH_LEN);
        if (seen.has(id)) { problems.push(`${where} #${i + 1}: exact duplicate of #${seen.get(id)}`); return; }
      }
      seen.set(id, i + 1);
      out.push({ id, q: r.q, choices: scramble(id, r.choices) });
      keys[kind][id] = { ref, answer: r.choices["ABCD".indexOf(r.letter)] };
    });
    return out;
  };
  for (const x of h3split(need("Question Banks").blocks).secs) {
    const id = chIdOfHeading(x.heading);
    if (!id) { problems.push("Question bank heading not understood: " + x.heading); continue; }
    const { n, suffix } = splitChapterId(id);
    questions.chapter[id] = bank(x.heading, "chapter", `c${pad2(n)}${suffix}-`, chapterRef(id), `Chapter ${id.toUpperCase()} quiz`, items(x.blocks, `Chapter ${id.toUpperCase()} quiz`));
  }
  for (const x of ut.secs) {
    const m = x.heading.match(/^Realm (\d+)/); if (!m) continue;
    const r = Number(m[1]);
    questions.unit[String(r)] = bank(x.heading, "unit", `u${r}-`, r, `Realm ${r} test`, items(x.blocks, `Realm ${r} test`));
  }
  for (const x of h3split(need("Answer Keys: Think Like a Scientist").blocks).secs) {
    const id = chIdOfHeading(x.heading);
    if (!id) { problems.push("Answer key heading not understood: " + x.heading); continue; }
    keys.tls[tlsId(id)] = { ref: chapterRef(id), answer: x.blocks.map(md).join("\n") };
  }

  // ── side quests ──
  const sq = need("Side Quests").blocks; const paras = sq.filter(isPara);
  const side_quests = {
    intro: paras[0] ? md(paras[0]) : "", safetyNotes: paras.slice(1).map(md).join("\n\n"),
    quests: table(sq).map((r) => ({ n: parseInt(r["#"], 10), title: r["Side Quest"], realm: r["Realm"], task: r["What students do"], proof: r["Proof"] })),
  };

  // ── pick a side (ids kept from the current site when the question text is unchanged) ──
  const ps = need("Pick a Side: Debate Bell Ringers").blocks; const rk = {};
  for (const b of ps) if (b.type === "list") for (const it of b.items) { const t = it.blocks[0].plain; const i = t.indexOf(":"); rk[t.slice(0, i).trim()] = t.slice(i + 1).trim(); }
  const prevDeb = new Map((prev.pick_a_side?.debates ?? []).map((d) => [`${d.chapter}|${normStem(d.question)}`, d.id]));
  const usedDeb = new Set(prevDeb.values());
  const rows = table(ps).map((r) => ({ c: /^\d+$/.test(r["Ch"].trim()) ? Number(r["Ch"]) : r["Ch"].trim().toLowerCase(), r }));
  const kept = rows.map(({ c, r }) => prevDeb.get(`${c}|${normStem(r["Question"])}`));
  const cnt = {};
  const pick_a_side = {
    intro: ps.filter(isPara).map(md).join("\n\n"), ratingKey: rk,
    debates: rows.map(({ c, r }, i) => {
      const { n, suffix } = splitChapterId(String(c)); const base = `d${pad2(n)}${suffix}-`;
      let id = kept[i];
      if (!id || kept.indexOf(id) !== i) { // new (or duplicate) row: next free number in this chapter
        if (!prevDeb.size) id = base + (cnt[c] = (cnt[c] ?? 0) + 1);
        else { let k = 1; while (usedDeb.has(base + k)) k++; id = base + k; }
      }
      usedDeb.add(id);
      return { id, chapter: c, question: r["Question"], sideA: r["Side A"], sideB: r["Side B"], rating: r["Rating"] };
    }),
  };

  // ── survey of the day (numbers kept from the current site when the question text is unchanged) ──
  const sv = need("Survey of the Day").blocks;
  // Options were hand-tidied on the site after the first extraction; an unchanged question keeps its site options.
  const prevSvQ = new Map((prev.survey?.questions ?? []).map((q) => [normStem(q.question), q]));
  const prevSv = new Map([...prevSvQ].map(([k, q]) => [k, q.n]));
  const usedSv = new Set(prevSv.values()); const takenSv = new Set();
  const survey = { intro: sv.filter(isPara).map(md).join("\n\n"), questions: [] };
  const splitOpts = (s) => s.split(/,\s*(?:or\s+)?|\s+or\s+/).map((p) => p.trim().replace(/\.+$/, "")).filter(Boolean);
  const opts = (q) => {
    let m = q.match(/:\s*(.+?)\?$/); if (m && m[1].includes(" or ")) return splitOpts(m[1]);
    m = q.match(/\?\s*(.+?)\.?$/); if (m) return splitOpts(m[1]);
    m = q.match(/^Would you rather (.+?) or (.+?)\?$/); if (m) return [m[1].trim(), m[2].trim()];
    m = q.match(/^([^?]+?) or ([^?]+?)\?$/); if (m) return [m[1].trim(), m[2].trim()];
    return null;
  };
  let pos = 0;
  for (const b of sv) {
    if (b.type !== "list") continue;
    for (const it of b.items) {
      pos++;
      const t = it.blocks[0].plain; const o = opts(t);
      let n = prevSv.get(normStem(t));
      if (n == null || takenSv.has(n)) { if (!prevSv.size) n = pos; else { n = 1; while (usedSv.has(n)) n++; } }
      usedSv.add(n); takenSv.add(n);
      const d = { n, question: t };
      const was = prevSvQ.get(normStem(t));
      if (was && was.question === t) { const { n: _n, question: _q, ...rest } = was; Object.assign(d, rest); }
      else if (o) d.options = o; else { d.options = null; d.openEnded = true; }
      survey.questions.push(d);
    }
  }

  if (prev.survey?.optionsNote) survey.optionsNote = prev.survey.optionsNote;
  // The Site Look section is a picture (embed); its written summary lives on the site, so keep it.
  if (prev.theme?.lookNotes) theme.lookNotes = { ...prev.theme.lookNotes, fromBuildHandoff: theme.lookNotes.fromBuildHandoff };

  return {
    content: { chapters: chaptersOut, realms, glossary, questions, pick_a_side, survey, side_quests, theme },
    keys, problems,
  };
}

export const CONTENT_FILES = ["chapters", "realms", "glossary", "questions", "pick_a_side", "survey", "side_quests", "theme"];
/** Same formatting as the committed files (2-space JSON, no trailing newline). */
export const toJson = (x) => JSON.stringify(x, null, 2);
