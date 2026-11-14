import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FlaskConical, Pickaxe } from "lucide-react";
import { chapters, realmForChapter } from "@/data/site";
import { Eyebrow, Md, PageHead } from "@/components/ui";
import { TaskCheck } from "@/components/task-check";

export const dynamicParams = false;
export function generateStaticParams() { return chapters.map((c) => ({ n: String(c.n) })); }
export async function generateMetadata({ params }: PageProps<"/chapters/[n]">): Promise<Metadata> {
  const { n } = await params;
  const c = chapters.find((x) => x.n === Number(n));
  return { title: c ? `Chapter ${c.n}: ${c.title}` : "Chapter" };
}

export default async function ChapterPage({ params }: PageProps<"/chapters/[n]">) {
  const n = Number((await params).n);
  const c = chapters.find((x) => x.n === n);
  if (!c) notFound();
  const r = realmForChapter(n);
  const prev = chapters.find((x) => x.n === n - 1), next = chapters.find((x) => x.n === n + 1);
  let part = "";

  return (
    <>
      <PageHead eyebrow={`Realm ${r.n}: ${r.name} · Chapter ${n}`} title={c.title}>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#think" className="btn-block"><FlaskConical className="size-5" /> Think Like a Scientist</a>
          <Link href={`/chapters/${n}/quiz/`} className="btn-block btn-grass"><Pickaxe className="size-5" /> Chapter quiz</Link>
        </div>
      </PageHead>

      <article className="mx-auto max-w-3xl px-6 pt-10">
        {c.sections.map((s, i) => {
          const showPart = s.part && s.part !== part;
          if (s.part) part = s.part;
          return (
            <section key={i} className="mb-8">
              {showPart && <div className="mb-6 border-y-[3px] border-black py-2 text-center font-pixel text-xs uppercase">{s.part}</div>}
              <h2 className="pixel-title text-2xl sm:text-3xl">{s.heading}</h2>
              <Md text={s.markdown} />
            </section>
          );
        })}

        <section className="block-panel mb-8 p-6">
          <Eyebrow>Survival checklist</Eyebrow>
          <ul className="space-y-2">{c.checklist.map((x, i) => <li key={i} className="flex gap-2 font-semibold"><span className="text-grass">■</span><Md text={x} /></li>)}</ul>
          <div className="mt-6"><TaskCheck taskKey={`ch${n}_read`} label="I read this chapter" /></div>
        </section>

        <section id="think" className="block-panel mb-8 scroll-mt-24 p-6" style={{ borderColor: r.color }}>
          <Eyebrow color={r.color}>Think Like a Scientist</Eyebrow>
          <Md text={c.thinkLikeAScientist.prompt} />
          <div className="mt-3 text-sm font-semibold text-muted"><Md text={c.thinkLikeAScientist.standards} /></div>
          <p className="mt-3 text-sm font-bold">Write your answer in your notebook or class assignment, then check it off here.</p>
          <div className="mt-4"><TaskCheck taskKey={`ch${n}_tls`} label="I finished my answer" /></div>
        </section>

        <section className="mb-8">
          <Eyebrow>Key words</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {c.keyWords.map((w) => <Link key={w} href={`/glossary/?q=${encodeURIComponent(w)}`} className="border-2 border-black bg-[var(--panel)] px-2.5 py-1 text-sm font-bold hover:bg-grass/25">{w}</Link>)}
          </div>
        </section>

        <div className="flex justify-between gap-3 border-t-[3px] border-black pt-6">
          {prev ? <Link href={`/chapters/${prev.n}/`} className="btn-block !text-sm"><ArrowLeft className="size-4" /> Ch {prev.n}</Link> : <span />}
          <Link href={`/chapters/${n}/quiz/`} className="btn-block btn-grass !text-sm">Take the quiz</Link>
          {next ? <Link href={`/chapters/${next.n}/`} className="btn-block !text-sm">Ch {next.n} <ArrowRight className="size-4" /></Link> : <span />}
        </div>
      </article>
    </>
  );
}
