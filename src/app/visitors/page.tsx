// ── wave-x7b ── Visitors (twin of Dopps Class visitor.html): past students and guests.
import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { Visitors } from "./visitors";

export const metadata: Metadata = { title: "Visitors", description: "Took Mr. Dopp's Earth science class before? Make a free visitor account to keep playing." };

export default function VisitorsPage() {
  return (
    <>
      <PageHead eyebrow="👋 Visitor section" title={<>Welcome back, <span className="text-gradient">explorer</span></>}
        sub="Took Mr. Dopp's Earth science class before? Make a free visitor account to keep playing the arcade, raise a rock alien and climb the Visitors board, separate from current classes."
        art={{ slug: "realm-9", fallback: "⭐" }} />
      <Visitors />
    </>
  );
}
