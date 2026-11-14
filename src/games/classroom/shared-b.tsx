"use client";

// Shared UI for the Bedrock classroom (projector/team) games 06–10, ported from Dopps Class.
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Gamepad2 } from "lucide-react";
import { CrStyle } from "./theme";

export function shuffleB<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** Shuffle an options array and return the new options plus the new index of the correct answer. */
export function shuffleOpts(opts: string[], ans: number) {
  const order = shuffleB(opts.map((_, i) => i));
  return { opts: order.map((i) => opts[i]), ans: order.indexOf(ans) };
}

/** Tiny WebAudio beep (same envelope as the originals' _beep). */
let _ctx: AudioContext | null = null;
export function beep(freq: number, dur: number, type: OscillatorType = "sine", delay = 0) {
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = W.AudioContext || W.webkitAudioContext;
    if (!Ctor) return;
    const ctx = _ctx || (_ctx = new Ctor());
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch { /* audio unavailable */ }
}

/** Page frame: gradient title, subtitle, content, "More games" link. */
export function FrameB({ title, sub, children, right, max = "max-w-5xl" }: { title: string; sub?: ReactNode; children: ReactNode; right?: ReactNode; max?: string }) {
  return (
    <div className={`cr-page mx-auto flex w-full flex-col items-center ${max}`}>
      <CrStyle />
      <div className="flex w-full flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-gradient font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          {sub && <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-muted">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="mt-6 w-full">{children}</div>
      <Link href="/arcade/" className="glass mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold transition hover:bg-fg/10"><Gamepad2 className="size-4" /> More games</Link>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "gold" | "ghost" | "good" | "bad" | "blue" | "orange" | "violet"; big?: boolean };
const TONES: Record<NonNullable<BtnProps["tone"]>, string> = {
  gold: "bg-gradient-to-r from-gold via-amber to-[#ff6b3d] text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)]",
  ghost: "glass text-fg enabled:hover:bg-fg/10",
  good: "bg-emerald text-ink shadow-[0_10px_30px_-10px_rgba(0,229,160,.8)]",
  bad: "bg-crimson text-white shadow-[0_10px_30px_-10px_rgba(255,59,92,.8)]",
  blue: "bg-sky text-ink shadow-[0_10px_30px_-10px_rgba(56,191,255,.8)]",
  orange: "bg-amber text-ink shadow-[0_10px_30px_-10px_rgba(255,159,28,.8)]",
  violet: "bg-violet text-white shadow-[0_10px_30px_-10px_rgba(168,85,247,.8)]",
};
export function BtnB({ tone = "gold", big, className = "", ...p }: BtnProps) {
  return (
    <button type="button" {...p}
      className={`rounded-2xl font-display font-extrabold transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${big ? "px-8 py-4 text-xl" : "px-5 py-3 text-base"} ${TONES[tone]} ${className}`} />
  );
}

/** Glass card. */
export function Card({ children, className = "", accent }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <div className={`glass rounded-3xl p-5 sm:p-6 ${className}`}
      style={accent ? { borderColor: `${accent}88`, boxShadow: `0 0 40px -14px ${accent}` } : undefined}>
      {children}
    </div>
  );
}

/** Small stat tile: label over big number. */
export function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3 text-center">
      <div className="text-xs font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className="font-display text-2xl font-extrabold sm:text-3xl" style={{ color: color ?? "var(--color-fg)" }}>{value}</div>
    </div>
  );
}

/** Status line under the play area. */
export function StatusB({ children, tone }: { children: ReactNode; tone?: "good" | "bad" | "gold" }) {
  const c = tone === "good" ? "border-emerald/40 bg-emerald/10 text-emerald" : tone === "bad" ? "border-crimson/40 bg-crimson/10 text-[#ff8fa3]" : tone === "gold" ? "border-gold/40 bg-gold/10 text-gold" : "border-line bg-fg/[0.03] text-fg/85";
  return <div className={`min-h-12 rounded-2xl border px-4 py-3 text-center text-lg font-semibold ${c}`}>{children}</div>;
}
