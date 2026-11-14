"use client";
// ── wave-twinA ── Quake Ready quest. Same flow as Dopps Class cpr_aed_quest.html:
//   1 protect (4 steps)  ≈ Check & call      2 spot (tap the safe place)  ≈ hand placement
//   3 hold (hold-on trainer) ≈ compression trainer      4 after (tag the shutoffs + After-Shake Coach) ≈ AED pads + AED prompts
//   5 watch & practice (ShakeOut link, Class drill timer, printables)     6 quick check (5/5 to finish)
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHead } from "@/components/ui";
import { useProjectSave } from "@/lib/twinA-save";
import { shuffle } from "@/lib/db";
import { DrillStation } from "./station";
import { useQuakeSound } from "./sound";

type StepKey = "protect" | "spot" | "hold" | "after" | "quiz";
type S = Record<StepKey, boolean>;
const STEPS: [StepKey, string, string][] = [["protect", "🛡️", "Protect"], ["spot", "📍", "Spot"], ["hold", "✊", "Hold"], ["after", "🔧", "After"], ["quiz", "✅", "Check"]];
const EMPTY: S = { protect: false, spot: false, hold: false, after: false, quiz: false };

const QUAKE_CSS = `@keyframes qshake { 0%,100% { transform:translate(0,0) } 25% { transform:translate(var(--q),calc(var(--q) * -.5)) } 50% { transform:translate(calc(var(--q) * -1),calc(var(--q) * .4)) } 75% { transform:translate(calc(var(--q) * .6),var(--q)) } }
.quake-shake { animation:qshake .14s linear infinite; }
@keyframes stflash { 50% { background:rgba(242,140,40,.96); } }
@media (prefers-reduced-motion: reduce) { .quake-shake { animation:none; } }`;
const card = "block-panel mt-4 scroll-mt-24 p-4 sm:p-5";
const h2 = "pixel-title mb-1.5 text-xl sm:text-2xl";
const fbCls = (k: "good" | "bad" | "") => `mt-2 min-h-[22px] text-sm font-extrabold leading-snug ${k === "good" ? "text-emerald" : k === "bad" ? "text-crimson" : "text-muted"}`;
const Done = ({ on, label = "✓ Done" }: { on: boolean; label?: string }) =>
  on ? <span className="ml-2 inline-block rounded-full border border-emerald px-2 py-0.5 align-middle text-xs font-extrabold text-emerald">{label}</span> : null;

export function QuakeQuest() {
  const { data, save, row, cloud } = useProjectSave<S>("quake_ready", EMPTY);
  const S = data;
  const sound = useQuakeSound();
  const [stationOpen, setStationOpen] = useState(false);
  const [win, setWin] = useState<null | boolean>(null);   // null = hidden, true = saved to account, false = this device

  const mark = useCallback((k: StepKey) => { if (!S[k]) save({ ...S, [k]: true }); }, [S, save]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- show the win box once the saved progress has loaded
  useEffect(() => { if (S.quiz && win === null) setWin(!!row?.done_at); }, [S.quiz, row, win]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- ?class=1 opens the projector timer (the URL is only known in the browser)
  useEffect(() => { if (/[?&]class=1\b/.test(location.search)) setStationOpen(true); }, []);

  return (
    <>
      <style>{QUAKE_CSS}</style>
      <PageHead eyebrow="Side quest · Chapter 14 Earthquakes" title={<>🌎 Quake Ready</>}
        sub={<>When the ground starts shaking, the first few seconds matter most. The safe move is three words: <b className="text-fg">Drop, Cover, and Hold On</b>. Learn it here, practice holding on through a quake and its aftershocks, and learn what to do once the shaking stops.</>}>
        <p className="mt-4 max-w-2xl rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm font-extrabold text-fg">🤝 This gets you ready for the earthquake drill in class. It doesn&apos;t replace it: you&apos;ll practice Drop, Cover, and Hold On in person, and Mr. Dopp checks it off.</p>
        {row?.drill_ok && <p className="mt-3 max-w-2xl rounded-xl border border-emerald/50 bg-emerald/10 p-3 text-sm font-extrabold text-emerald">✓ Mr. Dopp checked off your in-class earthquake drill.</p>}
      </PageHead>

      <div className="mx-auto max-w-3xl px-4 pb-6 sm:px-6">
        <div className="sticky top-[76px] z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl bg-ink/85 p-1 backdrop-blur">
          <div className="flex min-w-0 flex-[1_1_240px] gap-1.5" aria-label="Your progress">
            {STEPS.map(([k, ic, t]) => (
              <a key={k} href={`#s-${k}`} aria-label={`${t}${S[k] ? " — done" : ""}`}
                className={`min-w-0 flex-1 rounded-xl border px-1 py-2 text-center text-xs font-extrabold ${S[k] ? "border-emerald bg-emerald/10 text-emerald" : "border-line text-muted"}`}>
                {S[k] ? "✓" : ic} <span className="hidden sm:inline">{t}</span>
              </a>
            ))}
          </div>
          <button type="button" onClick={sound.toggle} aria-pressed={sound.muted} className="btn-block ml-auto !min-h-10 !px-3 !py-2 !text-sm">{sound.muted ? "🔇 Sound off" : "🔊 Sound on"}</button>
        </div>

        <Protect done={S.protect} onDone={() => mark("protect")} />
        <Spot done={S.spot} onDone={() => mark("spot")} blip={sound.blip} />
        <HoldTrainer done={S.hold} onDone={() => mark("hold")} sound={sound} stationOpen={stationOpen} />
        <After done={S.after} onDone={() => mark("after")} blip={sound.blip} />

        {/* 5. WATCH IT + CLASS PRACTICE KIT */}
        <section className={card} id="s-coach">
          <h2 className={h2}>5 · Watch it, then practice for real</h2>
          <p className="mb-3 text-[15px] leading-relaxed">See Drop, Cover, and Hold On (and what to do in bed, in a car or in a wheelchair) on the Great ShakeOut site. In class you&apos;ll run a timed drill and build a shake table and a seismograph.</p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-block btn-grass !text-sm" href="https://www.shakeout.org/dropcoverholdon/" target="_blank" rel="noopener noreferrer">▶ Great ShakeOut: Drop, Cover, Hold On ↗</a>
            <a className="btn-block !text-sm" href="https://www.ready.gov/earthquakes" target="_blank" rel="noopener noreferrer">Ready.gov: Earthquakes ↗</a>
            <button type="button" className="btn-block !text-sm" onClick={() => setStationOpen(true)}>⏱ Class drill timer</button>
          </div>
          <p className="mt-2 text-xs text-muted">These links open outside websites (the Earthquake Country Alliance&apos;s Great ShakeOut and FEMA&apos;s Ready.gov), not run by Bedrock.</p>
          <h3 className="mt-5 text-base font-extrabold">Class practice kit (printables)</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[["/quake-ready/shake-table/", "🛠️", "Build a shake table", "Cardboard, marbles and rubber bands, with a 1-inch shake marker. 1 page."],
              ["/quake-ready/paper-seismograph/", "📈", "Paper seismograph", "Box, cup and marker, cut-out strips and a partner script. 1 page."],
              ["/quake-ready/checkoff/", "📋", "Teacher check-off sheet", "Drill skills record for class. Blank lines only. 1 page."]].map(([href, ic, t, d]) => (
              <Link key={href} href={href} className="accent-card block rounded-xl p-3" style={{ "--accent": "#f28c28" } as React.CSSProperties}>
                <b className="block text-2xl">{ic}</b><strong className="block text-sm">{t}</strong><span className="text-[13px] leading-snug text-muted">{d}</span>
              </Link>
            ))}
          </div>
        </section>

        <Quiz done={S.quiz} blip={sound.blip} onPass={async () => {
          const r = await save({ ...S, quiz: true }, true);
          setWin(r === "cloud");
        }} />
        {win !== null && (
          <div role="status" className="mt-3 rounded-2xl border border-emerald bg-emerald/10 p-4 font-extrabold leading-relaxed">
            🏅 Side quest complete! {win ? <>It&apos;s saved to your account and shows on <Link className="underline" href="/quest/">My Quest</Link>.</>
              : <>It&apos;s saved on this device. {cloud ? "It will sync next time you're online." : <>Log in (top right) and pass the check again to get it on <Link className="underline" href="/quest/">My Quest</Link>.</>}</>}
            <br />Next: the earthquake drill in class, where Mr. Dopp checks you off.
          </div>
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted">Sources: Earthquake Country Alliance, <a className="font-bold text-gold underline" href="https://www.shakeout.org/dropcoverholdon/" target="_blank" rel="noopener noreferrer">Great ShakeOut: Drop, Cover, and Hold On</a> (also Lock, Cover, Hold On for wheelchairs and walkers); FEMA, <a className="font-bold text-gold underline" href="https://www.ready.gov/earthquakes" target="_blank" rel="noopener noreferrer">Ready.gov Earthquakes</a> (don&apos;t run outside or stand in a doorway, expect aftershocks, text instead of calling); utility and gas-leak steps from Ready.gov and FEMA earthquake safety guidance (shut off gas only if you smell gas or hear hissing; only the gas company turns it back on); USGS records of the 1983 Borah Peak (M6.9) and 2020 Stanley (M6.5) earthquakes; Idaho Office of Emergency Management.</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">Optional side quest. Pass the quick check to mark it complete on <Link className="font-bold text-gold underline" href="/quest/">My Quest</Link>. Logged in? Your progress follows you to any device; otherwise it stays on this one. The in-class drill is checked off separately by Mr. Dopp.</p>
      </div>

      {stationOpen && <DrillStation sound={sound} onClose={() => { setStationOpen(false); if (location.search.includes("class=1")) history.replaceState(null, "", location.pathname); }} />}
    </>
  );
}

// ---------- 1. when the shaking starts ----------
function Protect({ done, onDone }: { done: boolean; onDone: () => void }) {
  const [got, setGot] = useState(false);
  const cards: [string, string, string][] = [
    ["⬇️", "Drop", "Drop onto your hands and knees before the shaking knocks you down. You can still crawl from there."],
    ["🛡️", "Cover", "Cover your head and neck with one arm. Crawl under a sturdy desk or table if one is close. No table? Get low next to an inside wall, away from windows."],
    ["✊", "Hold On", "Hold on to your shelter with your other hand and move with it until the shaking stops. No shelter? Keep both arms over your head and neck."],
    ["🚫", "Stay put", "Don't run outside or stand in a doorway. Falling and flying objects cause most quake injuries, and trying to move is how people get hit."],
  ];
  return (
    <section className={card} id="s-protect">
      <h2 className={h2}>1 · When the shaking starts <Done on={done} /></h2>
      <p className="mb-3 text-[15px] leading-relaxed">You&apos;re in class and the floor starts to roll. You won&apos;t get a warning, so know these by heart:</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
        {cards.map(([ic, t, d]) => (
          <div key={t} className="rounded-xl border border-line bg-white/[0.03] p-3">
            <b className="mb-1 block text-2xl">{ic}</b><strong className="mb-0.5 block text-sm">{t}</strong>
            <span className="text-[13px] leading-snug text-muted">{d}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted">In a wheelchair or using a walker: <b className="text-fg">Lock, Cover, Hold On</b>. In bed: stay there and cover your head with a pillow.</span>
        <button type="button" className="btn-block btn-grass !text-sm" onClick={() => { setGot(true); onDone(); }}>{got || done ? "Got it ✓" : "I know these 4 steps ✓"}</button>
      </div>
    </section>
  );
}

// ---------- 2. where do you take cover? ----------
type SpotK = "table" | "window" | "shelf" | "door" | "outside";
const SPOT_AT: Record<SpotK, [number, number]> = { table: [204, 246], window: [49, 100], shelf: [284, 160], door: [121, 190], outside: [121, 190] };
const SPOT_MSG: Record<SpotK, string> = {
  table: "✓ Right spot: under the sturdy table. Drop, crawl under, cover your head and neck, and hold on to a table leg.",
  window: "✗ Not by the window. Glass can shatter and fly during shaking. Get away from windows.",
  shelf: "✗ Not by the tall bookshelf. Tall furniture can tip over and books fly off the shelves.",
  door: "✗ Not the doorway. In modern buildings a doorway is no stronger than any other spot, the door can swing into you, and it doesn't protect you from falling objects.",
  outside: "✗ Don't run outside during shaking. Glass, bricks and building fronts fall near exits. In the 1983 Borah Peak earthquake, falling bricks from a building front killed two children in Challis.",
};
function zoneFor(x: number, y: number): SpotK | null {
  if (x >= 14 && x <= 84 && y >= 50 && y <= 150) return "window";
  if (x >= 96 && x <= 146 && y >= 110 && y <= 270) return "door";
  if (x >= 156 && x <= 252 && y >= 190 && y <= 272) return "table";
  if (x >= 260 && x <= 308 && y >= 60 && y <= 272) return "shelf";
  return null;
}
function svgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }) {
  const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM()!.inverse());
}
function Spot({ done, onDone, blip }: { done: boolean; onDone: () => void; blip: (ok: boolean) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [markAt, setMarkAt] = useState<{ x: number; y: number; ok: boolean } | null>(null);
  const [fb, setFb] = useState<{ k: "good" | "bad" | ""; t: string }>({ k: "", t: "" });
  const judge = (k: SpotK | null, x: number, y: number) => {
    if (!k) { setFb({ k: "", t: "Tap a place: the window, the doorway, under the table, or the bookshelf." }); return; }
    const ok = k === "table";
    setMarkAt({ x, y, ok }); setFb({ k: ok ? "good" : "bad", t: SPOT_MSG[k] }); blip(ok);
    if (ok) onDone();
  };
  return (
    <section className={card} id="s-spot">
      <h2 className={h2}>2 · Where do you take cover? <Done on={done} /></h2>
      <p className="mb-2 text-[15px] leading-relaxed">The shaking just started. Tap the safest place in this classroom to Drop, Cover, and Hold On.</p>
      <svg ref={ref} viewBox="0 0 320 300" className="mx-auto block h-auto w-full max-w-[380px] cursor-crosshair touch-manipulation select-none" role="img" aria-labelledby="spotT"
        onPointerDown={(e) => { const p = svgPoint(ref.current!, e); judge(zoneFor(p.x, p.y), p.x, p.y); }}>
        <title id="spotT">A classroom wall with a window, a doorway, a sturdy table and a tall bookshelf. Tap where you take cover.</title>
        <rect x="0" y="0" width="320" height="300" rx="16" fill="#e9f1ea" />
        <rect x="0" y="270" width="320" height="30" fill="#cdb48d" />
        <line x1="0" y1="270" x2="320" y2="270" stroke="#8a6d3b" strokeWidth="2" />
        {/* window */}
        <rect x="14" y="50" width="70" height="100" rx="3" fill="#bfe3f7" stroke="#4b5545" strokeWidth="4" />
        <line x1="49" y1="50" x2="49" y2="150" stroke="#4b5545" strokeWidth="3" /><line x1="14" y1="100" x2="84" y2="100" stroke="#4b5545" strokeWidth="3" />
        <path d="M22 60 L36 74 M58 112 L72 126" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
        {/* doorway */}
        <rect x="96" y="110" width="50" height="160" fill="#f5efe1" stroke="#4b5545" strokeWidth="3" />
        <path d="M146 110 L176 122 L176 266 L146 270 Z" fill="#b07d4f" stroke="#4b5545" strokeWidth="2" />
        <circle cx="170" cy="196" r="3" fill="#4b5545" />
        <text x="121" y="104" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4b5545" letterSpacing=".06em">EXIT</text>
        {/* sturdy table */}
        <rect x="156" y="196" width="96" height="12" rx="2" fill="#8b5a2b" stroke="#4b3214" strokeWidth="2" />
        <rect x="162" y="208" width="9" height="62" fill="#8b5a2b" stroke="#4b3214" strokeWidth="1.5" />
        <rect x="237" y="208" width="9" height="62" fill="#8b5a2b" stroke="#4b3214" strokeWidth="1.5" />
        <rect x="188" y="180" width="26" height="16" rx="2" fill="#f6c453" stroke="#4b3214" strokeWidth="1.5" />
        {/* tall bookshelf */}
        <rect x="262" y="60" width="44" height="210" fill="#c9a06b" stroke="#4b3214" strokeWidth="3" />
        {[100, 140, 180, 220].map((y) => <line key={y} x1="262" y1={y} x2="306" y2={y} stroke="#4b3214" strokeWidth="2.5" />)}
        {[66, 106, 146, 186, 226].map((y, i) => (
          <g key={y}>{[0, 1, 2, 3].map((j) => <rect key={j} x={266 + j * 9} y={y + 8 + ((i + j) % 2) * 4} width="7" height={26 - ((i + j) % 2) * 4} fill={["#dc2626", "#2563eb", "#059669", "#f59e0b"][(i + j) % 4]} />)}</g>
        ))}
        <text x="49" y="166" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4b5545">WINDOW</text>
        <text x="204" y="292" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4b3214">STURDY TABLE</text>
        <text x="284" y="52" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4b3214">SHELF</text>
        {markAt && <ellipse cx={markAt.x} cy={markAt.y} rx="22" ry="15" fill={markAt.ok ? "rgba(5,150,105,.5)" : "rgba(220,38,38,.45)"} stroke={markAt.ok ? "#047857" : "#dc2626"} strokeWidth="3" />}
      </svg>
      <div className={fbCls(fb.k)} role="status" aria-live="polite">{fb.t}</div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Or choose a spot">
        <span className="self-center text-xs text-muted">No touch screen? Pick a spot:</span>
        {([["window", "By the window"], ["door", "In the doorway"], ["table", "Under the sturdy table"], ["shelf", "Next to the tall bookshelf"], ["outside", "Run outside"]] as [SpotK, string][]).map(([k, t]) => (
          <button key={k} type="button" className="rounded-xl border border-line px-3 py-2 text-[13px] font-extrabold hover:bg-white/5" onClick={() => { const [x, y] = SPOT_AT[k]; judge(k, x, y); }}>{t}</button>
        ))}
      </div>
    </section>
  );
}

// ---------- 3. hold-on trainer ----------
type Sound = ReturnType<typeof useQuakeSound>;
type Phase = "idle" | "wait" | "shake" | "calm";
const ROUNDS = ["The main quake", "Aftershock 1", "Aftershock 2"];
function HoldTrainer({ done, onDone, sound, stationOpen }: { done: boolean; onDone: () => void; sound: Sound; stationOpen: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [holding, setHolding] = useState(false);
  const [round, setRound] = useState(0);
  const [total, setTotal] = useState(0);
  const [secs, setSecs] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [zone, setZone] = useState<{ c: "green" | "amber" | "red" | ""; t: string }>({ c: "", t: "Press Start, then hold on when it shakes" });
  const st = useRef({ phase: "idle" as Phase, holding: false, t0: 0, dur: 0, startAt: 0, round: 0, raf: 0, timer: 0 as unknown as ReturnType<typeof setTimeout>, grace: 1.5 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const trace = useRef<number[]>([]);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  const loopRef = useRef<() => void>(() => {});

  const stopAll = useCallback(() => {
    cancelAnimationFrame(st.current.raf); clearTimeout(st.current.timer); sound.rumble(0);
  }, [sound]);
  useEffect(() => stopAll, [stopAll]);

  const fail = useCallback((t: string) => {
    stopAll(); st.current.phase = "idle"; st.current.round = 0;
    setPhase("idle"); setRound(0); setLevel(0); setZone({ c: "red", t }); sound.blip(false);
  }, [stopAll, sound]);

  const loop = useCallback(() => {
    const s = st.current, now = performance.now() / 1000;
    let lv = 0;
    if (s.phase === "wait" && now >= s.startAt) { s.phase = "shake"; s.t0 = now; setPhase("shake"); }
    if (s.phase === "shake") {
      const t = now - s.t0;
      const env = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (s.dur - t) / 1.6));
      lv = (s.round === 0 ? 1 : 0.65) * env * (0.75 + 0.25 * Math.sin(t * 2.3));
      setSecs(Math.floor(t));
      if (t > s.grace && !s.holding) { fail(t < s.grace + 0.3 ? "✗ Too slow! Drop, Cover, and Hold On the moment you feel shaking." : "✗ You let go! Hold on until the shaking stops."); return; }
      setZone(s.holding ? { c: "green", t: "Holding on. Keep holding…" } : { c: "amber", t: "Drop! Cover! Hold on!" });
      if (t >= s.dur) {
        sound.rumble(0); setLevel(0);
        const r = s.round + 1; s.round = r; setRound(r); setTotal((n) => n + 1); sound.blip(true);
        if (r >= ROUNDS.length) {
          s.phase = "idle"; setPhase("idle"); setZone({ c: "green", t: "🎉 You held on through the quake and both aftershocks!" }); onDoneRef.current();
        } else {
          s.phase = "calm"; setPhase("calm");
          setZone({ c: "green", t: "✓ Shaking stopped. Stay put and look around… aftershocks are common." });
          s.timer = setTimeout(() => { s.phase = "wait"; s.startAt = performance.now() / 1000 + 0.6 + Math.random() * 2.2; s.dur = 4 + Math.random() * 4; setPhase("wait"); }, 2200 + Math.random() * 1800);
        }
      }
    }
    sound.rumble(lv); setLevel(lv);
    trace.current.push(lv * (Math.random() * 2 - 1) + (Math.random() - 0.5) * 0.04);
    if (trace.current.length > 150) trace.current.shift();
    const c = canvas.current?.getContext("2d");
    if (c) {
      const w = c.canvas.width, h = c.canvas.height;
      c.fillStyle = "#0e1a14"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(125,255,179,.18)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
      c.strokeStyle = "#7dffb3"; c.lineWidth = 2; c.beginPath();
      trace.current.forEach((v, i) => { const x = (i / 149) * w, y = h / 2 - v * (h / 2 - 4); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.stroke();
    }
    s.raf = requestAnimationFrame(() => loopRef.current());
  }, [fail, sound]);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  const start = () => {
    const s = st.current;
    if (s.phase !== "idle") { stopAll(); s.phase = "idle"; setPhase("idle"); setLevel(0); setZone({ c: "", t: "Stopped. Press Start to try again." }); return; }
    sound.unlock();
    s.round = 0; setRound(0); setSecs(null);
    s.phase = "wait"; s.startAt = performance.now() / 1000 + 1.5 + Math.random() * 2.5; s.dur = 10 + Math.random() * 6;
    setPhase("wait"); setZone({ c: "", t: "Quiet… it could start any second." });
    cancelAnimationFrame(s.raf); s.raf = requestAnimationFrame(() => loopRef.current());
  };
  const setHold = (on: boolean) => { st.current.holding = on; setHolding(on); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code !== "Space" || stationOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "A" || (t.tagName === "BUTTON" && t.id !== "holdBtn"))) return;
      const r = document.getElementById("s-hold")?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > innerHeight) return;
      e.preventDefault();
      if (down && e.repeat) return;
      setHold(down);
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku);
    return () => { document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku); };
  }, [stationOpen]);

  const shaking = phase === "shake";
  const color = zone.c === "green" ? "text-emerald" : zone.c === "amber" ? "text-amber" : zone.c === "red" ? "text-crimson" : "text-muted";
  return (
    <section className={card} id="s-hold">
      <h2 className={h2}>3 · Hold on until it stops <Done on={done} /></h2>
      <p className="mb-3 text-[15px] leading-relaxed">Press <b>Start</b>. When the shaking hits, press and <b>hold</b> the button (or hold <b>Space</b>) and don&apos;t let go until the shaking stops. Hold on through <b>the quake and 2 aftershocks</b> in a row.</p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-block !text-sm" onClick={start} aria-pressed={phase !== "idle"}>{phase === "idle" ? (round > 0 || zone.c === "red" ? "▶ Try again" : "▶ Start a quake") : "⏹ Stop"}</button>
        <span className="text-[13px] text-muted">Real quakes come with no warning, and big ones can shake for a minute or more.</span>
      </div>
      <div className={`grid items-center gap-4 sm:grid-cols-2 ${shaking ? "quake-shake" : ""}`} style={{ "--q": `${(level * 5).toFixed(1)}px` } as React.CSSProperties}>
        <button id="holdBtn" type="button" aria-pressed={holding} aria-describedby="holdZone"
          onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setHold(true); }}
          onPointerUp={() => setHold(false)} onPointerCancel={() => setHold(false)} onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.repeat) { e.preventDefault(); setHold(true); } }} onKeyUp={(e) => { if (e.key === "Enter") setHold(false); }}
          className={`mx-auto grid aspect-square w-full max-w-[220px] touch-none select-none place-content-center rounded-full border-0 text-[26px] font-black text-white transition-transform [-webkit-tap-highlight-color:transparent] ${holding ? "translate-y-2 scale-[.97] shadow-[0_2px_0_#7c2d12,0_4px_10px_rgba(0,0,0,.25)]" : "shadow-[0_10px_0_#7c2d12,0_14px_24px_rgba(0,0,0,.25)]"}`}
          style={{ background: "radial-gradient(circle at 35% 30%, #fdba74, #ea580c 60%, #9a3412)" }}>
          {holding ? "HOLDING" : "HOLD ON"}<small className="block text-xs font-extrabold opacity-90">press &amp; hold · Space</small>
        </button>
        <div>
          <div className="text-center">
            <div className={`font-black tabular-nums leading-none ${color}`} style={{ fontSize: "clamp(46px,14vw,64px)" }}>{secs == null ? "--" : `${secs}s`}</div>
            <div className="text-[13px] font-extrabold text-muted">of shaking · {ROUNDS[Math.min(round, 2)]}</div>
            <div id="holdZone" className={`mt-1.5 min-h-5 text-sm font-black ${color}`} role="status" aria-live="polite">{zone.t}</div>
          </div>
          <div className="relative mb-1 mt-2.5 h-3 rounded-full" aria-hidden style={{ background: "linear-gradient(90deg,#bbf7d0 0 25%,#fde68a 25% 55%,#fdba74 55% 80%,#fca5a5 80%)" }}>
            <i className="absolute -top-1 h-5 w-1 rounded-sm bg-[#1c2419] transition-[left] duration-100" style={{ left: `${Math.min(98, level * 100)}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-bold text-muted" aria-hidden><span>Weak</span><span>Light</span><span>Strong</span><span>Severe</span></div>
          <canvas ref={canvas} width={300} height={64} className="mt-2 block h-16 w-full rounded-lg bg-[#0e1a14]" aria-label="Live seismogram of the shaking" />
          <div className="mt-2 text-[13.5px] font-extrabold text-muted">Held on in a row: <b className="text-fg">{round}</b> / 3 · Quakes held: <b className="text-fg">{total}</b></div>
        </div>
      </div>
      <ul className="ml-5 mt-3 list-disc space-y-1 text-sm leading-relaxed">
        <li><b>Get down first:</b> drop before the shaking can knock you down, then crawl to cover.</li>
        <li><b>Hold on and move with it:</b> if your table slides, hold the leg and go with it.</li>
        <li><b>Expect aftershocks:</b> smaller quakes often follow a big one, for days or more. Drop, Cover, and Hold On every time.</li>
      </ul>
    </section>
  );
}

// ---------- 4. after the shaking: tag the shutoffs, then the After-Shake Coach ----------
type ZoneK = "meter" | "main" | "stove" | "faucet";
const ZONES: Record<ZoneK, { x: number; y: number; ok?: "gas" | "water"; name: string }> = {
  meter: { x: 282, y: 300, ok: "gas", name: "the gas meter outside" },
  main: { x: 92, y: 372, ok: "water", name: "the main water valve" },
  stove: { x: 138, y: 292, name: "stove" },
  faucet: { x: 206, y: 270, name: "faucet" },
};
type TagK = "gas" | "water";
const TAG_HOME: Record<TagK, [number, number]> = { gas: [110, 446], water: [210, 446] };
const FLOW: { say: string; btn?: string; need?: "tags"; valve?: boolean }[] = [
  { say: "The shaking stopped. Before you move, look around: is anyone hurt? Is anything about to fall?", btn: "👀 Check people & hazards" },
  { say: "Put on sturdy shoes: there may be broken glass. Do you know where the shutoffs are? Tag them on the house.", btn: "I found the shutoffs ✓", need: "tags" },
  { say: "You smell rotten eggs and hear a hiss near the stove. That's a gas leak. Don't flip a light switch or use a lighter.", btn: "🚪 Get everyone out, leave the door open" },
  { say: "Everyone is outside, away from the house. An adult turns the gas valve at the meter a quarter turn, so it sits crosswise to the pipe. Press the flashing valve.", valve: true },
  { say: "Gas is off. Call the gas company (or 911) from outside, away from the house. Then text your family: phone lines jam after big quakes.", btn: "📱 Call from outside, then text" },
  { say: "✓ You did it. Only the gas company turns the gas back on. Stay out of damaged buildings, and Drop, Cover, and Hold On in every aftershock." },
];
const WRONG: Record<number, string> = {
  0: "Check people and hazards first. The valve comes later, and only if you smell gas.",
  1: "Find the shutoffs first: tag the gas and water valves on the house.",
  2: "People first! Get everyone out of the house before anyone works on the gas.",
};
function After({ done, onDone, blip }: { done: boolean; onDone: () => void; blip: (ok: boolean) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const [pos, setPos] = useState<Record<TagK, [number, number]>>({ ...TAG_HOME });
  const [placed, setPlaced] = useState<Record<TagK, boolean>>({ gas: false, water: false });
  const [sel, setSel] = useState<TagK | null>(null);
  const [fb, setFb] = useState<{ k: "good" | "bad" | ""; t: string }>({ k: "", t: "" });
  const [afb, setAfb] = useState("");
  const [at, setAt] = useState(0);
  const drag = useRef<{ k: TagK; moved: boolean; sx: number; sy: number } | null>(null);
  const doneOnce = useRef(false);

  const zoneAt = (x: number, y: number): ZoneK | null => {
    let best: ZoneK | null = null, bd = 1e9;
    (Object.keys(ZONES) as ZoneK[]).forEach((k) => { const d = Math.hypot(ZONES[k].x - x, ZONES[k].y - y); if (d < bd) { bd = d; best = k; } });
    return bd < 40 ? best : null;
  };
  const place = (k: TagK, z: ZoneK | null) => {
    if (!z) { setPos((p) => ({ ...p, [k]: TAG_HOME[k] })); return; }
    const Z = ZONES[z];
    if (Z.ok !== k) {
      setPos((p) => ({ ...p, [k]: TAG_HOME[k] }));
      const t = z === "stove" ? "✗ Not the stove knobs. Turning off a burner doesn't stop a leak in the gas line. The gas shutoff valve is on the pipe at the gas meter."
        : z === "faucet" ? "✗ Not the faucet. A faucet only shuts off one tap. The main water valve, where the water pipe comes into the house, shuts off all of it if pipes break."
        : z === "main" ? "✗ That's the main water valve. The GAS tag goes on the valve at the gas meter outside."
        : "✗ That's the gas meter. The WATER tag goes on the main water valve where the water pipe comes into the house.";
      setFb({ k: "bad", t }); blip(false); return;
    }
    const next = { ...placed, [k]: true };
    setPlaced(next); setPos((p) => ({ ...p, [k]: [Z.x, Z.y] })); setSel(null);
    setFb({ k: "good", t: next.gas && next.water ? "✓ Both shutoffs tagged. Now follow the After-Shake Coach." : `✓ Good: ${Z.name}. Now tag the other shutoff.` });
    blip(true);
  };
  const tagsDone = placed.gas && placed.water;
  useEffect(() => { if (at === FLOW.length - 1 && !doneOnce.current) { doneOnce.current = true; onDone(); blip(true); } }, [at, onDone, blip]);
  const go = () => { setAfb(""); setAt((a) => a + 1); };
  const wrong = () => { setAfb("✗ " + (WRONG[at] ?? "Not yet. Follow the coach's prompt.")); blip(false); };
  const f = FLOW[at];

  return (
    <section className={card} id="s-after">
      <h2 className={h2}>4 · After the shaking <Done on={done} /></h2>
      <p className="mb-2 text-[15px] leading-relaxed">At home, broken pipes can leak gas or water after a big quake. First, <b>drag the two tags</b> onto the shutoffs on this house. (Every home is different: ask an adult to show you yours.)</p>
      <svg ref={ref} viewBox="0 0 320 480" className="mx-auto block h-auto w-full max-w-[380px] touch-none select-none" role="img" aria-labelledby="houseT"
        onPointerMove={(e) => { const d = drag.current; if (!d) return; if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true; const p = svgPoint(ref.current!, e); setPos((q) => ({ ...q, [d.k]: [p.x, p.y] })); }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d) { drag.current = null; if (d.moved) { const p = svgPoint(ref.current!, e); place(d.k, zoneAt(p.x, p.y)); setSel(null); } else { setSel(d.k); setFb({ k: "", t: "Tag selected. Now tap where it goes on the house." }); } return; }
          if (sel) { const p = svgPoint(ref.current!, e); const s = sel; setSel(null); place(s, zoneAt(p.x, p.y)); }
        }}
        onPointerCancel={() => { const d = drag.current; if (d) { setPos((q) => ({ ...q, [d.k]: TAG_HOME[d.k] })); drag.current = null; } }}>
        <title id="houseT">A house cut open to show the kitchen, a gas meter on the outside wall and the main water valve in the basement. Two tags, GAS and WATER, wait below.</title>
        <rect x="0" y="0" width="320" height="480" rx="16" fill="#e8f2f8" />
        <rect x="0" y="330" width="320" height="80" fill="#b08a5a" />
        <path d="M0 330 L320 330" stroke="#6b4f2a" strokeWidth="3" />
        <path d="M30 120 L160 40 L290 120 Z" fill="#9a3412" stroke="#4b2412" strokeWidth="3" />
        <rect x="40" y="120" width="230" height="210" fill="#fff8ec" stroke="#4b5545" strokeWidth="3" />
        <rect x="56" y="140" width="56" height="44" fill="#bfe3f7" stroke="#4b5545" strokeWidth="2.5" />
        <line x1="84" y1="140" x2="84" y2="184" stroke="#4b5545" strokeWidth="2" />
        <rect x="40" y="330" width="230" height="70" fill="#d9c7a7" stroke="#4b5545" strokeWidth="2" />
        <text x="226" y="392" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4b5545">BASEMENT</text>
        {/* stove */}
        <rect x="112" y="266" width="54" height="64" fill="#e5e7eb" stroke="#374151" strokeWidth="2" />
        <rect x="112" y="266" width="54" height="10" fill="#374151" />
        {[124, 138, 152].map((x) => <circle key={x} cx={x} cy="292" r="4.5" fill="#111827" />)}
        <rect x="120" y="300" width="38" height="24" rx="2" fill="#9ca3af" />
        <text x="139" y="258" textAnchor="middle" fontSize="10" fontWeight="800" fill="#374151">STOVE</text>
        {/* sink + faucet */}
        <rect x="180" y="280" width="54" height="50" fill="#c9a06b" stroke="#4b3214" strokeWidth="2" />
        <path d="M200 280 L200 262 L214 262 L214 268" fill="none" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />
        <text x="207" y="252" textAnchor="middle" fontSize="10" fontWeight="800" fill="#4b3214">SINK</text>
        {/* gas line + meter on outside wall */}
        <path d="M166 312 L262 312" stroke="#ca8a04" strokeWidth="4" />
        <path d="M296 330 L296 312 L300 312" stroke="#ca8a04" strokeWidth="4" fill="none" />
        <rect x="270" y="282" width="28" height="30" rx="4" fill="#d1d5db" stroke="#374151" strokeWidth="2" />
        <circle cx="284" cy="294" r="7" fill="#fff" stroke="#374151" strokeWidth="1.5" />
        <rect x="270" y="314" width="16" height="6" fill="#dc2626" stroke="#374151" strokeWidth="1" />
        <text x="296" y="270" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#374151">GAS</text><text x="296" y="280" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#374151">METER</text>
        {/* water main in basement */}
        <path d="M0 372 L40 372 L80 372" stroke="#2563eb" strokeWidth="6" />
        <path d="M104 372 L150 372 L150 330" stroke="#2563eb" strokeWidth="6" fill="none" />
        <circle cx="92" cy="372" r="10" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="2" />
        <path d="M86 362 L98 362" stroke="#1e3a8a" strokeWidth="3" />
        <text x="58" y="356" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#1e3a8a">water pipe in</text>
        <text x="160" y="426" textAnchor="middle" fontSize="11" fontWeight="800" fill="#4b5545" letterSpacing=".06em">DRAG THE TAGS ONTO THE SHUTOFFS</text>
        {(["gas", "water"] as TagK[]).map((k) => (
          <g key={k} transform={`translate(${pos[k][0]} ${pos[k][1]})`} style={{ cursor: placed[k] ? "default" : "grab" }}
            onPointerDown={(e) => { if (placed[k]) return; e.preventDefault(); e.stopPropagation(); drag.current = { k, moved: false, sx: e.clientX, sy: e.clientY }; ref.current?.setPointerCapture(e.pointerId); }}>
            <rect x="-38" y="-17" width="76" height="34" rx="8" fill={k === "gas" ? "#facc15" : "#7dd3fc"} stroke="#1c2419" strokeWidth={sel === k ? 5 : 2.5} />
            <circle cx="-29" cy="0" r="4" fill="#fff" stroke="#1c2419" strokeWidth="1.5" />
            <text x="6" y="5" textAnchor="middle" fontSize="13" fontWeight="900" fill="#1c2419">{k === "gas" ? "GAS" : "WATER"}</text>
          </g>
        ))}
      </svg>
      <div className={fbCls(fb.k)} role="status" aria-live="polite">{fb.t}</div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Or choose a spot for the next tag">
        <span className="self-center text-xs text-muted">No mouse? Put the {placed.gas ? "WATER" : "GAS"} tag on:</span>
        {([["meter", "The valve at the gas meter outside"], ["main", "The main valve where the water pipe comes in"], ["stove", "The stove knobs"], ["faucet", "The kitchen faucet"]] as [ZoneK, string][]).map(([z, t]) => (
          <button key={z} type="button" disabled={tagsDone} className="rounded-xl border border-line px-3 py-2 text-[13px] font-extrabold hover:bg-white/5 disabled:opacity-40" onClick={() => place(placed.gas ? "water" : "gas", z)}>{t}</button>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border-[3px] border-[#1c2419] bg-[#f6c453] p-3">
        <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#1c2419]">After-Shake Coach</div>
        <div className="min-h-[62px] rounded-xl bg-[#0e1a14] p-3 font-mono text-[14.5px] font-bold leading-snug text-[#7dffb3]" role="status" aria-live="polite">{f.say}</div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {f.btn && (
            <button type="button" disabled={f.need === "tags" && !tagsDone} title={f.need === "tags" && !tagsDone ? "Tag both shutoffs on the house first" : undefined}
              onClick={go} className="min-h-[46px] flex-[1_1_160px] rounded-xl bg-[#1c2419] px-4 py-2.5 font-black text-[#f6c453] disabled:opacity-45">{f.btn}</button>
          )}
          {at < FLOW.length - 1 && (
            <button type="button" aria-label="Gas shutoff valve" onClick={() => (f.valve ? go() : wrong())}
              className={`grid size-[72px] shrink-0 place-items-center rounded-full border-[3px] border-[#1c2419] bg-[#ea580c] text-[26px] ${f.valve ? "animate-pulse ring-4 ring-[#ea580c]/40" : ""}`}>🔧</button>
          )}
        </div>
      </div>
      <div className={fbCls("bad")} role="status" aria-live="polite">{afb}</div>
    </section>
  );
}

// ---------- 6. quick check ----------
const QS: { q: string; a: string[]; c: number; why: string }[] = [
  { q: "The floor starts shaking during class. What do you do first?", a: ["Run for the door", "Stand in the doorway", "Drop, Cover, and Hold On", "Call 911"], c: 2,
    why: "Drop, Cover, and Hold On right where you are. Running or standing in a doorway puts you in the path of falling and flying objects." },
  { q: "There's no desk or table near you. What's the best move?", a: ["Stand by the window to see what's happening", "Get low next to an inside wall, away from windows, and cover your head and neck", "Stand next to a tall bookshelf", "Run into the hallway"], c: 1,
    why: "No shelter? Drop low by an inside wall, away from windows and tall furniture, and protect your head and neck with your arms." },
  { q: "When can you stop holding on?", a: ["After 10 seconds", "When the shaking stops (and drop again for every aftershock)", "As soon as you feel scared", "When the lights go out"], c: 1,
    why: "Hold on until the shaking stops, however long that is. Aftershocks often follow a big quake: Drop, Cover, and Hold On each time." },
  { q: "After the quake you smell rotten eggs and hear hissing. What do you do?", a: ["Flip on the lights to look for the leak", "Get everyone out; an adult shuts the gas off at the meter and calls the gas company from outside", "Light a candle so you can see", "Turn the gas back on yourself the next day"], c: 1,
    why: "That smell means gas. Get out first, don't make sparks, shut the gas off at the meter only if it's safe, and call from outside. Only the gas company turns it back on." },
  { q: "Why do Idaho students practice earthquake drills?", a: ["Idaho never has earthquakes", "Idaho is in the Intermountain Seismic Belt and has had big quakes like Borah Peak (M6.9, 1983) and Stanley (M6.5, 2020)", "Earthquakes only happen in California", "Drills tell scientists when the next quake will hit"], c: 1,
    why: "Idaho's normal faults are part of the Intermountain Seismic Belt. Scientists can't predict the exact day of a quake, so practice is how you get ready." },
];
function Quiz({ done, onPass, blip }: { done: boolean; onPass: () => Promise<void>; blip: (ok: boolean) => void }) {
  const [order, setOrder] = useState<number[][]>(() => QS.map((q) => q.a.map((_, j) => j)));
  // eslint-disable-next-line react-hooks/set-state-in-effect -- shuffle after hydration so server and browser HTML match
  useEffect(() => { setOrder(QS.map((q) => shuffle(q.a.map((_, j) => j)))); }, []);
  const [pick, setPick] = useState<(number | null)[]>(QS.map(() => null));
  const [checked, setChecked] = useState(false);
  const [fb, setFb] = useState<{ k: "good" | "bad" | ""; t: string }>({ k: "", t: "" });
  const check = async () => {
    if (pick.some((p) => p === null)) { setFb({ k: "bad", t: "Answer all 5 first." }); return; }
    setChecked(true);
    const right = QS.filter((q, i) => pick[i] === q.c).length;
    if (right === QS.length) { setFb({ k: "good", t: "5 / 5! 🎉" }); blip(true); await onPass(); }
    else { setFb({ k: "bad", t: `${right} / 5. Read the why-lines, change your answers and check again.` }); blip(false); }
  };
  return (
    <section className={card} id="s-quiz">
      <h2 className={h2}>6 · Quick check <Done on={done} label="✓ Passed" /></h2>
      <p className="mb-2 text-[15px] leading-relaxed">Get all 5 right to finish the side quest. You can try as many times as you need.</p>
      {QS.map((q, i) => (
        <div key={i} className="border-t border-line py-3 first:border-t-0">
          <p className="mb-2 text-[15px] font-extrabold">{i + 1}. {q.q}</p>
          {order[i].map((j) => {
            const sel = pick[i] === j;
            const cls = checked && sel ? (j === q.c ? "border-emerald bg-emerald/10" : "border-crimson bg-crimson/10") : sel ? "border-gold bg-gold/10" : "border-line";
            return (
              <button key={j} type="button" aria-pressed={sel} onClick={() => { setPick((p) => p.map((v, k) => (k === i ? j : v))); setChecked(false); setFb({ k: "", t: "" }); }}
                className={`mb-1.5 block min-h-11 w-full rounded-xl border-[1.5px] px-3 py-2.5 text-left text-[14.5px] font-bold ${cls}`}>{q.a[j]}</button>
            );
          })}
          {checked && <div className="mt-1 border-l-[3px] border-sky pl-2.5 text-[13.5px] leading-snug text-muted">{pick[i] === q.c ? "✓ " : "✗ "}{q.why}</div>}
        </div>
      ))}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className={fbCls(fb.k) + " !mt-0"} role="status" aria-live="polite">{fb.t}</span>
        <button type="button" className="btn-block btn-grass" onClick={check}>Check my answers</button>
      </div>
    </section>
  );
}
