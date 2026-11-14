"use client";
// ── wave-pet: home page "Champions" cards + once-a-day check-in (Dopps Class home_champions.js) ──
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { champions, dbReady, getStudent, petFallen, petGallery, petGet, type Champion, type Pet, type PetFallen, type PetPublic } from "@/lib/db";
import { MOOD_TEXT } from "@/data/pet";
import { Alien } from "@/components/alien";

const POPUP_KEY = "bedrock_daily_popup";
const idahoDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(d);
const medal = (i: number) => ["🥇", "🥈", "🥉"][i];
const pname = (p: { name: string | null }) => p.name ?? "New alien";
const ago = (iso: string) => {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
  if (h < 24) return h <= 1 ? "just now" : `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};

type Data = { heroes: Champion[]; aliens: PetPublic[]; fallen: PetFallen[] };
async function getData(): Promise<Data> {
  const [h, g, f] = await Promise.allSettled([champions(), petGallery(), petFallen(7)]);
  return {
    heroes: h.status === "fulfilled" ? h.value.filter((c) => c.verified_xp > 0) : [],
    aliens: g.status === "fulfilled" ? g.value.filter((p) => p.alive && p.stage !== "geode").sort((a, b) => b.health - a.health || b.streak - a.streak) : [],
    fallen: f.status === "fulfilled" ? f.value : [],
  };
}

/** checkIn = also show the once-a-day check-in popup (home page only, logged-in students). */
export function ChampionsStrip({ checkIn = false }: { checkIn?: boolean }) {
  const [d, setD] = useState<Data | null>(null);
  const [popup, setPopup] = useState(false);
  useEffect(() => {
    if (!dbReady) return;
    getData().then((x) => {
      setD(x);
      let show = false;
      try { show = new URLSearchParams(location.search).get("popup") === "1" || (!!getStudent() && localStorage.getItem(POPUP_KEY) !== idahoDate(new Date())); } catch {}
      if (show && checkIn) setPopup(true);
    });
  }, [checkIn]);
  const row = "grid grid-cols-[28px_44px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-line py-2 first:border-t-0";
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="block-panel p-4">
          <h3 className="mb-2 flex items-center justify-between font-display text-lg font-extrabold">🏆 Top miners <Link href="/champions/" className="text-xs font-bold text-muted hover:text-fg">Hall →</Link></h3>
          {d?.heroes.length ? d.heroes.slice(0, 3).map((h, i) => (
            <div key={h.id} className={row}><span className="text-xl">{medal(i)}</span><span className="text-2xl">⛏️</span>
              <div className="min-w-0"><b className="block truncate">{h.name}</b><span className="text-xs font-bold text-muted">{h.period}</span></div>
              <span className="font-display font-extrabold text-gold">{h.verified_xp.toLocaleString()} XP</span></div>
          )) : <p className="text-sm text-muted">No verified XP yet. <Link href="/chapters/" className="font-bold underline">Pass a chapter quiz →</Link></p>}
        </div>
        <div className="block-panel p-4">
          <h3 className="mb-2 flex items-center justify-between font-display text-lg font-extrabold">🪨 Healthiest aliens <Link href="/pets/" className="text-xs font-bold text-muted hover:text-fg">Gallery →</Link></h3>
          {d?.aliens.length ? d.aliens.slice(0, 3).map((p, i) => (
            <div key={i} className={row}><span className="text-xl">{medal(i)}</span><Alien a={p} size={44} anim={false} />
              <div className="min-w-0"><b className="block truncate">{pname(p)}</b><span className="text-xs font-bold text-muted">{p.owner} · 🔥 {p.streak}</span></div>
              <span className="font-display font-extrabold text-emerald">❤️ {p.health}</span></div>
          )) : <p className="text-sm text-muted">No aliens have hatched yet. <Link href="/pet/" className="font-bold underline">Adopt yours →</Link></p>}
        </div>
        <div className="block-panel p-4">
          <h3 className="mb-2 flex items-center justify-between font-display text-lg font-extrabold">💤 Gone dormant <Link href="/pets/" className="text-xs font-bold text-muted hover:text-fg">All →</Link></h3>
          {d?.fallen.length ? d.fallen.slice(0, 4).map((f, i) => (
            <div key={i} className={row}><span className="text-xl">💤</span><Alien a={{ stage: "pebble", color: f.color, alive: false }} size={44} anim={false} />
              <div className="min-w-0"><b className="block truncate">{pname(f)}</b><span className="text-xs font-bold text-muted">{f.owner} · {ago(f.died_at)}</span></div>
              <span className={`text-xs font-extrabold ${f.revived ? "text-emerald" : "text-sky"}`}>{f.revived ? "✨ Awake" : "Asleep"}</span></div>
          )) : <p className="text-sm text-muted">No aliens went dormant this week. 🎉</p>}
        </div>
      </div>
      {popup && d && <DailyPopup d={d} onClose={() => { try { localStorage.setItem(POPUP_KEY, idahoDate(new Date())); } catch {} setPopup(false); }} />}
    </>
  );
}

function DailyPopup({ d, onClose }: { d: Data; onClose: () => void }) {
  const [pet, setPet] = useState<Pet | null | undefined>(undefined);
  useEffect(() => { if (getStudent()) petGet().then(setPet).catch(() => setPet(undefined)); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  const asleep = d.fallen.filter((f) => !f.revived).length;
  const links = [
    { href: "/pet/", ico: "🪨", t: "Check on your rock alien", s: "Log field habits and teach it new words" },
    { href: "/chapters/", ico: "📚", t: "Keep up with your chapter", s: "Read, pass the quiz, mine crystals" },
    { href: "/quest/", ico: "⛏️", t: "Climb the mining ranks", s: "Clear a realm and your alien evolves" },
  ];
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="dq-t" className="glass relative max-h-[92vh] w-full max-w-lg overflow-auto rounded-3xl bg-ink-2 p-5" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-2 text-2xl text-muted">×</button>
        <h2 id="dq-t" className="text-center font-display text-2xl font-extrabold">⛏️ Daily check-in</h2>
        <p className="text-center text-sm text-muted">Your quest for today</p>
        <div className="mt-4 grid grid-cols-[96px_1fr] items-center gap-3 rounded-2xl border border-line p-3">
          {pet ? <Alien a={pet} size={96} /> : <Alien a={{ stage: "geode", color: "amethyst", alive: true }} size={96} />}
          <div>
            <b className="text-lg text-gold">{pet ? pet.name : pet === null ? "No alien yet!" : "Your alien is waiting…"}</b>
            <p className="text-sm">{pet ? (pet.stage === "geode" && pet.alive ? "Your geode is waiting to crack open!" : MOOD_TEXT[pet.alive ? pet.mood_label : "dormant"](pet.name)) : "Adopt a rock alien and raise it all year."}</p>
            {pet && <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${pet.health}%`, background: pet.health >= 60 ? "var(--color-emerald)" : pet.health >= 30 ? "var(--color-gold)" : "var(--color-crimson)" }} /></div>}
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {links.map((l) => (
            <li key={l.href}><Link href={l.href} onClick={onClose} className="flex items-center gap-3 rounded-xl border border-line p-3 font-extrabold hover:border-gold">
              <span className="text-2xl">{l.ico}</span><span>{l.t}<small className="block font-semibold text-muted">{l.s}</small></span></Link></li>
          ))}
        </ul>
        {d.fallen.length > 0 && <p className="mt-3 rounded-xl border border-crimson/40 bg-crimson/10 p-2.5 text-sm font-bold">💤 {d.fallen.length} alien{d.fallen.length === 1 ? "" : "s"} went dormant this week{asleep ? ` (${asleep} still asleep)` : ""}. Don&apos;t let yours be next!</p>}
        <button onClick={onClose} className="btn-block btn-grass mt-4 w-full justify-center">Let&apos;s dig in! ⛏️</button>
      </div>
    </div>, document.body);
}
// ── end wave-pet ──
