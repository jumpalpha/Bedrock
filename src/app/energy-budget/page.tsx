import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { EnergyBudget } from "./budget";

// ── wave-twinB ── twin of Dopps Class "The Cost of Your Future" (finance.html)
export const metadata: Metadata = {
  title: "Home Energy Budget",
  description: "Plan a home's energy budget: predict the bills, research real costs, compare Idaho hydro, solar and gas, and work out the payback on upgrades.",
};

export default function EnergyBudgetPage() {
  return (
    <>
      <PageHead eyebrow="Home Energy Budget · Chapter 25" title="The Energy of Your Future"
        sub="Can your budget power the home you want? Predict the bills, research the real ones, and find the upgrades that pay for themselves."
        art={{ slug: "energy-budget", fallback: "⚡" }} />
      <EnergyBudget />
    </>
  );
}
