import Link from "next/link";

const cols = [
  { title: "Explore", links: [["World Map", "/"], ["All Chapters", "/chapters/"], ["Glossary", "/glossary/"], ["Side Quests", "/side-quests/"]] },
  { title: "Students", links: [["My Quest", "/quest/"], ["Unit Tests", "/tests/"], ["Pick a Side", "/pick-a-side/"], ["Survey of the Day", "/survey/"]] },
  { title: "Teacher", links: [["Teacher Dashboard", "/teacher/"], ["Dopps Class (Health)", "https://doppsclass.com"]] },
];

export function Footer() {
  return (
    <footer className="relative z-10 mt-24">
      <div className="ground" />
      <div className="tex tex-dirt">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 text-white md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="pixel-title pixel-shadow text-3xl">Bedrock</div>
            <p className="mt-3 max-w-xs text-sm font-semibold leading-relaxed text-white/90 [text-shadow:1px_1px_0_#000]">
              Mr. Dopp&apos;s Earth science class as a survival planet. 28 chapters, 9 realms, one world to figure out.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="mb-4 font-pixel text-[10px] uppercase tracking-wider text-gold [text-shadow:2px_2px_0_#000]">{c.title}</div>
              <ul className="space-y-2.5">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-sm font-bold text-white/90 [text-shadow:1px_1px_0_#000] hover:text-white hover:underline">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="tex tex-bedrock border-t-[3px] border-black px-6 py-4 text-center font-pixel text-[9px] leading-relaxed text-white/80">
          You hit bedrock. Nothing below here but the core.
        </div>
      </div>
    </footer>
  );
}
