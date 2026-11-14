import { chapters, realms } from "@/data/site";
import { SiteLink, x7aLinks } from "@/components/x7a-link"; // ── wave-x7a ──
import { VisitCount } from "@/components/x7b/visit-count"; // ── wave-x7b ──
import { InstallButton } from "@/components/x7b/pwa"; // ── wave-x7b ──

// ── wave-learnA ── learning tools column
const learn = { title: "Learn", links: [["Vocab Games", "/vocab/"], ["Review Deck", "/review/"], ["Mastery Checks", "/mastery/"], ["Search", "/search/"]] };
// ── wave-x7a ── listening, reading and making tools join the Learn column
learn.links.push(...x7aLinks.map((l) => [l.label, l.href]));
// ── end wave-x7a ──
// ── end wave-learnA ──
const cols = [
  { title: "Explore", links: [["World Map", "/"], ["All Chapters", "/chapters/"], ["Sprite Arcade", "/arcade/"], ["Glossary", "/glossary/"], ["Side Quests", "/side-quests/"]] },
  { title: "Students", links: [["My Quest", "/quest/"], ["Unit Tests", "/tests/"], ["Pick a Side", "/pick-a-side/"], ["Survey of the Day", "/survey/"],
    // ── wave-twinA ──
    ["Quake Ready", "/quake-ready/"], ["Family Disaster Plan", "/disaster-plan/"], ["Hazard PSA", "/hazard-psa/"],
    // ── wave-x7b ──
    ["Welcome Back", "/welcome/"], ["Print Quest Sheet", "/print-quest/"], ["Visitors (past students)", "/visitors/"], ["Suggest an Improvement", "/suggest/"]] },
  learn, // wave-learnA
  { title: "Adults", links: [["Teacher Dashboard", "/teacher/"],
    // ── wave-x7b ──
    ["Parents & Guardians", "/parents/"], ["Sub Guide", "/sub-guide/"], ["Station Timer", "/timer/"],
    ["Dopps Class (Health)", "https://doppsclass.com"]] },
];

export function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-line bg-ink-2/60 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <div className="font-display text-2xl font-extrabold"><span className="text-gradient">Bedrock</span></div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Mr. Dopp&apos;s Earth science class as a survival planet. {chapters.length} chapters, {realms.length} realms, one world to figure out.
          </p>
          <p className="mt-5 font-mono text-xs tracking-wider text-muted/70">#Doppitup · Dig down, then look up</p>
          {/* ── wave-x7b ── */}<div className="mt-5"><InstallButton /></div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/80">{c.title}</div>
            <ul className="space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}><SiteLink href={href} className="text-sm text-muted transition hover:text-fg">{label}</SiteLink></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-6 py-6 text-center text-xs text-muted/60">Bedrock · bedrock.doppsclass.com{/* ── wave-x7b ── */}<VisitCount /></div>
    </footer>
  );
}
