"use client";

// Shared UI for the Bedrock classroom (projector/team) games 01–05, ported from Dopps Class.
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Gamepad2 } from "lucide-react";
import { CrStyle } from "./theme";

export const TEAM_COLORS = ["#3BA8FF", "#00E5A0", "#A855F7", "#FF9F1C"];

export const money = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString();

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** Page frame: gradient title, subtitle, content, "More games" link. */
export function Shell({ title, sub, children, wide = true }: { title: string; sub?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`cr-page mx-auto flex w-full flex-col items-center ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
      <CrStyle />
      <h1 className="text-gradient text-center font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      {sub && <p className="mt-1 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted">{sub}</p>}
      <div className="mt-6 w-full">{children}</div>
      <Link href="/arcade/" className="glass mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold transition hover:bg-fg/10"><Gamepad2 className="size-4" /> More games</Link>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "gold" | "ghost" | "good" | "bad" | "blue" | "orange"; big?: boolean };
const TONES: Record<NonNullable<BtnProps["tone"]>, string> = {
  gold: "bg-gradient-to-r from-gold via-amber to-[#ff6b3d] text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)]",
  ghost: "glass text-fg hover:bg-fg/10",
  good: "bg-emerald-500/90 text-ink shadow-[0_10px_30px_-10px_rgba(0,229,160,.8)]",
  bad: "bg-[#ff3b5c] text-white shadow-[0_10px_30px_-10px_rgba(255,59,92,.8)]",
  blue: "bg-sky/90 text-ink shadow-[0_10px_30px_-10px_rgba(56,191,255,.8)]",
  orange: "bg-amber text-ink shadow-[0_10px_30px_-10px_rgba(255,159,28,.8)]",
};
export function Btn({ tone = "gold", big, className = "", ...p }: BtnProps) {
  return (
    <button {...p}
      className={`rounded-2xl font-display font-extrabold transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${big ? "px-8 py-4 text-xl" : "px-5 py-3 text-base"} ${TONES[tone]} ${className}`} />
  );
}

/** Row of team score cards; the active one glows. Click a card to make it the active team. */
export function Scoreboard({ names, scores, active, onPick, fmt = money, extra }: {
  names: string[]; scores: number[]; active?: number; onPick?: (i: number) => void; fmt?: (n: number) => string; extra?: (i: number) => ReactNode;
}) {
  const cols = names.length <= 2 ? "grid-cols-2" : names.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4";
  return (
    <div className={`grid w-full gap-3 ${cols}`}>
      {names.map((n, i) => {
        const c = TEAM_COLORS[i % TEAM_COLORS.length], on = active === i;
        return (
          <button key={i} type="button" onClick={() => onPick?.(i)} disabled={!onPick}
            className="rounded-2xl border px-4 py-3 text-center transition enabled:hover:bg-fg/5"
            style={{ borderColor: on ? c : "var(--color-line)", background: on ? `${c}22` : "color-mix(in srgb, var(--color-fg) 3%, transparent)", boxShadow: on ? `0 0 28px -6px ${c}` : undefined }}>
            <div className="truncate text-sm font-bold uppercase tracking-widest" style={{ color: c }}>{n}{on ? " ◂" : ""}</div>
            <div className="font-display text-3xl font-extrabold text-fg sm:text-4xl">{fmt(scores[i] ?? 0)}</div>
            {extra?.(i)}
          </button>
        );
      })}
    </div>
  );
}

/** Setup card with up to four team-name inputs. */
export function TeamNames({ names, setNames, min = 2, placeholders }: { names: string[]; setNames: (n: string[]) => void; min?: number; placeholders?: string[] }) {
  return (
    <div className="space-y-2">
      {names.map((n, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="size-4 shrink-0 rounded-full" style={{ background: TEAM_COLORS[i], boxShadow: `0 0 12px ${TEAM_COLORS[i]}` }} />
          <input value={n} maxLength={24} onChange={(e) => setNames(names.map((v, j) => (j === i ? e.target.value : v)))}
            placeholder={placeholders?.[i] ?? `Team ${i + 1}${i >= min ? " (optional)" : ""}`}
            className="w-full rounded-xl border border-line bg-fg/5 px-4 py-3 text-lg font-semibold text-fg outline-none focus:border-gold/60" />
        </div>
      ))}
    </div>
  );
}

export function SetupCard({ title, blurb, children }: { title: string; blurb: ReactNode; children: ReactNode }) {
  return (
    <div className="block-panel mx-auto max-w-lg animate-rise rounded-3xl p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.45)]">
      <h2 className="text-gradient text-center font-display text-4xl font-extrabold tracking-tight">{title}</h2>
      <p className="mt-2 text-center text-muted">{blurb}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** Keyboard helper: ignore keys typed into inputs. */
export const typingTarget = (e: KeyboardEvent) => { const t = (e.target as HTMLElement)?.tagName; return t === "INPUT" || t === "TEXTAREA" || t === "SELECT"; };
