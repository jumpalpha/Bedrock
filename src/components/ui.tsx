import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { realmForChapter, type Chapter } from "@/data/site";

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return <div className="mb-2 font-pixel text-[10px] uppercase leading-relaxed tracking-wider" style={{ color: color ?? "var(--color-grass)" }}>{children}</div>;
}

export function PageHead({ eyebrow, title, sub, children }: { eyebrow: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section className="sky relative overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-6 pb-12 pt-14">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="pixel-title pixel-shadow text-4xl leading-tight sm:text-6xl">{title}</h1>
        {sub && <p className="mt-4 max-w-2xl text-lg font-semibold text-muted">{sub}</p>}
        {children}
      </div>
      <div className="ground" />
    </section>
  );
}

export function ChapterCard({ ch, done }: { ch: Chapter; done?: boolean }) {
  const realm = realmForChapter(ch.n);
  return (
    <Link href={`/chapters/${ch.n}/`} style={{ "--accent": realm.color } as CSSProperties} className="accent-card flex flex-col p-5 pt-6">
      <div className="flex items-start justify-between">
        <span className="pixel-title text-4xl leading-none" style={{ color: realm.color }}>{String(ch.n).padStart(2, "0")}</span>
        {done && <span className="border-2 border-black bg-emerald px-1.5 py-0.5 text-[11px] font-extrabold text-black">✓ Read</span>}
      </div>
      <h3 className="mt-3 text-[17px] font-extrabold leading-snug">{ch.title}</h3>
      <div className="mt-auto pt-3 text-xs font-bold text-muted">{realm.icon} {realm.name}</div>
    </Link>
  );
}

/** Tiny markdown for chapter text: paragraphs, "- " bullets, "1. " lists, **bold**, *italic*. */
export function Md({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((t, i) => <li key={i}>{inline(t)}</li>);
    out.push(list.type === "ul" ? <ul key={out.length}>{items}</ul> : <ol key={out.length}>{items}</ol>);
    list = null;
  };
  for (const raw of lines) {
    const l = raw.trim();
    const ul = l.match(/^[-*] (.*)/), ol = l.match(/^\d+\. (.*)/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) { flush(); list = { type, items: [] }; }
      list.items.push((ul ?? ol)![1]);
    } else {
      flush();
      if (l) out.push(<p key={out.length}>{inline(l)}</p>);
    }
  }
  flush();
  return <div className="prose-block">{out}</div>;
}
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((p, i) =>
    p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : p);
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="block-panel border-amber! p-4 text-sm font-bold">{children}</div>;
}
