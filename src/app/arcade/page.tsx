import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { arcadeGames } from "@/data/arcade";
import { ArcadeArt } from "@/components/arcade-art";
// ── wave-arcadeC ──
import { classicGames } from "@/data/arcade-classic";
// ── /wave-arcadeC ──

export const metadata: Metadata = { title: "Arcade" };

export default function ArcadePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-36">
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            <span className="h-px w-6 bg-gold" />
            {arcadeGames.length} games · no installs
          </div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
            The <span className="bg-gradient-to-r from-gold via-amber to-[#ff6b3d] bg-clip-text text-transparent">Arcade</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Dodge lava bombs, mine crystals, and outrun landslides with your sprite. Every game ends with a real Earth science fact.
          </p>
        </div>
      </div>

      <section id="sprite" className="scroll-mt-36 pt-14">
        <div className="mb-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            <span className="h-px w-6 bg-gold" />
            Starring your sprite
          </div>
          <h2 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Sprite Arcade</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">Bronze, Silver, Gold, and Legend medals for every game. Your best scores save on this device.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* grouped games (wave A: group, wave B: section) get their own shelves below */}
          {arcadeGames.filter((g) => !g.group && !g.section).map((g) => (
            <Link
              key={g.slug}
              href={`/arcade/play/${g.slug}/`}
              style={{ "--accent": g.color } as CSSProperties}
              className="accent-card group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-3xl p-6"
            >
              <div className="absolute inset-0" style={{ background: `radial-gradient(80% 60% at 50% 30%, color-mix(in srgb, ${g.color} 40%, transparent), transparent 70%)` }} />
              <span className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 group-hover:-translate-y-[58%] group-hover:scale-110">
                <ArcadeArt slug={g.slug} emoji={g.emoji} size={140} />
              </span>
              <div className="relative">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: g.color }}>🎯 {g.goal}</div>
                <h3 className="mt-1 font-display text-2xl font-extrabold">{g.title}</h3>
                <p className="mt-1 text-sm text-muted">{g.subtitle}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-ink" style={{ background: g.color }}>
                  <Play className="size-3.5 fill-current" /> Play now
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── wave-arcadeA ── */}
      {SHELVES_A.map((sh) => (
        <section key={sh.id} id={sh.id} className="scroll-mt-36 pt-24">
          <div className="mb-10 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              <span className="h-px w-6 bg-gold" />
              {sh.eyebrow}
            </div>
            <h2 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{sh.title}</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">{sh.sub}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {arcadeGames.filter((g) => g.group === sh.id).map((g) => (
              <Link
                key={g.slug}
                href={`/arcade/play/${g.slug}/`}
                style={{ "--accent": g.color } as CSSProperties}
                className="accent-card group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl p-6"
              >
                <div className="absolute inset-0" style={{ background: `radial-gradient(80% 60% at 50% 30%, color-mix(in srgb, ${g.color} 35%, transparent), transparent 70%)` }} />
                <span className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 transition-transform duration-500 group-hover:-translate-y-[58%] group-hover:scale-110">
                  <ArcadeArt slug={g.slug} emoji={g.emoji} size={120} />
                </span>
                <div className="relative">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: g.color }}>🎯 {g.goal}</div>
                  <h3 className="mt-1 font-display text-xl font-extrabold">{g.title}</h3>
                  <p className="mt-1 text-sm text-muted">{g.subtitle}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-[#10140e]" style={{ background: g.color }}>
                    <Play className="size-3.5 fill-current" /> Play now
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {/* ── end wave-arcadeA ── */}
      {/* ── wave-arcadeC ── */}
      <section id="classic" className="scroll-mt-36 pt-24">
        <div className="mb-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            <span className="h-px w-6 bg-gold" />
            Old-school favorites
          </div>
          <h2 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Classic Arcade</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">The original classics. Best scores save on this device.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classicGames.map((g) => (
            <a
              key={g.slug}
              href={g.href}
              style={{ "--accent": g.color } as CSSProperties}
              className="accent-card group relative flex items-center gap-5 overflow-hidden rounded-3xl p-6"
            >
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl text-4xl transition-transform duration-300 group-hover:scale-110" style={{ background: `color-mix(in srgb, ${g.color} 22%, transparent)` }}>
                {g.emoji}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-extrabold">{g.title}</h3>
                <p className="mt-1 text-sm text-muted">{g.subtitle}</p>
              </div>
            </a>
          ))}
        </div>
      </section>
      {/* ── /wave-arcadeC ── */}

      {/* ── wave-arcadeB ── */}
      {SHELVES_B.map((sh) => {
        const games = arcadeGames.filter((g) => g.section === sh.id);
        if (!games.length) return null;
        return (
          <section key={sh.id} id={sh.anchor} className="scroll-mt-36 pt-20">
            <div className="mb-8 max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                <span className="h-px w-6 bg-gold" />
                {sh.eyebrow}
              </div>
              <h2 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{sh.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">{sh.blurb}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {games.map((g) => (
                <Link
                  key={g.slug}
                  href={g.href ?? `/arcade/play/${g.slug}/` /* wave-live: href */}
                  style={{ "--accent": g.color } as CSSProperties}
                  className="accent-card group relative flex items-center gap-4 overflow-hidden rounded-3xl p-5"
                >
                  <span className="grid size-20 shrink-0 place-items-center rounded-2xl transition-transform duration-500 group-hover:scale-110" style={{ background: `color-mix(in srgb, ${g.color} 18%, transparent)` }}>
                    <ArcadeArt slug={g.slug} emoji={g.emoji} size={72} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-muted">🎯 {g.goal}</span>
                    <span className="mt-0.5 block font-display text-xl font-extrabold">{g.title}</span>
                    <span className="mt-1 block text-sm leading-snug text-muted">{g.subtitle}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {/* ── end wave-arcadeB ── */}
    </div>
  );
}

// ── wave-arcadeA ──
const SHELVES_A = [
  { id: "classics", eyebrow: "Rebuilt with your sprite", title: "Sprite Classics", sub: "Arcade favorites, reimagined with rocks, storms and the Magma King." },
  { id: "brain", eyebrow: "Learn while you play", title: "Brain Games", sub: "Quiz yourself on the vocab and ideas from every chapter." },
] as const;
// ── end wave-arcadeA ──
// ── wave-arcadeB ──
const SHELVES_B = [
  { id: "classic", anchor: "classics", eyebrow: "Rebuilt classics", title: "Earth Science Classics", blurb: "Invaders, brick breakers, 2048 and more, rebuilt around rocks, quakes, meteors and minerals." },
  { id: "team", anchor: "team", eyebrow: "Whole class", title: "Team Games", blurb: "One screen, the whole class. Great for a projector." },
  { id: "partner", anchor: "partner", eyebrow: "Two players", title: "Partner Games", blurb: "Play the computer, a friend on the same device, or a classmate on two devices with a game code." /* wave-live */ },
  { id: "classroom", anchor: "classroom", eyebrow: "Class starters", title: "Classroom Games", blurb: "Quick warm-ups and closers for the whole room." },
] as const;
// ── end wave-arcadeB ──
