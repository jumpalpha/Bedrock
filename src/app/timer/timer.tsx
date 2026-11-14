"use client";
// ── wave-x7b ── Classroom station timer: twin of Dopps Class timer.html, feature for feature.
// Section 1 → Section 2 → Transition, repeated for N rounds. Last 10 seconds flash faster and tick with a
// countdown sound (6 styles). Space = start/pause, R = reset. Maximize = full screen for the projector.
// Settings and colors are remembered on this device (localStorage bedrock_timer).
import { useCallback, useEffect, useRef, useState } from "react";

type Settings = { rounds: number; s1: number; s2: number; tr: number; colors: [string, string, string]; sound: Sound };
type Sound = "bomb" | "arcade" | "sciFi" | "drum" | "laser" | "bell";
const SOUNDS: [Sound, string][] = [["bomb", "Bomb Countdown"], ["arcade", "Arcade Beeps"], ["sciFi", "Sci-Fi Alert"], ["drum", "Drum Hits"], ["laser", "Laser Countdown"], ["bell", "Bell / Chime"]];
const DEFAULTS: Settings = { rounds: 30, s1: 80, s2: 80, tr: 15, colors: ["#1f6fb2", "#5b6058", "#e0a21b"], sound: "bomb" };
const LABELS = ["SECTION 1", "SECTION 2", "TRANSITION"];
const DONE_COLOR = "#1f8f4e";
const KEY = "bedrock_timer";

const clampInt = (v: string | number, fb: number, min = 1, max = 3600) => { const n = parseInt(String(v), 10); return Number.isNaN(n) ? fb : Math.max(min, Math.min(max, n)); };
const fmt = (sec: number) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function StationTimer() {
  const [cfg, setCfg] = useState<Settings>(DEFAULTS);
  const [form, setForm] = useState({ rounds: "30", s1: "80", s2: "80", tr: "15", c1: DEFAULTS.colors[0], c2: DEFAULTS.colors[1], c3: DEFAULTS.colors[2] });
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(DEFAULTS.s1);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [maxed, setMaxed] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const panel = useRef<HTMLDivElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const target = useRef(0);
  const lastTick = useRef<number | null>(null);
  const st = useRef({ cfg, round, phase, running, done });
  st.current = { cfg, round, phase, running, done };

  // load saved settings
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null") as Settings | null;
      if (s && s.colors) {
        setCfg(s); setLeft(s.s1);
        setForm({ rounds: String(s.rounds), s1: String(s.s1), s2: String(s.s2), tr: String(s.tr), c1: s.colors[0], c2: s.colors[1], c3: s.colors[2] });
      }
    } catch {}
  }, []);
  const save = (s: Settings) => { setCfg(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const secsFor = (p: number, c = st.current.cfg) => [c.s1, c.s2, c.tr][p];

  // ── sound (Web Audio, unlocked on the first click) ──
  const initAudio = () => {
    try {
      const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
      audio.current ??= new (window.AudioContext || W.webkitAudioContext!)();
      const a = audio.current;
      if (a.state === "suspended") a.resume();
      const o = a.createOscillator(), g = a.createGain(); g.gain.value = 0.00001; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.02);
    } catch {}
  };
  const tone = (type: OscillatorType, f: number, gain: number, dur: number, delay = 0) => {
    const a = audio.current; if (!a) return;
    const now = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now + delay);
    g.gain.setValueAtTime(gain, now + delay); g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
    o.connect(g); g.connect(a.destination); o.start(now + delay); o.stop(now + delay + dur);
  };
  const beep = (f = 700, d = 0.12) => { try { if (!audio.current) initAudio(); tone("square", f, 0.55, d); } catch {} };
  const dramaticTick = useCallback((freq: number, dur: number, remaining: number, mode: Sound) => {
    try {
      const a = audio.current; if (!a) return;
      if (a.state === "suspended") a.resume();
      const k = 10 - remaining;
      if (mode === "bomb") { tone("square", freq, 0.62, dur); tone("sawtooth", Math.max(90, freq * 0.32), 0.24, dur * 1.35); if (remaining <= 1) tone("square", 1650, 0.28, 0.07, 0.03); }
      else if (mode === "arcade") { tone("square", 700 + k * 90, 0.42, 0.08); tone("square", 1050 + k * 110, 0.22, 0.05, 0.06); }
      else if (mode === "sciFi") { tone("sawtooth", 420 + k * 120, 0.38, 0.16); tone("sine", 900 + k * 150, 0.24, 0.2); }
      else if (mode === "drum") { tone("sine", 110 + k * 6, 0.78, 0.09); tone("triangle", 180 + k * 9, 0.28, 0.05); }
      else if (mode === "laser") {
        const now = a.currentTime, o = a.createOscillator(), g = a.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(1200, now); o.frequency.exponentialRampToValueAtTime(250, now + 0.12);
        g.gain.setValueAtTime(0.42, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12); o.connect(g); g.connect(a.destination); o.start(now); o.stop(now + 0.12);
      } else { tone("sine", 880 + k * 35, 0.34, 0.24); tone("sine", 1320 + k * 45, 0.14, 0.18); }
    } catch {}
  }, []);

  // Escalating "bomb timer" rhythm: 10–6 s = 2 ticks/s, 5–3 s = 4 ticks/s, last 3 s = 8 ticks/s, rising pitch.
  const countdown = (remaining: number) => {
    if (remaining <= 0 || remaining > 10) { lastTick.current = null; return; }
    const interval = remaining <= 3 ? 0.125 : remaining <= 5 ? 0.25 : 0.5;
    const n = Math.floor(remaining / interval);
    if (n !== lastTick.current) {
      lastTick.current = n;
      const urgency = 1 - remaining / 10;
      dramaticTick(520 + urgency * 900, remaining <= 3 ? 0.11 : 0.08, remaining, st.current.cfg.sound);
    }
  };

  const advance = useCallback(() => {
    const { cfg: c, round: r, phase: p } = st.current;
    lastTick.current = null;
    if (p < 2) { setPhase(p + 1); const s = secsFor(p + 1, c); setLeft(s); target.current = Date.now() + s * 1000; beep(700, 0.18); return; }
    if (r >= c.rounds) {
      setRunning(false); setDone(true); setLeft(0);
      beep(880, 0.25); setTimeout(() => beep(1040, 0.25), 300); setTimeout(() => beep(1240, 0.4), 600);
      return;
    }
    setRound(r + 1); setPhase(0); setLeft(c.s1); target.current = Date.now() + c.s1 * 1000; beep(700, 0.18);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the clock: wall-time based, so a slow tab never drifts
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remaining = (target.current - Date.now()) / 1000;
      setLeft(Math.max(0, remaining));
      countdown(remaining);
      if (remaining <= 0) advance();
    }, 100);
    return () => clearInterval(id);
  }, [running, advance]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { if (st.current.running) return; if (st.current.done) reset(); target.current = Date.now() + (st.current.done ? cfg.s1 : left) * 1000; setRunning(true); };
  const pause = () => { if (!st.current.running) return; setLeft(Math.max(0, (target.current - Date.now()) / 1000)); setRunning(false); };
  const reset = (c = st.current.cfg) => { setRunning(false); setDone(false); setRound(1); setPhase(0); setLeft(c.s1); lastTick.current = null; };
  const skip = () => { if (st.current.running) { target.current = Date.now(); } else { advance(); } };

  const apply = () => {
    const s: Settings = { ...cfg, rounds: clampInt(form.rounds, 30, 1, 999), s1: clampInt(form.s1, 80), s2: clampInt(form.s2, 80), tr: clampInt(form.tr, 15) };
    setForm({ ...form, rounds: String(s.rounds), s1: String(s.s1), s2: String(s.s2), tr: String(s.tr) });
    save(s); reset(s);
  };
  const applyColors = () => save({ ...cfg, colors: [form.c1, form.c2, form.c3] });
  const testSound = () => {
    initAudio();
    let n = 0;
    const id = setInterval(() => { n++; dramaticTick(650 + n * 120, 0.1, Math.max(1, 6 - n), cfg.sound); if (n >= 5) clearInterval(id); }, 250);
  };

  // keyboard: Space = start/pause, R = reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.code === "Space") { e.preventDefault(); initAudio(); if (st.current.running) pause(); else start(); }
      if (e.key.toLowerCase() === "r") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // maximize: real full screen when allowed, otherwise a fixed overlay
  const toggleMax = async () => {
    const next = !maxed; setMaxed(next);
    try {
      if (next && !document.fullscreenElement) await panel.current?.requestFullscreen();
      else if (!next && document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  };
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setMaxed(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const flash = !done && left > 0 && left <= 10 ? (left <= 3 ? "tm-fast" : left <= 6 ? "tm-med" : "tm-slow") : "";
  const bg = done ? DONE_COLOR : cfg.colors[phase];
  const btn = "rounded-xl border-2 border-white/80 bg-black/25 px-5 py-2.5 font-extrabold text-white transition hover:bg-black/40";
  const field = "mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 font-semibold";

  return (
    <>
      <style>{`
        @keyframes tmflash { 0%,100% { filter:none } 50% { filter:brightness(1.55) saturate(1.2) } }
        .tm-slow { animation: tmflash 1s steps(2,jump-none) infinite } .tm-med { animation: tmflash .5s steps(2,jump-none) infinite } .tm-fast { animation: tmflash .25s steps(2,jump-none) infinite }
        .tm-max { position: fixed !important; inset: 0; z-index: 80; border-radius: 0 !important; }
      `}</style>
      <div ref={panel} data-testid="timer-panel" className={`relative flex min-h-[62vh] flex-col items-center justify-center gap-4 rounded-3xl p-6 text-center text-white shadow-2xl transition-colors ${flash} ${maxed ? "tm-max" : ""}`} style={{ backgroundColor: bg }}>
        <div className="font-display text-3xl font-extrabold tracking-[0.15em] drop-shadow sm:text-5xl" data-testid="timer-phase">{done ? "COMPLETE" : LABELS[phase]}</div>
        <div className="text-lg font-bold opacity-90 sm:text-2xl">{done ? `${cfg.rounds} rounds finished` : `Round ${round} of ${cfg.rounds}`}</div>
        <div className="font-mono text-[clamp(5rem,22vw,16rem)] font-extrabold leading-none tabular-nums drop-shadow-lg" data-testid="timer-clock">{done ? "0:00" : fmt(left)}</div>
        <div className="flex flex-wrap justify-center gap-2">
          <button className={btn} onClick={() => { initAudio(); if (running) pause(); else start(); }} data-testid="timer-start">{running ? "Pause" : "Start"}</button>
          <button className={btn} onClick={() => { initAudio(); skip(); }}>Skip Section</button>
          <button className={btn} onClick={() => { initAudio(); reset(); }}>Reset</button>
          <button className={btn} onClick={toggleMax}>{maxed ? "Exit Maximize" : "Maximize Timer"}</button>
        </div>
        <div className="text-xs font-bold opacity-75">Space = start / pause · R = reset</div>
      </div>

      <section className="block-panel mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="pixel-title text-2xl">Timer settings</h2>
          <button className="btn-block !text-sm" onClick={() => setShowSettings((s) => !s)}>{showSettings ? "Minimize Settings" : "Show Settings"}</button>
        </div>
        {showSettings && (
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-extrabold">Rounds<input className={field} type="number" min={1} max={999} value={form.rounds} onChange={(e) => setForm({ ...form, rounds: e.target.value })} /></label>
              <label className="text-sm font-extrabold">Section 1 seconds<input className={field} type="number" min={1} value={form.s1} onChange={(e) => setForm({ ...form, s1: e.target.value })} /></label>
              <label className="text-sm font-extrabold">Section 2 seconds<input className={field} type="number" min={1} value={form.s2} onChange={(e) => setForm({ ...form, s2: e.target.value })} /></label>
              <label className="text-sm font-extrabold">Transition seconds<input className={field} type="number" min={1} value={form.tr} onChange={(e) => setForm({ ...form, tr: e.target.value })} /></label>
              <button className="btn-block btn-grass col-span-2 justify-center !text-sm" onClick={() => { initAudio(); apply(); }}>Apply Changes</button>
            </div>
            <div>
              <label className="text-sm font-extrabold">Countdown sound
                <select className={field} value={cfg.sound} onChange={(e) => save({ ...cfg, sound: e.target.value as Sound })}>{SOUNDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </label>
              <button className="btn-block mt-3 !text-sm" onClick={testSound}>Test Sound</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["c1", "c2", "c3"] as const).map((k, i) => (
                <label key={k} className="text-sm font-extrabold">{["Section 1", "Section 2", "Transition"][i]} color
                  <input type="color" className="mt-1 h-11 w-full cursor-pointer rounded-xl border border-line bg-ink" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </label>
              ))}
              <button className="btn-block col-span-3 justify-center !text-sm" onClick={applyColors}>Apply Colors</button>
            </div>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">Default sequence: 1:20 section 1 → 1:20 section 2 → 0:15 transition, repeated 30 times. Great for lab stations, rock-and-mineral ID rotations and gallery walks.</p>
      </section>
    </>
  );
}
