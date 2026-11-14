"use client";

// Shared UI + helpers for the Bedrock classroom (projector / team) games 11–15, ported from Dopps Class.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { CrStyle, OnTop } from "./theme";

export const TEAM_COLORS = ["#FF4D6D", "#3BA8FF", "#00E5A0", "#FFD166", "#A855F7"];

export function shuffle<T>(a: readonly T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Deck state that starts in source order (SSR-safe) and is shuffled right after mount. */
export function useDeck<T>(src: readonly T[]) {
  const [deck, setDeck] = useState<T[]>(() => [...src]);
  useEffect(() => { setDeck(shuffle(src)); }, [src]);
  return [deck, setDeck] as const;
}

/** True when a keyboard event came from a text field (so shortcuts should be ignored). */
export const typingIn = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
};

/** Window keydown listener that always sees the latest handler. */
export function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (!typingIn(e) && !e.ctrlKey && !e.metaKey && !e.altKey) ref.current(e); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
}

/** 1-second countdown while `running`; calls onEnd once when it reaches 0. */
export function useCountdown(running: boolean, setLeft: (fn: (n: number) => number) => void, left: number, onEnd: () => void) {
  const endRef = useRef(onEnd);
  useEffect(() => { endRef.current = onEnd; });
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [running, setLeft]);
  useEffect(() => {
    if (running && left <= 0) endRef.current();
  }, [running, left]);
}

// ---------- tiny WebAudio sfx ----------
let ac: AudioContext | null = null;
function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, delay = 0) {
  try {
    if (typeof window === "undefined") return;
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* audio unavailable */ }
}
export const sfx = {
  good: () => { tone(660, 0.12, "triangle"); tone(990, 0.18, "triangle", 0.15, 0.1); },
  bad: () => { tone(200, 0.25, "sawtooth", 0.1); },
  tick: () => tone(1200, 0.05, "square", 0.05),
  buzz: () => { tone(140, 0.6, "sawtooth", 0.14); tone(146, 0.6, "square", 0.06); },
  click: () => tone(520, 0.06, "triangle", 0.08),
};

// ---------- layout pieces ----------
export function Shell({ title, sub, right, children, max = "max-w-4xl" }: { title: string; sub?: ReactNode; right?: ReactNode; children: ReactNode; max?: string }) {
  return (
    <div className={`cr-page mx-auto w-full ${max} px-1`}>
      <CrStyle />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-gradient font-display text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          {sub && <div className="mt-1 text-sm font-semibold uppercase tracking-widest text-muted sm:text-base">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
      <div className="mt-8 flex justify-center">
        <Link href="/arcade/" className="glass inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold transition hover:bg-fg/10"><Gamepad2 className="size-4" /> More games</Link>
      </div>
    </div>
  );
}

export function TimerBadge({ secs, warnAt = 15, dangerAt = 5 }: { secs: number; warnAt?: number; dangerAt?: number }) {
  const c = secs <= dangerAt ? "#FF3B5C" : secs <= warnAt ? "#FF9F1C" : "#FFD166";
  return (
    <div className={`grid min-w-24 place-items-center rounded-2xl border-2 px-4 py-2 font-display text-4xl font-extrabold tabular-nums sm:text-5xl ${secs <= dangerAt && secs > 0 ? "animate-pulse" : ""}`}
      style={{ borderColor: c, color: c, background: `${c}18`, boxShadow: `0 0 30px -8px ${c}` }}>
      {secs}
    </div>
  );
}

export function TeamCard({ name, score, color, active, onName, extra }: { name: string; score: ReactNode; color: string; active: boolean; onName: (s: string) => void; extra?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 px-3 py-2.5 text-center transition"
      style={{ borderColor: active ? color : "var(--color-line)", background: active ? `${color}22` : "color-mix(in srgb, var(--color-fg) 3%, transparent)", boxShadow: active ? `0 0 28px -6px ${color}` : undefined }}>
      <input value={name} onChange={(e) => onName(e.target.value)} maxLength={20} aria-label="Team name"
        className="w-full border-b-2 bg-transparent text-center text-sm font-extrabold uppercase tracking-widest outline-none sm:text-base" style={{ color, borderColor: `${color}66` }} />
      <div className="font-display text-4xl font-extrabold tabular-nums text-fg sm:text-5xl">{score}</div>
      {extra}
    </div>
  );
}

type Tone = "gold" | "good" | "bad" | "ghost" | "sky" | "violet";
const TONES: Record<Tone, string> = {
  gold: "bg-gradient-to-r from-gold via-amber to-[#ff6b3d] text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)]",
  good: "bg-emerald text-ink shadow-[0_12px_30px_-10px_rgba(0,229,160,.8)]",
  bad: "bg-crimson text-white shadow-[0_12px_30px_-10px_rgba(255,59,92,.8)]",
  sky: "bg-sky text-ink shadow-[0_12px_30px_-10px_rgba(56,191,255,.8)]",
  violet: "bg-violet text-white shadow-[0_12px_30px_-10px_rgba(168,85,247,.8)]",
  ghost: "glass text-fg hover:bg-fg/10",
};
export function Btn({ tone = "gold", big, onClick, children, disabled, className = "", kbd }: { tone?: Tone; big?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; className?: string; kbd?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-display font-extrabold transition enabled:hover:-translate-y-0.5 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${big ? "px-7 py-4 text-xl sm:text-2xl" : "px-5 py-3 text-base sm:text-lg"} ${TONES[tone]} ${className}`}>
      {children}
      {kbd && <kbd className="rounded-md border border-current/30 px-1.5 py-0.5 font-sans text-[0.65em] font-bold opacity-60">{kbd}</kbd>}
    </button>
  );
}

export function Modal({ title, children, onClose, cta = "Continue" }: { title: string; children: ReactNode; onClose: () => void; cta?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === "Escape" || e.key === " ") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <OnTop>
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="cr-dark w-full max-w-md animate-rise rounded-3xl border border-gold/40 bg-gradient-to-b from-[#16201b] to-[#0b110e] p-7 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)]" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-3xl font-extrabold text-gold">{title}</div>
        <div className="mt-3 whitespace-pre-line text-lg leading-relaxed text-muted">{children}</div>
        <Btn big className="mt-6" onClick={onClose}>{cta}</Btn>
      </div>
    </div>
    </OnTop>
  );
}

export const Hint = ({ children }: { children: ReactNode }) => <p className="mt-3 text-center text-xs text-muted/70">{children}</p>;
