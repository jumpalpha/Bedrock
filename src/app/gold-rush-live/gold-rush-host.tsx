"use client";

// ── wave-live ── Gold Rush Live, projector screen (twin of Dopps Class coin_host.html).
// The game is created and its questions loaded on /live/host/ (pick "Gold Rush Live"), then it opens here.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { coinBoard, coinStart, liveSetPhase, money, store, type CoinBoard, type HostSession } from "@/lib/live";
import { JoinBanner, TEAMS, btnGold, btnRed, useTwoTap } from "@/components/live/shared";
import { GR_HKEY } from "../live/host/live-host";

type H = { S: HostSession; secs: number; from: number; to: number; teams: number; n: number };

export function GoldRushHost() {
  const router = useRouter();
  const [H, setH] = useState<H | null>(null);
  const [B, setB] = useState<CoinBoard | null>(null);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [ending, setEnding] = useState(false);
  const endTap = useTwoTap(), cancelTap = useTwoTap();

  useEffect(() => {
    const h = store.get<H | null>(GR_HKEY, null, true);
    if (!h?.S) { router.replace("/live/host/"); return; }
    setH(h); // eslint-disable-line react-hooks/set-state-in-effect -- the game this tab started
  }, [router]);

  const poll = useCallback(async () => {
    if (!H) return;
    try {
      const b = await coinBoard(H.S);
      if (!b) { setErr("This game is gone. Start a new one."); return; }
      setB(b); setErr("");
      if (b.seconds_left != null) setDeadline(Date.now() + b.seconds_left * 1000);
    } catch { setErr("Connection trouble… retrying"); }
  }, [H]);
  useEffect(() => {
    if (!H || B?.phase === "ended") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first poll now, then on a timer
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [H, poll, B?.phase]);

  const endGame = useCallback(async () => {
    if (!H || ending) return;
    setEnding(true);
    try { await liveSetPhase(H.S, "ended"); } catch {}
    await poll();
  }, [H, ending, poll]);
  useEffect(() => {
    const t = setInterval(() => {
      if (!B || B.phase !== "question" || !deadline) return;
      const l = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) endGame();
    }, 250);
    return () => clearInterval(t);
  }, [B, deadline, endGame]);

  if (!H) return null;
  const mins = Math.round(H.secs / 60);
  const teamsHTML = (t: Record<string, number>, n: number) => {
    const ks = Array.from({ length: n }, (_, i) => String(i + 1));
    const max = Math.max(1, ...ks.map((k) => +(t[k] ?? 0)));
    return (
      <div className="flex flex-col gap-2">
        {ks.sort((a, b) => (t[b] ?? 0) - (t[a] ?? 0)).map((k) => (
          <div key={k} className="grid grid-cols-[minmax(0,190px)_1fr_110px] items-center gap-3 text-lg font-extrabold">
            <span style={{ color: TEAMS[+k].col }}>{TEAMS[+k].icon} {TEAMS[+k].name}</span>
            <div className="h-5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(((t[k] ?? 0) / max) * 100)}%`, background: TEAMS[+k].col }} /></div>
            <span className="text-right font-display" style={{ color: TEAMS[+k].col }}>{money(t[k] ?? 0)}</span>
          </div>
        ))}
      </div>
    );
  };
  const board = (players: CoinBoard["players"], limit: number) => {
    const max = Math.max(1, ...players.map((p) => p.cash));
    return (
      <div className="mt-4 flex flex-col gap-2" data-testid="gr-board">
        {players.slice(0, limit).map((p, i) => (
          <div key={i} className="grid grid-cols-[40px_minmax(0,1fr)_1fr_110px] items-center gap-3 rounded-2xl border border-line bg-[var(--panel)] px-4 py-2.5 text-lg font-extrabold sm:text-xl">
            <span className="text-center font-display text-muted">{i + 1}</span>
            <span className="truncate" style={p.team ? { color: TEAMS[p.team].col } : undefined}>{p.nickname}</span>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-gradient-to-r from-gold to-amber" style={{ width: `${Math.round((p.cash / max) * 100)}%` }} /></div>
            <span className="text-right font-display text-gold">{money(p.cash)}</span>
          </div>
        ))}
      </div>
    );
  };

  const b = B;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="mb-1 font-display text-3xl font-extrabold text-gold sm:text-4xl">⛏️ Gold Rush Live</h1>
      <p className="mb-4 text-muted">Chapters <b className="text-fg">{H.from}{H.to !== H.from ? `–${H.to}` : ""}</b> · <b className="text-fg">{H.n}</b> questions · <b className="text-fg">{mins} min</b>{H.teams ? <> · <b className="text-fg">{H.teams} teams</b></> : null}</p>
      {(!b || b.phase === "lobby") && (
        <>
          <JoinBanner path="/live/" code={H.S.join_code} />
          <div className="block-panel mt-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-display text-3xl font-extrabold"><span data-testid="gr-joined">{b?.players.length ?? 0}</span> joined</div>
              <div className="flex flex-wrap gap-3">
                <button className={btnGold} disabled={!b?.players.length} data-testid="gr-start" onClick={async () => {
                  try { await coinStart(H.S, H.secs); await poll(); } catch (e) { setErr("Could not start: " + (e as Error).message); }
                }}>▶ Start the clock ({mins} min)</button>
                <button className={btnRed} onClick={async () => {
                  if (!cancelTap.tap()) return;
                  try { await liveSetPhase(H.S, "ended"); } catch {}
                  store.set(GR_HKEY, null, true); router.push("/live/host/");
                }}>{cancelTap.armed ? "Tap again to cancel" : "Cancel game"}</button>
              </div>
            </div>
            <p className="mt-2 text-muted">Students answer at their own pace. Right answers dig gold; gold buys mining gear at the Assay Office. Most gold when time runs out wins.</p>
            <div className="mt-3 flex flex-wrap gap-2">{b?.players.map((p, i) => <span key={i} className="rounded-full border-2 px-3 py-1 font-extrabold" style={{ borderColor: p.team ? TEAMS[p.team].col : "var(--color-line)" }}>{p.nickname}</span>)}</div>
          </div>
        </>
      )}
      {b?.phase === "question" && (
        <div className="block-panel p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className={`font-display text-7xl font-extrabold ${left <= 30 ? "text-crimson" : "text-gold"}`} data-testid="gr-clock">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</div>
              <div className="text-lg text-muted"><b className="text-fg">{b.players.length}</b> mining · <b className="text-fg">{b.answered}</b> answers · <b className="text-fg">{b.answered ? Math.round((b.correct / b.answered) * 100) : 0}%</b> right</div>
            </div>
            <button className={btnRed} onClick={() => endTap.tap() && endGame()}>{endTap.armed ? "Tap again to end" : "End now"}</button>
          </div>
          {b.teams_n ? <div className="mt-5">{teamsHTML(b.teams, b.teams_n)}</div> : null}
          {board(b.players, b.teams_n ? 5 : 10)}
        </div>
      )}
      {b?.phase === "ended" && (() => {
        const ps = b.players, top = [ps[1], ps[0], ps[2]], hts = [150, 200, 115], cols = ["#c9d1e0", "#f6c453", "#d9935b"], place = [2, 1, 3];
        const t = b.teams, win = b.teams_n ? Object.keys(t).sort((x, y) => t[y] - t[x])[0] : null;
        return (
          <div className="block-panel p-5" data-testid="gr-final">
            <div className="text-center font-display text-4xl font-extrabold text-gold">{win && TEAMS[+win] ? <>🏆 <span style={{ color: TEAMS[+win].col }}>{TEAMS[+win].name}</span> strike it rich!</> : "🏆 Final Results"}</div>
            <div className="mt-6 flex items-end justify-center gap-3">
              {top.map((p, i) => p ? (
                <div key={i} className="max-w-[220px] flex-1 text-center">
                  <div className="mb-2 break-words text-lg font-extrabold sm:text-2xl">{p.nickname}</div>
                  <div className="rounded-t-2xl pt-3 text-[#1a1030]" style={{ height: hts[i], background: cols[i] }}>
                    <div className="font-display text-4xl font-extrabold">{place[i]}</div><div className="font-display text-lg font-extrabold">{money(p.cash)}</div>
                  </div>
                </div>
              ) : <div key={i} className="max-w-[220px] flex-1" />)}
            </div>
            {b.teams_n ? <div className="mt-5">{teamsHTML(t, b.teams_n)}</div> : null}
            {board(ps, 10)}
            <p className="mt-4 text-center text-muted"><b className="text-fg">{b.answered}</b> questions answered · <b className="text-fg">{b.answered ? Math.round((b.correct / b.answered) * 100) : 0}%</b> right</p>
            <div className="mt-4 text-center"><Link className={btnGold} href="/live/host/" onClick={() => store.set(GR_HKEY, null, true)}>New game</Link></div>
          </div>
        );
      })()}
      {err && <p className="mt-3 font-bold text-crimson">{err}</p>}
    </div>
  );
}
