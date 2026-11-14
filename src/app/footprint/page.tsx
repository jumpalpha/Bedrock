import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { FootprintQuest } from "./quest";

// ── wave-twinB ── twin of Dopps Class Weight Control Quest
export const metadata: Metadata = {
  title: "Footprint Quest",
  description: "Pick 15 everyday uses, read their water and energy meters, log 3 days, and swap your way to a footprint goal.",
};

export default function FootprintPage() {
  return (
    <>
      <PageHead eyebrow="Footprint Quest · Chapters 25–26" title="15 Uses. One Planet."
        sub="Every shower, car ride and hamburger leaves a water and carbon footprint. Measure yours, set a goal, and swap your way there."
        art={{ slug: "footprint-quest", fallback: "👣" }} />
      <FootprintQuest />
    </>
  );
}
