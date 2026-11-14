import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui";
import { realms } from "@/data/site";
import { ClassworkRealm } from "../classwork";
import { realmData } from "../data";

export const dynamicParams = false;
export function generateStaticParams() { return realms.map((r) => ({ realm: String(r.n) })); }
export const metadata: Metadata = { title: "Realm Classwork" };

export default async function RealmClasswork({ params }: PageProps<"/classwork/[realm]">) {
  const { realm } = await params;
  const r = realms.find((x) => String(x.n) === realm);
  if (!r) notFound();
  const data = realmData(r);
  return (
    <>
      <PageHead eyebrow={`Realm ${r.n} · Classwork · Chapters ${data.chapters.map((c) => c.label).join(", ")}`} title={`${r.icon} ${r.name}`} sub={r.tagline} />
      <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6"><ClassworkRealm data={data} /></div>
    </>
  );
}
