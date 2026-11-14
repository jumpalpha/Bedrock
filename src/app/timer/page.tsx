// ── wave-x7b ── Classroom station timer (twin of Dopps Class timer.html).
import type { Metadata } from "next";
import { StationTimer } from "./timer";

export const metadata: Metadata = { title: "Station Timer", description: "A big projector timer for lab stations: two sections and a transition, repeated for as many rounds as you need." };

export default function TimerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-28">
      <StationTimer />
    </div>
  );
}
