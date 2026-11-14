"use client";

// Realm Classwork: the Bedrock port of Dopps Class "Unit Classwork" (classwork.html).
// Per chapter: Learn → Practice → Chapter Test → Real-world stories. Then the Review Test and Turn In.
// Everything that counts is graded in the database (supabase/migrations/004_classwork_reflection.sql).

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Check, Lock, Shuffle, X } from "lucide-react";
import {
  cwGet, cwLearnStart, cwLearnSubmit, cwStatus, cwStoryOpen, cwStorySave, cwSubmit, cwSwap, cwTestStart, cwTestSubmit,
  dbReady, shuffle, useStudent, type CwLearn, type CwLearnResult, type CwTestResult, type CwWork,
} from "@/lib/db";
import { LoginDialog } from "@/components/login";
import { RULES, hints, highlightParts, scoreStory } from "./rubric";
import type { CwChapter, CwQuestion, CwRealmData, CwWord } from "./data";

// ───────────────────────── shared bits ─────────────────────────
const k = (ref: number) => String(ref);
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`block-panel mb-4 p-5 ${className}`}>{children}</div>;
}
function Banner({ tone, children }: { tone: "good" | "mid" | "bad" | "info"; children: ReactNode }) {
  const c = { good: "border-emerald/50 bg-emerald/10", mid: "border-amber/50 bg-amber/10", bad: "border-crimson/50 bg-crimson/10", info: "border-sky/50 bg-sky/10" }[tone];
  return <div className={`my-3 rounded-xl border p-3 text-sm font-bold ${c}`}>{children}</div>;
}
function Pill({ tone = "plain", children }: { tone?: "ok" | "go" | "plain"; children: ReactNode }) {
  const c = tone === "ok" ? "bg-emerald/15 text-emerald" : tone === "go" ? "bg-amber/15 text-amber" : "bg-fg/5 text-muted";
  return <span className={`mr-1.5 mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${c}`}>{children}</span>;
}
function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-2xl font-extrabold tracking-tight">{children}</h2>;
}
function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div role="status" className="fixed bottom-5 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-xl border border-line bg-ink px-4 py-2.5 text-sm font-bold shadow-xl">{msg}</div>;
}
function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => { setMsg(m); if (t.current) clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 3800); }, []);
  return { msg, show };
}

/** Log-in / database gate shared by the hub and the realm page. */
function Gate({ children }: { children: ReactNode }) {
  const { student, ready } = useStudent();
  const [login, setLogin] = useState(false);
  if (!ready) return <Card>Loading…</Card>;
  if (!dbReady) return <Card><b>Preview:</b> Classwork turns on once the class database is connected.</Card>;
  if (!student)
    return (
      <Card>
        <H2>Log in first</H2>
        <p className="mt-2 text-muted">Classwork saves your Learn scores, tests and stories to your account, so you need to log in with your name and PIN.</p>
        <button onClick={() => setLogin(true)} className="btn-block btn-grass mt-4">Log in</button>
        {login && <LoginDialog onClose={() => setLogin(false)} />}
      </Card>
    );
  return <>{children}</>;
}

// ───────────────────────── hub ─────────────────────────
export type HubRealm = { n: number; name: string; color: string; icon: string; chapters: { ref: number; label: string }[]; words: number; storiesNeeded: number };

export function ClassworkHub({ realms }: { realms: HubRealm[] }) {
  return <Gate><Hub realms={realms} /></Gate>;
}

function Hub({ realms }: { realms: HubRealm[] }) {
  const [st, setSt] = useState<{ open: boolean; realms?: CwWork[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { cwStatus().then(setSt).catch((e) => setErr(e.message)); }, []);
  if (err) return <Card><b>Couldn&apos;t load Classwork:</b> {err}</Card>;
  if (!st) return <Card>Loading your classwork…</Card>;
  if (!st.open) return <Card><H2>Coming soon</H2><p className="mt-2 text-muted">Classwork isn&apos;t open yet. Mr. Dopp will turn it on.</p></Card>;
  const by = new Map((st.realms ?? []).map((w) => [w.realm, w]));
  return (
    <>
      <Card>
        <H2>Your realms</H2>
        <p className="mt-2 text-muted">
          Each realm is split into chapters. In every chapter: <b className="text-fg">Learn</b> the words (80% to move on), <b className="text-fg">Practice</b>,
          take the <b className="text-fg">Chapter Test</b>, and write <b className="text-fg">3 short real-world stories</b>. Then take the realm&apos;s
          <b className="text-fg"> Review Test</b> and turn the realm in. Only Mr. Dopp reads your stories.
        </p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {realms.map((r) => {
          const w = by.get(r.n);
          let pills: ReactNode = <Pill>Not started</Pill>;
          if (w?.status === "submitted")
            pills = <><Pill tone="ok">✓ Turned in · {w.final_score}%</Pill>{w.unit_tries > 0 && <Pill tone={w.unit_best >= RULES.reviewPass ? "ok" : "go"}>Review Test {w.unit_best}%</Pill>}</>;
          else if (w) {
            const learned = r.chapters.filter((c) => (w.learn_best[k(c.ref)] ?? 0) >= RULES.learnPass).length;
            const stories = r.chapters.reduce((t, c) => t + (w.ch_stories[k(c.ref)] ?? []).filter(Boolean).length, 0);
            pills = <><Pill tone={learned === r.chapters.length ? "ok" : "go"}>Learned {learned}/{r.chapters.length} chapters</Pill><Pill>Stories {stories}/{r.storiesNeeded}</Pill></>;
          }
          return (
            <Link key={r.n} href={`/classwork/${r.n}/`} style={{ "--accent": r.color } as CSSProperties} className="accent-card block rounded-2xl p-5">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: r.color }}>{r.icon} Realm {r.n}</div>
              <div className="mt-1 font-display text-xl font-extrabold">{r.name}</div>
              <div className="mt-1 text-sm text-muted">Chapters {r.chapters.map((c) => c.label).join(", ")} · {r.words} words</div>
              <div>{pills}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

// ───────────────────────── realm page ─────────────────────────
type View = { ch: number; step: Step } | { ch: "review" | "done" };
type Step = "learn" | "practice" | "test" | "stories";

export function ClassworkRealm({ data }: { data: CwRealmData }) {
  return <Gate><Realm data={data} /></Gate>;
}

function Realm({ data }: { data: CwRealmData }) {
  const { student } = useStudent();
  const [W, setW0] = useState<CwWork | null>(null);
  const [skew, setSkew] = useState(0);
  const [closed, setClosed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const toast = useToast();
  const now = useNow();
  const setW = useCallback((w: CwWork) => { setW0(w); setSkew(Date.parse(w.now) - Date.now()); }, []);

  const byRef = useMemo(() => new Map(data.chapters.map((c) => [c.ref, c])), [data.chapters]);
  const learnBest = (ref: number) => W?.learn_best[k(ref)] ?? 0;
  const learnOk = (ref: number) => learnBest(ref) >= RULES.learnPass;
  const refs = data.chapters.map((c) => c.ref);
  const chOpen = (ref: number) => refs.slice(0, refs.indexOf(ref)).every(learnOk);
  const storiesDone = (ref: number) => (W?.ch_stories[k(ref)] ?? []).filter(Boolean).length;
  const need = (ref: number) => W?.need[k(ref)] ?? 3;
  const allLearned = () => refs.every(learnOk);
  const allStories = () => refs.every((r) => storiesDone(r) >= need(r));
  const waitLeft = (key: string) => {
    if (!W?.last_try?.[key]) return 0;
    return Math.max(0, Math.ceil((Date.parse(W.last_try[key]) + W.cooldown * 1000 - (now + skew)) / 1000));
  };

  useEffect(() => {
    (async () => {
      try {
        const st = await cwStatus();
        if (!st.open) { setClosed(true); return; }
        const w = await cwGet(data.n);
        setW(w);
        // land on the first chapter that still needs something
        if (w.status === "submitted") setView({ ch: "done" });
        else {
          const ok = (r: number) => (w.learn_best[k(r)] ?? 0) >= RULES.learnPass;
          const next = data.chapters.find((c) => !ok(c.ref) || (w.ch_stories[k(c.ref)] ?? []).filter(Boolean).length < (w.need[k(c.ref)] ?? 3));
          setView(next ? { ch: next.ref, step: ok(next.ref) ? "stories" : "learn" } : { ch: "review" });
        }
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [data, setW]);

  if (err) return <Card><b>Couldn&apos;t load Classwork:</b> {err}</Card>;
  if (closed) return <Card><H2>Coming soon</H2><p className="mt-2 text-muted">Classwork isn&apos;t open yet. Mr. Dopp will turn it on.</p></Card>;
  if (!W || !view) return <Card>Loading your classwork…</Card>;

  const sub = W.status === "submitted";
  const reviewOpen = sub || (allLearned() && allStories());
  const go = (v: View) => { setView(v); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const tabs: { key: string; label: string; on: boolean; done: boolean; open: boolean; v: View }[] = [
    ...data.chapters.map((c) => ({
      key: k(c.ref), label: `Ch ${c.label}`, on: view.ch === c.ref, done: learnOk(c.ref) && storiesDone(c.ref) >= need(c.ref),
      open: sub || chOpen(c.ref), v: { ch: c.ref, step: "learn" } as View,
    })),
    { key: "review", label: "Review Test", on: view.ch === "review", done: W.unit_best >= RULES.reviewPass, open: reviewOpen, v: { ch: "review" } },
    { key: "done", label: "Turn In", on: view.ch === "done", done: sub, open: reviewOpen, v: { ch: "done" } },
  ];
  const ctx: Ctx = { data, W, setW, toast: toast.show, waitLeft, learnOk, learnBest, storiesDone, need, go, student: student?.name ?? "" };

  return (
    <>
      <p className="mb-4"><Link href="/classwork/" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-fg"><ArrowLeft className="size-4" /> All realms</Link></p>
      {W.returned_at && !sub && <Banner tone="info">Mr. Dopp returned this realm so you can make changes. Turn it in again when you&apos;re done.</Banner>}
      <StepTabs items={tabs.map((t) => ({ ...t, onClick: () => go(t.v) }))} />
      {view.ch === "review" ? <ReviewTest ctx={ctx} /> : view.ch === "done" ? <TurnIn ctx={ctx} />
        : <ChapterPane ctx={ctx} c={byRef.get(view.ch)!} step={learnOk(view.ch) ? (view as { step: Step }).step : "learn"} setStep={(s) => setView({ ch: view.ch as number, step: s })} />}
      <Toast msg={toast.msg} />
    </>
  );
}

type Ctx = {
  data: CwRealmData; W: CwWork; setW: (w: CwWork) => void; toast: (m: string) => void; waitLeft: (k: string) => number;
  learnOk: (r: number) => boolean; learnBest: (r: number) => number; storiesDone: (r: number) => number; need: (r: number) => number;
  go: (v: View) => void; student: string;
};

function StepTabs({ items }: { items: { key: string; label: string; on: boolean; done: boolean; open: boolean; onClick: () => void }[] }) {
  return (
    <div className="mb-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${items.length > 4 ? 92 : 120}px, 1fr))` }}>
      {items.map((t) => (
        <button key={t.key} disabled={!t.open} onClick={t.onClick} aria-current={t.on ? "step" : undefined}
          className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-45 ${
            t.on ? "border-gold bg-gold text-[#10140e]" : "border-line hover:border-fg/40"}`}>
          {!t.open ? <Lock className="size-3.5" /> : t.done ? <Check className={`size-4 ${t.on ? "" : "text-emerald"}`} /> : null}{t.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── chapter ─────────────────────────
function ChapterPane({ ctx, c, step, setStep }: { ctx: Ctx; c: CwChapter; step: Step; setStep: (s: Step) => void }) {
  const { W, learnOk, learnBest, storiesDone, need } = ctx;
  const ok = learnOk(c.ref);
  const ct = W.ch_test[k(c.ref)];
  const steps: { key: Step; label: string; open: boolean; done: boolean }[] = [
    { key: "learn", label: "1. Learn", open: true, done: ok },
    { key: "practice", label: "2. Practice", open: ok, done: false },
    { key: "test", label: "3. Chapter Test", open: ok, done: !!ct },
    { key: "stories", label: "4. Stories", open: ok, done: storiesDone(c.ref) >= need(c.ref) },
  ];
  return (
    <>
      <div className="block-panel mb-3 px-5 py-3">
        <b className="font-display text-lg font-extrabold">Chapter {c.label}: {c.title}</b>
        <span className="text-sm text-muted"> · {c.words.length} words · Learn best {learnBest(c.ref)}%{ct ? ` · Test best ${ct.best}%` : ""} · Stories {storiesDone(c.ref)}/{need(c.ref)}</span>
      </div>
      <StepTabs items={steps.map((s) => ({ ...s, on: s.key === step, onClick: () => setStep(s.key) }))} />
      {step === "learn" && <LearnStep key={c.ref} ctx={ctx} c={c} next={() => setStep("practice")} />}
      {step === "practice" && <PracticeStep key={c.ref} ctx={ctx} c={c} next={() => setStep("test")} />}
      {step === "test" && (
        <TestBlock key={c.ref} ctx={ctx} refN={c.ref} title={`Chapter ${c.label} Test`} best={ct?.best ?? 0} tries={ct?.tries ?? 0} waitKey={`T${c.ref}`}
          intro={<>20 questions from Chapter {c.label}: about 8 make you think a situation through and 12 check the facts. There&apos;s no passing score here, so use it to see what you know. Retake it as often as you want, 15 minutes apart. Your best score counts.</>}
          after={<button onClick={() => setStep("stories")} className="btn-block">Go to Stories →</button>} />
      )}
      {step === "stories" && <StoriesStep key={c.ref} ctx={ctx} c={c} />}
    </>
  );
}

// 1. LEARN — every chapter word, one shared list of definitions (plus a few from nearby chapters)
function LearnStep({ ctx, c, next }: { ctx: Ctx; c: CwChapter; next: () => void }) {
  const { W, setW, toast, waitLeft, learnOk, learnBest, data } = ctx;
  const [learn, setLearn] = useState<CwLearn | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [res, setRes] = useState<CwLearnResult | null>(null);
  const [busy, setBusy] = useState(false);
  const tries = W.learn_tries[k(c.ref)] ?? 0;
  const grade = W.learn_grade[k(c.ref)] ?? learnBest(c.ref);
  const wait = waitLeft(`L${c.ref}`);

  if (W.status === "submitted") return <Card>This realm is turned in. Learn best for Chapter {c.label}: <b>{learnBest(c.ref)}%</b>.</Card>;

  const start = async () => {
    setBusy(true);
    try { const l = await cwLearnStart(data.n, c.ref); setLearn(l); setPicks(l.words.map(() => -1)); setRes(null); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const send = async () => {
    const left = picks.filter((p) => p < 0).length;
    if (left && !confirm(`${left} word(s) have no definition and will count as wrong. Check anyway?`)) return;
    setBusy(true);
    try { const r = await cwLearnSubmit(data.n, picks); setRes(r); setW(r.work); setLearn(null); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  if (learn) {
    const left = picks.filter((p) => p < 0).length;
    return (
      <Card>
        <H2>Learn: Chapter {c.label}</H2>
        <p className="mt-1 text-sm text-muted">{learn.words.length} words. Pick the definition that matches each word. You can use a definition more than once, and a few belong to other chapters.</p>
        <ol className="mt-3">
          {learn.words.map((w, i) => (
            <li key={w} className="border-t border-line py-3">
              <label className="block font-extrabold" htmlFor={`lw${i}`}>{i + 1}. {w}</label>
              <select id={`lw${i}`} value={picks[i]} onChange={(e) => setPicks((p) => p.map((x, j) => (j === i ? +e.target.value : x)))}
                className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm font-semibold">
                <option value={-1}>Pick the definition…</option>
                {learn.defs.map((d, j) => <option key={j} value={j}>{d}</option>)}
              </select>
            </li>
          ))}
        </ol>
        <div className="sticky bottom-3 mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-ink p-3">
          <span className="text-sm font-extrabold">{left ? `${left} left` : "All answered"}</span>
          <button onClick={send} disabled={busy} className="btn-block btn-grass disabled:opacity-50">{busy ? "Checking…" : "Check my answers"}</button>
        </div>
      </Card>
    );
  }

  const r = res && res.ref === c.ref ? res : null;
  return (
    <Card>
      <H2>Learn the words</H2>
      <p className="mt-2">Match every Chapter {c.label} word with its definition. The list has every definition from this chapter plus a few from nearby chapters, and you can use any definition more than once, so read carefully. You need <b>{RULES.learnPass}%</b> to move on. You can retake it (15 minutes apart). Your grade is the <b>average of all your tries</b>, so do your best every time.</p>
      {r && (
        <Banner tone={r.score >= RULES.learnPass ? "good" : "mid"}>
          Last try: {r.score}% ({r.right}/{r.total}). {r.passed ? (r.score >= RULES.learnPass ? "Passed! The next chapter is open." : "You already passed with your best score.") : "Study the ones you missed and try again."}
        </Banner>
      )}
      <p className="mt-2 text-sm">Best: <b>{learnBest(c.ref)}%</b> · Grade (average): <b>{grade}%</b> · Tries: {tries}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={start} disabled={busy || wait > 0} className="btn-block btn-grass disabled:opacity-50">{wait > 0 ? `Retake in ${mmss(wait)}` : tries ? "Try again" : "Start Learn"}</button>
        {learnOk(c.ref) && <button onClick={next} className="btn-block">Go to Practice →</button>}
      </div>
      {r && r.misses.length > 0 && (
        <div className="mt-5">
          <h3 className="font-extrabold">{r.reveal ? "Missed (with the right definition)" : "Words you missed"}</h3>
          {!r.reveal && <p className="text-sm text-muted">Look these up in the chapter or the flashcards. The definitions show here after you pass or after 3 tries.</p>}
          <ul className="mt-2 grid gap-1.5">
            {r.misses.map((m) => <li key={m.i} className="rounded-lg bg-fg/5 px-3 py-2 text-sm"><b className="text-sky">{m.term}</b>{m.def ? ` — ${m.def}` : ""}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

// 2. PRACTICE — flashcards + matching + word list (no points)
function PracticeStep({ c, next }: { ctx: Ctx; c: CwChapter; next: () => void }) {
  const [mode, setMode] = useState<"flash" | "match" | "list">("flash");
  return (
    <Card>
      <H2>Practice</H2>
      <p className="mt-1 text-sm text-muted">No points. Practice until you know these cold, then take the Chapter Test.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["flash", "match", "list"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`btn-block !text-sm ${mode === m ? "btn-grass" : ""}`}>{m === "flash" ? "🃏 Flashcards" : m === "match" ? "🧩 Matching" : "📖 Word list"}</button>
        ))}
        <button onClick={next} className="btn-block !text-sm">Take the Chapter Test →</button>
      </div>
      <div className="mt-4">
        {mode === "flash" ? <Flashcards words={c.words} /> : mode === "match" ? <Matching words={c.words} /> : (
          <ul className="grid gap-1.5">{c.words.map((w) => <li key={w.t} className="rounded-lg bg-fg/5 px-3 py-2 text-sm"><b className="text-sky">{w.t}</b> — {w.d}</li>)}</ul>
        )}
      </div>
    </Card>
  );
}

function Flashcards({ words }: { words: CwWord[] }) {
  // Rendered only in the browser (behind the log-in gate), so shuffling during the first render is safe.
  const [deck, setDeck] = useState<CwWord[]>(() => shuffle(words));
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const w = deck[i];
  const move = (d: number) => { setI((x) => (x + d + deck.length) % deck.length); setFlip(false); };
  return (
    <>
      <button onClick={() => setFlip((f) => !f)} aria-label="Flip card"
        className={`grid min-h-44 w-full place-items-center rounded-2xl border-2 p-6 text-center transition ${flip ? "border-sky bg-sky/10 text-base font-semibold" : "border-gold/70 font-display text-2xl font-extrabold"}`}>
        {flip ? w.d : w.t}
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button onClick={() => move(-1)} className="btn-block !text-sm">← Back</button>
        <span className="text-center text-xs font-bold text-muted">{i + 1} / {deck.length} · tap the card to flip</span>
        <button onClick={() => move(1)} className="btn-block !text-sm">Next →</button>
      </div>
      <button onClick={() => { setDeck(shuffle(words)); setI(0); setFlip(false); }} className="btn-block mt-3 !text-sm"><Shuffle className="size-4" /> Shuffle</button>
    </>
  );
}

function Matching({ words }: { words: CwWord[] }) {
  type R = { left: { w: CwWord; done: boolean }[]; right: { w: CwWord; done: boolean }[]; sel: number | null };
  const deal = useCallback((): R => { const pick = shuffle(words).slice(0, 6); return { left: pick.map((w) => ({ w, done: false })), right: shuffle(pick).map((w) => ({ w, done: false })), sel: null }; }, [words]);
  const [round, setRound] = useState<R>(deal);
  const [bad, setBad] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const tapRight = (j: number) => {
    if (round.sel == null) { setMsg("Tap a word first."); return; }
    const a = round.left[round.sel], z = round.right[j];
    if (a.w === z.w) {
      const nr = { left: round.left.map((x, i) => (i === round.sel ? { ...x, done: true } : x)), right: round.right.map((x, i) => (i === j ? { ...x, done: true } : x)), sel: null };
      setRound(nr); setMsg("");
      if (nr.left.every((x) => x.done)) { setMsg("Round cleared! New words coming up."); setTimeout(() => { setRound(deal()); setMsg(""); }, 900); }
    } else { setBad(j); setTimeout(() => setBad(null), 500); }
  };
  const cell = "rounded-xl border-2 p-2.5 text-left text-sm font-semibold transition disabled:cursor-default";
  return (
    <>
      <p className="mb-2 text-sm text-muted">Tap a word, then tap its definition. {msg && <b className="text-fg">{msg}</b>}</p>
      <div className="grid grid-cols-[1fr_1.6fr] gap-2">
        {round.left.map((x, i) => (
          <FragmentPair key={i}>
            <button disabled={x.done} onClick={() => setRound({ ...round, sel: i })}
              className={`${cell} ${x.done ? "border-emerald/60 bg-emerald/10 opacity-60" : round.sel === i ? "border-sky bg-sky/10" : "border-line"}`}>{x.w.t}</button>
            <button disabled={round.right[i].done} onClick={() => tapRight(i)}
              className={`${cell} ${round.right[i].done ? "border-emerald/60 bg-emerald/10 opacity-60" : bad === i ? "border-crimson bg-crimson/10" : "border-line"}`}>{round.right[i].w.d}</button>
          </FragmentPair>
        ))}
      </div>
    </>
  );
}
const FragmentPair = ({ children }: { children: ReactNode }) => <>{children}</>;

// 3. CHAPTER TEST / REVIEW TEST — graded in the database. Shows right/wrong, never the right answer.
function TestBlock({ ctx, refN, title, intro, best, tries, waitKey, after }: {
  ctx: Ctx; refN: number | null; title: string; intro: ReactNode; best: number; tries: number; waitKey: string; after?: ReactNode;
}) {
  const { data, setW, toast, waitLeft } = ctx;
  const [test, setTest] = useState<{ ids: string[]; opts: Record<string, string[]> } | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [res, setRes] = useState<(CwTestResult & { picks: Record<string, string>; ids: string[] }) | null>(null);
  const [busy, setBusy] = useState(false);
  const wait = waitLeft(waitKey);
  const Q = (id: string): CwQuestion | undefined => data.questions[id];

  const start = async () => {
    setBusy(true);
    try {
      const r = await cwTestStart(data.n, refN);
      if (r.ids.some((id) => !Q(id))) throw new Error("Some questions are missing. Reload the page and try again.");
      setTest({ ids: r.ids, opts: Object.fromEntries(r.ids.map((id) => [id, shuffle(Q(id)!.choices)])) });
      setPicks({}); setRes(null);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!test) return;
    const left = test.ids.filter((id) => !picks[id]).length;
    if (left && !confirm(`${left} question(s) are blank and will count as wrong. Check anyway?`)) return;
    setBusy(true);
    try { const r = await cwTestSubmit(data.n, picks); setRes({ ...r, picks, ids: test.ids }); setW(r.work); setTest(null); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  if (test) {
    const answered = test.ids.filter((id) => picks[id]).length;
    return (
      <Card>
        <H2>{title}</H2>
        <p className="mt-1 text-sm text-muted">Some questions check facts; some ask you to think a situation through. Read every choice.</p>
        <ol className="mt-3 space-y-4">
          {test.ids.map((id, i) => (
            <li key={id} className="border-t border-line pt-3">
              <p className="font-extrabold leading-relaxed">{i + 1}. {Q(id)!.q}</p>
              <div className="mt-2 grid gap-2">
                {test.opts[id].map((o, j) => {
                  const on = picks[id] === o;
                  return (
                    <button key={o} onClick={() => setPicks((p) => ({ ...p, [id]: o }))}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left font-semibold transition ${on ? "border-emerald bg-emerald/15" : "border-line hover:border-fg/40"}`}>
                      <span className={`grid size-6 shrink-0 place-items-center rounded-lg border border-line font-mono text-[10px] font-bold ${on ? "bg-emerald text-white" : ""}`}>{"ABCD"[j]}</span>
                      <span>{o}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
        <div className="sticky bottom-3 mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-ink p-3">
          <span className="text-sm font-extrabold">{answered} / {test.ids.length} answered</span>
          <button onClick={send} disabled={busy} className="btn-block btn-grass disabled:opacity-50">{busy ? "Grading…" : "Check my answers"}</button>
        </div>
      </Card>
    );
  }

  const missed = res ? res.ids.filter((id) => !res.results[id]) : [];
  return (
    <Card>
      <H2>{title}</H2>
      <p className="mt-2">{intro}</p>
      {res && <Banner tone={res.passed ? "good" : "mid"}>Last try: {res.score}% ({res.right}/{res.total}). Your best: {res.best}%.</Banner>}
      <p className="mt-2 text-sm">Best: <b>{best}%</b> · Tries: {tries}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={start} disabled={busy || wait > 0} className="btn-block btn-grass disabled:opacity-50">{wait > 0 ? `Retake in ${mmss(wait)}` : tries ? "Take it again" : "Start"}</button>
        {after}
      </div>
      {missed.length > 0 && (
        <div className="mt-5">
          <h3 className="font-extrabold">Questions you missed</h3>
          <p className="text-sm text-muted">Bedrock never shows the right answers to graded questions. Go back to the chapter, work it out, and try again after the wait.</p>
          <ol className="mt-2 space-y-3">
            {missed.map((id) => (
              <li key={id} className="rounded-xl border border-line p-3">
                <p className="font-bold">{Q(id)?.q}</p>
                <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-crimson/10 px-2.5 py-1.5 text-sm font-semibold"><X className="mt-0.5 size-4 shrink-0 text-crimson" />{res!.picks[id] ? `Your answer: ${res!.picks[id]}` : "No answer"}</p>
                {Q(id)?.think && <p className="mt-1.5 text-xs font-bold text-muted">Think-it-through question: reread the chapter section and reason it out.</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

function ReviewTest({ ctx }: { ctx: Ctx }) {
  const { W, data } = ctx;
  return (
    <TestBlock ctx={ctx} refN={null} title={`Realm ${data.n} Review Test`} best={W.unit_best} tries={W.unit_tries} waitKey="U"
      intro={<>20 questions from every chapter in this realm ({data.chapters.map((c) => c.label).join(", ")}). You need <b>{RULES.reviewPass}%</b> to pass. Retake it as often as you want, 15 minutes apart: your best score is your Review Test grade, separate from your Classwork score. (This is not the 2-try Realm Test on the Unit Tests page.)</>}
      after={W.unit_best >= RULES.reviewPass ? <Pill tone="ok">✓ Passed</Pill> : null} />
  );
}

// 4. STORIES — real-world stories, 2 chapter words each
function StoriesStep({ ctx, c }: { ctx: Ctx; c: CwChapter }) {
  const { W, need } = ctx;
  const n = need(c.ref);
  const swapMax = W.swap_max[k(c.ref)] ?? 0;
  const swapLeft = swapMax - W.swapped.filter((s) => s.ref === c.ref).length;
  return (
    <>
      <Card>
        <H2>Chapter {c.label} Stories</H2>
        <p className="mt-2">Write <b>{n} short {n === 1 ? "story" : "stories"}</b> from your own life: something you saw, did, felt or heard about (a hike, a storm, a rock you found, a trip, the news). Each uses <b>2 different words</b> from Chapter {c.label}{n > 1 ? ` (${2 * n} words total)` : ""} and needs at least <b>{RULES.minWords} words</b>.</p>
        <Banner tone="info">🔒 Only Mr. Dopp reads these. Your story must be true or based on real life. {swapMax ? `No story for a word? Tap "No story for this word" and pick another one (${swapLeft} swap left for this chapter).` : "This chapter has only a few story words, so there is no word swap here."}</Banner>
        <p className="text-sm text-muted">Each story is scored out of 100: length 40 · both words used 30 · real detail (2+ sentences and a who, where or when) 30.</p>
      </Card>
      {Array.from({ length: n }, (_, i) => <StorySlot key={`${c.ref}:${i}:${W.ch_stories[k(c.ref)]?.[i]?.saved_at ?? ""}`} ctx={ctx} c={c} slot={i} />)}
    </>
  );
}

const openedAt: Record<string, number> = {};

function StorySlot({ ctx, c, slot }: { ctx: Ctx; c: CwChapter; slot: number }) {
  const { W, setW, toast, data } = ctx;
  const arr = W.ch_stories[k(c.ref)] ?? [];
  const st = arr[slot] ?? null;
  const key = `${c.ref}:${slot}`;
  const locked = W.status === "submitted";
  const [a, setA] = useState(st?.a ?? "");
  const [b, setB] = useState(st?.b ?? "");
  const [text, setText] = useState(st?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [swap, setSwap] = useState<{ term: string; reason: string } | null>(null);
  const now = useNow();
  const used = new Set(arr.flatMap((s, j) => (s && j !== slot ? [s.a.toLowerCase(), s.b.toLowerCase()] : [])));
  const swapped = new Set(W.swapped.filter((s) => s.ref === c.ref).map((s) => s.term.toLowerCase()));
  const choices = c.words.filter((w) => w.s && !used.has(w.t.toLowerCase()) && !swapped.has(w.t.toLowerCase()));
  const def = (t: string) => c.words.find((w) => w.t === t)?.d;
  const sc = scoreStory(text, a, b);
  const h = hints(sc, a, b);
  const swapMax = W.swap_max[k(c.ref)] ?? 0;
  const t0 = openedAt[key] ?? (W.story_open[key] ? Date.parse(W.story_open[key]) : 0);
  const waitS = t0 ? Math.max(0, Math.ceil(RULES.minSeconds - (now - t0) / 1000)) : 0;

  const onFocus = () => {
    if (locked || openedAt[key]) return;
    openedAt[key] = W.story_open[key] ? Date.parse(W.story_open[key]) : Date.now();
    cwStoryOpen(data.n, c.ref, slot).catch(() => {});
  };
  const save = async () => {
    if (!a || !b) { toast("Pick 2 words first."); return; }
    if (a === b) { toast("Pick 2 different words."); return; }
    setBusy(true);
    try { const r = await cwStorySave(data.n, c.ref, slot, a, b, text); toast(`Story ${slot + 1} saved: ${r.score.total}/100`); setW(r.work); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const doSwap = async () => {
    if (!swap?.term) { toast("Pick which word."); return; }
    try {
      const r = await cwSwap(data.n, c.ref, swap.term, swap.reason);
      setW(r.work); setSwap(null); if (a === swap.term) setA(""); if (b === swap.term) setB("");
      toast("Word swapped out. Pick a different one.");
    } catch (e) { toast((e as Error).message); }
  };
  const sel = "min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 py-2 text-sm font-semibold";
  const meter = (label: string, v: number, max: number, sub?: string) => (
    <div className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${v === max ? "bg-emerald/15 text-emerald" : "bg-fg/5"}`}>{label} {v}/{max}{sub && <><br /><span className="font-semibold text-muted">{sub}</span></>}</div>
  );

  return (
    <div className={`block-panel mb-4 p-5 ${st ? "!border-emerald/60" : ""}`}>
      <h3 className="font-display text-lg font-extrabold">Story {slot + 1}{st && <span className="ml-2 text-sm font-bold text-muted">Saved · {st.score.total}/100</span>}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {[[a, setA, "First word"], [b, setB, "Second word"]].map(([v, set, label], j) => {
          const val = v as string;
          const opts = val && !choices.some((w) => w.t === val) ? [{ t: val, d: "", s: true }, ...choices] : choices;
          return (
            <select key={j} aria-label={label as string} value={val} disabled={locked} onChange={(e) => (set as (s: string) => void)(e.target.value)} className={sel}>
              <option value="">Pick a word…</option>
              {opts.map((w) => <option key={w.t} value={w.t}>{w.t}</option>)}
            </select>
          );
        })}
      </div>
      {!locked && swapMax > 0 && !swap && <button type="button" onClick={() => {
        const picks = [a, b].filter(Boolean);
        if (!picks.length) { toast("Pick the word you have no story for first."); return; }
        setSwap({ term: "", reason: "" });
      }} className="btn-block mt-2 !px-3 !py-1.5 !text-xs">No story for this word</button>}
      {swap && (
        <div className="mt-2 rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm">
          {W.swapped.filter((s) => s.ref === c.ref).length >= swapMax ? <p>You&apos;ve used the word swap for this chapter. Pick a word you can write about.</p> : <>
            <b>No story for which word?</b>
            <div className="my-2 flex flex-wrap gap-3">
              {[a, b].filter(Boolean).map((t) => <label key={t} className="flex items-center gap-1.5 font-semibold"><input type="radio" name={`swn${key}`} checked={swap.term === t} onChange={() => setSwap({ ...swap, term: t })} /> {t}</label>)}
            </div>
            <input value={swap.reason} onChange={(e) => setSwap({ ...swap, reason: e.target.value })} placeholder="In at least 5 words, why don't you have a story for it?"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2" />
            <div className="mt-2 flex gap-2"><button onClick={doSwap} className="btn-block btn-grass !px-3 !py-1.5 !text-xs">Swap it out</button></div>
          </>}
          <button onClick={() => setSwap(null)} className="btn-block mt-2 !px-3 !py-1.5 !text-xs">Cancel</button>
        </div>
      )}
      {(a || b) && <p className="mt-2 text-sm text-muted">{[a, b].filter(Boolean).map((t) => <span key={t} className="block"><b className="text-fg">{t}:</b> {def(t)}</span>)}</p>}
      <textarea value={text} readOnly={locked} onFocus={onFocus} onChange={(e) => setText(e.target.value)}
        onPaste={(e) => { e.preventDefault(); toast("Type your story yourself. Pasting is turned off here."); }}
        onDrop={(e) => { e.preventDefault(); toast("Type your story yourself. Pasting is turned off here."); }}
        placeholder="Tell what really happened. Use both words." aria-label={`Story ${slot + 1}`}
        className="mt-3 min-h-32 w-full resize-y rounded-xl border border-line bg-ink p-3 text-[15px] leading-relaxed" />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {meter("Length", sc.length, 40, `${sc.words}/${RULES.minWords} words`)}{meter("Words", sc.used, 30)}{meter("Detail", sc.detail, 30)}
      </div>
      <div className="mt-2 text-sm text-muted">{h.length ? h.map((x) => <div key={x}>💡 {x}</div>) : <>✅ Looks complete. <b className="text-fg">Estimated {sc.total}/100</b></>}</div>
      {text.trim() && (a || b) && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
          {highlightParts(text, [a, b]).map((p, i) => p.hl ? <mark key={i} className="rounded bg-gold/40 px-0.5 font-extrabold text-fg">{p.t}</mark> : <span key={i}>{p.t}</span>)}
        </p>
      )}
      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy} className="btn-block btn-grass disabled:opacity-50">{busy ? "Saving…" : `Save story ${slot + 1}`}</button>
          {waitS > 0 && <span className="text-sm text-muted">You can save in {waitS}s. Take your time.</span>}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── turn in + certificate ─────────────────────────
function TurnIn({ ctx }: { ctx: Ctx }) {
  const { W, setW, toast, data, student } = ctx;
  const [busy, setBusy] = useState(false);
  const fin = W.final_score, ok = fin != null && fin >= RULES.minFinal;
  const tile = (v: ReactNode, label: string) => <div className="rounded-xl border border-line bg-fg/5 p-3 text-center font-display text-xl font-extrabold">{v}<small className="block font-sans text-xs font-bold text-muted">{label}</small></div>;
  if (W.status !== "submitted") {
    const submit = async () => {
      if (!confirm(`Turn in Realm ${data.n} Classwork now? Learn and stories lock after this.`)) return;
      setBusy(true);
      try { setW((await cwSubmit(data.n)).work); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
    };
    return (
      <Card>
        <H2>Turn In</H2>
        <div className="my-4 grid grid-cols-3 gap-2">{tile(W.learn_avg == null ? "—" : `${W.learn_avg}%`, "Learn average")}{tile(W.story_avg == null ? "—" : `${W.story_avg}%`, "Story average")}{tile(fin == null ? "—" : `${fin}%`, "Classwork score")}</div>
        <p className="text-sm text-muted">Classwork score = (Learn average + story average) ÷ 2. You need at least {RULES.minFinal}% to turn it in. Your Review Test is a separate grade (best so far: {W.unit_best}%).</p>
        {!ok && <Banner tone="bad">Your score is under {RULES.minFinal}%. Retake Learn in a chapter or improve a story (check the 💡 hints).</Banner>}
        <button onClick={submit} disabled={!ok || busy} className="btn-block btn-grass mt-3 disabled:opacity-50">Turn in Realm {data.n} Classwork</button>
        <p className="mt-2 text-sm text-muted">Once you turn it in, your Learn scores and stories are locked. You can still retake the Review Test.</p>
      </Card>
    );
  }
  return (
    <>
      <div className="mb-4 rounded-2xl border-4 border-double p-6 text-center" style={{ borderColor: data.color }}>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: data.color }}>Certificate of Completion</div>
        <h2 className="mt-2 font-display text-3xl font-extrabold">Realm {data.n} Classwork</h2>
        <p className="text-muted">{data.icon} {data.name} · Chapters {data.chapters.map((c) => c.label).join(", ")}</p>
        <p className="mt-3 text-xl font-extrabold">{student}</p>
        <div className="text-gradient font-display text-5xl font-extrabold">{W.final_score}%</div>
        <div className="mx-auto my-4 grid max-w-md grid-cols-3 gap-2">{tile(`${W.learn_avg}%`, "Learn average")}{tile(`${W.story_avg}%`, "Story average")}{tile(`${W.unit_best}%`, "Review Test")}</div>
        <p className="text-sm text-muted">Turned in {new Date(W.submitted_at!).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
      </div>
      <Card><b>Done!</b> Mr. Dopp sees your score on the teacher dashboard.{W.unit_best >= RULES.reviewPass ? "" : <> Don&apos;t forget the <b>Review Test</b> ({RULES.reviewPass}% to pass).</>}</Card>
    </>
  );
}
