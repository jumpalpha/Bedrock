// ── wave-x7b ── Suggest an Improvement (twin of Dopps Class suggest-improvement.html).
import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { SuggestForm } from "./suggest";

export const metadata: Metadata = { title: "Suggest an Improvement", description: "Found a bug or have an idea for Bedrock? Tell Mr. Dopp." };

export default function SuggestPage() {
  return (
    <>
      <PageHead eyebrow="Feedback" title="Suggest an improvement"
        sub="Found a bug? Have an idea for a new game, chapter or feature? Tell Mr. Dopp. It goes straight to his teacher dashboard." />
      <div className="mx-auto max-w-2xl px-6 pt-6"><SuggestForm /></div>
    </>
  );
}
