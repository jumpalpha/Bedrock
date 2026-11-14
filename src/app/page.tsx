import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, Gamepad2, Gem, Map as MapIcon, Medal, Pickaxe, Sparkles, Star, Swords, Telescope } from "lucide-react";
import { GraduationCap, Layers, Search, SpellCheck } from "lucide-react"; // wave-learnA
import { chapters, realms } from "@/data/site";
import { arcadeGames } from "@/data/arcade";
import { Btn, ChapterCard, Eyebrow, SectionHeading } from "@/components/ui";
import { PlayerCard } from "@/components/player-card";
import { WorldMap } from "@/components/world-map";
import { ArtIcon } from "@/components/art-icon";
import { ArcadeArt } from "@/components/arcade-art";
import { ChampionsStrip } from "@/components/champions-strip"; // ── wave-pet ──
import { Trophy } from "lucide-react"; // ── wave-pet ──
import { Footprints, Mountain, Lightbulb, Zap } from "lucide-react"; // ── wave-twinB ──

const heroChips = [
  { n: String(chapters.length), label: "Chapters", color: "#84cc16", icon: BookOpen },
  { n: String(realms.length), label: "Realms", color: "#22d3ee", icon: MapIcon },
  { n: String(arcadeGames.length), label: "Games", color: "#f6c453", icon: Gamepad2 },
  { n: "10", label: "Mining ranks", color: "#c084fc", icon: Pickaxe },
];
const stats = [
  { n: "28", label: "Chapters", color: "#84cc16" },
  { n: "830", label: "Quiz questions", color: "#22d3ee" },
  { n: "661", label: "Key words", color: "#f6c453" },
  { n: "◆10", label: "Ranks to mine", color: "#c084fc" },
];
const quickLinks = [
  { label: "My Quest", desc: "XP, ranks, badges, checklist", href: "/quest/", icon: ClipboardCheck, color: "#f6c453" },
  { label: "Survey of the Day", desc: "Vote, then see the class", href: "/survey/", icon: BarChart3, color: "#22d3ee" },
  { label: "Pick a Side", desc: "56 debates, bring evidence", href: "/pick-a-side/", icon: Swords, color: "#f25c45" },
  { label: "Unit Tests", desc: "One boss fight per realm", href: "/tests/", icon: Medal, color: "#a78bfa" },
  { label: "Sprite Arcade", desc: `${arcadeGames.length} Earth science games`, href: "/arcade/", icon: Gamepad2, color: "#84cc16" },
  { label: "Glossary", desc: "661 key words", href: "/glossary/", icon: BookOpen, color: "#60a5fa" },
  { label: "Side Quests", desc: "Real science, outside", href: "/side-quests/", icon: Telescope, color: "#34d399" },
  { label: "Badges", desc: "9 realm + 6 bonus", href: "/quest/#badges", icon: Gem, color: "#c084fc" },
  // ── wave-learnA ──
  { label: "Vocab Games", desc: "Flashcards, speed quiz, concept maps", href: "/vocab/", icon: SpellCheck, color: "#38bdf8" },
  { label: "Review Deck", desc: "Practice what you missed", href: "/review/", icon: Layers, color: "#f28c28" },
  { label: "Mastery Checks", desc: "Warm up before the quiz", href: "/mastery/", icon: GraduationCap, color: "#34d399" },
  { label: "Search", desc: "Chapters, words, games", href: "/search/", icon: Search, color: "#a78bfa" },
  // ── end wave-learnA ──
  // ── wave-pet ──
  { label: "My Rock Alien", desc: "Name it, teach it, evolve it", href: "/pet/", icon: Gem, color: "#a78bfa" },
  { label: "Hall of Champions", desc: "Top miners and aliens", href: "/champions/", icon: Trophy, color: "#f6c453" },
  // ── end wave-pet ──
  // ── wave-twinB ──
  { label: "Footprint Quest", desc: "Your water & carbon footprint", href: "/footprint/", icon: Footprints, color: "#34d399" },
  { label: "Home Energy Budget", desc: "Bills, hydro, solar, payback", href: "/energy-budget/", icon: Zap, color: "#f6c453" },
  { label: "The Idaho Trail", desc: "Wagon trek across Idaho geology", href: "/arcade/play/idaho-trail/", icon: Mountain, color: "#d9a75a" },
  { label: "What If?", desc: "Earth science thought experiments", href: "/what-if/", icon: Lightbulb, color: "#38bdf8" },
  // ── end wave-twinB ──
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-14 pt-32 lg:grid-cols-[1.15fr_1fr] lg:pt-40">
        <div className="relative">
          <div className="glass inline-flex animate-rise items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-medium text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald">
              <span className="hero-live" /> World is live
            </span>
            Mr. Dopp&apos;s Earth Science
          </div>

          <h1 className="mt-7 animate-rise font-display text-[clamp(3.4rem,9vw,7.25rem)] font-extrabold leading-[0.9] tracking-[-0.045em] [animation-delay:80ms]">
            <span className="hero-legend">
              <Star className="hero-twinkle -left-2 -top-3 size-6 fill-current text-emerald sm:-left-5 sm:-top-4 sm:size-8" aria-hidden />
              Bedrock
            </span>
            <br />
            <span className="relative inline-block text-[0.62em] tracking-[-0.035em]">
              <span className="hero-shimmer">Earth Science</span>
              <svg className="hero-swash" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="hero-swash-g" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="#f6c453" /><stop offset="0.55" stopColor="#f28c28" /><stop offset="1" stopColor="#c2703d" />
                  </linearGradient>
                </defs>
                <path d="M4 16 C 90 4, 190 4, 270 11 S 370 20, 396 7" fill="none" stroke="url(#hero-swash-g)" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <Sparkles className="hero-twinkle -right-8 -top-2 size-8 text-gold [animation-delay:-1.2s] sm:-right-10 sm:size-10" aria-hidden />
            </span>
          </h1>

          <p className="mt-8 animate-rise font-display text-2xl font-bold tracking-tight sm:text-3xl [animation-delay:160ms]">
            Survive{" "}
            <span className="hero-rotator" aria-label="the rocks, the oceans, the sky, the stars">
              <span style={{ color: "#f28c28" }}>the rocks.</span>
              <span style={{ color: "#22d3ee" }}>the oceans.</span>
              <span style={{ color: "#60a5fa" }}>the sky.</span>
              <span style={{ color: "#c084fc" }}>the stars.</span>
            </span>
          </p>

          <ul className="mt-6 flex flex-wrap gap-2.5">
            {heroChips.map((c, i) => (
              <li key={c.label} className="hero-chip animate-rise" style={{ "--accent": c.color, animationDelay: `${220 + i * 70}ms` } as CSSProperties}>
                <c.icon className="size-4" aria-hidden /><b>{c.n}</b> {c.label}
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-xl animate-rise text-lg leading-relaxed text-muted [animation-delay:520ms]">
            You woke up on a raw planet. Read the chapters, pass the quizzes, clear the realms, and dig your way from Dirt Digger to{" "}
            <span className="hero-master"><Gem className="size-[1.05em]" aria-hidden /> Diamond</span>.
          </p>

          <div className="mt-9 flex animate-rise flex-wrap gap-3 [animation-delay:600ms]">
            <Btn href="/chapters/"><BookOpen className="size-5" /> Start reading</Btn>
            <Btn href="/arcade/" variant="ghost"><Gamepad2 className="size-5" /> Sprite Arcade</Btn>
          </div>
        </div>
        <HeroOrbit />
      </section>

      {/* PLAYER CARD (from the Bedrock mock-up) */}
      <section className="mx-auto max-w-7xl px-6"><PlayerCard /></section>

      {/* STATS */}
      <section className="mx-auto max-w-7xl px-6 pt-6">
        <div className="glass grid grid-cols-2 overflow-hidden rounded-3xl md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`p-7 text-center ${i > 0 ? "md:border-l" : ""} ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""} border-line`}>
              <div className="font-display text-5xl font-extrabold tracking-tight" style={{ color: s.color }}>{s.n}</div>
              <div className="mt-1 text-sm font-medium uppercase tracking-wider text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className="mx-auto max-w-7xl px-6 pt-24">
        <SectionHeading eyebrow="Your toolkit" title="Everything in one tap" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {quickLinks.map((q) => (
            <Link key={q.label} href={q.href} style={{ "--accent": q.color } as CSSProperties} className="accent-card group flex min-w-0 flex-col items-start gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 sm:size-14" style={{ background: `color-mix(in srgb, ${q.color} 16%, transparent)`, color: q.color }}>
                <q.icon className="size-6 sm:size-7" />
              </span>
              <span className="w-full min-w-0">
                <span className="block font-bold leading-tight">{q.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">{q.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── wave-pet: champions (Dopps Class home_champions.js) ── */}
      <section className="mx-auto max-w-7xl px-6 pt-24">
        <SectionHeading eyebrow="This week" title={<>Champions of <span className="text-gradient">Bedrock</span></>}>
          <Btn href="/champions/" variant="ghost">Hall of Champions <ArrowRight className="size-4" /></Btn>
        </SectionHeading>
        <ChampionsStrip checkIn />
      </section>

      {/* WORLD MAP */}
      <section className="mx-auto max-w-7xl px-6 pt-28">
        <SectionHeading eyebrow="The world map" title={<>Dig down, then <span className="text-gradient">look up</span></>}
          sub="Each realm is a biome to survive. Clear every task in a realm to earn its badge and mine your way up one rank." />
        <WorldMap />
      </section>

      {/* CHAPTERS */}
      <section className="mx-auto max-w-7xl px-6 pt-28">
        <SectionHeading eyebrow="All chapters" title="Jump to any chapter" sub="Every chapter has the full reading, a 20-question quiz, a Think Like a Scientist challenge, and key words.">
          <Btn href="/chapters/" variant="ghost">Browse chapters <ArrowRight className="size-4" /></Btn>
        </SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {chapters.slice(0, 8).map((ch) => <ChapterCard key={ch.id} ch={ch} />)}
        </div>
        <div className="mt-6 text-center">
          <Link href="/chapters/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-fg">See all {chapters.length} chapters <ArrowRight className="size-4" /></Link>
        </div>
      </section>

      {/* ARCADE */}
      <section className="mx-auto max-w-7xl px-6 pt-28">
        <SectionHeading eyebrow="The arcade" title={<>Play your way <span className="text-gradient">through the planet</span></>}
          sub="The five most-played Dopps Class games, rebuilt with volcanoes, landslides, meteors and crystals.">
          <Btn href="/arcade/">Open the Arcade <ArrowRight className="size-4" /></Btn>
        </SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {arcadeGames.map((g) => (
            <Link key={g.slug} href={`/arcade/play/${g.slug}/`} style={{ "--accent": g.color } as CSSProperties} className="accent-card group flex flex-col rounded-2xl p-5">
              <span className="-m-1 grid size-24 place-items-center self-center transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><ArcadeArt slug={g.slug} emoji={g.emoji} size={96} /></span>
              <h3 className="mt-3 text-lg font-bold">{g.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{g.subtitle}</p>
              <span className="mt-auto pt-4 font-mono text-[11px] text-muted/80">🎯 {g.goal}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* BANNERS */}
      <section className="mx-auto grid max-w-7xl gap-4 px-6 pt-28 md:grid-cols-2">
        <Link href="/side-quests/" className="group relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-emerald/20 via-sky/10 to-transparent p-8 transition hover:border-emerald/50">
          <Telescope className="absolute -right-6 -top-6 size-40 text-emerald/10 transition-transform duration-500 group-hover:rotate-12" />
          <Eyebrow color="#34d399">Go outside</Eyebrow>
          <h3 className="font-display text-3xl font-extrabold">Side Quests</h3>
          <p className="mt-2 max-w-sm text-muted">15 real-world missions, from Rock Collector to Moon Tracker to Watershed Detective. Three per term, 50 XP each.</p>
          <span className="mt-6 inline-flex items-center gap-1.5 font-bold text-emerald">Explore <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
        </Link>
        <Link href="/pick-a-side/" className="group relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-amber/25 via-crimson/10 to-transparent p-8 transition hover:border-amber/50">
          <Swords className="absolute -right-6 -top-6 size-40 text-amber/10 transition-transform duration-500 group-hover:-rotate-12" />
          <Eyebrow color="#f28c28">Class favorite</Eyebrow>
          <h3 className="font-display text-3xl font-extrabold">Pick a Side</h3>
          <p className="mt-2 max-w-sm text-muted">Two debates per chapter. Choose a side, back it with evidence, see where the class lands.</p>
          <span className="mt-6 inline-flex items-center gap-1.5 font-bold text-amber">Debate <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
        </Link>
      </section>
    </>
  );
}

function HeroOrbit() {
  const ring = realms.slice(0, 8);
  return (
    <div className="relative mx-auto hidden aspect-square w-full max-w-[520px] animate-rise [animation-delay:200ms] lg:block" aria-hidden>
      <div className="absolute inset-[8%] rounded-full border border-line" />
      <div className="absolute inset-[24%] rounded-full border border-dashed border-line" />
      <div className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle,rgba(246,196,83,0.35),rgba(242,140,40,0.12)_45%,transparent_70%)] blur-xl" />
      <div className="absolute inset-[20%] grid animate-float place-items-center">
        <ArtIcon slug="hero-earth" fallback="🌍" size={280} className="drop-shadow-[0_30px_50px_rgba(242,140,40,0.45)]" />
      </div>
      {ring.map((r, i) => {
        const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <div key={r.n} className="absolute grid size-24 -translate-x-1/2 -translate-y-1/2 animate-float place-items-center"
            style={{ left: `${50 + Math.cos(angle) * 42}%`, top: `${50 + Math.sin(angle) * 42}%`, animationDelay: `${-i * 0.8}s` }} title={r.name}>
            <span className="absolute inset-3 rounded-full blur-xl" style={{ background: `color-mix(in srgb, ${r.color} 35%, transparent)` }} />
            <ArtIcon slug={`realm-${r.n}`} fallback={r.icon} size={88} className="relative" />
          </div>
        );
      })}
    </div>
  );
}
