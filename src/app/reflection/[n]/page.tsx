import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui";
import { chapterById, chapters, realmForChapter } from "@/data/site";
import { ReflectionCoach } from "../coach";
import { promptsFor } from "../prompts";

export const dynamicParams = false;
export function generateStaticParams() { return chapters.map((c) => ({ n: c.id })); }

export async function generateMetadata({ params }: PageProps<"/reflection/[n]">): Promise<Metadata> {
  const c = chapterById((await params).n);
  return { title: c ? `Reflection: Chapter ${c.label}` : "Reflection Coach" };
}

// Print just the paper: hide the site chrome and the coach.
const PRINT = `@media print { header, footer, nav, .no-print { display: none !important; } body { background: #fff !important; color: #000 !important; }
  .print-paper { border: 0 !important; box-shadow: none !important; background: none !important; padding: 0 !important; color: #000 !important; } .print-paper p { color: #000 !important; } section:has(h1) { display: none !important; } }`;

export default async function ReflectionChapter({ params }: PageProps<"/reflection/[n]">) {
  const c = chapterById((await params).n);
  if (!c) notFound();
  const r = realmForChapter(c.id);
  return (
    <>
      <style>{PRINT}</style>
      <PageHead eyebrow={`Reflection Coach · Realm ${r.n} · Chapter ${c.label}`} title={c.title} />
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <ReflectionCoach ch={{ id: c.id, label: c.label, ref: c.ref, title: c.title, realm: r.n, realmName: r.name, color: r.color, keyWords: c.keyWords, prompts: promptsFor(c.id, c.title) }} />
      </div>
    </>
  );
}
