"use client";
// ── wave-x7a ── Listen page: Dopps Class listen-core.js player rebuilt on the browser's speech voice.
// Controls match Dopps: play/pause, back/forward, speed, auto-next with an "Up next" countdown, a section list,
// progress, resume where you stopped, and realm listener badges. An episode counts as heard only when most of it
// was actually played (skipping ahead doesn't count). Saved in localStorage bedrock_listen_*; badges are not XP.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Headphones, ListMusic, Pause, Play, Repeat, SkipBack, SkipForward, BookOpen } from "lucide-react";
import { chapters, chaptersIn, realms, sectionAnchors, type Chapter } from "@/data/site";
import { ArtIcon } from "@/components/art-icon";
import { hasSpeech, sentences, speakOne, speechText, stopSpeech, store, useVoices, words } from "@/lib/x7a-speech";

type Ep = {
  id: string; label: string; title: string; realm: number; audio?: string;
  sents: string[]; secStart: number[]; headings: string[]; anchors: string[]; cum: number[]; words: number;
};

const K = {
  done: "bedrock_listen_done", last: "bedrock_listen_last", auto: "bedrock_listen_autonext", rate: "bedrock_listen_rate", voice: "bedrock_listen_voice",
  pos: (id: string) => `bedrock_listen_pos_${id}`, // sentence index (device voice) or seconds (audio file)
  heard: (id: string) => `bedrock_listen_heard_${id}`, // sentences actually played, or seconds actually played
};
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const FINISH_SHARE = 0.75;
const COUNTDOWN = 5;
const WPM = 160;

function buildEp(c: Chapter, audio?: string): Ep {
  const sents = [`Chapter ${c.label}. ${c.title}.`];
  const secStart: number[] = [];
  c.sections.forEach((s) => {
    secStart.push(sents.length);
    sents.push(/[.!?]$/.test(s.heading) ? s.heading : s.heading + ".");
    sents.push(...sentences(speechText(s.markdown)));
  });
  const cum: number[] = [];
  let w = 0;
  for (const s of sents) { cum.push(w); w += words(s); }
  return { id: c.id, label: c.label, title: c.title, realm: c.realm, audio, sents, secStart, headings: c.sections.map((s) => s.heading), anchors: sectionAnchors(c), cum, words: w };
}
const fmtMin = (m: number) => (m < 1 ? "<1 min" : `${Math.round(m)} min`);
const fmtSec = (s: number) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function ListenClient({ audio }: { audio: Record<string, string> }) {
  const eps = useMemo(() => chapters.map((c) => buildEp(c, audio[c.id])), [audio]);
  const epById = useMemo(() => new Map(eps.map((e) => [e.id, e])), [eps]);
  const voices = useVoices();

  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [curId, setCurId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [time, setTime] = useState({ t: 0, d: 0 });
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [auto, setAuto] = useState(true);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [next, setNext] = useState<{ id: string; left: number } | null>(null);
  const [toast, setToast] = useState<{ icon: string; title: string; body: string } | null>(null);
  const [tick, setTick] = useState(0); // re-render when saved positions change
  const [noSpeech, setNoSpeech] = useState(false);

  const epRef = useRef<Ep | null>(null);
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const tokenRef = useRef(0);
  const errRef = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const heardSet = useRef<Set<number>>(new Set());
  const heardSec = useRef(0);
  const lastT = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rateRef = useRef(1);
  const autoRef = useRef(true);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerBox = useRef<HTMLDivElement | null>(null);
  const loadRef = useRef<(id: string, play: boolean) => void>(() => {});

  // ── restore settings ──
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of saved settings after mount */
    const d = store.get<string[]>(K.done, []);
    setDone(Array.isArray(d) ? d : []);
    const r = store.get<number>(K.rate, 1); rateRef.current = SPEEDS.includes(r) ? r : 1; setRate(rateRef.current);
    autoRef.current = store.get<boolean>(K.auto, true) !== false; setAuto(autoRef.current);
    setVoiceURI(store.get<string>(K.voice, ""));
    setNoSpeech(!hasSpeech());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    voiceRef.current = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0] ?? null;
  }, [voices, voiceURI]);

  const position = (id: string) => { const p = Number(store.get(K.pos(id), 0)); return Number.isFinite(p) ? p : 0; };
  const isDone = (id: string) => done.includes(id);

  const showToast = useCallback((icon: string, title: string, body: string) => {
    setToast({ icon, title, body });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const realmEarned = (n: number, list: string[]) => { const ids = chaptersIn(realms.find((r) => r.n === n)!).map((c) => c.id); return ids.length > 0 && ids.every((id) => list.includes(id)); };

  const markDone = useCallback((id: string) => {
    const cur = store.get<string[]>(K.done, []);
    const list = Array.isArray(cur) ? cur : [];
    if (list.includes(id)) return;
    const ep = epById.get(id)!;
    const before = realmEarned(ep.realm, list);
    const nextList = [...list, id];
    store.set(K.done, nextList); setDone(nextList);
    const realm = realms.find((r) => r.n === ep.realm)!;
    if (!before && realmEarned(ep.realm, nextList)) showToast("🏅", `Badge earned: ${realm.name} Listener`, `You finished every chapter in Realm ${realm.n}.`);
    else showToast("🎧", "Chapter finished", `Chapter ${ep.label} is marked as heard.`);
  }, [epById, showToast]);

  const checkDone = useCallback((end = false) => {
    const ep = epRef.current; if (!ep) return;
    if (ep.audio) {
      const a = audioRef.current; if (!a || !a.duration) return;
      if (heardSec.current >= a.duration * FINISH_SHARE && (end || a.currentTime >= a.duration * 0.9)) markDone(ep.id);
    } else if (heardSet.current.size >= ep.sents.length * FINISH_SHARE && (end || idxRef.current >= ep.sents.length * 0.9)) markDone(ep.id);
  }, [markDone]);

  const nextAfter = (id: string) => { const i = eps.findIndex((e) => e.id === id); return i > -1 && i + 1 < eps.length ? eps[i + 1].id : null; };

  const cancelNext = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setNext(null); };

  const stopAll = () => {
    tokenRef.current++;
    cancelRef.current?.(); cancelRef.current = null;
    if (hasSpeech()) stopSpeech();
    audioRef.current?.pause();
  };

  const finish = () => {
    const ep = epRef.current; if (!ep) return;
    playingRef.current = false; setPlaying(false);
    store.del(K.pos(ep.id)); setTick((t) => t + 1);
    checkDone(true);
    const nx = nextAfter(ep.id);
    if (!autoRef.current || !nx) return;
    let left = COUNTDOWN;
    setNext({ id: nx, left });
    timerRef.current = setInterval(() => {
      left -= 1;
      if (left <= 0) { cancelNext(); loadRef.current(nx, true); } else setNext({ id: nx, left });
    }, 1000);
  };

  const speakFrom = (i: number) => {
    const ep = epRef.current; if (!ep) return;
    cancelRef.current?.(); cancelRef.current = null;
    stopSpeech();
    if (i >= ep.sents.length) { finish(); return; }
    idxRef.current = i; setIdx(i);
    store.set(K.pos(ep.id), i);
    const tok = ++tokenRef.current;
    cancelRef.current = speakOne(ep.sents[i], {
      rate: rateRef.current, voice: voiceRef.current,
      onDone: () => {
        if (tok !== tokenRef.current || !playingRef.current) return;
        heardSet.current.add(i);
        store.set(K.heard(ep.id), [...heardSet.current]);
        checkDone();
        errRef.current = 0;
        speakFrom(i + 1);
      },
      // a sentence the voice couldn't say: move on, but it doesn't count as heard
      onError: () => {
        if (tok !== tokenRef.current || !playingRef.current) return;
        if (++errRef.current >= 3) { errRef.current = 0; pause(); showToast("🔇", "The voice stopped working", "Your device's voice couldn't read this. Try another voice, or a different browser."); return; }
        speakFrom(i + 1);
      },
    });
  };

  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio(); a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => {
      const ep = epRef.current; if (!ep) return;
      const p = position(ep.id); if (p > 5 && p < a.duration - 10) a.currentTime = p;
      lastT.current = a.currentTime; setTime({ t: a.currentTime, d: a.duration });
    });
    a.addEventListener("timeupdate", () => {
      const ep = epRef.current; if (!ep) return;
      const d = a.currentTime - lastT.current; lastT.current = a.currentTime;
      if (!a.paused && d > 0 && d < 1 + a.playbackRate * 1.5) heardSec.current += d; // only time actually played counts
      setTime({ t: a.currentTime, d: a.duration || 0 });
      store.set(K.pos(ep.id), Math.floor(a.currentTime)); store.set(K.heard(ep.id), Math.round(heardSec.current));
      checkDone();
    });
    a.addEventListener("seeked", () => { lastT.current = a.currentTime; });
    a.addEventListener("ended", () => finish());
    audioRef.current = a;
    return a;
  };

  const play = () => {
    const ep = epRef.current; if (!ep) return;
    cancelNext();
    if (ep.audio) {
      const a = ensureAudio(); a.playbackRate = rateRef.current;
      playingRef.current = true; setPlaying(true);
      a.play().catch(() => { playingRef.current = false; setPlaying(false); });
      return;
    }
    if (!hasSpeech()) { showToast("🔇", "No voice on this browser", "This browser can't read aloud. Try Chrome, Edge or Safari."); return; }
    playingRef.current = true; setPlaying(true);
    speakFrom(idxRef.current >= ep.sents.length ? 0 : idxRef.current);
  };
  const pause = () => { playingRef.current = false; setPlaying(false); stopAll(); setTick((t) => t + 1); };

  const load = (id: string, andPlay: boolean) => {
    const ep = epById.get(id); if (!ep) return;
    stopAll(); cancelNext();
    playingRef.current = false; setPlaying(false);
    epRef.current = ep; setCurId(id);
    store.set(K.last, { id, ts: Date.now() });
    if (ep.audio) {
      heardSec.current = Number(store.get(K.heard(id), 0)) || 0;
      const a = ensureAudio(); a.src = ep.audio; a.playbackRate = rateRef.current; a.load(); setTime({ t: 0, d: 0 });
    } else {
      const h = store.get<number[]>(K.heard(id), []);
      heardSet.current = new Set(Array.isArray(h) ? h : []);
      const p = position(id);
      idxRef.current = p > 0 && p < ep.sents.length - 1 ? p : 0; setIdx(idxRef.current);
    }
    if (andPlay) play();
  };
  useEffect(() => { loadRef.current = load; });

  const openAndScroll = (id: string, andPlay: boolean) => {
    load(id, andPlay);
    requestAnimationFrame(() => playerBox.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // Seek by fraction (progress bar) or section
  const seekFrac = (f: number) => {
    const ep = epRef.current; if (!ep) return;
    f = Math.max(0, Math.min(1, f));
    if (ep.audio) { const a = ensureAudio(); if (a.duration) a.currentTime = f * a.duration; return; }
    const target = ep.words * f;
    let i = 0; while (i + 1 < ep.cum.length && ep.cum[i + 1] <= target) i++;
    jumpTo(i);
  };
  const jumpTo = (i: number) => {
    const ep = epRef.current; if (!ep) return;
    i = Math.max(0, Math.min(ep.sents.length - 1, i));
    if (ep.audio) return;
    if (playingRef.current) speakFrom(i); else { idxRef.current = i; setIdx(i); store.set(K.pos(ep.id), i); setTick((t) => t + 1); }
  };
  const jumpSection = (k: number) => {
    const ep = epRef.current; if (!ep) return;
    if (ep.audio) { seekFrac(ep.cum[ep.secStart[k]] / ep.words); return; }
    jumpTo(ep.secStart[k]);
  };
  const skip = (d: number) => {
    const ep = epRef.current; if (!ep) return;
    if (ep.audio) { const a = ensureAudio(); a.currentTime = Math.max(0, a.currentTime + d * 15); return; }
    jumpTo(idxRef.current + d);
  };
  const cycleSpeed = () => {
    const r = SPEEDS[(SPEEDS.indexOf(rateRef.current) + 1) % SPEEDS.length];
    rateRef.current = r; setRate(r); store.set(K.rate, r);
    if (audioRef.current) audioRef.current.playbackRate = r;
    if (playingRef.current && epRef.current && !epRef.current.audio) speakFrom(idxRef.current);
  };
  const toggleAuto = () => { autoRef.current = !autoRef.current; setAuto(autoRef.current); store.set(K.auto, autoRef.current); if (!autoRef.current) cancelNext(); };
  const pickVoice = (uri: string) => {
    setVoiceURI(uri); store.set(K.voice, uri);
    voiceRef.current = voices.find((v) => v.voiceURI === uri) ?? null;
    if (playingRef.current && epRef.current && !epRef.current.audio) speakFrom(idxRef.current);
  };

  // listen/#ch3 opens that chapter, ready to play
  useEffect(() => {
    if (!ready) return;
    const h = location.hash.match(/^#ch(\d{1,2}[a-z]?)$/i);
    if (h && epById.has(h[1].toLowerCase())) loadRef.current(h[1].toLowerCase(), false);
  }, [ready, epById]);
  // stop the voice when leaving the page
  useEffect(() => () => { tokenRef.current++; cancelRef.current?.(); if (hasSpeech()) stopSpeech(); audioRef.current?.pause(); if (timerRef.current) clearInterval(timerRef.current); }, []);
  // keyboard: space toggles when the player is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!epRef.current || e.code !== "Space") return;
      const t = e.target as HTMLElement; if (/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(t.tagName)) return;
      e.preventDefault(); if (playingRef.current) pause(); else play();
    };
    addEventListener("keydown", onKey); return () => removeEventListener("keydown", onKey);
  });

  // ── derived ──
  const cur = curId ? epById.get(curId)! : null;
  const frac = !cur ? 0 : cur.audio ? (time.d ? time.t / time.d : 0) : cur.words ? cur.cum[Math.min(idx, cur.sents.length - 1)] / cur.words : 0;
  const curSec = !cur ? -1 : (() => { const at = cur.audio ? frac * cur.words : cur.cum[idx]; let k = -1; cur.secStart.forEach((s, j) => { if (cur.cum[s] <= at) k = j; }); return k; })();
  const minsLeft = cur ? ((1 - frac) * cur.words) / (WPM * rate) : 0;
  const totalHeard = done.filter((id) => epById.has(id)).length;
  const badges = realms.filter((r) => realmEarned(r.n, done)).length;

  const continueTarget = (() => {
    if (!ready) return null;
    void tick;
    const l = store.get<{ id: string } | null>(K.last, null);
    if (l && epById.has(l.id) && !isDone(l.id) && position(l.id) > 1) return { id: l.id, resume: true };
    const start = l && epById.has(l.id) ? eps.findIndex((e) => e.id === l.id) : -1;
    const after = eps.slice(start + 1).find((e) => !isDone(e.id)) ?? eps.find((e) => !isDone(e.id));
    return after ? { id: after.id, resume: false } : null;
  })();

  const status = (e: Ep) => {
    if (!ready) return null;
    if (isDone(e.id)) return <span className="rounded-full bg-emerald/15 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald">✓ Heard</span>;
    const p = position(e.id);
    if (p > 1) return <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-[#8a5a00] dark:text-gold">◐ {e.audio ? fmtSec(p) : `${Math.round((e.cum[Math.min(p, e.sents.length - 1)] / e.words) * 100)}%`} in</span>;
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl px-6">
      {/* stats */}
      <div className="flex flex-wrap gap-2.5">
        <span className="glass rounded-full px-4 py-2 text-sm font-bold">🎧 {totalHeard} of {eps.length} chapters heard</span>
        <span className="glass rounded-full px-4 py-2 text-sm font-bold text-[#8a5a00] dark:text-gold">🏅 {badges} of {realms.length} badges</span>
      </div>
      {noSpeech && Object.keys(audio).length === 0 && (
        <p className="block-panel mt-5 border-amber/40 p-4 text-sm font-semibold">This browser can&apos;t read aloud. Open Bedrock in Chrome, Edge or Safari to listen.</p>
      )}

      {/* continue */}
      {continueTarget && !cur && (
        <button type="button" onClick={() => openAndScroll(continueTarget.id, true)}
          className="mt-6 flex w-full items-center gap-4 rounded-3xl border border-gold/40 bg-gradient-to-r from-gold/15 via-amber/10 to-emerald/10 p-5 text-left transition hover:border-gold/70 sm:w-auto sm:pr-10">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold to-amber text-[#10140e] shadow-[0_8px_24px_-8px_rgba(242,140,40,0.9)]"><Play className="size-6 fill-current" /></span>
          <span className="min-w-0">
            <b className="block font-display text-xl">{continueTarget.resume ? "Continue listening" : totalHeard ? "Play the next chapter" : "Start listening"}</b>
            <small className="block text-sm text-muted">Chapter {epById.get(continueTarget.id)!.label} · {epById.get(continueTarget.id)!.title}</small>
          </span>
        </button>
      )}

      {/* player */}
      <div ref={playerBox} className="scroll-mt-28">
        {cur && (
          <section aria-label="Chapter player" className="block-panel mt-6 overflow-hidden" style={{ "--accent": realms.find((r) => r.n === cur.realm)!.color } as CSSProperties}>
            <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
              <div className="p-5 sm:p-7">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8a5a00] dark:text-gold">🎧 Now playing · Chapter {cur.label}{cur.audio ? " · recording" : " · read aloud"}</div>
                <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{cur.title}</h2>
                <p className="mt-4 min-h-[4.5rem] rounded-2xl border border-line bg-ink-2/60 p-4 text-lg leading-relaxed" aria-live="off">
                  {cur.audio ? (curSec >= 0 ? cur.headings[curSec] : cur.title) : cur.sents[Math.min(idx, cur.sents.length - 1)]}
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <button type="button" onClick={() => (playing ? pause() : play())} aria-label={playing ? "Pause" : "Play"}
                    className="grid size-16 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold to-amber text-[#10140e] shadow-[0_8px_24px_-8px_rgba(242,140,40,0.9)] transition hover:brightness-110 active:translate-y-px">
                    {playing ? <Pause className="size-7 fill-current" /> : <Play className="ml-1 size-7 fill-current" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div role="slider" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "ArrowRight") skip(1); if (e.key === "ArrowLeft") skip(-1); }}
                      onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); seekFrac((e.clientX - b.left) / b.width); }}
                      className="xp-bar h-3 cursor-pointer"><div className="xp-fill" style={{ width: `${frac * 100}%`, transition: "width .3s" }} /></div>
                    <div className="mt-1.5 flex justify-between gap-2 text-xs font-semibold text-muted">
                      <span>{cur.audio ? fmtSec(time.t) : `Part ${Math.min(idx + 1, cur.sents.length)} of ${cur.sents.length}`}</span>
                      <span>{cur.audio ? (time.d ? fmtSec(time.d) : "--:--") : `about ${fmtMin(minsLeft)} left`}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => skip(-1)} className="btn-block inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold" aria-label={cur.audio ? "Back 15 seconds" : "Back one sentence"}>
                    <SkipBack className="size-4" /> {cur.audio ? "15s" : "Back"}
                  </button>
                  <button type="button" onClick={() => skip(1)} className="btn-block inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold" aria-label={cur.audio ? "Forward 15 seconds" : "Forward one sentence"}>
                    {cur.audio ? "15s" : "Next"} <SkipForward className="size-4" />
                  </button>
                  <button type="button" onClick={cycleSpeed} className="btn-block rounded-full px-3.5 py-2 text-sm font-bold" aria-label="Playback speed">{rate}×</button>
                  <button type="button" onClick={toggleAuto} aria-pressed={auto} title="Play the next chapter automatically"
                    className={`btn-block inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold ${auto ? "border-emerald/60 text-emerald-700 dark:text-emerald" : "opacity-60"}`}>
                    <Repeat className="size-4" /> Auto-next {auto ? "on" : "off"}
                  </button>
                  {!cur.audio && voices.length > 0 && (
                    <select value={voices.some((v) => v.voiceURI === voiceURI) ? voiceURI : voices[0].voiceURI} onChange={(e) => pickVoice(e.target.value)} aria-label="Voice"
                      className="max-w-[14rem] rounded-full border border-line bg-ink-2 px-3 py-2 text-sm font-semibold text-fg">
                      {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                    </select>
                  )}
                </div>

                {next && (
                  <div aria-live="polite" className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm font-semibold">
                    <span className="min-w-[12rem] flex-1">Up next: <b className="text-[#8a5a00] dark:text-gold">Chapter {epById.get(next.id)!.label} · {epById.get(next.id)!.title}</b> — playing in {next.left}…</span>
                    <button type="button" onClick={() => { const id = next.id; cancelNext(); load(id, true); }} className="rounded-full bg-gold px-3.5 py-1.5 font-bold text-[#10140e]">▶ Play now</button>
                    <button type="button" onClick={cancelNext} className="btn-block rounded-full px-3.5 py-1.5 font-bold">Cancel</button>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
                  <Link href={`/chapters/${cur.id}/`} className="inline-flex items-center gap-1.5 text-[#8a5a00] hover:underline dark:text-gold"><BookOpen className="size-4" /> Open Chapter {cur.label}</Link>
                  <Link href="/ask/" className="text-muted hover:text-fg hover:underline">🙋 Got a question? Ask Mr. Dopp</Link>
                </div>
              </div>

              {/* section list */}
              <div className="border-t border-line p-5 sm:p-7 lg:border-l lg:border-t-0">
                <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted"><ListMusic className="size-4" /> Sections</div>
                <ol className="space-y-1">
                  {cur.headings.map((h, k) => (
                    <li key={k}>
                      <button type="button" onClick={() => jumpSection(k)} aria-current={k === curSec ? "true" : undefined}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${k === curSec ? "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] font-bold text-fg" : "text-muted hover:bg-fg/5 hover:text-fg"}`}>
                        <span className="w-5 shrink-0 font-mono text-xs leading-5">{k === curSec ? (playing ? "♪" : "▸") : k + 1}</span>
                        <span className="leading-5">{h}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* badges */}
      <section className="mt-14">
        <h2 className="font-display text-3xl font-extrabold tracking-tight">🏅 Listener badges</h2>
        <p className="mt-2 max-w-2xl text-muted">Finish every chapter in a realm to earn its badge. A chapter counts once you&apos;ve actually heard most of it (skipping ahead doesn&apos;t count).</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {realms.map((r) => {
            const ids = chaptersIn(r).map((c) => c.id), heard = ids.filter((id) => done.includes(id)).length, earned = realmEarned(r.n, done);
            return (
              <div key={r.n} style={{ "--accent": r.color } as CSSProperties} className={`accent-card flex items-center gap-3 rounded-2xl p-4 ${earned ? "" : "opacity-80"}`}>
                <span className={earned ? "" : "grayscale"}><ArtIcon slug={`realm-${r.n}`} fallback={r.icon} size={48} /></span>
                <span className="min-w-0">
                  <b className="block leading-tight">{r.name} Listener</b>
                  <small className="text-muted">{earned ? "Earned!" : `${heard} of ${ids.length} heard`}</small>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* realms + chapters */}
      {realms.map((r) => {
        const list = eps.filter((e) => e.realm === r.n), heard = list.filter((e) => done.includes(e.id)).length;
        return (
          <section key={r.n} className="mt-12" style={{ "--accent": r.color } as CSSProperties}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl font-extrabold tracking-tight"><span aria-hidden>{r.icon}</span> Realm {r.n} · {r.name}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${heard === list.length && list.length ? "bg-emerald/15 text-emerald-700 dark:text-emerald" : "border border-line text-muted"}`}>
                {heard}/{list.length} heard{heard === list.length && list.length ? " · 🏅" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {list.map((e) => (
                <div key={e.id} className={`glass flex items-center gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4 ${e.id === curId ? "ring-2 ring-[var(--accent)]" : ""}`}>
                  <span className="w-10 shrink-0 text-center font-display text-2xl font-extrabold" style={{ color: r.color }}>{e.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{e.title}</div>
                    <div className="text-xs text-muted">{e.headings.length} sections · {e.audio ? "recording" : `about ${fmtMin(e.words / WPM)}`} · <Link href={`/chapters/${e.id}/`} className="underline-offset-2 hover:text-fg hover:underline">read it</Link></div>
                  </div>
                  {status(e)}
                  <button type="button" onClick={() => (e.id === curId ? (playing ? pause() : play()) : openAndScroll(e.id, true))} aria-label={`Play chapter ${e.label}`}
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold to-amber text-[#10140e] transition hover:brightness-110">
                    {e.id === curId && playing ? <Headphones className="size-5" /> : <Play className="ml-0.5 size-5 fill-current" />}
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-12 text-center text-sm leading-relaxed text-muted">
        Chapters are read aloud by your device&apos;s own voice from the chapter text, so nothing is downloaded. Voice quality depends on the device (Edge and newer phones sound the most natural).<br />
        Progress and badges are saved on this device. Badges are just for you; they don&apos;t add XP.
      </p>

      {toast && (
        <div role="status" className="glass fixed bottom-6 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-3 rounded-2xl border-gold/50 bg-ink-2/95 p-4 text-sm font-semibold shadow-2xl">
          <span className="text-2xl" aria-hidden>{toast.icon}</span>
          <span><b className="block text-[#8a5a00] dark:text-gold">{toast.title}</b>{toast.body}</span>
        </div>
      )}
    </div>
  );
}
// ── end wave-x7a ──
