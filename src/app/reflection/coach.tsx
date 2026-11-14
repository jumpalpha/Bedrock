"use client";

// Reflection Coach: the Bedrock port of Dopps Class reflection.html. A rule-based coach (no AI service):
// one question at a time about a chapter, at most one follow-up per answer, length feedback along the way,
// and a short paper built only from the student's own words. Saves after every answer
// (to the account when logged in, otherwise to this browser).

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, Copy, Pencil, Printer } from "lucide-react";
import { dbReady, reflectionGet, reflectionList, reflectionSave, useStudent, type ReflectionRow } from "@/lib/db";
import { HINTS, KEYS, PART_NAME, STARTERS, type Key, type Prompts } from "./prompts";

// ───────────────────────── saved state ─────────────────────────
type FollowUp = { kind: "short" | "story"; q: string; a?: string | null; skip?: boolean };
type Item = { a: string; skip?: boolean; fu?: FollowUp };
type Draft = { v: 1; tone: string; title: string; ans: Partial<Record<Key, Item>>; last?: Key | null };
const empty = (): Draft => ({ v: 1, tone: "", title: "", ans: {} });
const localKey = (id: string) => `bedrock_reflection_${id}`;
function readLocal(id: string): Draft | null {
  try { const d = JSON.parse(localStorage.getItem(localKey(id)) || "null"); return d && d.v === 1 ? d : null; } catch { return null; }
}
function writeLocal(id: string, d: Draft) { try { localStorage.setItem(localKey(id), JSON.stringify(d)); } catch {} }

// ───────────────────────── coaching rules ─────────────────────────
const words = (t?: string | null) => (String(t || "").trim().match(/\S+/g) || []).length;
// A real moment needs someone or somewhere besides "me", and an event ("one day", "when I…", "last spring"…).
const PERSON = /\b(mom|dad|mother|father|parents?|brothers?|sisters?|siblings?|friends?|coach|teachers?|grandma|grandpa|grandparents?|aunt|uncle|cousins?|team|class|family|he|she|they|we|us|someone|people|dog|ranger|guide|scout|troop|at (the|a|my|our) [a-z]+|in (the|a|my|our) [a-z]+|on (the|a|my|our) [a-z]+|river|lake|creek|mountains?|canyon|trail|desert|beach|cave|park|yard|backyard|farm|ranch|school|home|idaho|boise|yellowstone|road|highway)\b/i;
const EVENT = /\b(when|one (day|night|time|morning|afternoon|weekend|summer|winter)|last (week|night|month|year|spring|summer|fall|winter|weekend)|that (day|night|time|moment|year|summer)|happened|moment|once|trip|hike|camping|storm|earthquake|eclipse|flood|yesterday|in \d|grade|ago)\b/i;
const EXAMPLE = /\b(for example|for instance|like when|such as|one (time|day|night)|once|last (week|month|year|summer|winter|spring|fall)|yesterday|when (i|we|my|our)|the time|that (day|night))\b|\d/i;
const SHORT_SAY = ["Can you tell me a little more? Add a detail or an example.", "Keep going. What else would help someone picture it?", "Say a bit more: what did that actually look like?"];
const STORY_SAY = ["Where were you, who was there, and what exactly happened?", "Walk me through it: where were you, and what did you see first?"];
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
function followUp(key: Key, text: string): FollowUp | undefined {
  if (words(text) < 15) return { kind: "short", q: SHORT_SAY[hash(key) % SHORT_SAY.length] };
  if (key === "story" && !(PERSON.test(text) && EVENT.test(text))) return { kind: "story", q: STORY_SAY[hash(key + text.length) % STORY_SAY.length] };
}

// Length goal: a one-chapter reflection of about one page (≈300 words), so about 60 words an answer.
const GOAL_WORDS = 300, TIP_UNDER = 40;
const itemWords = (it?: Item) => (!it || (it.skip && !it.a) ? 0 : words(it.a) + (it.fu?.a ? words(it.fu.a) : 0));
const PONDER: Record<Key, string[]> = {
  before: ["Where did that idea come from: a movie, a class, a family member?", "What part of it turned out to be wrong, or right?", "What did you picture in your head?"],
  story: ["Where were you, and who was with you?", "What did you see, hear or feel right then?", "What did you think was happening, and what do you think now?"],
  learned: ["Give one example that proves the idea.", "Use one more key word from the chapter and say what it means.", "How would you explain it to a younger kid?"],
  connect: ["Name the exact place, and what it looks like.", "When did you last see it?", "Who else should know about this, and why?"],
  ahead: ["Why does that question matter to you?", "How could you find the answer?", "What would you do differently now that you know this?"],
};

// ───────────────────────── paper (own words, organized; tone changes only the framing) ─────────────────────────
type Tone = { name: string; title: (t: string) => string; lead: Record<Key, string>; close: string };
const TONES: Record<string, Tone> = {
  reflective: { name: "Reflective", title: (t) => `Looking Back at ${t}`, close: "Looking back on this chapter helped me see the Earth around me a little differently.",
    lead: { before: "When I started this chapter, I had my own ideas.", story: "One experience helps me think about it.", learned: "Now I understand it better.", connect: "I can see this in the world around me.", ahead: "As I look ahead, I still have questions." } },
  formal: { name: "Formal", title: (t) => `A Reflection on ${t}`, close: "In conclusion, this chapter changed how I understand the planet I live on.",
    lead: { before: "Prior to this chapter, my understanding was limited.", story: "A personal observation connects to this topic.", learned: "The central idea of the chapter is clear to me now.", connect: "This concept appears in the world around me.", ahead: "Several questions remain for further study." } },
  story: { name: "Story-driven", title: (t) => `My Story with ${t}`, close: "And that's where my story with this chapter continues.",
    lead: { before: "My story starts before I opened this chapter.", story: "Then something happened.", learned: "Here is what it taught me.", connect: "Now I see it everywhere.", ahead: "The next chapter of this story is still unwritten." } },
  explorer: { name: "Field explorer", title: (t) => `Field Notes: ${t}`, close: "End of field notes. More exploring to do.",
    lead: { before: "Starting point:", story: "Field observation:", learned: "What the evidence shows:", connect: "Where I've spotted it:", ahead: "Open questions for my next expedition:" } },
  conversational: { name: "Conversational", title: (t) => `Me and ${t}`, close: "So that's what this chapter means to me, at least for now.",
    lead: { before: "So, here's what I used to think.", story: "Here's a moment that stuck with me.", learned: "Here's what I get now.", connect: "And here's where I see it.", ahead: "Here's what I still wonder." } },
};
// If the student's answer already opens the way the lead-in would, skip the lead-in.
const ECHO: Partial<Record<Key, RegExp>> = { before: /^(before|when i started|i used to)\b/i, story: /^(one (time|day|night)|once|i remember|last (week|summer|year))\b/i, learned: /^(now i|the biggest)\b/i };
function clean(t?: string | null) {
  let s = String(t || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(/\bi\b/g, "I").replace(/^([a-z])/, (c) => c.toUpperCase()).replace(/([.!?])(\s+)([a-z])/g, (_m, p, sp, c) => p + sp + c.toUpperCase());
  if (!/[.!?"')]$/.test(s)) s += ".";
  return s;
}
const wordsOf = (d: Draft, key: Key) => { const it = d.ans[key]; if (!it) return ""; return [it.skip && !it.a ? "" : clean(it.a), it.fu?.a ? clean(it.fu.a) : ""].filter(Boolean).join(" "); };
function buildPaper(d: Draft, chapterTitle: string) {
  const t = TONES[d.tone] ?? TONES.reflective;
  const paras = KEYS.map((key) => { const w = wordsOf(d, key); return w ? (ECHO[key]?.test(w) ? w : `${t.lead[key]} ${w}`) : ""; }).filter(Boolean);
  paras.push(t.close);
  return { title: d.title || t.title(chapterTitle), paras };
}

// ───────────────────────── page ─────────────────────────
export type CoachChapter = { id: string; label: string; ref: number; title: string; realm: number; realmName: string; color: string; keyWords: string[]; prompts: Prompts };

export function ReflectionCoach({ ch }: { ch: CoachChapter }) {
  const { student, ready } = useStudent();
  const [D, setD] = useState<Draft | null>(null);
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState<{ key: Key; which: "a" | "fu" } | null>(null);
  const [editText, setEditText] = useState("");
  const [box, setBox] = useState("");
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const composeRef = useRef<HTMLDivElement>(null);
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloud = !!student && dbReady;

  // load: the account copy when logged in (falling back to this browser's draft), else this browser
  useEffect(() => {
    if (!ready) return;
    (async () => {
      let d: Draft | null = null;
      if (cloud) { try { const r = await reflectionGet(ch.ref); if (r?.data) d = r.data as Draft; } catch {} }
      setD(d ?? readLocal(ch.id) ?? empty());
    })();
  }, [ready, cloud, ch.id, ch.ref]);

  const persist = useCallback((d: Draft) => {
    writeLocal(ch.id, d);
    if (!cloud) { setSaved("✓ Saved on this device. Log in to keep it in your account."); return; }
    setSaved("Saving…");
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      reflectionSave(ch.ref, d).then(() => setSaved("✓ Saved to your account")).catch((e) => setSaved(`⚠ ${(e as Error).message} (still saved on this device)`));
    }, 400);
  }, [ch.id, ch.ref, cloud]);
  const update = (f: (d: Draft) => Draft) => setD((cur) => { const n = f(structuredClone(cur ?? empty())); persist(n); return n; });

  const answered = (it?: Item) => !!it && (!!it.skip || !!String(it.a || "").trim());
  const fuPending = (it?: Item) => !!it?.fu && it.fu.a == null && !it.fu.skip;
  const pending = useMemo(() => {
    if (!D) return null;
    for (const key of KEYS) {
      const it = D.ans[key];
      if (!answered(it)) return { type: "q" as const, key };
      if (fuPending(it)) return { type: "fu" as const, key };
    }
    return D.tone ? { type: "paper" as const } : { type: "tone" as const };
  }, [D]);

  useEffect(() => { if (pending && (pending.type === "q" || pending.type === "fu")) boxRef.current?.focus({ preventScroll: true }); }, [pending]);
  const scrollToCompose = () => setTimeout(() => {
    const el = composeRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight) window.scrollBy({ top: r.bottom - window.innerHeight + 16, behavior: "smooth" });
  }, 30);

  if (!D || !pending) return <div className="block-panel p-5">Loading your reflection…</div>;

  const send = () => {
    const text = box.trim(); if (!text) return;
    update((d) => {
      if (pending.type === "q") d.ans[pending.key] = { a: text, fu: followUp(pending.key, text) };
      else if (pending.type === "fu") d.ans[pending.key]!.fu!.a = text;
      d.last = pending.type === "q" || pending.type === "fu" ? pending.key : null;
      return d;
    });
    setBox(""); scrollToCompose();
  };
  const skip = () => {
    update((d) => {
      if (pending.type === "q") { d.ans[pending.key] = { a: "", skip: true }; d.last = null; }
      else if (pending.type === "fu") d.ans[pending.key]!.fu!.skip = true;
      return d;
    });
    setBox(""); scrollToCompose();
  };
  const saveEdit = () => {
    if (!editing) return;
    const v = editText.trim();
    update((d) => {
      const it = d.ans[editing.key]!;
      if (editing.which === "a") { it.a = v; it.skip = !v; } else if (it.fu) { it.fu.a = v || null; it.fu.skip = !v; }
      return d;
    });
    setEditing(null);
  };

  // pace: projected words if the rest of the answers look like these
  const done = KEYS.map((key) => D.ans[key]).filter((it) => answered(it) && !(it!.skip && !it!.a));
  const avg = done.length ? done.reduce((n, it) => n + itemWords(it), 0) / done.length : 0;
  const projected = Math.round((avg + 8) * KEYS.length);
  const low = done.length >= 2 && projected < GOAL_WORDS * 0.85;
  const nDone = KEYS.filter((key) => answered(D.ans[key])).length + (D.tone ? 1 : 0);
  const qNum = pending.type === "q" || pending.type === "fu" ? KEYS.indexOf(pending.key) + 1 : pending.type === "tone" ? 6 : 6;

  const coach = (body: React.ReactNode, label = "Coach", extra = "") => (
    <div className={`max-w-[88%] self-start rounded-2xl rounded-bl-md border border-sky/40 bg-sky/10 px-4 py-3 text-[15px] leading-relaxed ${extra}`}>
      <span className="mb-0.5 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-sky">{label}</span>{body}
    </div>
  );
  const me = (key: Key, which: "a" | "fu", text: string, skipped: boolean) =>
    editing?.key === key && editing.which === which ? (
      <div key={`${key}-${which}`} className="w-[88%] self-end rounded-2xl border border-gold/60 bg-gold/10 p-3">
        <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Edit your answer"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditing(null); }}
          className="min-h-24 w-full rounded-xl border border-line bg-ink p-2.5 text-[15px]" />
        <div className="mt-2 flex justify-end gap-2"><button onClick={() => setEditing(null)} className="btn-block !px-3 !py-1.5 !text-xs">Cancel</button><button onClick={saveEdit} className="btn-block btn-grass !px-3 !py-1.5 !text-xs">Save</button></div>
      </div>
    ) : (
      <div key={`${key}-${which}`} className={`max-w-[88%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md border border-gold/50 bg-gold/15 px-4 py-3 text-[15px] leading-relaxed ${skipped ? "italic text-muted" : ""}`}>
        {skipped ? "Skipped" : text}
        <button onClick={() => { setEditing({ key, which }); setEditText(text); }} className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-bold text-muted hover:text-fg" aria-label="Edit this answer"><Pencil className="size-3" /> Edit</button>
      </div>
    );
  const question = (key: Key) => coach(<>{ch.prompts[key]}<ul className="mt-1.5 list-disc pl-5 text-sm text-muted">{HINTS[key].map((h) => <li key={h}>{h}</li>)}</ul></>, `Coach · ${PART_NAME[key]}`);
  const lengthTip = (key: Key, it: Item) => {
    const n = itemWords(it);
    if (it.skip && !it.a) return null;
    if (n >= TIP_UNDER && !low) return null;
    const head = n < TIP_UNDER
      ? `That answer is short (${n} word${n === 1 ? "" : "s"}). ${low ? `With answers this short, your reflection will come out around ${projected} words; the goal is about ${GOAL_WORDS} (one page).` : `Short answers make a short paper; the goal is about ${GOAL_WORDS} words (one page).`}`
      : `Good detail! Your answers average ${Math.round(avg)} words, so you're on pace for about ${projected} words; the goal is about ${GOAL_WORDS}. Keep adding detail like this.`;
    return coach(<>{head}{n < TIP_UNDER && <> To say more, think about:<ul className="mt-1.5 list-disc pl-5 text-sm">{PONDER[key].map((x) => <li key={x}>{x}</li>)}</ul>
      {key === "story" ? "Slow the moment down: tell it like a scene in a movie, one step at a time." : "Or add a quick example: \"One time when…\" A real moment is the easiest way to explain what you mean."}
      <button onClick={() => { setEditing({ key, which: "a" }); setEditText(it.a); }} className="mt-2 flex items-center gap-1 text-sm font-bold text-sky underline"><Pencil className="size-3.5" /> Add more to this answer</button></>}</>,
      "Coach · length check", "border-amber/50 bg-amber/10");
  };

  const chat: React.ReactNode[] = [coach(<>Hi! I&apos;m your Reflection Coach. Let&apos;s think back on <b>Chapter {ch.label}: {ch.title}</b>, one question at a time. Use the hints so you know what to include, and tap a sentence starter if you&apos;re stuck. Your words stay your words.</>, "Coach", "")];
  for (const key of KEYS) {
    const it = D.ans[key];
    if (!it) break;
    chat.push(<div key={`q-${key}`} className="contents">{question(key)}</div>);
    chat.push(me(key, "a", it.a, !!it.skip && !it.a));
    if (it.fu) {
      chat.push(<div key={`fq-${key}`} className="contents">{coach(it.fu.q, "Coach · one more thing")}</div>);
      if (it.fu.a != null || it.fu.skip) chat.push(me(key, "fu", it.fu.a || "", !!it.fu.skip && it.fu.a == null));
    }
    if (D.last === key && !fuPending(it) && !editing) { const tip = lengthTip(key, it); if (tip) chat.push(<div key={`len-${key}`} className="contents">{tip}</div>); }
  }
  if (pending.type === "q") chat.push(<div key="pending" className="contents">{question(pending.key)}</div>);
  if (pending.type === "tone" || pending.type === "paper")
    chat.push(<div key="tone" className="contents">{coach(<>Last question! What tone would you like your reflection to have? It only changes the sentences that connect your answers.
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(TONES).map(([k, t]) => (
        <button key={k} onClick={() => update((d) => ({ ...d, tone: k }))} className={`rounded-xl border px-3 py-2 text-left text-sm font-bold ${D.tone === k ? "border-gold bg-gold/20" : "border-line hover:border-fg/40"}`}>{D.tone === k && "✓ "}{t.name}</button>
      ))}</div></>)}</div>);

  // draft check + paper
  const keyWordsUsed = ch.keyWords.filter((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(KEYS.map((key) => wordsOf(D, key)).join(" ")));
  const allText = KEYS.map((key) => wordsOf(D, key)).join(" ");
  const total = words(allText);
  const checks = [
    { ok: words(wordsOf(D, "story")) >= 15 && PERSON.test(wordsOf(D, "story")), label: "A real moment with a who or where", fix: "story" as Key },
    { ok: EXAMPLE.test(allText) || EVENT.test(allText), label: "A specific example", fix: "connect" as Key },
    { ok: keyWordsUsed.length >= 2, label: `At least 2 chapter key words (${keyWordsUsed.length ? keyWordsUsed.slice(0, 4).join(", ") : "none yet"})`, fix: "learned" as Key },
    { ok: total >= GOAL_WORDS * 0.85, label: `About one page (${total} of ~${GOAL_WORDS} words)`, fix: (KEYS.slice().sort((a, b) => words(wordsOf(D, a)) - words(wordsOf(D, b)))[0]) as Key },
  ];
  const paper = buildPaper(D, `Chapter ${ch.label}: ${ch.title}`);
  const paperText = paper.title + "\n\n" + paper.paras.join("\n\n");
  const fix = (key: Key) => {
    const it = D.ans[key];
    if (it) { setEditing({ key, which: "a" }); setEditText(it.a); setTimeout(() => document.getElementById(`chat-end`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30); }
  };

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/reflection/" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-fg"><ArrowLeft className="size-4" /> All chapters</Link>
        <Link href={`/chapters/${ch.id}/`} className="text-sm font-bold text-muted underline hover:text-fg">Reread Chapter {ch.label}</Link>
      </div>
      <div className="no-print block-panel mb-4 p-4">
        <div className="flex justify-between text-sm font-extrabold"><span>{pending.type === "paper" ? "All questions answered 🎉" : `Question ${qNum} of 6`}</span><span>{Math.round((nDone * 100) / 6)}%</span></div>
        <div className="xp-bar mt-2" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={6} aria-valuenow={nDone}><div className="xp-fill" style={{ width: `${(nDone * 100) / 6}%` }} /></div>
        {done.length >= 2 && <p className={`mt-2 text-sm font-bold ${low ? "text-amber" : "text-emerald"}`}>📏 Length: on pace for about {projected} words (goal: about {GOAL_WORDS}, one page). {low ? `Your answers average ${Math.round(avg)} words; aim for about 60.` : "Nice, keep it up!"}</p>}
      </div>

      <div className="no-print block-panel p-4 sm:p-5" style={{ "--accent": ch.color } as CSSProperties}>
        <div className="flex flex-col gap-2.5">{chat}<span id="chat-end" /></div>
        {(pending.type === "q" || pending.type === "fu") && (
          <div ref={composeRef} className="mt-4 border-t border-line pt-4">
            {pending.type === "q" && <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Sentence starters">{STARTERS[pending.key].map((s) => (
              <button key={s} onClick={() => { setBox((b) => (b.trim() ? b.replace(/\s*$/, " ") : "") + s.replace(/…$/, "") + " "); boxRef.current?.focus(); }}
                className="rounded-full border border-line px-3 py-1 text-xs font-bold text-muted hover:text-fg">{s}</button>
            ))}</div>}
            <label className="sr-only" htmlFor="coach-box">Your answer</label>
            <textarea id="coach-box" ref={boxRef} value={box} onChange={(e) => setBox(e.target.value)} placeholder="Type your answer…"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
              className="min-h-28 w-full rounded-xl border border-line bg-ink p-3 text-[15px] leading-relaxed" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">Enter sends · Shift+Enter for a new line</span>
              <span className="flex gap-2"><button onClick={skip} className="btn-block !text-sm">{pending.type === "fu" ? "Skip this one" : "Skip"}</button><button onClick={send} className="btn-block btn-grass !text-sm">Send ➤</button></span>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs font-semibold text-muted" aria-live="polite">{saved}</p>
      </div>

      {pending.type === "paper" && (
        <>
          <div className="no-print block-panel mt-4 p-5">
            <h2 className="font-display text-xl font-extrabold">Draft check</h2>
            <ul className="mt-2 space-y-1.5">{checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm font-semibold">
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs ${c.ok ? "bg-emerald/20 text-emerald" : "bg-crimson/15 text-crimson"}`}>{c.ok ? "✓" : "✗"}</span>
                <span>{c.label}{!c.ok && <button onClick={() => fix(c.fix)} className="ml-2 font-bold text-sky underline">fix it →</button>}</span>
              </li>
            ))}</ul>
          </div>
          <div className="no-print block-panel mt-4 p-5">
            <h2 className="font-display text-xl font-extrabold">Your reflection</h2>
            <p className="mt-1 text-sm text-muted">This coach doesn&apos;t write for you: your reflection is your own words, organized. Want it polished? Copy it into Docs and edit it there.</p>
            <label className="mt-3 block text-xs font-bold text-muted" htmlFor="ref-title">Title</label>
            <input id="ref-title" maxLength={120} value={D.title || paper.title} onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 font-bold" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">{total} words · tone: {(TONES[D.tone] ?? TONES.reflective).name}</span>
              <span className="flex gap-2">
                <button onClick={() => navigator.clipboard?.writeText(paperText).then(() => setCopied(true)).catch(() => {})} className="btn-block !text-sm">{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}</button>
                <button onClick={() => window.print()} className="btn-block btn-grass !text-sm"><Printer className="size-4" /> Print / PDF</button>
              </span>
            </div>
          </div>
          <article className="print-paper block-panel mt-4 p-6 sm:p-8">
            <h3 className="font-display text-2xl font-extrabold">{paper.title}</h3>
            <p className="mt-1 text-sm text-muted">{student?.name ? `${student.name} · ` : ""}Bedrock Earth Science · Chapter {ch.label}</p>
            {paper.paras.map((p, i) => <p key={i} className="mt-3 leading-relaxed">{p}</p>)}
          </article>
        </>
      )}
    </>
  );
}

// ───────────────────────── chapter picker ─────────────────────────
export type PickRealm = { n: number; name: string; color: string; icon: string; chapters: { id: string; label: string; ref: number; title: string }[] };

export function ReflectionPicker({ realms }: { realms: PickRealm[] }) {
  const { student, ready } = useStudent();
  const [rows, setRows] = useState<Record<string, { words: number; done: boolean }>>({});
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const local: Record<string, { words: number; done: boolean }> = {};
      for (const r of realms) for (const c of r.chapters) {
        const d = readLocal(c.id);
        if (d) local[c.ref] = { words: KEYS.reduce((n, key) => n + itemWords(d.ans[key]), 0), done: !!d.tone && KEYS.every((key) => !!d.ans[key]) };
      }
      let server: ReflectionRow[] = [];
      if (student && dbReady) { try { server = await reflectionList(); } catch {} }
      setRows({ ...local, ...Object.fromEntries(server.map((x) => [x.ref, { words: x.words, done: x.done }])) });
    })();
  }, [ready, student, realms]);
  return (
    <div className="space-y-8">
      {realms.map((r) => (
        <section key={r.n}>
          <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: r.color }}>{r.icon} Realm {r.n} · {r.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {r.chapters.map((c) => {
              const s = rows[c.ref];
              return (
                <Link key={c.id} href={`/reflection/${c.id}/`} style={{ "--accent": r.color } as CSSProperties} className="accent-card flex items-center gap-3 rounded-2xl p-4">
                  <span className="font-display text-3xl font-extrabold leading-none" style={{ color: r.color }}>{c.label.padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1"><span className="block font-bold leading-snug">{c.title}</span>
                    <span className={`text-xs font-bold ${s?.done ? "text-emerald" : "text-muted"}`}>{s ? (s.done ? `✓ Done · ${s.words} words` : `In progress · ${s.words} words`) : "Not started"}</span></span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
