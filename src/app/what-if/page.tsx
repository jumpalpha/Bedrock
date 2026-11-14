import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { WhatIfGame } from "./game";

// ── wave-twinB ── twin of Dopps Class "The What If Game" (whatif.html)
export const metadata: Metadata = {
  title: "What If?",
  description: "What if Earth stopped spinning? What if Yellowstone erupted? Pick what you think happens, then see the real Earth science.",
};

export default function WhatIfPage() {
  return (
    <>
      <PageHead eyebrow="What If? · Earth science thought experiments" title="🤔 The What If Game"
        sub="Big Earth science questions. Pick what you think would really happen, see what it does to Earth's spheres, then find the best answer." />
      <WhatIfGame />
    </>
  );
}
