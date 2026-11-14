"use client";
// ── wave-pet: Alien Gallery (Bedrock's version of the Dopps Class Sprite Gallery) ──
import Link from "next/link";
import { useEffect, useState } from "react";
import { dbReady, petFallen, petGallery, type PetFallen, type PetPublic } from "@/lib/db";
import { FORM_NAME, stageInfo } from "@/data/pet";
import { ranks } from "@/data/site";
import { PageHead } from "@/components/ui";
import { Alien } from "@/components/alien";

const col = (v: number) => (v >= 60 ? "var(--color-emerald)" : v >= 30 ? "var(--color-gold)" : "var(--color-crimson)");
export const petLabel = (p: PetPublic) => (p.alive ? `${p.form ? FORM_NAME[p.form] + " " : ""}${stageInfo(p.stage).name}` : "💤 Dormant");
export const petName = (p: { name: string | null }) => p.name ?? "New alien";
export function ago(iso: string) {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
  if (h < 1) return "just now";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

type Sort = "upgrades" | "health" | "streak" | "stage" | "age" | "name";

export default function Gallery() {
  const [pets, setPets] = useState<PetPublic[] | null>(null);
  const [fallen, setFallen] = useState<PetFallen[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("upgrades");
  useEffect(() => {
    if (!dbReady) return;
    const load = () => {
      petGallery().then(setPets).catch((e) => setErr(e.message));
      petFallen(14).then(setFallen).catch(() => setFallen([]));
    };
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const top = (pets ?? []).filter((p) => p.alive && p.stage !== "geode").sort((a, b) => b.health - a.health || b.streak - a.streak || b.age_days - a.age_days).slice(0, 10);
  const list = [...(pets ?? [])].sort(
    sort === "name" ? (a, b) => petName(a).localeCompare(petName(b))
    : sort === "streak" ? (a, b) => b.streak - a.streak || b.health - a.health
    : sort === "age" ? (a, b) => b.age_days - a.age_days
    : sort === "stage" ? (a, b) => b.cleared - a.cleared || b.health - a.health
    : sort === "upgrades" ? (a, b) => b.upgrades - a.upgrades || Number(b.alive) - Number(a.alive) || b.health - a.health
    : (a, b) => Number(b.alive) - Number(a.alive) || b.health - a.health || b.streak - a.streak);

  return (
    <>
      <PageHead eyebrow="Class pets" title="Alien Gallery" sub="Every rock alien in class: who's healthiest, who's evolved furthest through the rock cycle, and who has gone dormant.">
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/pet/" className="btn-block btn-grass !text-sm">🪨 My alien</Link><Link href="/champions/" className="btn-block !text-sm">🏆 Hall of Champions</Link></div>
      </PageHead>
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-10 sm:px-6">
        {!dbReady && <p className="block-panel p-4 font-bold">Preview: the gallery fills up once the class database is connected.</p>}
        {err && <p className="block-panel p-4 font-bold text-crimson">Could not load aliens: {err}</p>}

        <section className="block-panel p-5">
          <h2 className="pixel-title text-2xl">❤️ Healthiest aliens</h2>
          <p className="mt-1 text-sm text-muted">Ranked by health right now, then by field-habit streak. Health drops when aliens are ignored, so the top spots change every day.</p>
          <div className="mt-3 space-y-1.5">
            {pets === null ? <p className="text-muted">Loading…</p> : top.length === 0 ? <p className="text-muted">No aliens have cracked out of their geodes yet.</p> : top.map((p, i) => (
              <div key={i} className="grid grid-cols-[28px_56px_1fr_auto] items-center gap-3 rounded-xl border border-line p-2">
                <span className="text-center font-display text-lg font-extrabold">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                <Alien a={p} size={56} anim={false} />
                <div className="min-w-0"><b className="block truncate">{petName(p)}</b><span className="block truncate text-xs font-bold text-muted">{p.owner} · {petLabel(p)} · 🔥 {p.streak}</span></div>
                <span className="font-display font-extrabold" style={{ color: col(p.health) }}>❤️ {p.health}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="block-panel p-5">
          <h2 className="pixel-title text-2xl">💤 Recently dormant</h2>
          <p className="mt-1 text-sm text-muted">Aliens that went cold in the last 14 days. Ten right vocab answers wake them up.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {fallen === null ? <p className="text-muted">Loading…</p> : fallen.length === 0 ? <p className="text-muted">No aliens have gone dormant in the last 14 days. 🎉</p> : fallen.map((f, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line p-2">
                <Alien a={{ stage: "pebble", color: f.color, alive: false }} size={48} anim={false} />
                <div className="min-w-0 flex-1"><b className="block truncate">{petName(f)}</b><span className="text-xs font-bold text-muted">{f.owner} · went dormant {ago(f.died_at)}</span></div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${f.revived ? "bg-emerald/15 text-emerald" : "bg-sky/15 text-sky"}`}>{f.revived ? "✨ Awake" : "💤 Still asleep"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="block-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="pixel-title text-2xl">Every alien</h2>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort aliens" className="rounded-xl border border-line bg-ink px-3 py-2 text-sm font-bold">
              <option value="upgrades">Most gear</option><option value="stage">Most evolved</option><option value="health">Healthiest first</option>
              <option value="streak">Longest streak</option><option value="age">Oldest first</option><option value="name">A to Z</option>
            </select>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {list.map((p, i) => (
              <div key={i} className="rounded-2xl border border-line p-3 text-center">
                <Alien a={p} size={120} className="mx-auto" anim={false} />
                <div className="mt-1 truncate font-extrabold">{petName(p)}</div>
                <div className="truncate text-xs font-bold text-muted">{p.owner}{p.period ? ` · ${p.period}` : ""}</div>
                <div className="mt-1 text-xs text-muted">{petLabel(p)} · 🔥 {p.streak} · 🎒 {p.upgrades}</div>
                <div className="text-[11px] font-bold text-gold">⛏ {ranks[Math.min(p.cleared, ranks.length - 1)]?.name}</div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full" style={{ width: `${p.health}%`, background: col(p.health) }} /></div>
              </div>
            ))}
          </div>
          {pets && pets.length === 0 && <p className="mt-3 text-sm text-muted">No aliens yet. Be the first! <Link href="/pet/" className="font-bold underline">Adopt yours</Link></p>}
        </section>
      </div>
    </>
  );
}
// ── end wave-pet ──
