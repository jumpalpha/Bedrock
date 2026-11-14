"use client";
// ── wave-x7b ── Visitors: twin of Dopps Class visitor.html (+ visitor_admin.sql), on Bedrock's own b_ tables (010_x7b.sql).
// Past students and guests make a free visitor account (period "Visitor") to keep playing, raise a rock alien and
// climb the Visitors board, separate from the current classes. 90 days without a visit switches the account off.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { dbReady, signOut, useStudent } from "@/lib/db";
import { needsUpdate, notInstalled, visitorBoard, visitorLogin, visitorRegister, visitorTouch, type VisitorBoardRow, type VisitorTouch } from "@/lib/x7b";
import { LoginDialog } from "@/components/login";

const field = "mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 font-semibold";
const NAME = /^[A-Za-zÀ-ÿ' -]+$/;

export function Visitors() {
  const { student, ready } = useStudent();
  const [me, setMe] = useState<VisitorTouch | null>(null);
  const [meErr, setMeErr] = useState("");
  const [board, setBoard] = useState<VisitorBoardRow[] | null | "error">(null);
  const [login, setLogin] = useState(false);

  const loadBoard = useCallback(() => {
    if (!dbReady) return setBoard([]);
    visitorBoard().then(setBoard).catch((e) => { setBoard("error"); if (notInstalled(e)) setMeErr(needsUpdate); });
  }, []);
  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => {
    setMe(null);
    if (!student || !dbReady) return;
    visitorTouch().then((r) => { setMe(r); if ("removed" in r) signOut(); }).catch((e) => setMeErr(notInstalled(e) ? needsUpdate : (e as Error).message));
  }, [student]);

  if (!ready) return <div className="h-96" />;
  const isVisitor = !!me && "visitor" in me && me.visitor;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-6 pt-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        {meErr && <p className="block-panel p-3 text-sm font-bold text-amber">{meErr}</p>}
        {me && "removed" in me && <p className="block-panel p-4 font-bold">That visitor account was switched off (90 days without a visit, or removed by Mr. Dopp). Make a new one below.</p>}

        {student && isVisitor && me && "first" in me && (
          <section className="block-panel p-6" data-testid="visitor-in">
            <h2 className="font-display text-3xl font-extrabold">👋 Welcome, {me.first}!</h2>
            <p className="mt-2 text-sm text-muted">Your visitor account is active. Visit again before <b className="text-fg">{new Date(me.expires + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</b> to keep it.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[["/arcade/", "🎮 Arcade", "Every Sprite Arcade and classic game"], ["/pet/", "🪨 My Rock Alien", "Raise and evolve your own alien"], ["/live/", "⚔️ Live games", "Join with the code on a screen"], ["/mastery/", "🎓 Mastery Checks", "Test what you remember"]].map(([h, t, s]) => (
                <Link key={h} href={h} className="accent-card rounded-2xl p-4"><b className="block">{t}</b><span className="text-sm text-muted">{s}</span></Link>
              ))}
            </div>
            <button className="btn-block mt-5 !text-sm" onClick={() => signOut()}>Sign out</button>
          </section>
        )}

        {student && me && "visitor" in me && !me.visitor && (
          <section className="block-panel p-6" data-testid="visitor-student">
            <h2 className="font-display text-2xl font-extrabold">You&apos;re logged in as a current student</h2>
            <p className="mt-2 text-sm text-muted">Visitor accounts are for past students and guests. Your scores already count for your class.</p>
            <Link href="/arcade/" className="btn-block btn-grass mt-4">Go to the Arcade →</Link>
          </section>
        )}

        {(!student || (me && "removed" in me)) && (
          <>
            <NewVisitor />
            <ReturningVisitor onClassLogin={() => setLogin(true)} />
          </>
        )}
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
          <li>Your visitor account stays active as long as you visit at least once every <b className="text-fg">90 days</b>. After that it switches off automatically.</li>
          <li>Boards show your first name and last initial only. Mr. Dopp can remove any visitor account.</li>
          <li>Current students: log in with the <b className="text-fg">Log in</b> button at the top (name, period, PIN) instead.</li>
        </ul>
      </div>

      <aside className="block-panel h-fit p-5" data-testid="visitor-board">
        <h2 className="pixel-title text-2xl">🏆 Top visitors</h2>
        <p className="mb-3 text-sm text-muted">Most XP earned by visitors: logins, live games and anything else they finish.</p>
        {board === null ? <p className="text-sm text-muted">Loading…</p>
          : board === "error" ? <p className="text-sm text-muted">Couldn&apos;t load the board right now.</p>
          : !board.length ? <p className="text-sm text-muted">No visitors on the board yet. Be the first!</p>
          : (
            <ol className="space-y-1.5">
              {board.map((r, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                  <span className="w-7 text-center text-lg">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                  <b className="flex-1">{r.name}{r.pet ? " 🪨" : ""}</b>
                  <span className="text-xs font-bold text-muted">{r.xp.toLocaleString()} XP · {r.days} day{r.days === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ol>
          )}
      </aside>
      {login && <LoginDialog onClose={() => setLogin(false)} />}
    </div>
  );
}

function NewVisitor() {
  const [f, setF] = useState({ first: "", last: "", pin: "", pin2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    const first = f.first.trim(), last = f.last.trim();
    if (first.length < 2 || first.length > 16 || !NAME.test(first)) return setErr("First name: 2 to 16 letters.");
    if (last.length < 2 || last.length > 30 || !NAME.test(last)) return setErr("Please enter your last name.");
    if (!/^\d{4}$/.test(f.pin)) return setErr("PIN must be exactly 4 digits.");
    if (f.pin !== f.pin2) return setErr("PINs don't match.");
    setBusy(true); setErr("Creating your account…");
    try { await visitorRegister(first, last, f.pin); setErr(""); }
    catch (x) { setErr(notInstalled(x) ? needsUpdate : (x as Error).message); }
    finally { setBusy(false); }
  };
  const pin = (k: "pin" | "pin2") => ({ value: f[k], inputMode: "numeric" as const, maxLength: 4, type: "password", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value.replace(/\D/g, "") }), className: field + " tracking-[0.5em]" });
  return (
    <form onSubmit={go} className="block-panel p-6" data-testid="visitor-new">
      <h2 className="font-display text-2xl font-extrabold">New visitor</h2>
      <p className="mt-1 text-sm text-muted">Make your account in 20 seconds. Use your real first and last name so Mr. Dopp knows who you are.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-extrabold">First name (shown on boards)<input className={field} value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} autoComplete="given-name" /></label>
        <label className="text-sm font-extrabold">Last name<input className={field} value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} autoComplete="family-name" /></label>
        <label className="text-sm font-extrabold">Make a 4-digit PIN<input {...pin("pin")} /></label>
        <label className="text-sm font-extrabold">Type the PIN again<input {...pin("pin2")} /></label>
      </div>
      {err && <p className="mt-3 text-sm font-bold text-crimson">{err}</p>}
      <button disabled={busy || !dbReady} className="btn-block btn-grass mt-4 w-full justify-center disabled:opacity-50">Create visitor account</button>
    </form>
  );
}

function ReturningVisitor({ onClassLogin }: { onClassLogin: () => void }) {
  const [f, setF] = useState({ first: "", last: "", pin: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.first.trim() || !f.last.trim() || !/^\d{4}$/.test(f.pin)) return setErr("Enter your first name, last name and 4-digit PIN.");
    setBusy(true); setErr("Checking…");
    try { await visitorLogin(f.first, f.last, f.pin); setErr(""); }
    catch (x) { setErr(notInstalled(x) ? needsUpdate : (x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="block-panel p-6" data-testid="visitor-return">
      <h2 className="font-display text-2xl font-extrabold">Returning visitor</h2>
      <p className="mt-1 text-sm text-muted">Already made a visitor account? Sign in with the same name and PIN. <b className="text-fg">Past Bedrock students:</b> your old class login still works. <button type="button" className="font-bold underline" onClick={onClassLogin}>Log in with your period</button></p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-extrabold">First name<input className={field} value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></label>
        <label className="text-sm font-extrabold">Last name<input className={field} value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} /></label>
        <label className="text-sm font-extrabold">Your PIN<input className={field + " tracking-[0.5em]"} value={f.pin} inputMode="numeric" maxLength={4} type="password" onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "") })} /></label>
      </div>
      {err && <p className="mt-3 text-sm font-bold text-crimson">{err}</p>}
      <button disabled={busy || !dbReady} className="btn-block mt-4 w-full justify-center disabled:opacity-50">Sign in</button>
    </form>
  );
}
