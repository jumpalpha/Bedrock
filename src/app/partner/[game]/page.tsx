import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { partnerBySlug, partnerGames } from "@/games/partner/meta";
import { PartnerGame } from "@/games/partner/partner-game";

// ── wave-live ── one partner game: vs the computer, same device, or two devices
export const dynamicParams = false;
export function generateStaticParams() {
  return partnerGames.map((g) => ({ game: g.slug }));
}
export async function generateMetadata({ params }: PageProps<"/partner/[game]">): Promise<Metadata> {
  const { game } = await params;
  const g = partnerBySlug(game);
  return { title: g?.title ?? "Partner Games", description: g?.blurb };
}

export default async function PartnerGamePage({ params }: PageProps<"/partner/[game]">) {
  const { game } = await params;
  if (!partnerBySlug(game)) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6">
      <div className="mb-4">
        <Link href="/partner/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-fg"><ArrowLeft className="size-4" /> Partner Games</Link>
      </div>
      <PartnerGame slug={game} />
    </div>
  );
}
