// ── wave-twinA ── building blocks for the long project pages (Dopps Class family_quest.html / psa_challenge.html layout):
// centered hero with badge, chip table of contents, numbered cards with an accent stripe, two-box rows, chips, callouts, rules.
import type { CSSProperties, ReactNode } from "react";

export const PROJECT_CSS = `
.pj-card { border-left:5px solid var(--accent); }
.pj-card p { margin:6px 0; }
.pj-card ul { list-style:disc; margin:6px 0 6px 22px; } .pj-card ol { list-style:decimal; margin:6px 0 6px 22px; }
.pj-card li { margin:3px 0; }
.pj-card li::marker { color:var(--accent); }
.pj-card a:not(.btn-block) { color:var(--color-gold); font-weight:700; text-decoration:underline; }
.pj-check { list-style:none !important; margin-left:0 !important; columns:2; column-gap:24px; }
.pj-check li::before { content:'☐ '; font-weight:800; color:var(--accent); }
.pj-table { width:100%; border-collapse:collapse; margin-top:8px; font-size:14.5px; }
.pj-table th, .pj-table td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--color-line); vertical-align:top; }
.pj-table th { font-size:12px; letter-spacing:1px; text-transform:uppercase; color:var(--color-muted); }
.pj-table td.pts, .pj-table th.pts { text-align:right; width:80px; white-space:nowrap; }
.pj-table tr.total td { font-weight:800; border-bottom:none; }
.pj-sched td:first-child { font-weight:800; white-space:nowrap; width:130px; }
@media (max-width:640px) { .pj-check { columns:1; } .pj-sched td:first-child { width:auto; white-space:normal; } }
@media print {
  html, html.light { --bg:#fff; --bg-2:#fff; --fg:#111; --muted:#444; --line:rgba(0,0,0,.18); --glass-1:#fff; --glass-2:#fff; --panel:#fff;
    --color-gold:#8a5a00; --color-emerald:#047857; --color-crimson:#b91c1c; --color-sky:#0369a1; --color-amber:#b45309; }
  html, body { background:#fff !important; color:#111 !important; } :root, html { color-scheme:light !important; }
  header, footer, .pj-toc, .no-print, body > div[aria-hidden] { display:none !important; }
  .grain::after { display:none !important; }
  .block-panel { backdrop-filter:none !important; box-shadow:none !important; }
  .pj-card { break-inside:avoid; border-left-width:3px; }
  .pj-hero { padding-top:0 !important; }
  .pj-hero h1 { -webkit-text-fill-color:#111; color:#111; background:none !important; }
  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}`;

export function ProjectHero({ badge, title, tagline, motto, children }: { badge: string; title: string; tagline: string[]; motto: string; children?: ReactNode }) {
  return (
    <header className="pj-hero mx-auto max-w-[860px] px-5 pb-7 pt-28 text-center sm:pt-36">
      <div className="mb-4 inline-block rounded-full border border-crimson/40 bg-crimson/10 px-3.5 py-1.5 font-mono text-[11px] font-semibold tracking-[0.2em] text-crimson">{badge}</div>
      <h1 className="text-gradient font-display font-extrabold leading-[1.05] tracking-tight" style={{ fontSize: "clamp(34px,7vw,60px)" }}>{title}</h1>
      <p className="mt-3 font-extrabold" style={{ fontSize: "clamp(17px,2.6vw,21px)" }}>{tagline.map((t) => <span key={t} className="inline-block">{t}&nbsp;</span>)}</p>
      <p className="mt-3.5 text-sm font-bold text-muted">{motto}</p>
      {children}
    </header>
  );
}

export function Toc({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="On this page" className="pj-toc mb-6 flex flex-wrap justify-center gap-1.5">
      {items.map(([id, t]) => <a key={id} href={`#${id}`} className="rounded-full border border-line bg-white/[0.04] px-2.5 py-1 text-[12.5px] font-extrabold hover:border-gold">{t}</a>)}
    </nav>
  );
}

export function Card({ id, n, accent, title, pts, children }: { id: string; n: number; accent: string; title: ReactNode; pts?: string; children: ReactNode }) {
  return (
    <section id={id} className="pj-card block-panel mb-4 scroll-mt-24 p-4 leading-relaxed sm:p-5" style={{ "--accent": accent } as CSSProperties}>
      <h2 className="mb-2 flex items-baseline gap-2.5 font-display text-xl font-extrabold leading-tight">
        <span className="inline-flex h-[26px] min-w-[26px] flex-none items-center justify-center rounded-full font-sans text-[13px] font-extrabold text-[#10140e]" style={{ background: "var(--accent)" }}>{n}</span>
        <span>{title}{pts && <span className="ml-1.5 font-sans text-sm font-bold text-muted">· {pts}</span>}</span>
      </h2>
      {children}
    </section>
  );
}

export const Two = ({ children }: { children: ReactNode }) => <div className="mt-2 grid gap-3 sm:grid-cols-2">{children}</div>;
export const Box = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-line"><h3 className="mb-1 text-[15px] font-extrabold">{title}</h3>{children}</div>
);
export const Chips = ({ items, center }: { items: string[]; center?: boolean }) => (
  <div className={`my-2 flex flex-wrap gap-1.5 ${center ? "justify-center" : ""}`}>
    {items.map((c) => <span key={c} className="rounded-full border border-violet/30 bg-violet/10 px-2.5 py-0.5 text-[12.5px] font-bold text-violet">{c}</span>)}
  </div>
);
export const Callout = ({ children }: { children: ReactNode }) => <div className="mt-2.5 rounded-xl border border-gold/50 bg-gold/10 px-3.5 py-2.5 font-bold">{children}</div>;
export const Rules = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mt-2.5 rounded-xl bg-[#141a12] px-4 py-3.5 text-white [&_b]:text-[#f6c453]">
    <h3 className="mb-1.5 font-display text-[15px] font-extrabold text-[#f6c453]">{title}</h3>{children}
  </div>
);
export const Closing = ({ children }: { children: ReactNode }) => <p className="mb-2 mt-7 text-center font-display font-bold leading-normal" style={{ fontSize: "clamp(16px,2.6vw,20px)" }}>{children}</p>;
