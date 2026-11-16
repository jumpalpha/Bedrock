"use client";
// ── wave-tour ── Teacher Tour: a guided walk through everything Bedrock can do, for a teacher who's new to the site.
// The button lives in the nav (top right, next to My Quest). Because the nav sits in the root layout, the tour's
// state survives page changes: each step moves the site to the page it talks about and docks a card at the bottom,
// so the teacher sees the real page while reading. A step can also spotlight one element ([data-tour="…"]).
// Start it from a link too: https://bedrock.doppsclass.com/?tour=1
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, GraduationCap, List, X } from "lucide-react";

type Step = { title: string; path: string; target?: string; intro: string; points: string[] };

const STEPS: Step[] = [
  {
    title: "Welcome to Bedrock",
    path: "/",
    intro: "Bedrock is a full Earth science course built as a blocky survival planet. Students mine their way from Dirt Digger to Diamond by reading, quizzing and playing their way through 9 realms.",
    points: [
      "28 chapters in 9 realms, from Spawn Point (how scientists think) to Beyond Bedrock (space).",
      "Works on Chromebooks, phones and the projector. Students can install it like an app.",
      "This tour moves the site page to page as you read. Scroll the page behind this card any time.",
    ],
  },
  {
    title: "The top bar",
    path: "/",
    target: "nav-right",
    intro: "Everything a student needs is one tap away from the top of every page.",
    points: [
      "Main links: Chapters, Arcade, Unit Tests, Classwork, Pick a Side, Survey, Side Quests, Glossary.",
      "🔍 Search finds any chapter, key word, game or page. ☀️/🌙 switches light and dark mode.",
      "Log in, then My Quest shows a student's XP, rank and every task. Teacher Tour (this) is next to it.",
      "On phones and tablets, the ☰ menu holds every page on the site.",
    ],
  },
  {
    title: "Student logins",
    path: "/welcome/",
    intro: "Students log in with their name, class period and a 4-digit PIN. No email, no Google account.",
    points: [
      "The site remembers each student's own device, so they're welcomed back by name.",
      "Welcome Back is their daily start: check in for the day, read your class briefing, answer the Survey of the Day, and jump to their next task.",
      "Every day they log in earns 5 XP, so showing up counts.",
    ],
  },
  {
    title: "The world map",
    path: "/",
    target: "map",
    intro: "The home page map is the whole course at a glance. Each realm is a biome to survive.",
    points: [
      "1 Spawn Point · 2 The Mine · 3 The Surface · 4 The Deep · 5 The Ocean · 6 The Sky · 7 Ancient Layers · 8 Resources · 9 Beyond Bedrock.",
      "Clear every task in a realm to earn its badge and move up one mining rank.",
      "Tap a realm to see its story, its chapters and its unit test.",
    ],
  },
  {
    title: "Chapters",
    path: "/chapters/",
    intro: "All 28 chapters are written for about a 7th-grade reading level, 2–3 pages each, aligned to Idaho Earth science standards.",
    points: [
      "Original writing built from CK-12, USGS, NOAA and NASA sources, with every key vocabulary word.",
      "Every chapter has 3 graded tasks: read it, pass the 20-question quiz at 80%+, and the Think Like a Scientist challenge.",
      "Bonus chapters can be added mid-term without breaking anyone's progress.",
    ],
  },
  {
    title: "Inside a chapter",
    path: "/chapters/1/",
    intro: "The reading page does more than show text. It keeps students moving and tracks real reading.",
    points: [
      "A section counts as read only after its end has been on screen and it stayed up long enough to read.",
      "Quick Checks pop up after sections. Missed ones go to the student's Review Deck for later.",
      "The sidebar path walks them through: read → Quick Checks → vocab games → quiz → Think Like a Scientist.",
      "Every chapter can also be played aloud on the Listen page.",
    ],
  },
  {
    title: "Quizzes and unit tests",
    path: "/tests/",
    intro: "Grading is automatic, and the answer keys never reach a student's browser.",
    points: [
      "Chapter quizzes: 20 questions, 80% to pass. Unit tests: one per realm, 30 multiple-choice questions, 70% to pass.",
      "Answer choices are shuffled on every attempt.",
      "The database grades each answer and only says right or wrong, so students can't dig the key out of the page.",
      "Only the passcode-locked Teacher page can show keys.",
    ],
  },
  {
    title: "My Quest: XP, ranks and badges",
    path: "/quest/",
    intro: "My Quest is each student's progress page and the heart of the motivation system.",
    points: [
      "25 XP per task, 5 XP per day logged in, 50 XP per approved side quest, plus XP from live class games.",
      "Mining ranks go Dirt Digger at spawn, one rank per realm cleared, Diamond for all nine.",
      "A badge for every realm. Graded tasks are tracked automatically as students finish them.",
      "Print Quest Sheet gives the whole checklist on paper.",
    ],
  },
  {
    title: "Learning tools",
    path: "/vocab/",
    intro: "Extra practice for students who need more than one pass at the reading.",
    points: [
      "Vocab Games: Flashcard Flip, Speed Quiz, Word Builder and Concept Map for every chapter's key words.",
      "Mastery Checks: a 10-question warm-up before each graded quiz. Review Deck: the Quick Checks they missed.",
      "Glossary of every key term, Listen (chapters read aloud), Text Reader, and the Reflection Coach for one-page reflections.",
    ],
  },
  {
    title: "Classwork",
    path: "/classwork/",
    intro: "Realm Classwork replaces paper vocab worksheets.",
    points: [
      "Students learn each chapter's words, take the chapter tests, and write short real-world stories using the vocabulary.",
      "Stories are scored by a rubric on the site. You can read them and return work for changes from the Teacher page.",
    ],
  },
  {
    title: "The Arcade",
    path: "/arcade/",
    intro: "Dozens of games, all reskinned with volcanoes, landslides, meteors and crystals.",
    points: [
      "Sprite Arcade and Earth Science Classics for solo play, with Bronze to Legend medals for every game.",
      "Brain games like How Smart Am I?, Word Quest and Vocab Slice.",
      "Team Games for one projector, Partner Games for two devices with a game code, and 15 Classroom Games (Jeopardy, Family Feud, Escape Room and more) for warm-ups and closers.",
      "Activities include an Art Studio and a Book Studio.",
    ],
  },
  {
    title: "Live class games",
    path: "/live/",
    intro: "Kahoot-style games you run from the front of the room.",
    points: [
      "You host on the projector from Live Host with your teacher code; students join with the game code on the screen.",
      "Showdown, Realm Raid and Gold Rush Live (dig gold, buy mining gear by answering questions).",
      "Right answers and wins add XP to each student's Quest.",
    ],
  },
  {
    title: "Pick a Side and Survey of the Day",
    path: "/pick-a-side/",
    intro: "Quick discussion starters tied to the chapters.",
    points: [
      "Pick a Side: two debates per chapter. Students pick a side and back it with evidence. Green = evidence can settle it, Yellow = values decide, Red = mostly opinion.",
      "Survey of the Day: a new question each school day; students vote and see class results right away.",
    ],
  },
  {
    title: "Side quests and projects",
    path: "/side-quests/",
    intro: "A menu of bigger projects students choose from. Three approved side quests are required each term.",
    points: [
      "15 options, 50 XP each once you approve them on the Teacher page.",
      "Built-in quests: Footprint Quest, Home Energy Budget, The Idaho Trail, What If?, Quake Ready (with printable shake table and paper seismograph), Family Disaster Plan and the Hazard PSA video challenge.",
    ],
  },
  {
    title: "Rock Aliens and Hall of Champions",
    path: "/pet/",
    intro: "Each student raises a Rock Alien, a class pet that grows as they learn.",
    points: [
      "Students keep it healthy with real-life field habits and chapter questions, and dress it up from the shop.",
      "Alien names wait for your approval on the Teacher page before anyone else sees them.",
      "Hall of Champions shows top players and ranks by class period.",
    ],
  },
  {
    title: "Ask Mr. Dopp and suggestions",
    path: "/ask/",
    intro: "Student voice, built in.",
    points: [
      "Ask Mr. Dopp: students ask science questions anonymously. You answer in class or post the answer for everyone.",
      "Suggest an Improvement: students report bugs or ideas, which show up on your dashboard.",
    ],
  },
  {
    title: "The Teacher page",
    path: "/teacher/",
    intro: "Your dashboard, locked behind a passcode. Nothing here is visible to students.",
    points: [
      "Roster & scores for every student, task and unit test, with PIN resets.",
      "Answer keys, side quest approvals, Classwork and Reflections, Ask Mr. Dopp, and hosting Live games.",
      "Project reports (Footprint, Energy Budget, Idaho Trail, Be Ready), Aliens, Suggestions and Visitors.",
      "Daily Briefing: post an announcement to the Welcome screen and see today's Survey of the Day results.",
    ],
  },
  {
    title: "Class tools",
    path: "/sub-guide/",
    intro: "Helpers for the days that don't go to plan.",
    points: [
      "Sub Guide: a printable page telling a substitute exactly what to put on the projector.",
      "Station Timer: a big projector timer for lab stations with transitions and rounds.",
      "Print Quest Sheet: every task in all nine realms on paper.",
    ],
  },
  {
    title: "Parents and visitors",
    path: "/parents/",
    intro: "Pages for the people around the class.",
    points: [
      "Parents & Guardians explains XP, ranks and realms, how to help at home, and how student data is handled.",
      "Visitors lets former students and guests make a free account to keep playing.",
    ],
  },
  {
    title: "Behind the scenes",
    path: "/",
    intro: "How the site runs, so you can keep it going.",
    points: [
      "Content lives in one master Claude Doc. Edit the doc, then tell Claude \"sync Bedrock from the doc\" to update the site and answer keys.",
      "Pushing to the GitHub repo deploys the site. Student data sits in a private Supabase database.",
      "The code is public but holds no answer keys, so it's safe to share.",
      "That's the tour! Replay it any time with the Teacher Tour button.",
    ],
  },
];

const SKEY = "bedrock_tour_step";

export function TeacherTourButton({ className = "", compact = false, onStart }: { className?: string; compact?: boolean; onStart?: () => void }) {
  return (
    <button onClick={() => { window.dispatchEvent(new CustomEvent("bedrock-tour", { detail: 0 })); onStart?.(); }} data-tour="tour"
      title="Teacher Tour: a guided tour of everything Bedrock can do" aria-label="Teacher Tour" className={className}>
      <GraduationCap className="size-4 shrink-0" />{compact ? <><span className="xl:hidden">Teacher</span><span className="xl:max-[1379px]:hidden">Tour</span></> : "Teacher Tour"}
    </button>
  );
}

export function TeacherTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);
  const [spot, setSpot] = useState<{ step: number; rect: DOMRect } | null>(null);

  // start from the button, from ?tour=1, or resume after a full reload
  useEffect(() => {
    const start = (e: Event) => setStep((e as CustomEvent<number>).detail ?? 0);
    window.addEventListener("bedrock-tour", start);
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ?tour=1 and the saved step are only known in the browser (static export)
      if (new URLSearchParams(window.location.search).get("tour") === "1") setStep(0);
      else { const s = sessionStorage.getItem(SKEY); if (s != null) setStep(Math.min(STEPS.length - 1, Math.max(0, Number(s) || 0))); }
    } catch {}
    return () => window.removeEventListener("bedrock-tour", start);
  }, []);

  useEffect(() => { try { if (step == null) sessionStorage.removeItem(SKEY); else sessionStorage.setItem(SKEY, String(step)); } catch {} }, [step]);

  const cur = step == null ? null : STEPS[step];
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");

  // move the site to this step's page
  useEffect(() => {
    if (!cur) return;
    if (norm(pathname) !== norm(cur.path)) router.push(cur.path);
    else if (!cur.target) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [cur, pathname, router]);

  // spotlight the step's element once its page is showing
  useEffect(() => {
    if (step == null || !cur?.target || norm(pathname) !== norm(cur.path)) return;
    let el: Element | null = null;
    let raf = 0;
    const measure = () => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height < window.innerHeight * 0.45) setSpot({ step, rect });
    };
    const find = window.setTimeout(() => {
      el = document.querySelector(`[data-tour="${cur.target}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight * 0.55) el.scrollIntoView({ behavior: "smooth", block: "start" });
      measure();
    }, 350);
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => { clearTimeout(find); cancelAnimationFrame(raf); window.removeEventListener("scroll", onMove); window.removeEventListener("resize", onMove); };
  }, [cur, step, pathname]);

  const close = useCallback(() => setStep(null), []);
  const go = useCallback((d: number) => { setShowList(false); setStep((s) => (s == null ? s : Math.min(STEPS.length - 1, Math.max(0, s + d)))); }, []);

  useEffect(() => {
    if (step == null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, close, go]);

  if (step == null || !cur) return null;
  const last = step === STEPS.length - 1;
  const ring = spot && spot.step === step && cur.target && norm(pathname) === norm(cur.path) ? spot.rect : null;

  return (
    <>
      {ring && (
        <div aria-hidden className="pointer-events-none fixed z-[60] rounded-2xl ring-4 ring-gold shadow-[0_0_0_9999px_rgba(0,0,0,0.35),0_0_40px_rgba(246,196,83,0.6)] transition-all duration-300"
          style={{ top: ring.top - 6, left: ring.left - 6, width: ring.width + 12, height: ring.height + 12 }} />
      )}
      <div role="dialog" aria-label="Teacher Tour" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl animate-rise sm:bottom-5">
        <div className="flex max-h-[55vh] flex-col rounded-2xl border border-line p-4 sm:max-h-[60vh] sm:p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]" style={{ background: "var(--color-ink)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-extrabold uppercase tracking-wider text-gold">Teacher Tour · {step + 1} of {STEPS.length}</div>
              <h2 className="pixel-title mt-1 text-xl leading-tight sm:text-2xl">{cur.title}</h2>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => setShowList((v) => !v)} aria-label="All tour stops" title="All stops" className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-white/5 hover:text-fg"><List className="size-5" /></button>
              <button onClick={close} aria-label="End tour" title="End tour (Esc)" className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-white/5 hover:text-fg"><X className="size-5" /></button>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className="-mx-1 mt-1 min-h-0 flex-1 overflow-y-auto px-1">
          {showList ? (
            <ol className="mt-2 grid gap-1 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title}><button onClick={() => { setStep(i); setShowList(false); }} className={`w-full rounded-lg px-3 py-1.5 text-left text-sm font-semibold transition hover:bg-white/5 ${i === step ? "text-gold" : "text-muted"}`}>{i + 1}. {s.title}</button></li>
              ))}
            </ol>
          ) : (
            <>
              <p className="mt-2 leading-relaxed">{cur.intro}</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
                {cur.points.map((p) => <li key={p} className="flex gap-2"><span className="text-gold">◆</span><span>{p}</span></li>)}
              </ul>
            </>
          )}
          </div>
          <div className="mt-3 flex shrink-0 items-center justify-between gap-2">
            <button onClick={() => go(-1)} disabled={step === 0} className="btn-block !text-sm disabled:opacity-40"><ArrowLeft className="size-4" /> Back</button>
            {last
              ? <button onClick={close} className="btn-block btn-grass !text-sm">Finish</button>
              : <button onClick={() => go(1)} className="btn-block btn-grass !text-sm">Next <ArrowRight className="size-4" /></button>}
          </div>
        </div>
      </div>
    </>
  );
}
// ── end wave-tour ──
