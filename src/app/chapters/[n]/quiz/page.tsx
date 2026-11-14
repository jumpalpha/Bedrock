import type { Metadata } from "next";
import { notFound } from "next/navigation";
import questions from "@/data/content/questions.json";
import { chapters, realmForChapter } from "@/data/site";
import { PageHead } from "@/components/ui";
import { Quiz, type Q } from "@/components/quiz";

export const dynamicParams = false;
export function generateStaticParams() { return chapters.map((c) => ({ n: String(c.n) })); }
export const metadata: Metadata = { title: "Chapter quiz" };

export default async function ChapterQuiz({ params }: PageProps<"/chapters/[n]/quiz">) {
  const n = Number((await params).n);
  const c = chapters.find((x) => x.n === n);
  if (!c) notFound();
  const qs = (questions.chapter as Record<string, Q[]>)[String(n)];
  return (
    <>
      <PageHead eyebrow={`Realm ${realmForChapter(n).n} · Chapter ${n} quiz`} title={c.title} />
      <div className="px-4 pt-10"><Quiz kind="chapter" refN={n} questions={qs} title={`Chapter ${n} quiz`} passPct={80} backHref={`/chapters/${n}/`} /></div>
    </>
  );
}
