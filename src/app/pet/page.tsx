"use client";
// ── wave-pet: My Rock Alien (Bedrock's version of the Dopps Class Wellness Sprite page) ──
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Sparkles, Trophy, Users } from "lucide-react";
import {
  dbReady, petAction, petCreate, petEquip, petGet, petQuizAnswer, petQuizStart, petRename, petShopBuy, petShopItems,
  type Pet, type PetItem, type PetQuestion,
} from "@/lib/db";
import { useProgress } from "@/lib/progress";
import { useLearn, VOCAB_PASS } from "@/lib/learn-progress";
import { realms } from "@/data/site";
import {
  FORM_NAME, HABITS, knownWords, learnedChapters, lineFor, MOOD_BUBBLE, MOOD_TEXT, PET_COLORS, quizChapters, SLOT_NAME,
  stageIndex, stageInfo, STAGES,
} from "@/data/pet";
import { PageHead } from "@/components/ui";
import { LoginDialog } from "@/components/login";
import { Alien } from "@/components/alien";

const SEEN_KEY = "bedrock_pet_seen_stage";
const CH_KEY = "bedrock_pet_quiz_ch";

export default function PetPage() {
  const { student, ready, stats } = useProgress();
  const { s: learn } = useLearn();
  const [pet, setPet] = useState<Pet | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [evolve, setEvolve] = useState<{ from: number; to: number } | null>(null);
  const [pop, setPop] = useState(0);
  const tRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((m: string) => { setToast(m); clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(null), 3400); }, []);

  const accept = useCallback((p: Pet | null) => {
    setPet(p);
    if (!p) return;
    const i = stageIndex(p.stage);
    let seen = -1;
    try { seen = Number(localStorage.getItem(SEEN_KEY) ?? -1); } catch {}
    if (seen >= 0 && i > seen) setEvolve({ from: seen, to: i });
    try { localStorage.setItem(SEEN_KEY, String(i)); } catch {}
  }, []);

  const load = useCallback(async () => {
    if (!student || !dbReady) return;
    try { accept(await petGet()); setErr(null); } catch (e) { setErr((e as Error).message); }
  }, [student, accept]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect -- async load
  // realm clears are recorded by useProgress; refresh once they arrive so the body evolves right away
  const clearedN = stats.cleared.length;
  useEffect(() => { if (pet && clearedN > pet.cleared) load(); }, [clearedN]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- async load
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden && !busy && student) petGet().then((p) => p && setPet(p)).catch(() => {}); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [busy, student]);

  const run = async (fn: () => Promise<Pet>, after?: (p: Pet, before: Pet | null | undefined) => void) => {
    if (busy) return null;
    setBusy(true);
    const before = pet;
    try { const p = await fn(); accept(p); setPop((n) => n + 1); after?.(p, before); return p; }
    catch (e) { say((e as Error).message); return null; }
    finally { setBusy(false); }
  };

  const words = useMemo(() => pet ? knownWords(pet.learned ?? [], learnedChapters(learn, stats.done, VOCAB_PASS)) : [], [pet, learn, stats.done]);

  return (
    <>
      <PageHead eyebrow="Class pet" title={pet?.name ? <>My rock alien: <span className="text-gradient">{pet.name}</span></> : "My Rock Alien"}
        sub="A little crystal alien crash-landed at Craters of the Moon. Adopt it, name it, teach it words, and watch it travel the rock cycle as you clear realms.">
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/pets/" className="btn-block !text-sm"><Users className="size-4" /> Alien Gallery</Link>
          <Link href="/champions/" className="btn-block !text-sm"><Trophy className="size-4" /> Hall of Champions</Link>
        </div>
      </PageHead>
      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        {!dbReady ? <p className="block-panel p-4 font-bold">Preview: your alien comes to life once the class database is connected.</p>
          : !ready ? null
          : !student ? <SignIn />
          : err && pet === undefined ? <p className="block-panel p-4 font-bold text-crimson">{err}</p>
          : pet === undefined ? <p className="block-panel p-4 font-bold text-muted">Scanning the crater for your alien…</p>
          : pet === null ? <Adopt onDone={(p) => { accept(p); say("Your geode landed! Log a field habit or answer a question to wake it up."); }} />
          : <PetView pet={pet} busy={busy} run={run} say={say} words={words} pop={pop} />}
      </div>
      {evolve && <Evolution from={evolve.from} to={evolve.to} pet={pet!} onClose={() => setEvolve(null)} />}
      {toast && createPortal(<div role="status" className="fixed inset-x-4 bottom-5 z-[60] mx-auto max-w-md animate-rise rounded-2xl border border-line bg-ink-2 px-4 py-3 text-center font-bold shadow-2xl">{toast}</div>, document.body)}
    </>
  );
}

function SignIn() {
  const [open, setOpen] = useState(false);
  return (
    <section className="block-panel mx-auto max-w-xl p-6 text-center">
      <Alien a={{ stage: "geode", color: "amethyst", alive: true }} size={160} className="mx-auto" />
      <h2 className="pixel-title mt-3 text-2xl">Log in to adopt your alien</h2>
      <p className="mt-2 text-muted">Your alien lives on your Quest account, so it follows you to any device.</p>
      <button onClick={() => setOpen(true)} className="btn-block btn-grass mt-4 justify-center">Log in / Join</button>
      {open && <LoginDialog onClose={() => setOpen(false)} />}
    </section>
  );
}

function Adopt({ onDone }: { onDone: (p: Pet) => void }) {
  const [color, setColor] = useState("amethyst");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!name.trim()) { setErr("Give your alien a name first."); return; }
    setBusy(true); setErr(null);
    try { onDone(await petCreate(name.trim(), color)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="block-panel p-5 sm:p-7">
      <h2 className="pixel-title text-2xl">Something crashed near Craters of the Moon…</h2>
      <p className="mt-2 max-w-3xl text-muted">Inside a still-warm geode is a tiny rock alien. Pick its crystal color and give it a name. It grows through the rock cycle all year:
        pebble, sandstone, quartzite, magma, granite and, at Diamond rank, a mountain titan. Look after it and it thrives. Ignore it for about 4 days and it goes dormant.</p>
      <div className="mt-5 flex flex-wrap gap-3" role="radiogroup" aria-label="Crystal color">
        {PET_COLORS.map((c) => (
          <button key={c.key} type="button" role="radio" aria-checked={color === c.key} onClick={() => setColor(c.key)}
            className={`grid place-items-center rounded-2xl border-2 p-2 transition ${color === c.key ? "border-gold bg-gold/10" : "border-line hover:border-muted"}`}>
            <Alien a={{ stage: "pebble", color: c.key, alive: true, mood_label: "happy" }} size={92} anim={color === c.key} />
            <span className="text-xs font-extrabold" style={{ color: c.hex }}>{c.name}</span>
          </button>
        ))}
      </div>
      <label className="mt-5 block max-w-sm text-sm font-extrabold">Name your alien
        <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="e.g. Pumice"
          className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 font-semibold" />
      </label>
      <p className="mt-1 text-xs text-muted">Classmates see the name once Mr. Dopp approves it. Keep it school-friendly.</p>
      <button disabled={busy} onClick={go} className="btn-block btn-grass mt-4 disabled:opacity-50">🪨 Adopt my alien</button>
      {err && <p className="mt-2 text-sm font-bold text-crimson">{err}</p>}
    </section>
  );
}

type Run = (fn: () => Promise<Pet>, after?: (p: Pet, before: Pet | null | undefined) => void) => Promise<Pet | null>;

function PetView({ pet, busy, run, say, words, pop }: { pet: Pet; busy: boolean; run: Run; say: (m: string) => void; words: string[]; pop: number }) {
  const mood = !pet.alive ? "dormant" : pet.stage === "geode" ? "geode" : pet.mood_label;
  const today = pet.today ?? {}, caps = pet.caps ?? {};
  const left = (k: string) => Math.max(0, (caps[k] ?? 0) - (today[k] ?? 0));
  const si = stageIndex(pet.stage), next = STAGES[si + 1];
  const act = (k: string) => run(() => petAction(k), (p, before) => {
    const h = HABITS.find((x) => x.k === k);
    if (before && before.stage === "geode" && p.stage !== "geode") say(`🥚 ${p.name} woke up! It's a ${stageInfo(p.stage).name}.`);
    else if (h) say(`${h.ico} ${h.tip}`);
    else if (k === "junk") say("🛰️ Crunchy… but space junk costs health and heat.");
    else say(`🪨 ${p.name} had fun skipping stones!`);
  });
  const bars: [string, number][] = [["❤️ Health", pet.health], ["🪨 Minerals", pet.minerals], ["🔥 Heat", pet.heat], ["😊 Mood", pet.mood], ["✨ Shine", pet.shine]];
  const barColor = (v: number) => (v >= 60 ? "var(--color-emerald)" : v >= 30 ? "var(--color-gold)" : "var(--color-crimson)");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="space-y-5">
        <section className="block-panel p-5">
          <Bubble mood={mood} words={words} name={pet.name} />
          <div key={pop} className="mx-auto mt-2 w-fit animate-rise"><Alien a={pet} size={260} /></div>
          <NameRow pet={pet} run={run} say={say} />
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-extrabold">
            <Chip>{pet.form ? `${FORM_NAME[pet.form]} ` : ""}{stageInfo(pet.stage).name}</Chip>
            <Chip>🎂 {pet.age_days} day{pet.age_days === 1 ? "" : "s"}</Chip>
            <Chip>🔥 {pet.streak} day streak</Chip>
            {pet.deaths > 0 && <Chip>💤 woke up {pet.deaths}×</Chip>}
            <Chip gold>💎 {pet.crystals} crystals</Chip>
            <Chip>📖 {words.length} words</Chip>
          </div>
          <div className="mt-4 space-y-2">
            {bars.map(([l, v]) => (
              <div key={l} className="grid grid-cols-[92px_1fr_32px] items-center gap-2 text-sm font-bold">
                <span>{l}</span>
                <div className="h-3 overflow-hidden rounded-full border border-line bg-ink"><div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: barColor(v) }} /></div>
                <span className="text-right font-mono text-xs">{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center font-bold">{pet.stage === "geode" && pet.alive ? "Your geode is waiting. Log a field habit or answer a question to wake it up!" : MOOD_TEXT[pet.mood_label](pet.name)}</p>
        </section>

        <section className="block-panel p-5">
          <h2 className="pixel-title text-xl">Rock cycle journey</h2>
          <p className="mt-1 text-sm text-muted">{next ? (next.key === "pebble" ? "Care for it once to crack the geode." : `Clear ${Math.max(0, next.realms - pet.cleared)} more realm${next.realms - pet.cleared === 1 ? "" : "s"} to become ${next.name}.`) : "Fully evolved. It made it all the way around!"}</p>
          <ol className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {STAGES.map((s, i) => (
              <li key={s.key} className={`rounded-xl border p-1 text-center text-[10px] font-extrabold leading-tight ${i === si ? "border-gold bg-gold/10" : i < si ? "border-emerald/50" : "border-line opacity-50"}`} title={s.why}>
                <Alien a={{ stage: s.key, color: pet.color, alive: true, mood_label: "happy" }} size={54} anim={false} className="mx-auto" />
                {s.name}<div className="font-semibold text-muted">{s.key === "geode" ? "start" : `${s.realms} realm${s.realms === 1 ? "" : "s"}`}</div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm"><b>{stageInfo(pet.stage).name}:</b> {stageInfo(pet.stage).why}</p>
        </section>

        {words.length > 0 && (
          <section className="block-panel p-5">
            <h2 className="pixel-title text-xl">Words {pet.name} knows</h2>
            <p className="mt-1 text-sm text-muted">It learns every word you get right below, plus the key words of chapters you&apos;ve mastered (vocab games, Mastery Checks, passed quizzes).</p>
            <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-auto">{words.slice(-60).reverse().map((w) => <span key={w} className="rounded-full border border-line px-2 py-0.5 text-xs font-bold">{w}</span>)}</div>
          </section>
        )}
      </div>

      <div className="space-y-5">
        {!pet.alive && (
          <section className="block-panel border-sky/50 p-5">
            <h2 className="pixel-title text-xl">💤 {pet.name} has gone dormant…</h2>
            <p className="mt-1 text-sm text-muted">Answer <b>10 vocab questions</b> correctly to warm it back up. Each right answer adds a spark.</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full border border-line bg-ink"><div className="h-full bg-sky" style={{ width: `${(100 * pet.revive_progress) / pet.revive_needed}%` }} /></div>
            <p className="mt-1 text-sm font-extrabold">{pet.revive_progress} / {pet.revive_needed} sparks</p>
          </section>
        )}

        {pet.alive && (
          <section className="block-panel p-5">
            <h2 className="pixel-title text-xl">Today&apos;s field habits</h2>
            <p className="mt-1 text-sm text-muted">Did you do these in real life today? Be honest: your alien feels it. Log 3 different habits in a day to grow your streak 🔥.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {HABITS.map((h) => {
                const n = today[h.k] ?? 0, cap = caps[h.k] ?? 1;
                return (
                  <button key={h.k} disabled={busy || n >= cap} onClick={() => act(h.k)}
                    className={`relative rounded-xl border-2 p-3 pt-6 text-left text-sm font-bold transition disabled:cursor-not-allowed ${n ? "border-emerald/60 bg-emerald/10" : "border-line hover:border-gold"} ${n >= cap ? "opacity-70" : ""}`}>
                    <span className="absolute right-2 top-1.5 font-mono text-[10px] text-muted">{n ? "✓ " : ""}{n}/{cap}</span>
                    <span className="mb-1 block text-2xl">{h.ico}</span>{h.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <Quiz pet={pet} run={run} />
        <Shop pet={pet} run={run} say={say} />

        {pet.alive && (
          <section className="block-panel p-5">
            <h2 className="pixel-title text-xl">Extras</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy || !left("play")} onClick={() => act("play")} className="btn-block !text-sm disabled:opacity-50">🪨 Skip stones ({left("play")})</button>
              <button disabled={busy || !left("junk")} onClick={() => act("junk")} className="btn-block !text-sm disabled:opacity-50">🛰️ Space-junk snack ({left("junk")})</button>
            </div>
            <p className="mt-2 text-sm text-muted">Space junk is a fun crunchy snack… but it costs health and heat. Too much and your titan grows up rusty.</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Chip({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return <span className={`rounded-full border px-2.5 py-1 ${gold ? "border-gold/60 text-gold" : "border-line"}`}>{children}</span>;
}

function Bubble({ mood, words, name }: { mood: keyof typeof MOOD_BUBBLE; words: string[]; name: string }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => n + 1), 7000); return () => clearInterval(t); }, []);
  let text = MOOD_BUBBLE[mood];
  if (mood === "happy") {
    const pool = words.length ? words : null;
    text = pool ? lineFor(pool[(i * 7 + 3) % pool.length]) : i % 2 ? `I'm ${name}! Teach me some Earth science words?` : MOOD_BUBBLE.happy;
  }
  return (
    <div className="relative mx-auto max-w-sm rounded-2xl border-2 border-line bg-ink px-4 py-2.5 text-center text-sm font-bold" aria-live="polite">
      {text}
      <span className="absolute -bottom-2 left-1/2 size-3.5 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-line bg-ink" />
    </div>
  );
}

function NameRow({ pet, run, say }: { pet: Pet; run: Run; say: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(pet.name);
  const next = pet.next_rename ? new Date(pet.next_rename) : null;
  const save = () => run(() => petRename(v.trim()), (p) => { setOpen(false); say(p.name_ok ? `Your alien is now called ${p.name}!` : `${p.name} is waiting for Mr. Dopp's OK. Classmates see the old name until then.`); });
  return (
    <div className="mt-2 text-center">
      <div className="font-display text-3xl font-extrabold tracking-tight">{pet.name}</div>
      {!pet.name_ok && <div className="text-xs font-bold text-amber">Name waiting for Mr. Dopp&apos;s OK{pet.approved_name ? ` (classmates see “${pet.approved_name}”)` : " (classmates see “New alien”)"}</div>}
      <button onClick={() => { setOpen((o) => !o); setV(pet.name); }} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-muted underline"><Pencil className="size-3" /> Rename</button>
      {open && (
        <div className="mx-auto mt-2 flex max-w-xs gap-2">
          <input value={v} maxLength={16} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !next && save()} className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-3 py-1.5 text-sm font-semibold" />
          <button disabled={!!next} onClick={save} className="btn-block btn-grass !px-3 !py-1.5 !text-sm disabled:opacity-50">Save</button>
        </div>
      )}
      {open && <div className="mt-1 text-xs text-muted">{next ? `Next rename: ${next.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} (once a week).` : "You can rename your alien once a week."}</div>}
    </div>
  );
}

function Quiz({ pet, run }: { pet: Pet; run: Run }) {
  const [ch, setCh] = useState("any");
  const [q, setQ] = useState<PetQuestion | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved chapter after hydration (static export)
  useEffect(() => { try { const s = localStorage.getItem(CH_KEY); if (s) setCh(s); } catch {} }, []);
  const today = pet.today ?? {}, caps = pet.caps ?? {};
  const left = (k: string) => Math.max(0, (caps[k] ?? 0) - (today[k] ?? 0));
  const ask = async () => {
    try { localStorage.setItem(CH_KEY, ch); } catch {}
    setLoading(true); setFb(null); setPicked(null);
    try { setQ(await petQuizStart(ch === "any" ? null : Number(ch))); } catch (e) { setFb({ ok: false, text: (e as Error).message }); } finally { setLoading(false); }
  };
  const answer = async (o: string) => {
    if (!q || picked) return;
    setPicked(o);
    const p = await run(() => petQuizAnswer(o));
    if (!p) { setPicked(null); return; }
    if (p.right) {
      setFb({ ok: true, text: p.result === "revived" ? `✨ ${p.name} is awake again!` : p.result === "revive_progress" ? "✅ Correct! A spark of warmth returns…"
        : p.action === "quiz" ? `✅ Correct! ${p.name} munches the minerals. +1 💎` : p.action === "study" ? "✅ Correct! +1 💎" : "✅ Correct! (Today's crystal limit is reached, but keep practicing.)" });
    } else setFb({ ok: false, text: `❌ Not quite. The answer is “${p.answer}”.` });
    setQ((x) => (x ? { ...x, answer: p.answer } as PetQuestion & { answer?: string } : x));
  };
  const ans = (q as (PetQuestion & { answer?: string }) | null)?.answer;
  return (
    <section className="block-panel p-5">
      <h2 className="pixel-title text-xl">📚 Teach it a word</h2>
      {pet.alive ? <p className="mt-1 text-sm text-muted">Each right answer earns <b>+1 💎 crystal</b> and teaches {pet.name} the word. The first {caps.quiz} a day also feed it ({left("quiz")} snacks left), then you can study for {left("study")} more crystals. Graded by the class database.</p>
        : <p className="mt-1 text-sm text-muted">Each right answer adds a spark of warmth. No daily limit while it&apos;s dormant.</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <select value={ch} onChange={(e) => setCh(e.target.value)} aria-label="Chapter" className="w-full min-w-0 rounded-xl border border-line bg-ink px-3 py-2 text-sm font-bold">
          <option value="any">🎲 Any chapter</option>
          {quizChapters.map((c) => <option key={c.ref} value={c.ref}>{c.label}</option>)}
        </select>
        <button disabled={loading} onClick={ask} className="btn-block btn-grass !text-sm disabled:opacity-50">{q ? (picked ? "Next question ▶" : "Skip / new question") : "Ask me a question"}</button>
      </div>
      {q && (
        <div className="mt-4">
          <p className="rounded-xl border border-line bg-ink p-3 font-bold">“{q.def}”</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.opts.map((o) => {
              const right = ans && o.toLowerCase() === ans.toLowerCase(), wrong = picked === o && !right && ans;
              return <button key={o} disabled={!!picked} onClick={() => answer(o)}
                className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition ${right ? "border-emerald bg-emerald/15" : wrong ? "border-crimson bg-crimson/10" : "border-line hover:border-gold"}`}>{o}</button>;
            })}
          </div>
          {fb && <p className={`mt-2 text-sm font-extrabold ${fb.ok ? "text-emerald" : "text-crimson"}`}>{fb.text}</p>}
        </div>
      )}
      {!q && fb && <p className="mt-2 text-sm font-bold text-crimson">{fb.text}</p>}
    </section>
  );
}

function Shop({ pet, run, say }: { pet: Pet; run: Run; say: (m: string) => void }) {
  const [items, setItems] = useState<PetItem[] | null>(null);
  const [tab, setTab] = useState("all");
  const [err, setErr] = useState(false);
  useEffect(() => { petShopItems().then(setItems).catch(() => setErr(true)); }, []);
  const owned = pet.owned ?? [], gear = pet.gear ?? {};
  const slots = ["all", ...new Set((items ?? []).map((i) => i.slot))];
  const base = { ...pet, stage: pet.stage === "geode" ? ("pebble" as const) : pet.stage, alive: true, mood_label: "happy" as const };
  return (
    <section className="block-panel p-5">
      <h2 className="pixel-title text-xl">💎 Crystal Shop</h2>
      <p className="mt-1 text-sm text-muted">Crystals come from graded work only: vocab questions here, passed chapter quizzes (+10), unit tests (+30), Classwork turned in (+20), and every new correct answer above your best quiz score (up to 40 a day). Bigger items unlock as you mine more crystals all-time. The whole class sees your alien&apos;s gear in the gallery.</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-2"><span className="font-display text-3xl font-extrabold text-gold">💎 {pet.crystals}</span><span className="text-sm text-muted">to spend · <b>{pet.crystals_total}</b> mined all-time</span></div>
      {pet.stage === "geode" && <p className="mt-1 text-sm text-muted">🥚 Gear shows once your geode cracks open.</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {slots.map((s) => <button key={s} onClick={() => setTab(s)} className={`rounded-full border px-3 py-1 text-xs font-extrabold ${tab === s ? "border-gold bg-gold/15" : "border-line"}`}>{s === "all" ? "All" : SLOT_NAME[s] ?? s}</button>)}
      </div>
      {err ? <p className="mt-3 text-sm text-muted">The shop couldn&apos;t load right now. Refresh to try again.</p> : !items ? <p className="mt-3 text-sm text-muted">Loading the shop…</p> : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.filter((it) => tab === "all" || it.slot === tab).map((it) => {
            const has = owned.includes(it.key), worn = gear[it.slot] === it.key, locked = !has && pet.crystals_total < it.unlock;
            return (
              <div key={it.key} className={`rounded-xl border p-2 text-center ${worn ? "border-emerald bg-emerald/10" : "border-line"} ${locked ? "opacity-60" : ""}`}>
                <Alien a={{ ...base, gear: { ...gear, [it.slot]: it.key } }} size={96} anim={false} className="mx-auto" />
                <div className="text-sm font-extrabold leading-tight">{it.name}</div>
                {has ? <div className="text-xs font-bold text-emerald">{worn ? "✓ Wearing" : "Owned"}</div>
                  : <div className="text-xs font-bold text-gold">💎 {it.cost}{locked && <span className="block font-semibold text-muted">Unlocks at {it.unlock} mined ({it.unlock - pet.crystals_total} to go)</span>}</div>}
                <div className="mt-1.5">
                  {worn ? <button onClick={() => run(() => petEquip(it.slot, null))} className="btn-block !px-2.5 !py-1 !text-xs">Take off</button>
                    : has ? <button onClick={() => run(() => petEquip(it.slot, it.key))} className="btn-block !px-2.5 !py-1 !text-xs">Wear</button>
                    : locked ? <button disabled className="btn-block !px-2.5 !py-1 !text-xs opacity-60">🔒 Locked</button>
                    : <button disabled={pet.crystals < it.cost} onClick={() => run(() => petShopBuy(it.key), (p) => say(`🎉 ${p.name} got the ${it.name}!`))} className="btn-block btn-grass !px-2.5 !py-1 !text-xs disabled:opacity-50">Buy 💎{it.cost}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Evolution({ from, to, pet, onClose }: { from: number; to: number; pet: Pet; onClose: () => void }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => { const t = setTimeout(() => setPhase(1), 900); return () => clearTimeout(t); }, []);
  const s = STAGES[phase ? to : from];
  const realmName = realms[Math.max(0, pet.cleared - 1)]?.name;
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="evo-t" onClick={onClose}>
      <div className="glass w-full max-w-md rounded-3xl bg-ink-2 p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-gold"><Sparkles className="mr-1 inline size-4" />Evolution{realmName && to > 1 ? ` · ${realmName} cleared` : ""}</div>
        <div className="relative mx-auto mt-3 grid size-60 place-items-center">
          {phase === 1 && <span className="alien-burst absolute inset-6 rounded-full bg-gold/60" />}
          <div key={phase} className={phase ? "alien-evolve" : "alien-sway"}><Alien a={{ ...pet, stage: s.key }} size={220} anim={false} /></div>
        </div>
        <h2 id="evo-t" className="mt-2 font-display text-3xl font-extrabold">{phase ? `${pet.name} became ${STAGES[to].name}!` : "Something is happening…"}</h2>
        {phase === 1 && <p className="mt-2 text-muted">{STAGES[to].why}</p>}
        <button onClick={onClose} className="btn-block btn-grass mt-5 w-full justify-center">Rock on!</button>
      </div>
    </div>, document.body);
}
// ── end wave-pet ──
