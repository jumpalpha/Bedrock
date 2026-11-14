// ── wave-twinA ── shared printable "paper sheet" (Dopps Class cpr_checkoff / cpr_paper_aed / cpr_trainer_build look):
// on screen a white page on the site background; printed, only the page (no nav, footer, aurora or buttons).
import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "./print-button";

const css = (landscape: boolean, width: string) => `
.paper { background:#fff; color:#1c2419; width:100%; max-width:${width}; margin:0 auto 30px; padding:0.45in 0.5in; border-radius:6px;
  box-shadow:0 10px 40px -12px rgba(0,0,0,.45); font-size:12.5px; line-height:1.42; }
.paper h1 { font-family:var(--font-display); font-weight:800; font-size:22px; letter-spacing:-.01em; margin-bottom:2px; color:#1c2419; }
.paper h2 { font-size:13.5px; font-weight:800; margin:9px 0 4px; text-transform:uppercase; letter-spacing:.05em; color:#9a3412; }
.paper .sub { font-size:12.5px; color:#4b5545; margin-bottom:8px; }
.paper p, .paper li { font-size:12.5px; line-height:1.42; }
.paper ul { list-style:disc; padding-left:18px; } .paper ol { list-style:decimal; padding-left:18px; }
.paper b, .paper strong { font-weight:800; }
.paper svg { width:100%; height:auto; display:block; }
.paper .cols { display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start; }
.paper .box { border:1.5px solid #1c2419; border-radius:10px; padding:8px 10px; margin-top:6px; }
.paper .safety { border-color:#c2410c; background:#fff4ec; }
.paper .how { border:1.5px dashed #1c2419; border-radius:10px; padding:7px 10px; margin-top:6px; }
.paper .foot { font-size:10.5px; color:#555; margin-top:8px; border-top:1px solid #ccc; padding-top:5px; }
.paper table { width:100%; border-collapse:collapse; }
.paper a { color:#9a3412; font-weight:700; }
@media (max-width:640px) { .paper { padding:18px 16px; } .paper .cols { grid-template-columns:1fr; } }
@media print {
  @page { size:letter ${landscape ? "landscape" : "portrait"}; margin:${landscape ? "0.35in" : "0.4in"}; }
  html, body { background:#fff !important; } :root, html { color-scheme:light !important; }
  header, footer, .no-print, body > div[aria-hidden] { display:none !important; }
  .grain::after { display:none !important; }
  main { padding:0 !important; margin:0 !important; }
  .sheet-wrap { padding:0 !important; overflow:visible !important; }
  .paper { box-shadow:none !important; margin:0 !important; padding:0 !important; max-width:none !important; width:auto !important; border-radius:0; }
  .paper .cols { grid-template-columns:1fr 1fr; }
  .paper * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}`;

export function PrintSheet({ back = { href: "/quake-ready/", label: "Quake Ready" }, printLabel = "Print (1 page)", landscape = false, children }:
  { back?: { href: string; label: string }; printLabel?: string; landscape?: boolean; children: ReactNode }) {
  const width = landscape ? "11in" : "8.5in";
  return (
    <>
      <style>{css(landscape, width)}</style>
      <div className="no-print mx-auto flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-24 sm:pt-28" style={{ maxWidth: width }}>
        <Link href={back.href} className="font-extrabold text-gold hover:underline">← {back.label}</Link>
        <PrintButton label={printLabel} />
      </div>
      <div className={`sheet-wrap px-4 pb-8 ${landscape ? "overflow-x-auto" : ""}`}>
        <article className="paper" style={landscape ? { width } : undefined}>{children}</article>
      </div>
    </>
  );
}
