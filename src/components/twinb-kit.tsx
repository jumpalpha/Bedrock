"use client";
// ── wave-twinB ── small shared pieces for the step-by-step twins (Footprint Quest, Home Energy Budget).
// Every color is a theme token, so the pages read right in dark and light mode.
import type { ReactNode } from "react";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
export const INPUT = "w-full rounded-xl border-2 border-line bg-ink px-3 py-2 text-base text-fg outline-none transition focus:border-gold/70 disabled:opacity-60 [&>option]:bg-ink-2 [&>optgroup]:bg-ink-2";
export const r0 = (n: number) => Math.round(n || 0);
export const r1 = (n: number) => Math.round((n || 0) * 10) / 10;
export const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
export const fmt = (n: number) => r0(n).toLocaleString("en-US");
export const fmt1 = (n: number) => (Math.abs(n) < 10 ? r1(n) : r0(n)).toLocaleString("en-US");
export const sgn = (n: number) => (n >= 0 ? "+" : "−");

type Tone = "story" | "note" | "warn" | "ok" | "bad";
const TONE: Record<Tone, string> = {
  story: "border-sky bg-sky/10",
  note: "border-gold bg-gold/10",
  warn: "border-amber bg-amber/10",
  ok: "border-emerald bg-emerald/10",
  bad: "border-crimson bg-crimson/10",
};
export function Box({ tone = "note", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div className={cx("my-3 rounded-xl border-l-4 px-4 py-3 text-[15px] leading-relaxed", TONE[tone], className)}>{children}</div>;
}
export const Big = ({ children }: { children: ReactNode }) => <div className="my-1 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{children}</div>;
export function Tile({ k, v, s, tone }: { k: ReactNode; v: ReactNode; s?: ReactNode; tone?: "pos" | "neg" }) {
  return (
    <div className={cx("rounded-xl border bg-fg/[0.03] px-3.5 py-3", tone === "pos" ? "border-emerald/50" : tone === "neg" ? "border-crimson/50" : "border-line")}>
      <div className="text-[13px] font-bold text-muted">{k}</div>
      <div className="font-display text-xl font-extrabold tabular-nums sm:text-2xl">{v}</div>
      {s && <div className="text-xs leading-snug text-muted">{s}</div>}
    </div>
  );
}
export const Tiles = ({ children, min = 150 }: { children: ReactNode; min?: number }) => (
  <div className="my-3 grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(${min}px,100%),1fr))` }}>{children}</div>
);
export function Field({ label, small, children, className }: { label: ReactNode; small?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1 text-sm font-extrabold", className)}>
      <span>{label}</span>
      {children}
      {small && <small className="font-semibold text-muted">{small}</small>}
    </label>
  );
}
export const Grid = ({ children, min = 200 }: { children: ReactNode; min?: number }) => (
  <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(${min}px,100%),1fr))` }}>{children}</div>
);
export function Button({ children, onClick, kind = "gold", disabled, small, type = "button", className, title }: {
  children: ReactNode; onClick?: () => void; kind?: "gold" | "ink" | "ghost" | "danger"; disabled?: boolean; small?: boolean; type?: "button" | "submit"; className?: string; title?: string;
}) {
  const k = kind === "gold" ? "btn-grass" : kind === "ink" ? "!bg-fg !text-ink !border-fg" : kind === "danger" ? "!border-crimson/60 !text-crimson" : "";
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled}
      className={cx("btn-block justify-center disabled:pointer-events-none disabled:opacity-45", small ? "!rounded-xl !px-3 !py-1.5 !text-sm" : "", k, className)}>{children}</button>
  );
}
export const NavBtns = ({ children }: { children: ReactNode }) => <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5">{children}</div>;
export const H3 = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-6 font-display text-lg font-extrabold">{children}</h3>;
export function Table({ head, children, foot }: { head: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-sm tabular-nums [&_td.n]:text-right [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_th.n]:text-right [&_th]:border-b [&_th]:border-line [&_th]:bg-fg/[0.05] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted">
        <thead>{head}</thead><tbody>{children}</tbody>{foot && <tfoot className="font-extrabold">{foot}</tfoot>}
      </table>
    </div>
  );
}
export const Count = ({ ok, children, bad }: { ok?: boolean; bad?: boolean; children: ReactNode }) => (
  <span className={cx("rounded-full px-3 py-1 text-sm font-extrabold", ok ? "bg-emerald/15 text-emerald" : bad ? "bg-crimson/15 text-crimson" : "bg-fg/[0.07] text-fg")}>{children}</span>
);

/** The numbered gem path across the top (same as the Dopps Class quests). */
export function StepPath({ steps, cur, done, canEnter, onGo, locked, saveText, saveCls, extra }: {
  steps: string[]; cur: number; done: boolean[]; canEnter: (i: number) => boolean; onGo: (i: number) => void; locked?: boolean;
  saveText?: string; saveCls?: string; extra?: ReactNode;
}) {
  const n = done.filter(Boolean).length;
  return (
    <div className="block-panel p-3.5 sm:p-4">
      <ol className="grid grid-cols-5 gap-1 sm:grid-cols-9">
        {steps.map((s, i) => (
          <li key={s} className="text-center">
            <button type="button" disabled={!canEnter(i) || locked} onClick={() => onGo(i)} aria-current={i === cur ? "step" : undefined}
              className="flex w-full flex-col items-center gap-1 rounded-xl py-1 disabled:cursor-not-allowed disabled:opacity-45">
              <span className={cx("grid size-9 place-items-center rounded-full border-2 text-sm font-black transition",
                done[i] ? "border-emerald bg-emerald text-[#04241a]" : i === cur ? "scale-110 border-amber bg-gold text-[#10140e]" : "border-line bg-fg/[0.06] text-muted")}>
                {done[i] ? "✓" : i}
              </span>
              <span className={cx("text-[11px] font-extrabold leading-tight sm:text-xs", i === cur ? "text-fg" : "text-muted")}>{s}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="xp-bar mt-2.5"><div className="xp-fill" style={{ width: (n / steps.length) * 100 + "%" }} /></div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
        <span className={saveCls}>{saveText}</span>{extra}
      </div>
    </div>
  );
}
export function StepHead({ num, title }: { num: ReactNode; title: ReactNode }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-3">
      <span className="whitespace-nowrap rounded-lg bg-gold px-2.5 py-1 font-display text-sm font-black text-[#10140e]">{num}</span>
      <h2 className="font-display text-2xl font-extrabold sm:text-[28px]">{title}</h2>
    </div>
  );
}
export const Lead = ({ children }: { children: ReactNode }) => <p className="mb-4 mt-1 text-muted">{children}</p>;

export const PIE = ["#d4a000", "#0e9aa7", "#e0475e", "#3b82f6", "#10b981", "#8b5cf6"];
export function Donut({ slices, center, sub, label }: { slices: { v: number }[]; center: string; sub: string; label: string }) {
  const tot = slices.reduce((a, x) => a + x.v, 0) || 1, R = 15.9155;
  const ps = slices.map((x) => (x.v / tot) * 100), offs = ps.map((_, k) => 25 - ps.slice(0, k).reduce((a, v) => a + v, 0));
  return (
    <svg viewBox="0 0 42 42" role="img" aria-label={label} className="size-[150px] flex-none">
      {ps.map((p, k) => <circle key={k} r={R} cx="21" cy="21" fill="transparent" stroke={PIE[k % PIE.length]} strokeWidth="7" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={offs[k]} />)}
      <text x="21" y="20.5" textAnchor="middle" fontSize="5" fontWeight="900" fill="currentColor">{center}</text>
      <text x="21" y="26" textAnchor="middle" fontSize="3" fill="currentColor">{sub}</text>
    </svg>
  );
}
export function HBar({ name, pct, w, top }: { name: string; pct: string; w: number; top?: boolean }) {
  return (
    <div className="my-1.5 grid grid-cols-[105px_1fr_56px] items-center gap-2 text-sm sm:grid-cols-[170px_1fr_70px]">
      <span className="truncate font-extrabold">{name}</span>
      <span className="h-4 overflow-hidden rounded-full bg-fg/[0.08]"><i className={cx("block h-full rounded-full", top ? "bg-gradient-to-r from-gold to-amber" : "bg-sky")} style={{ width: w + "%" }} /></span>
      <span className="text-right font-black tabular-nums">{pct}</span>
    </div>
  );
}

// Seeded random for the self-check tests (same as the Dopps Class quests).
export function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export function shuffle<T>(a: T[], R: () => number) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};
// ── end wave-twinB ──
