import type { Metadata } from "next";
import { LivePlayerView } from "./live-player";

// ── wave-live ── students join a live class game here (twin of Dopps Class live.html)
export const metadata: Metadata = { title: "Live Game", description: "Join your class's live Earth science game with the code on the screen." };

export default function LivePage() {
  return <LivePlayerView />;
}
