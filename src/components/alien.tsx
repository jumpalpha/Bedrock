"use client";
// ── wave-pet: draws a student's rock alien (stage art + crystal color + shop gear) ──
// Art: /pet/<stage>.png (keyed Kling renders). If a PNG is missing, a drawn SVG alien stands in.
import { useState, type CSSProperties } from "react";
import type { PetMood, PetStage } from "@/lib/db";
import { petColor } from "@/data/pet";

export type AlienLook = { stage: PetStage; color: string; alive?: boolean; mood_label?: PetMood; gear?: Record<string, string> };

/** Stages whose art has a gray body: only their crystals take the hue shift. Colorful bodies keep their real rock color. */
const TINTABLE: PetStage[] = ["geode", "pebble", "granite", "titan"];
const SKIN_FILTER: Record<string, string> = {
  rose: "hue-rotate(60deg) saturate(1.4)",
  opal: "hue-rotate(150deg) saturate(1.6) brightness(1.08)",
  obsidian: "brightness(0.55) contrast(1.35) saturate(0.7)",
  gold: "sepia(1) saturate(3.2) hue-rotate(-12deg) brightness(1.08)",
};
/** Where the head top and middle sit in each stage's art (fraction of the box), so hats and glasses land in place. */
const ANCHOR: Record<PetStage, { head: number; eyes: number; feet: number; w: number }> = {
  geode: { head: 0.1, eyes: 0.42, feet: 0.94, w: 0.62 },
  pebble: { head: 0.2, eyes: 0.42, feet: 0.95, w: 0.72 },
  sandstone: { head: 0.2, eyes: 0.42, feet: 0.95, w: 0.76 },
  quartzite: { head: 0.2, eyes: 0.43, feet: 0.95, w: 0.78 },
  magma: { head: 0.2, eyes: 0.42, feet: 0.95, w: 0.78 },
  granite: { head: 0.2, eyes: 0.4, feet: 0.95, w: 0.86 },
  titan: { head: 0.06, eyes: 0.52, feet: 0.96, w: 0.86 },
};

export function alienFilter(a: AlienLook) {
  const f: string[] = [];
  const skin = a.gear?.skin;
  if (skin && SKIN_FILTER[skin]) f.push(SKIN_FILTER[skin]);
  else if (TINTABLE.includes(a.stage)) f.push(`hue-rotate(${petColor(a.color).hue}deg)`);
  if (a.alive === false) f.push("grayscale(1) brightness(0.75)");
  else if (a.mood_label === "sick") f.push("saturate(0.55)");
  return f.join(" ") || undefined;
}

export function Alien({ a, size = 220, className = "", anim = true }: { a: AlienLook; size?: number; className?: string; anim?: boolean }) {
  const [broken, setBroken] = useState(false);
  const g = a.gear ?? {};
  const an = ANCHOR[a.stage] ?? ANCHOR.pebble;
  const col = petColor(a.color).hex;
  const motion = !anim ? "" : a.alive === false ? "" : a.stage === "geode" ? "alien-wobble" : a.mood_label === "happy" ? "alien-bob" : "alien-sway";
  const box: CSSProperties = { width: size, height: size };
  return (
    <div className={`relative shrink-0 ${className}`} style={box} aria-hidden>
      {g.scene && <Scene k={g.scene} />}
      {g.aura === "glow" && a.alive !== false && <span className="absolute inset-[12%] animate-pulse rounded-full blur-2xl" style={{ background: "radial-gradient(circle, #f97316aa, #f6c45355 50%, transparent 72%)" }} />}
      {!g.aura && a.alive !== false && a.stage !== "geode" && <span className="absolute inset-[22%] rounded-full opacity-50 blur-2xl" style={{ background: col }} />}
      {g.stand === "stand" && <Stand />}
      <div className={`absolute inset-0 ${motion}`}>
        {g.back && <Gear k={g.back} style={{ left: "8%", top: `${an.eyes * 100 - 6}%`, width: "34%" }} />}
        {broken ? <FallbackAlien a={a} /> : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/pet/${a.stage}.png`} alt="" width={size} height={size} draggable={false} onError={() => setBroken(true)}
            className="absolute inset-0 size-full select-none object-contain" style={{ filter: alienFilter(a) }} />
        )}
        {a.stage !== "geode" && a.alive !== false && <>
          {g.body && <Gear k={g.body} style={{ left: "26%", top: `${an.eyes * 100 + 14}%`, width: "48%" }} />}
          {g.feet && <Gear k={g.feet} style={{ left: "27%", top: `${an.feet * 100 - 13}%`, width: "46%" }} />}
          {g.neck && <Gear k={g.neck} style={{ left: "41%", top: `${an.eyes * 100 + 17}%`, width: "18%" }} />}
          {g.face && <Gear k={g.face} style={{ left: "24%", top: `${an.eyes * 100 - 9}%`, width: "52%" }} />}
          {g.hat && <Gear k={g.hat} style={{ left: "27%", top: `${an.head * 100 - 6}%`, width: "46%" }} />}
          {g.hand && <Gear k={g.hand} style={{ right: "0%", top: `${an.eyes * 100 + 2}%`, width: "30%" }} />}
        </>}
      </div>
      {a.alive === false && <span className="absolute right-[12%] top-[8%] font-display text-lg font-extrabold text-sky/80">z z z</span>}
    </div>
  );
}

function Scene({ k }: { k: string }) {
  const bg: Record<string, string> = {
    sawtooth: "linear-gradient(180deg,#f59e0b 0%,#f472b6 45%,#7c3aed 100%)",
    aurora: "linear-gradient(180deg,#0b1026 0%,#134e4a 40%,#22d3ee55 60%,#0b1026 100%)",
    cosmos: "radial-gradient(circle at 30% 20%,#ffffff22 0 2px,transparent 3px),radial-gradient(circle at 70% 35%,#ffffff33 0 1.5px,transparent 3px),radial-gradient(circle at 50% 10%,#ffffff22 0 1px,transparent 2px),linear-gradient(180deg,#020617,#1e1b4b)",
  };
  return (
    <div className="absolute inset-[4%] overflow-hidden rounded-[28%]" style={{ background: bg[k] }}>
      {k === "sawtooth" && <svg viewBox="0 0 100 100" className="absolute inset-0 size-full"><path d="M0 78 L14 56 L22 66 L34 44 L46 64 L58 40 L70 62 L82 50 L100 70 V100 H0Z" fill="#3b2a52" /></svg>}
      {k === "aurora" && <svg viewBox="0 0 100 100" className="absolute inset-0 size-full"><path d="M-5 40 C20 10 40 55 60 25 S95 30 105 15" stroke="#34d399" strokeWidth="9" fill="none" opacity=".55" /><path d="M-5 55 C25 30 45 70 70 40 S100 45 105 35" stroke="#a78bfa" strokeWidth="6" fill="none" opacity=".45" /></svg>}
      {k === "cosmos" && <svg viewBox="0 0 100 100" className="absolute inset-0 size-full"><circle cx="78" cy="22" r="8" fill="#e5e7eb" opacity=".85" /><path d="M0 84 Q20 76 35 82 T70 80 T100 84 V100 H0Z" fill="#111827" /></svg>}
    </div>
  );
}

function Stand() {
  return (
    <svg viewBox="0 0 100 30" className="absolute bottom-[-2%] left-[14%] w-[72%]">
      <ellipse cx="50" cy="10" rx="44" ry="8" fill="#6b4f3a" /><rect x="10" y="10" width="80" height="12" fill="#5a3f2c" /><ellipse cx="50" cy="22" rx="40" ry="6" fill="#3f2a1d" />
      <rect x="34" y="12" width="32" height="7" rx="2" fill="#f6c453" />
    </svg>
  );
}

/** Small drawn gear pieces (shop items). */
function Gear({ k, style }: { k: string; style: CSSProperties }) {
  const svg: Record<string, React.ReactNode> = {
    hardhat: <svg viewBox="0 0 100 60"><path d="M10 48 Q12 8 50 6 Q88 8 90 48Z" fill="#facc15" stroke="#a16207" strokeWidth="3" /><rect x="2" y="44" width="96" height="10" rx="5" fill="#eab308" stroke="#a16207" strokeWidth="3" /><rect x="44" y="6" width="12" height="40" rx="4" fill="#fde047" /></svg>,
    headlamp: <svg viewBox="0 0 100 60"><rect x="4" y="34" width="92" height="12" rx="6" fill="#334155" /><rect x="34" y="18" width="32" height="28" rx="8" fill="#94a3b8" stroke="#334155" strokeWidth="3" /><circle cx="50" cy="32" r="9" fill="#fef9c3" /><path d="M50 32 L20 0 L80 0Z" fill="#fef08a" opacity=".35" /></svg>,
    ranger: <svg viewBox="0 0 100 60"><ellipse cx="50" cy="46" rx="48" ry="9" fill="#a16207" /><path d="M24 46 Q26 12 50 10 Q74 12 76 46Z" fill="#ca8a04" /><path d="M36 20 L50 10 L64 20" stroke="#854d0e" strokeWidth="3" fill="none" /><rect x="24" y="36" width="52" height="7" fill="#166534" /></svg>,
    crown: <svg viewBox="0 0 100 60"><path d="M8 54 L14 14 L32 34 L50 6 L68 34 L86 14 L92 54Z" fill="#fbbf24" stroke="#b45309" strokeWidth="3" /><circle cx="50" cy="38" r="7" fill="#be123c" /><circle cx="28" cy="44" r="4" fill="#be123c" /><circle cx="72" cy="44" r="4" fill="#be123c" /></svg>,
    loupe: <svg viewBox="0 0 100 50"><circle cx="70" cy="22" r="17" fill="#bae6fd88" stroke="#334155" strokeWidth="5" /><path d="M82 34 L96 48" stroke="#78350f" strokeWidth="7" strokeLinecap="round" /></svg>,
    goggles: <svg viewBox="0 0 100 50"><rect x="2" y="20" width="96" height="8" fill="#16a34a" /><rect x="10" y="8" width="36" height="30" rx="12" fill="#bbf7d0aa" stroke="#15803d" strokeWidth="4" /><rect x="54" y="8" width="36" height="30" rx="12" fill="#bbf7d0aa" stroke="#15803d" strokeWidth="4" /></svg>,
    shades: <svg viewBox="0 0 100 50"><path d="M4 14 H96" stroke="#111" strokeWidth="5" /><rect x="8" y="12" width="36" height="24" rx="10" fill="#111827" /><rect x="56" y="12" width="36" height="24" rx="10" fill="#111827" /><path d="M14 18 l10 0" stroke="#fff" strokeWidth="3" opacity=".6" /></svg>,
    hammer: <svg viewBox="0 0 60 80"><rect x="26" y="20" width="9" height="58" rx="4" fill="#92400e" /><path d="M6 10 H48 L56 18 L48 26 H6Z" fill="#64748b" stroke="#334155" strokeWidth="3" /></svg>,
    compass: <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" fill="#fbbf24" stroke="#92400e" strokeWidth="4" /><circle cx="30" cy="30" r="19" fill="#f8fafc" /><path d="M30 13 L36 30 L30 47 L24 30Z" fill="#dc2626" /><path d="M30 30 L36 30 L30 47 L24 30Z" fill="#1e293b" /></svg>,
    pick: <svg viewBox="0 0 80 50"><ellipse cx="40" cy="24" rx="36" ry="14" fill="#94a3b8" stroke="#475569" strokeWidth="3" /><ellipse cx="40" cy="22" rx="24" ry="8" fill="#64748b" /><circle cx="34" cy="21" r="3" fill="#facc15" /><circle cx="44" cy="23" r="2.4" fill="#facc15" /></svg>,
    vest: <svg viewBox="0 0 100 60"><path d="M10 4 H38 L50 30 L62 4 H90 L84 58 H16Z" fill="#f97316" stroke="#c2410c" strokeWidth="3" opacity=".92" /><rect x="14" y="30" width="72" height="6" fill="#e5e7eb" /></svg>,
    boots: <svg viewBox="0 0 100 40"><path d="M6 10 H34 V30 H42 V38 H2 Z" fill="#78350f" /><path d="M58 10 H86 V30 H94 V38 H54 Z" fill="#78350f" /><rect x="2" y="34" width="40" height="5" fill="#1f2937" /><rect x="54" y="34" width="40" height="5" fill="#1f2937" /></svg>,
    pack: <svg viewBox="0 0 60 70"><rect x="6" y="6" width="48" height="60" rx="12" fill="#166534" stroke="#14532d" strokeWidth="3" /><rect x="14" y="30" width="32" height="22" rx="5" fill="#15803d" /></svg>,
    jetpack: <svg viewBox="0 0 60 90"><rect x="4" y="6" width="22" height="52" rx="10" fill="#94a3b8" stroke="#475569" strokeWidth="3" /><rect x="34" y="6" width="22" height="52" rx="10" fill="#94a3b8" stroke="#475569" strokeWidth="3" /><path d="M8 60 L15 86 L22 60Z M38 60 L45 86 L52 60Z" fill="#f97316" /></svg>,
    medal: <svg viewBox="0 0 40 50"><path d="M8 0 L20 18 L32 0" stroke="#2563eb" strokeWidth="6" fill="none" /><circle cx="20" cy="32" r="14" fill="#fbbf24" stroke="#b45309" strokeWidth="3" /><path d="M20 22 l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#be123c" /></svg>,
  };
  if (!svg[k]) return null;
  return <div className="absolute [&>svg]:h-auto [&>svg]:w-full" style={style}>{svg[k]}</div>;
}

/** Drawn stand-in used only if a stage PNG fails to load. */
function FallbackAlien({ a }: { a: AlienLook }) {
  const body: Record<PetStage, string> = { geode: "#a8a29e", pebble: "#a8a29e", sandstone: "#d6a36a", quartzite: "#f5d0dc", magma: "#292524", granite: "#e7d6d6", titan: "#9ca3af" };
  const c = petColor(a.color).hex;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
      {a.stage === "titan" && <path d="M22 40 L40 6 L52 26 L64 2 L80 40Z" fill="#6b7280" />}
      <path d="M38 22 L42 6 L46 20 L50 2 L54 20 L58 8 L62 22Z" fill={c} />
      <circle cx="50" cy="56" r="34" fill={body[a.stage]} stroke="#44403c" strokeWidth="2" />
      {a.stage === "sandstone" && [44, 54, 64, 74].map((y) => <path key={y} d={`M18 ${y} Q50 ${y + 4} 82 ${y}`} stroke="#b45309" strokeWidth="3" fill="none" opacity=".5" />)}
      {a.stage === "magma" && <path d="M30 70 L44 60 L52 74 L66 62" stroke="#f97316" strokeWidth="3" fill="none" />}
      {a.stage !== "geode" && <><circle cx="40" cy="50" r="7" fill="#22d3ee" /><circle cx="60" cy="50" r="7" fill="#22d3ee" /><path d="M45 61 Q50 65 55 61" stroke="#292524" strokeWidth="2" fill="none" />
        <path d="M38 70 L46 66 L50 74 L56 66 L62 70 L58 80 H42Z" fill={c} opacity=".85" /></>}
      {a.stage === "geode" && <path d="M50 24 L46 50 L54 62 L48 88" stroke="#22d3ee" strokeWidth="2.5" fill="none" />}
    </svg>
  );
}
// ── end wave-pet ──
