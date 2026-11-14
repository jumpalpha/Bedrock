"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Gamepad2, RotateCcw, Users } from "lucide-react";
import { vocabByChapter } from "./review-bank";

// Same-device Team Hangman for one screen / projector, with Earth science words from the glossary
// (the Dopps Class original also has a multi-device mode with game codes; Bedrock has only this one). Scoring: +10 per revealed letter
// (and go again), +50 for finishing, solving = 50 + 10 per hidden letter, 6 misses = stumped.
const TEAMS = [{ n: "Red", c: "#FF4D6D" }, { n: "Blue", c: "#3BA8FF" }, { n: "Green", c: "#00E5A0" }, { n: "Gold", c: "#FFD700" }];
const MAX_MISS = 6, TURN_SECS = 30, ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lettersOnly = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");
const cleanPhrase = (s: string) => s.toUpperCase().replace(/[^A-Z '\-!?.,]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
const rot = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 84) % 26) + 97));
const BAD_STEM = ["shpx", "fuvg", "ovgpu", "phag", "avtt", "snt", "jube", "fyhg", "ergneq", "cbea", "qvyqb", "wvmm", "ohgguby", "nffuby", "zbgureshpx"].map(rot);
const BAD_WORD = ["nff", "qvpx", "pbpx", "chffl", "gvgf", "ubr", "xxx", "qnza", "cvff", "ancv"].map(rot);
function isRude(s: string) {
  const words = s.toLowerCase().split(/[^a-z]+/).filter(Boolean), joined = words.join("");
  return words.some((w) => BAD_WORD.includes(w) || BAD_STEM.some((b) => w.startsWith(b))) || BAD_STEM.some((b) => b.length >= 5 && joined.includes(b));
}
type Vocab = Record<string, { title: string; terms: [string, string][] }>;

type Phase = "setup" | "pick" | "guess" | "roundEnd" | "final";
type Source = "vocab" | "master";

export function TeamHangman() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [teamsN, setTeamsN] = useState(2);
  const [rounds, setRounds] = useState(5);
  const [source, setSource] = useState<Source>("vocab");
  const vocabReady = true; // the glossary is bundled, so words are always ready
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [secret, setSecret] = useState("");
  const [hint, setHint] = useState("");
  const [used, setUsed] = useState<Record<string, "hit" | "miss">>({});
  const [misses, setMisses] = useState(0);
  const [turn, setTurn] = useState(0);
  const [firstTurn, setFirstTurn] = useState(0);
  const [left, setLeft] = useState(TURN_SECS);
  const [log, setLog] = useState("");
  const [winTeam, setWinTeam] = useState<number | null>(null);
  const [stumps, setStumps] = useState(0);
  const [draft, setDraft] = useState({ phrase: "", hint: "", err: "" });
  const [solve, setSolve] = useState("");

  const mask = useMemo(() => secret.split("").map((ch) => (/[A-Z]/.test(ch) && !used[ch] ? "_" : ch)).join(""), [secret, used]);

  const beginRound = useCallback((r: number, ft: number) => {
    setRound(r); setUsed({}); setMisses(0); setWinTeam(null); setSolve(""); setDraft({ phrase: "", hint: "", err: "" });
    if (source === "vocab") {
      const V: Vocab = vocabByChapter();
      const chs = Object.keys(V);
      let term = "PLATE TECTONICS", h = "Earth science", tries = 0;
      while (tries++ < 50 && chs.length) {
        const ch = chs[Math.floor(Math.random() * chs.length)], t = V[ch].terms[Math.floor(Math.random() * V[ch].terms.length)];
        const p = cleanPhrase(t[0]);
        if (lettersOnly(p).length >= 4 && p.split(" ").every((w) => w.length <= 14)) { term = p; h = `Ch ${ch} · ${V[ch].title}`; break; }
      }
      setSecret(term); setHint(h); setTurn(ft % teamsN); setLeft(TURN_SECS);
      setLog(`Round ${r}: ${TEAMS[ft % teamsN].n} goes first!`); setPhase("guess");
    } else {
      setSecret(""); setHint(""); setPhase("pick");
    }
  }, [source, teamsN]);

  const start = () => { setScores([0, 0, 0, 0]); setStumps(0); setFirstTurn(1); beginRound(1, 0); };

  const endRound = useCallback((team: number, msg: string) => {
    setWinTeam(team); setLog(msg);
    setPhase(round >= rounds ? "final" : "roundEnd");
  }, [round, rounds]);

  const pass = useCallback(() => { setTurn((t) => (t + 1) % teamsN); setLeft(TURN_SECS); }, [teamsN]);
  const addScore = (team: number, n: number) => setScores((s) => s.map((v, i) => (i === team ? v + n : v)));
  const miss = (msg: string) => {
    const m = misses + 1; setMisses(m);
    if (m >= MAX_MISS) { setStumps((s) => s + 1); endRound(-1, "💀 Hangman complete! Nobody got it."); return; }
    setLog(msg); pass();
  };

  useEffect(() => {
    if (phase !== "guess") return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same timer flow as the original game
    if (phase === "guess" && left <= 0) { setLog(`⏰ ${TEAMS[turn].n} ran out of time.`); pass(); }
  }, [left, phase, turn, pass]);

  const guess = useCallback((L: string) => {
    if (phase !== "guess" || used[L]) return;
    const hits = secret.split("").filter((c) => c === L).length;
    const nu = { ...used, [L]: hits ? "hit" : "miss" } as Record<string, "hit" | "miss">;
    setUsed(nu);
    const team = TEAMS[turn].n;
    if (hits) {
      const done = !secret.split("").some((ch) => /[A-Z]/.test(ch) && !nu[ch]);
      addScore(turn, 10 * hits + (done ? 50 : 0));
      if (done) { endRound(turn, `${team} finished it! +${10 * hits} and +50 bonus`); return; }
      setLog(`✅ ${team}: ${L} ×${hits} — +${10 * hits}. Go again!`); setLeft(TURN_SECS);
    } else miss(`❌ ${team}: no ${L}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, used, secret, turn]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (phase !== "guess" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const L = e.key.toUpperCase();
      if (/^[A-Z]$/.test(L)) guess(L);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [guess, phase]);

  const trySolve = () => {
    const g = lettersOnly(solve); if (!g || phase !== "guess") return;
    setSolve("");
    if (g === lettersOnly(secret)) {
      const hidden = mask.split("").filter((c) => c === "_").length;
      addScore(turn, 50 + 10 * hidden);
      endRound(turn, `🎯 ${TEAMS[turn].n} solved it! +${50 + 10 * hidden}`);
    } else miss(`❌ ${TEAMS[turn].n} guessed "${solve.toUpperCase().slice(0, 40)}" — nope!`);
  };

  const lockWord = () => {
    const ph = cleanPhrase(draft.phrase), h = draft.hint.replace(/\s+/g, " ").trim().slice(0, 40);
    const err = lettersOnly(ph).length < 2 ? "Use at least 2 letters." : ph.split(" ").some((w) => w.length > 14) ? "Keep each word to 14 letters or fewer." : isRude(ph) || isRude(h) ? "Keep it school-appropriate. Pick something else." : "";
    if (err) { setDraft({ ...draft, err }); return; }
    const ft = (firstTurn - 1) % teamsN;
    setSecret(ph); setHint(h); setTurn(ft); setLeft(TURN_SECS); setLog(`Secret locked in. ${TEAMS[ft].n} goes first!`); setPhase("guess");
  };
  const next = () => { const ft = firstTurn; setFirstTurn(ft + 1); beginRound(round + 1, ft); };

  // ---------- screens ----------
  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-md">
        <div className="block-panel p-7">
          <h1 className="text-gradient text-center font-display text-4xl font-extrabold tracking-tight">Team Hangman</h1>
          <p className="mt-2 text-center text-muted">Teams take turns guessing letters on one screen. Hit a letter to go again — 6 misses and the hangman is done!</p>
          <div className="mx-auto my-4 w-28"><Gallows misses={6} lost={false} /></div>
          <Field label="Teams">
            {[2, 3, 4].map((n) => <Chip key={n} on={teamsN === n} onClick={() => setTeamsN(n)}>{n}</Chip>)}
          </Field>
          <Field label="Rounds">
            {[3, 5, 8].map((n) => <Chip key={n} on={rounds === n} onClick={() => setRounds(n)}>{n}</Chip>)}
          </Field>
          <Field label="Secret words">
            <Chip on={source === "vocab"} onClick={() => setSource("vocab")}>Earth science words</Chip>
            <Chip on={source === "master"} onClick={() => setSource("master")}>Word Master types it</Chip>
          </Field>
          <button disabled={source === "vocab" && !vocabReady} onClick={start}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-6 py-3.5 font-display text-lg font-extrabold text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)] transition enabled:hover:-translate-y-0.5 disabled:opacity-60">
            <Users className="mr-2 inline size-5" /> Start game
          </button>
        </div>
      </div>
    );
  }

  const Scoreboard = (
    <div className={`grid w-full gap-2 ${teamsN === 2 ? "grid-cols-2" : teamsN === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
      {TEAMS.slice(0, teamsN).map((t, i) => {
        const active = phase === "guess" && turn === i;
        return (
          <div key={t.n} className="rounded-2xl border px-3 py-2 text-center transition" style={{ borderColor: active ? t.c : "var(--color-line)", background: active ? `${t.c}22` : "color-mix(in srgb, var(--color-fg) 4%, transparent)", boxShadow: active ? `0 0 24px -6px ${t.c}` : undefined }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: t.c }}>{t.n}{active ? ` · ${Math.max(0, left)}s` : ""}</div>
            <div className="font-display text-3xl font-extrabold">{scores[i]}</div>
          </div>
        );
      })}
    </div>
  );

  if (phase === "pick") {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center">
        {Scoreboard}
        <div className="glass mt-6 w-full rounded-3xl p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-gold">Round {round} of {rounds} · Word Master</div>
          <p className="mt-1 text-sm text-muted">Everyone else look away! Type an Earth science word or phrase, then lock it in.</p>
          <input type="password" autoComplete="off" value={draft.phrase} onChange={(e) => setDraft({ ...draft, phrase: e.target.value, err: "" })} placeholder="Secret word or phrase"
            className="mt-4 w-full rounded-xl border border-line bg-fg/5 px-4 py-3 font-semibold tracking-widest text-fg outline-none focus:border-gold/60" />
          <input value={draft.hint} onChange={(e) => setDraft({ ...draft, hint: e.target.value })} placeholder="Hint (optional, everyone sees it)" maxLength={40}
            className="mt-2 w-full rounded-xl border border-line bg-fg/5 px-4 py-3 text-fg outline-none focus:border-gold/60" />
          {draft.err && <p className="mt-2 text-sm font-semibold text-crimson">{draft.err}</p>}
          <button onClick={lockWord} className="mt-4 w-full rounded-2xl bg-gold px-6 py-3 font-bold text-ink">🔒 Lock it in</button>
        </div>
      </div>
    );
  }

  const over = phase === "roundEnd" || phase === "final";
  const best = Math.max(...scores.slice(0, teamsN));
  const champs = TEAMS.slice(0, teamsN).filter((_, i) => scores[i] === best);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center">
      {Scoreboard}
      <div className="glass mt-5 w-full rounded-3xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-24 shrink-0 sm:w-28"><Gallows misses={misses} lost={over && winTeam === -1} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">Round {round} of {rounds} · Misses {misses}/{MAX_MISS}</div>
            {hint && <div className="mt-1 text-sm text-gold">💡 {hint}</div>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
              {secret.split(" ").map((word, wi) => (
                <div key={wi} className="flex gap-1">
                  {word.split("").map((ch, ci) => {
                    const isL = /[A-Z]/.test(ch), shown = !isL || !!used[ch] || over, missed = isL && over && !used[ch];
                    return (
                      <span key={ci} className={`grid h-11 w-8 place-items-center rounded-lg font-display text-2xl font-extrabold sm:h-12 sm:w-9 ${isL ? "border-b-4 bg-fg/5" : ""}`}
                        style={{ borderColor: isL ? (missed ? "#FF4D6D" : "color-mix(in srgb, var(--color-fg) 35%, transparent)") : undefined, color: missed ? "#E8364F" : undefined, animation: shown && isL ? "hmpop .3s ease" : undefined }}>
                        {shown ? ch : ""}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 min-h-6 text-center font-semibold text-fg">{log}</p>
      </div>

      {!over && (
        <>
          <div className="mt-4 grid w-full grid-cols-7 gap-1.5 sm:grid-cols-9">
            {ABC.split("").map((L) => {
              const u = used[L];
              return (
                <button key={L} onClick={() => guess(L)} disabled={!!u}
                  className={`h-11 rounded-xl font-display text-lg font-extrabold transition ${u === "hit" ? "bg-emerald/25 text-emerald" : u === "miss" ? "bg-fg/5 text-fg/25 line-through" : "bg-fg/10 text-fg hover:-translate-y-0.5 hover:bg-fg/20"}`}
                  style={!u ? { boxShadow: `inset 0 -3px 0 ${TEAMS[turn].c}88` } : undefined}>
                  {L}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex w-full gap-2">
            <input value={solve} onChange={(e) => setSolve(e.target.value)} onKeyDown={(e) => e.key === "Enter" && trySolve()} placeholder={`${TEAMS[turn].n}: solve the whole thing…`}
              className="min-w-0 flex-1 rounded-xl border border-line bg-fg/5 px-4 py-3 text-fg outline-none focus:border-gold/60" />
            <button onClick={trySolve} className="rounded-xl px-5 font-bold text-ink" style={{ background: TEAMS[turn].c }}>Solve</button>
          </div>
          <p className="mt-2 text-xs text-muted/80">A wrong solve counts as a miss. Type letters on the keyboard to guess.</p>
        </>
      )}

      {phase === "roundEnd" && (
        <button onClick={next} className="mt-5 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-8 py-3.5 font-display text-lg font-extrabold text-ink">Next round →</button>
      )}
      {phase === "final" && (
        <div className="mt-5 w-full rounded-3xl border border-gold/40 bg-gold/10 p-6 text-center">
          <div className="font-display text-3xl font-extrabold text-gold">{champs.length > 1 ? "It's a tie! 🤝" : `${champs[0].n} wins! 🏆`}</div>
          <p className="mt-1 text-sm text-muted">{stumps ? `The hangman won ${stumps} round${stumps > 1 ? "s" : ""}.` : "Every word got cracked!"}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button onClick={start} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-6 py-3 font-bold text-ink"><RotateCcw className="size-4" /> Play again</button>
            <button onClick={() => setPhase("setup")} className="glass rounded-2xl px-5 py-3 font-semibold text-fg hover:bg-white/10">Change setup</button>
          </div>
        </div>
      )}
      <Link href="/arcade/" className="glass mt-6 text-fg inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold transition hover:bg-white/10"><Gamepad2 className="size-4" /> More games</Link>
      <style>{`@keyframes hmpop{from{transform:scale(.5);opacity:0}to{transform:none;opacity:1}}`}</style>
    </div>
  );
}

function Gallows({ misses, lost }: { misses: number; lost: boolean }) {
  const ink = lost ? "#FF4D6D" : "currentColor";
  const parts = [
    <circle key="h" cx="84" cy="44" r="11" />,
    <line key="b" x1="84" y1="55" x2="84" y2="88" />,
    <line key="la" x1="84" y1="64" x2="70" y2="78" />,
    <line key="ra" x1="84" y1="64" x2="98" y2="78" />,
    <line key="ll" x1="84" y1="88" x2="72" y2="108" />,
    <line key="rl" x1="84" y1="88" x2="96" y2="108" />,
  ];
  return (
    <svg viewBox="0 0 120 140" className="block w-full text-fg">
      <g stroke="#a0784a" strokeWidth="6" strokeLinecap="round" fill="none">
        <line x1="12" y1="132" x2="70" y2="132" /><line x1="30" y1="132" x2="30" y2="12" /><line x1="30" y1="12" x2="84" y2="12" /><line x1="84" y1="12" x2="84" y2="32" />
      </g>
      <g stroke={ink} strokeWidth="4.5" strokeLinecap="round" fill="none" style={{ filter: lost ? "drop-shadow(0 0 6px #FF4D6D)" : undefined }}>
        {parts.slice(0, misses)}
      </g>
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${on ? "border-gold/60 bg-gold/15 text-gold" : "border-line bg-fg/5 text-fg hover:bg-fg/10"}`}>{children}</button>
  );
}
