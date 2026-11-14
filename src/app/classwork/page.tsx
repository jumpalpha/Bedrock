import type { Metadata } from "next";
import Link from "next/link";
import { ArtIcon } from "@/components/art-icon";
import { PageHead } from "@/components/ui";
import { chaptersIn, realms } from "@/data/site";
import { ClassworkHub, type HubRealm } from "./classwork";
import { storiesNeeded, wordsFor } from "./data";

export const metadata: Metadata = { title: "Classwork", description: "Realm Classwork: learn each chapter's words, take the chapter tests, and tell real-world stories." };

export default function ClassworkPage() {
  const hub: HubRealm[] = realms.map((r) => {
    const chs = chaptersIn(r).map((c) => ({ ref: c.ref, label: c.label, words: wordsFor(c.id) }));
    return {
      n: r.n, name: r.name, color: r.color, icon: r.icon,
      chapters: chs.map(({ ref, label }) => ({ ref, label })),
      words: chs.reduce((t, c) => t + c.words.length, 0),
      storiesNeeded: chs.reduce((t, c) => t + storiesNeeded(c.words), 0),
    };
  });
  return (
    <>
      <PageHead eyebrow="Classwork" title="Realm Classwork" sub="Learn the words. Pass the chapter checks. Tell real stories about the Earth around you." art={{ slug: "classwork", fallback: "📝" }} />
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <ClassworkHub realms={hub} />
        <Link href="/reflection/" className="block-panel mt-6 flex items-center gap-4 p-5 transition hover:-translate-y-0.5">
          <ArtIcon slug="reflection" fallback="📝" size={48} />
          <span><b className="font-display text-lg font-extrabold">Reflection Coach</b><span className="block text-sm text-muted">Think back on any chapter, one question at a time, and turn your own words into a one-page reflection.</span></span>
        </Link>
      </div>
    </>
  );
}
