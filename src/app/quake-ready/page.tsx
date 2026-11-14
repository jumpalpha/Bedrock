// ── wave-twinA ── Quake Ready: twin of Dopps Class cpr_aed_quest.html (CPR & AED side quest).
import type { Metadata } from "next";
import { QuakeQuest } from "./quest";

export const metadata: Metadata = {
  title: "Quake Ready",
  description: "Earthquake side quest: Drop, Cover, and Hold On, find the safe spot, hold on through a quake and its aftershocks, learn the after-shake steps and gas shutoff rules, and pass the quick check.",
};

export default function QuakeReadyPage() {
  return <QuakeQuest />;
}
