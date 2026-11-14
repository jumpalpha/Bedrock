"use client";

// ── wave-live ── a Partner Games page: pick vs the computer, same device, or two devices (game code).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Smartphone, Users } from "lucide-react";
import { Eyebrow } from "@/components/ui";
import { store } from "@/lib/live";
import { DISC, GemToken } from "./boards";
import { LocalCoreSample, LocalDuel, cpuStats, type LocalMode } from "./local";
import { partnerBySlug, partnerGames } from "./meta";
import { OnlineDuel } from "./online";

type Mode = LocalMode | "online";
const SUBS: Record<string, { easy: string; hard: string }> = {
  tictactoe: { easy: "A friendly warm-up", hard: "It never loses. Can you tie it?" },
  connect4: { easy: "A friendly warm-up", hard: "Thinks 6 moves ahead" },
  battleship: { easy: "Drills at random", hard: "Follows up every strike" },
  dots: { easy: "A friendly warm-up", hard: "Never hands you a free claim" },
};

export function PartnerGame({ slug }: { slug: string }) {
  const meta = partnerBySlug(slug)!;
  const [mode, setMode] = useState<Mode | null>(null);
  const [stats, setStats] = useState({ wins: 0, plays: 0 });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: a game code in the link, or a game in progress
    if (new URLSearchParams(location.search).get("code") || store.get("bedrock_duel_id", null, true)) setMode("online");
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- saved stats live in this browser
  useEffect(() => setStats(cpuStats(meta.game)), [meta.game, mode]);
  const back = () => setMode(null);

  if (mode === "online") return <OnlineDuel fixed={meta.game} onBack={back} />;
  if (mode && meta.game === "battleship") return <LocalCoreSample hard={mode === "cpu-hard"} onBack={back} />;
  if (mode && meta.game !== "memory" && meta.game !== "battleship") return <LocalDuel game={meta.game} mode={mode} onBack={back} />;

  const sub = SUBS[meta.game];
  return (
    <div className="mx-auto max-w-md">
      <div className="block-panel animate-rise p-7 text-center">
        <Eyebrow>Partner game</Eyebrow>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{meta.title}</h1>
        <p className="mt-2 text-muted">{meta.how}</p>
        <div className="mx-auto my-5 flex items-center justify-center gap-4">
          {meta.game === "connect4" ? <><span className="block size-14 rounded-full" style={{ background: DISC[1].bg }} /><b className="font-display text-2xl text-muted">vs</b><span className="block size-14 rounded-full" style={{ background: DISC[2].bg }} /></>
            : meta.game === "memory" || meta.game === "battleship" ? <span className="text-6xl">{meta.emoji}</span>
            : <><GemToken p={1} size={60} /><b className="font-display text-2xl text-muted">vs</b><GemToken p={2} size={60} /></>}
        </div>
        <div className="space-y-2.5">
          {meta.game === "memory" ? (
            <Link href="/arcade/play/fossil-memory/" className="flex w-full items-center gap-3 rounded-2xl border border-line bg-[var(--panel)] p-3.5 text-left transition hover:border-gold/50 hover:bg-gold/10">
              <span className="grid size-10 place-items-center rounded-xl bg-gold/15 text-gold"><Bot className="size-5" /></span>
              <span><span className="block font-bold">vs Computer or Same device</span><span className="block text-xs text-muted">The Fossil Memory arcade game</span></span>
            </Link>
          ) : (
            <>
              <ModeBtn onClick={() => setMode("cpu-easy")} icon={<Bot className="size-5" />} title="vs Computer · Easy" sub={sub.easy} />
              <ModeBtn onClick={() => setMode("cpu-hard")} icon={<Bot className="size-5" />} title="vs Computer · Hard" sub={sub.hard} />
              {meta.game !== "battleship" && <ModeBtn onClick={() => setMode("local")} icon={<Users className="size-5" />} title="2 Players · Same device" sub="Take turns with a friend" />}
            </>
          )}
          <ModeBtn onClick={() => setMode("online")} icon={<Smartphone className="size-5" />} title="2 Players · Two devices" sub="Play a classmate with a 4-letter game code" testid="mode-online" />
        </div>
        {meta.game !== "memory" && <p className="mt-5 text-xs text-muted">Wins vs the computer on this device: <b className="text-gold">{stats.wins}</b> of {stats.plays}</p>}
        <Link href="/partner/" className="mt-2 inline-block text-xs font-semibold text-muted underline-offset-4 hover:text-fg hover:underline">All partner games</Link>
      </div>
    </div>
  );
}

function ModeBtn({ onClick, icon, title, sub, testid }: { onClick: () => void; icon: React.ReactNode; title: string; sub: string; testid?: string }) {
  return (
    <button onClick={onClick} data-testid={testid} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-[var(--panel)] p-3.5 text-left transition hover:border-gold/50 hover:bg-gold/10">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">{icon}</span>
      <span><span className="block font-bold">{title}</span><span className="block text-xs text-muted">{sub}</span></span>
    </button>
  );
}

/** /partner/: every partner game, plus create/join on two devices for any of them. */
export function PartnerLobby() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_440px]">
      <div className="grid gap-4 sm:grid-cols-2">
        {partnerGames.map((g) => (
          <Link key={g.slug} href={`/partner/${g.slug}/`} style={{ "--accent": g.color } as React.CSSProperties} className="accent-card group flex items-center gap-4 rounded-3xl p-5">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl text-4xl transition-transform group-hover:scale-110" style={{ background: `color-mix(in srgb, ${g.color} 18%, transparent)` }}>{g.emoji}</span>
            <span className="min-w-0"><span className="block font-display text-xl font-extrabold">{g.title}</span><span className="mt-1 block text-sm leading-snug text-muted">{g.blurb}</span></span>
          </Link>
        ))}
      </div>
      <OnlineDuel />
    </div>
  );
}
