import type { Metadata } from "next";
import { GoldRushPlayer } from "./gold-rush-player";

// ── wave-live ── Gold Rush Live, the student screen (join with the code at /live/)
export const metadata: Metadata = { title: "Gold Rush Live", description: "The live class version of Gold Rush: answer Earth science questions to dig gold and buy mining gear." };

export default function GoldRushLivePage() {
  return <GoldRushPlayer />;
}
