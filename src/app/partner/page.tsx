import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { PartnerLobby } from "@/games/partner/partner-game";

// ── wave-live ── Partner Games: two players, two devices, one game code (twin of Dopps Class partner.html)
export const metadata: Metadata = { title: "Partner Games", description: "Tic-Tac-Toe, Connect 4, Core Sample Hunt, Dots & Boxes and Fossil Memory: play a classmate on two devices with a game code." };

export default function PartnerPage() {
  return (
    <>
      <PageHead eyebrow="Two players" title="Partner Games" sub="Play the computer, a friend on the same device, or a classmate on two devices with a 4-letter code." />
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6"><PartnerLobby /></div>
    </>
  );
}
