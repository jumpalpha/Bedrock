import Link from "next/link";
import { BarChart3, ClipboardCheck, Medal, Swords } from "lucide-react";
import { chapters, realms } from "@/data/site";
import { PlayerCard } from "@/components/player-card";
import { WorldMap } from "@/components/world-map";
import { Eyebrow } from "@/components/ui";

const quick = [
  { label: "Survey of the Day", href: "/survey/", icon: BarChart3 },
  { label: "Pick a Side", href: "/pick-a-side/", icon: Swords },
  { label: "Checklist", href: "/quest/", icon: ClipboardCheck },
  { label: "Badges", href: "/quest/#badges", icon: Medal },
];

export default function Home() {
  return (
    <>
      <section className="sky relative overflow-hidden">
        <div className="relative mx-auto max-w-7xl px-6 pb-10 pt-12 sm:pt-16">
          <Eyebrow>Mr. Dopp&apos;s Earth Science</Eyebrow>
          <h1 className="pixel-title pixel-shadow text-[clamp(3rem,11vw,7rem)] leading-[0.9]">Bedrock</h1>
          <p className="mt-4 max-w-2xl text-lg font-bold sm:text-xl">
            You woke up on a raw planet. {chapters.length} chapters, {realms.length} realms, one world to survive and figure out.
          </p>
          <div className="mt-8"><PlayerCard /></div>
        </div>
        <div className="ground" />
      </section>

      <section className="tex tex-stone border-b-[3px] border-black">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-6 py-5 sm:grid-cols-4">
          {quick.map((q) => (
            <Link key={q.label} href={q.href} className="btn-block justify-center !text-base"><q.icon className="size-5" /> {q.label}</Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-14">
        <Eyebrow>World Map</Eyebrow>
        <h2 className="pixel-title text-3xl sm:text-5xl">Dig down, then look up</h2>
        <p className="mb-8 mt-3 max-w-2xl font-semibold text-muted">
          Each realm is a biome to survive. Clear every task in a realm to earn its badge and mine your way up one rank.
        </p>
        <WorldMap />
      </section>
    </>
  );
}
