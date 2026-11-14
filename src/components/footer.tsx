import Link from "next/link";
import { chapters, realms } from "@/data/site";

const cols = [
  { title: "Explore", links: [["World Map", "/"], ["All Chapters", "/chapters/"], ["Sprite Arcade", "/arcade/"], ["Glossary", "/glossary/"], ["Side Quests", "/side-quests/"]] },
  { title: "Students", links: [["My Quest", "/quest/"], ["Unit Tests", "/tests/"], ["Pick a Side", "/pick-a-side/"], ["Survey of the Day", "/survey/"]] },
  { title: "Adults", links: [["Teacher Dashboard", "/teacher/"], ["Dopps Class (Health)", "https://doppsclass.com"]] },
];

export function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-line bg-ink-2/60 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="font-display text-2xl font-extrabold"><span className="text-gradient">Bedrock</span></div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Mr. Dopp&apos;s Earth science class as a survival planet. {chapters.length} chapters, {realms.length} realms, one world to figure out.
          </p>
          <p className="mt-5 font-mono text-xs tracking-wider text-muted/70">#Doppitup · Dig down, then look up</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/80">{c.title}</div>
            <ul className="space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}><Link href={href} className="text-sm text-muted transition hover:text-fg">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-6 py-6 text-center text-xs text-muted/60">Bedrock · bedrock.doppsclass.com</div>
    </footer>
  );
}
