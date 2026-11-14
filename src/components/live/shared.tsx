"use client";

// ── wave-live ── bits shared by the live pages (projector + phones).
import { useEffect, useRef, useState, type ReactNode } from "react";

export const TEAMS: Record<number, { name: string; col: string; icon: string }> = {
  1: { name: "Glacier Crew", col: "#38bdf8", icon: "🧊" },
  2: { name: "Magma Squad", col: "#f25c45", icon: "🌋" },
  3: { name: "Gold Prospectors", col: "#e0a526", icon: "⛏️" },
  4: { name: "Fossil Hunters", col: "#10b981", icon: "🦴" },
};
export const LETTERS = ["A", "B", "C", "D"] as const;
export const SHAPES = ["▲", "◆", "●", "■"];
/** Answer tile colors. Saturated in both themes, so white text always reads. */
export const TILE = ["#1d7fb0", "#c2334a", "#a87a06", "#0f8a63"];

export function TeamPill({ team }: { team: number | null | undefined }) {
  if (!team || !TEAMS[team]) return null;
  const t = TEAMS[team];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-extrabold" style={{ borderColor: t.col, color: t.col }}>
      {t.icon} {t.name}
    </span>
  );
}

let qrLoading: Promise<void> | null = null;
function loadQr() {
  // qrcodejs from cdnjs (the same library Dopps Class uses). If it can't load, the code still shows.
  qrLoading ??= new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = () => res();
    s.onerror = () => { qrLoading = null; rej(new Error("qr")); };
    document.head.appendChild(s);
  });
  return qrLoading;
}
export function Qr({ text, size = 132 }: { text: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    loadQr().then(() => {
      const el = ref.current;
      const Q = (window as unknown as { QRCode?: new (el: HTMLElement, o: object) => unknown }).QRCode;
      if (dead || !el || !Q) return;
      el.innerHTML = "";
      new Q(el, { text, width: size, height: size, colorDark: "#000000", colorLight: "#ffffff" });
    }).catch(() => !dead && setFailed(true));
    return () => { dead = true; };
  }, [text, size]);
  if (failed) return null;
  return <div ref={ref} className="shrink-0 rounded-xl bg-white p-2 leading-[0]" style={{ minWidth: size + 16, minHeight: size + 16 }} aria-label="QR code to join" />;
}

/** The projector's join banner: QR, the address and the big code. */
export function JoinBanner({ path, code, children }: { path: string; code: string; children?: ReactNode }) {
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only known in the browser (static export)
  useEffect(() => setOrigin(location.origin), []);
  const url = `${origin}${path}?code=${code}`;
  return (
    <div className="block-panel flex flex-wrap items-center justify-between gap-5 p-5">
      <div className="flex items-center gap-5">
        {origin && <Qr text={url} />}
        <div>
          <div className="text-lg text-muted">Go to <b className="text-fg">{origin.replace(/^https?:\/\//, "") || "bedrock.doppsclass.com"}{path}</b></div>
          <div className="text-lg text-muted">Game code:</div>
          <div data-testid="join-code" className="font-display text-5xl font-extrabold tracking-[0.15em] text-gold sm:text-7xl">{code}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function Timer({ left, low = 5 }: { left: number; low?: number }) {
  return <div className={`min-w-[90px] text-center font-display text-6xl font-extrabold ${left <= low ? "text-crimson" : "text-gold"}`}>{left}</div>;
}

/** Two-tap confirm instead of a browser dialog (a projector shouldn't pop up alerts). */
export function useTwoTap(ms = 4000) {
  const [armed, setArmed] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return {
    armed,
    tap(): boolean {
      if (armed) { setArmed(false); return true; }
      setArmed(true);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setArmed(false), ms);
      return false;
    },
  };
}

export const btn = "btn-block justify-center disabled:cursor-not-allowed disabled:opacity-45";
export const btnGold = "btn-block btn-grass justify-center disabled:cursor-not-allowed disabled:opacity-45";
export const btnRed = "btn-block justify-center !border-crimson/60 !text-crimson";
export const input = "w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-base text-fg outline-none focus:border-gold";
export const label = "mb-1 block text-sm font-extrabold";
