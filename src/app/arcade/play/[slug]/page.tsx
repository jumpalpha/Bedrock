import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { arcadeGame, arcadeGames } from "@/data/arcade";
import { GameHost } from "@/components/game-host";

export const dynamicParams = false;

export function generateStaticParams() {
  return arcadeGames.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/arcade/play/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: arcadeGame(slug)?.title ?? "Arcade" };
}

export default async function PlayPage({ params }: PageProps<"/arcade/play/[slug]">) {
  const { slug } = await params;
  if (!arcadeGame(slug)) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/arcade/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-fg">
          <ArrowLeft className="size-4" /> Arcade
        </Link>
      </div>
      <GameHost slug={slug} />
    </div>
  );
}
