import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { chaptersIn, realms } from "@/data/site";
import { ReflectionPicker, type PickRealm } from "./coach";

export const metadata: Metadata = { title: "Reflection Coach", description: "Think back on a chapter one question at a time and turn your own words into a one-page reflection." };

export default function ReflectionPage() {
  const list: PickRealm[] = realms.map((r) => ({
    n: r.n, name: r.name, color: r.color, icon: r.icon,
    chapters: chaptersIn(r).map((c) => ({ id: c.id, label: c.label, ref: c.ref, title: c.title })),
  }));
  return (
    <>
      <PageHead eyebrow="Reflection Coach" title="Reflection Coach" art={{ slug: "reflection", fallback: "📝" }}
        sub="Pick a chapter and talk it through. The coach asks one question at a time, helps you dig deeper when it counts, and organizes your own words into a one-page reflection. It saves after every answer." />
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <p className="mb-6 text-sm text-muted">Logged in? Your reflections follow you to any device. Otherwise they stay on this one. Only you and Mr. Dopp can see them.</p>
        <ReflectionPicker realms={list} />
      </div>
    </>
  );
}
