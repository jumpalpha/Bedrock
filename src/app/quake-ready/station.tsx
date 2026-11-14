"use client";
// ── wave-twinA ── Class drill station (projector), twin of the CPR "Class practice timer":
// a 60-second ShakeOut drill → "shaking stopped" → look around → aftershock → evacuate calmly.
import { useCallback, useEffect, useRef, useState } from "react";
import type { useQuakeSound } from "./sound";

type Phase = { title: string; sub: string; sec: number; shake?: boolean; alert?: [string, string] };
const PHASES: Phase[] = [
  { title: "DROP · COVER · HOLD ON", sub: "Hold on until the shaking stops", sec: 60, shake: true },
  { title: "LOOK AROUND", sub: "Stay put. Check yourself and your neighbors. Look for hazards.", sec: 30, alert: ["✋ SHAKING STOPPED", "Stay where you are and look around before you move."] },
  { title: "DROP · COVER · HOLD ON", sub: "Aftershock! Hold on again", sec: 15, shake: true, alert: ["⚠ AFTERSHOCK!", "Drop, Cover, and Hold On again."] },
  { title: "EVACUATE CALMLY", sub: "Walk, don't run. Follow your route to the assembly area. No elevators.", sec: 0, alert: ["🚶 EVACUATE CALMLY", "Walk your route to the assembly area for roll call."] },
];
const topBtn = "min-h-[46px] rounded-xl border-2 border-white/35 bg-white/[0.08] px-4 py-2.5 font-black";
const topFont = { fontSize: "clamp(14px,1.8vw,20px)" };
const fmt = (s: number) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

export function DrillStation({ sound, onClose }: { sound: ReturnType<typeof useQuakeSound>; onClose: () => void }) {
  const [on, setOn] = useState(false);
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(PHASES[0].sec);
  const [alert, setAlert] = useState<[string, string] | null>(null);
  const st = useRef({ idx: 0, used: 0, start: 0, on: false, tick: 0 as unknown as ReturnType<typeof setInterval>, alertT: 0 as unknown as ReturnType<typeof setTimeout> });
  const box = useRef<HTMLDivElement>(null);
  const goBtn = useRef<HTMLButtonElement>(null);

  const enter = useCallback((i: number) => {
    const s = st.current; s.idx = i; s.used = 0; s.start = performance.now(); setIdx(i); setLeft(PHASES[i].sec);
    const a = PHASES[i].alert;
    if (a) { setAlert(a); sound.alarm(); clearTimeout(s.alertT); s.alertT = setTimeout(() => setAlert(null), 4000); }
    sound.rumble(PHASES[i].shake && s.on ? 0.8 : 0);
  }, [sound]);

  const tick = useCallback(() => {
    const s = st.current, p = PHASES[s.idx];
    if (!p.sec) return;
    const t = s.used + (s.on ? (performance.now() - s.start) / 1000 : 0);
    setLeft(p.sec - t);
    if (t >= p.sec && s.idx < PHASES.length - 1) enter(s.idx + 1);
    if (s.idx === PHASES.length - 1) { s.on = false; setOn(false); clearInterval(s.tick); sound.rumble(0); }
  }, [enter, sound]);

  const startStop = () => {
    const s = st.current;
    sound.unlock();
    s.on = !s.on; setOn(s.on);
    if (s.on) {
      if (s.idx === PHASES.length - 1) { enter(0); }
      s.start = performance.now(); sound.rumble(PHASES[s.idx].shake ? 0.8 : 0); s.tick = setInterval(tick, 200);
    } else { s.used += (performance.now() - s.start) / 1000; clearInterval(s.tick); sound.rumble(0); }
  };
  const reset = useCallback(() => {
    const s = st.current; clearInterval(s.tick); clearTimeout(s.alertT); s.on = false; setOn(false); setAlert(null);
    s.idx = 0; s.used = 0; setIdx(0); setLeft(PHASES[0].sec); sound.rumble(0);
  }, [sound]);
  const close = useCallback(() => { reset(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); onClose(); }, [reset, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden"; goBtn.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.fullscreenElement) close(); };
    document.addEventListener("keydown", k);
    const s = st.current;
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", k); clearInterval(s.tick); clearTimeout(s.alertT); sound.rumble(0); };
  }, [close, sound]);

  const full = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else box.current?.requestFullscreen?.().catch(() => {}); };
  const p = PHASES[idx];
  const shaking = on && !!p.shake;
  return (
    <div ref={box} role="dialog" aria-modal="true" aria-labelledby="stTitle" className="fixed inset-0 z-[1000] flex flex-col p-[clamp(12px,3vw,32px)] text-white"
      style={{ background: "radial-gradient(circle at 30% 20%, #3b2a12, #0b0d0a 70%)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span id="stTitle" className="font-black text-[#f6c453]" style={{ fontSize: "clamp(18px,3vw,30px)" }}>🌎 ShakeOut drill</span>
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={sound.toggle} className={topBtn} style={topFont}>{sound.muted ? "🔇 Sound off" : "🔊 Sound on"}</button>
          <button type="button" onClick={full} className={topBtn} style={topFont}>⛶ Full screen</button>
          <button type="button" onClick={close} className={topBtn} style={topFont}>✕ Exit</button>
        </span>
      </div>
      <div className="flex flex-1 flex-wrap items-center justify-center gap-[clamp(20px,6vw,80px)]">
        <div aria-hidden className={`grid aspect-square place-items-center rounded-full text-center ${shaking ? "quake-shake" : ""}`}
          style={{ width: "clamp(180px,34vmin,440px)", background: p.shake ? "radial-gradient(circle at 35% 30%, #fdba74, #ea580c 60%, #9a3412)" : "radial-gradient(circle at 35% 30%, #6ee7b7, #059669 60%, #065f46)", "--q": "9px" } as React.CSSProperties}>
          <span className="px-4 font-black leading-tight" style={{ fontSize: "clamp(22px,4.6vmin,56px)" }}>{p.title.split(" · ").map((w) => <span key={w} className="block">{w}</span>)}</span>
        </div>
        <div className="text-center">
          <div className="font-black text-[#7dffb3]" style={{ fontSize: "clamp(24px,4.5vmin,54px)" }}>Step {idx + 1}<small className="ml-1 text-[.5em] text-[#bdf5d6]">of {PHASES.length}</small></div>
          <div className="font-black leading-none tabular-nums" style={{ fontSize: "clamp(80px,22vmin,260px)" }} aria-live="off">{p.sec ? fmt(left) : "GO"}</div>
          <div className="mt-1.5 font-extrabold text-[#f6c453]" style={{ fontSize: "clamp(18px,3vmin,34px)" }}>{p.sub}</div>
          <div className="mx-auto mt-2.5 max-w-[26ch] font-bold text-white/80" style={{ fontSize: "clamp(14px,2.2vmin,24px)" }}>Under a desk · cover head &amp; neck · hold the leg · away from windows</div>
        </div>
      </div>
      {alert && (
        <div role="alert" className="absolute inset-0 grid place-content-center gap-4 bg-[#f6c453]/95 text-center font-black leading-[1.05] text-[#1a0d00] [animation:stflash_.8s_3]" style={{ fontSize: "clamp(40px,10vmin,130px)" }}>
          {alert[0]}<small className="font-extrabold" style={{ fontSize: "clamp(16px,3vmin,34px)" }}>{alert[1]}</small>
        </div>
      )}
      <div className="flex justify-center gap-3">
        <button ref={goBtn} type="button" onClick={startStop} className="min-h-[46px] min-w-[180px] rounded-xl border-2 border-[#f6c453] bg-[#f6c453] px-4 py-2.5 font-black text-[#1a0d00]" style={{ fontSize: "clamp(18px,2.6vw,28px)" }}>{on ? "⏸ Pause" : idx === PHASES.length - 1 ? "↺ Run again" : "▶ Start"}</button>
        <button type="button" onClick={reset} className="min-h-[46px] rounded-xl border-2 border-white/35 bg-white/[0.08] px-4 py-2.5 font-black" style={{ fontSize: "clamp(14px,1.8vw,20px)" }}>↺ Reset</button>
      </div>
    </div>
  );
}
