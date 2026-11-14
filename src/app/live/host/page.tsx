import type { Metadata } from "next";
import { LiveHost } from "./live-host";

// ── wave-live ── the teacher's projector screen for live class games (twin of Dopps Class live_host.html)
export const metadata: Metadata = { title: "Live Host", robots: { index: false } };

export default function LiveHostPage() {
  return <LiveHost />;
}
