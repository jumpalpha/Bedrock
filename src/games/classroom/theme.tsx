import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// Bedrock classroom (projector) games: shared light/dark helpers.
// `cr-dark` marks a "TV stage" panel that stays dark in both themes (Jeopardy board, clue cards,
// Taboo card...). It re-points the theme tokens for everything inside it, so text-fg, text-muted,
// border-line etc. stay readable on the dark panel even when the site is in light mode.
export const CR_CSS = `
:root{--cr-close:#bef264;--cr-lose:#ff8fa3}html.light{--cr-close:#4d7c0f;--cr-lose:#b42318}
.cr-dark{--color-fg:#eef3ea;--color-muted:#a7b2a2;--color-line:rgb(236 244 228 / .12);--color-gold:#f6c453;--color-amber:#f28c28;--color-emerald:#34d399;--color-sky:#38bdf8;--color-crimson:#f25c45;--color-violet:#a78bfa;color:#eef3ea}
@media (min-width:640px) and (max-height:820px){.cr-jtile{min-height:4.5rem!important}.cr-jcat{min-height:3.75rem!important}}
.cr-page .text-ink,.cr-dark .text-ink{color:#10140e}
html.light .cr-page :is(.text-\\[\\#ff8fa3\\],.text-\\[\\#fca5a5\\]):not(.cr-dark,.cr-dark *){color:#b42318}
html.light .cr-page :is(.text-\\[\\#86efac\\],.text-\\[\\#6ee7b7\\]):not(.cr-dark,.cr-dark *){color:#047857}
`;
export function CrStyle() {
  return <style>{CR_CSS}</style>;
}

/** Full-screen overlays render on <body> so they sit above the site nav (the page body is its own stacking context). */
export function OnTop({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, document.body);
}
