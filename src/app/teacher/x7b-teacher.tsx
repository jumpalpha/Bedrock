"use client";
// ── wave-x7b ── teacher views: Daily Briefing (twin of Dopps Class briefing_teacher.js), Suggestions inbox,
// Visitors (twin of visitor_admin.sql) and links to the class tools (Sub Guide, Timer, Print Quest Sheet).
// Needs supabase/migrations/010_x7b.sql.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import survey from "@/data/content/survey.json";
import { daysOfYear } from "@/data/site";
import { results } from "@/lib/db";
import {
  briefingGet, needsUpdate, notInstalled, SUGGEST_CATS, teacherBriefingSet, teacherSuggestions, teacherSuggestionSet, teacherVisitorRemove, teacherVisitors,
  type Briefing, type SuggestionRow, type VisitorTeacherRow,
} from "@/lib/x7b";

export type X7bTab = "briefing" | "suggestions" | "visitors";
export const X7B_TABS: [X7bTab, string][] = [["briefing", "Daily Briefing"], ["suggestions", "Suggestions"], ["visitors", "Visitors"]];

const when = (s: string | null) => (s ? new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const day = (s: string) => new Date(s + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
const errText = (e: unknown) => (notInstalled(e) ? needsUpdate : (e as Error).message);
const btn = "btn-block !rounded-xl !px-3 !py-1.5 !text-sm";
const TH = "border-b border-line px-2 py-1.5 text-left text-xs uppercase tracking-wide text-muted";
const TD = "border-b border-line px-2 py-1.5";

export function X7bTeacher({ hash, tab }: { hash: string; tab: X7bTab }) {
  return tab === "briefing" ? <BriefingTeacher hash={hash} /> : tab === "suggestions" ? <SuggestionsTeacher hash={hash} /> : <VisitorsTeacher hash={hash} />;
}

// ---------- Daily Briefing ----------
type S = { n: number; question: string; options: string[] | null };
function BriefingTeacher({ hash }: { hash: string }) {
  const [b, setB] = useState<Briefing | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const qs = survey.questions as S[];
  const [q, setQ] = useState<S | null>(null);
  useEffect(() => {
    briefingGet().then((x) => { setB(x); setText(x?.announcement ?? ""); }).catch((e) => setErr(errText(e)));
    const today = qs[daysOfYear() % qs.length]; setQ(today);
    results("survey", `s${today.n}`).then(setCounts).catch(() => setCounts({}));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (clear: boolean) => {
    if (clear && !confirm("Remove the announcement?")) return;
    try { const x = await teacherBriefingSet(hash, clear ? "" : text); setB(x); setText(x.announcement); setMsg("Saved ✓ Students see it next time they open the Welcome screen."); }
    catch (e) { setMsg(errText(e)); }
  };
  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0;
  return (
    <div className="space-y-6">
      <section className="block-panel p-5">
        <h2 className="pixel-title mb-2 text-2xl">📣 Announcement</h2>
        {err && <p className="mb-2 font-bold text-crimson">{err}</p>}
        <textarea className="w-full rounded-xl border border-line bg-ink p-3 font-semibold" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Example: Chapter 13 reading is due Friday. Bring a rock from home tomorrow!" data-testid="briefing-text" />
        <p className="mt-1 text-sm text-muted">Shows at the top of every student&apos;s Welcome screen until you change or clear it.{b?.updated_at && b.announcement ? ` Last saved ${when(b.updated_at)}.` : ""}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-block btn-grass !text-sm" onClick={() => save(false)} disabled={!!err}>💾 Save &amp; show to students</button>
          <button className={btn} onClick={() => save(true)} disabled={!!err}>Clear</button>
          <Link className={btn} href="/welcome/" target="_blank">👀 Preview Welcome screen</Link>
          <span className="text-sm font-bold text-muted">{msg}</span>
        </div>
      </section>
      {q && (
        <section className="block-panel p-5">
          <h2 className="pixel-title mb-1 text-2xl">🗳 Today&apos;s Survey of the Day</h2>
          <p className="mb-3 text-sm text-muted">Automatic: question {q.n} of {qs.length} (a new one every day, from survey.json). Answers so far: {total}.</p>
          <div className="mb-3 font-extrabold">{q.question}</div>
          {q.options ? q.options.map((o) => {
            const n = counts?.[o] ?? 0, pct = total ? Math.round((n * 100) / total) : 0;
            return (
              <div key={o} className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                <div className="relative overflow-hidden rounded-lg border border-line px-3 py-1.5"><span className="absolute inset-y-0 left-0 bg-gold/25" style={{ width: `${pct}%` }} /><span className="relative font-semibold">{o}</span></div>
                <span className="w-20 text-right font-mono text-xs">{n} · {pct}%</span>
              </div>
            );
          }) : <p className="text-sm text-muted">Open-ended question: {total} answers.</p>}
          <button className={btn + " mt-2"} onClick={() => results("survey", `s${q.n}`).then(setCounts).catch(() => {})}>↻ Refresh results</button>
        </section>
      )}
      <section>
        <h2 className="pixel-title mb-3 text-2xl">🧰 Class tools</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[["/sub-guide/", "📝 Sub Guide", "Printable page for a substitute"], ["/timer/", "⏱ Station Timer", "Projector timer for lab stations"], ["/print-quest/", "🖨 Print Quest Sheet", "Every task on paper"]].map(([h, t, s]) => (
            <Link key={h} href={h} className="accent-card rounded-2xl p-4"><b className="block font-display text-lg">{t}</b><span className="text-sm text-muted">{s}</span></Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------- Suggestions ----------
function SuggestionsTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<SuggestionRow[] | null>(null);
  const [archived, setArchived] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => { teacherSuggestions(hash, archived).then(setRows).catch((e) => setErr(errText(e))); }, [hash, archived]);
  useEffect(() => { load(); }, [load]);
  const set = async (id: number, status: SuggestionRow["status"]) => { try { await teacherSuggestionSet(hash, id, status); load(); } catch (e) { alert(errText(e)); } };
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading suggestions…</p>;
  const cat = (k: string) => SUGGEST_CATS.find(([c]) => c === k)?.[1] ?? k;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="pixel-title text-2xl">💡 Suggestions ({rows.filter((r) => r.status === "new").length} new)</h2>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived</label>
        <button className={btn} onClick={load}>Refresh</button>
      </div>
      {!rows.length && <p className="font-bold text-muted">No suggestions yet. Students send them from the Suggest an Improvement page (footer).</p>}
      {rows.map((r) => (
        <div key={r.id} className={`block-panel p-4 ${r.status === "new" ? "" : "opacity-70"}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
            <span className="rounded bg-sky/15 px-1.5 py-0.5 uppercase tracking-wide text-sky">{cat(r.category)}</span>
            <span>{r.student ? `${r.student} (${r.period})` : r.name ? `${r.name} (not logged in)` : "Anonymous"}</span>
            {r.page && <span>· {r.page}</span>}<span>· {when(r.created_at)}</span>
            <span className="ml-auto uppercase">{r.status}</span>
          </div>
          <p className="mt-2 whitespace-pre-line">{r.message}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.status !== "done" && <button className={`${btn} btn-grass`} onClick={() => set(r.id, "done")}>✓ Done</button>}
            {r.status !== "new" && <button className={btn} onClick={() => set(r.id, "new")}>↩ Back to New</button>}
            {r.status !== "archived" && <button className={btn} onClick={() => set(r.id, "archived")}>🗄 Archive</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Visitors ----------
function VisitorsTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<VisitorTeacherRow[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { teacherVisitors(hash).then(setRows).catch((e) => setErr(errText(e))); }, [hash]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (r: VisitorTeacherRow) => {
    if (!r.removed && !confirm(`Remove ${r.name}'s visitor account? Their login stops working. (Nothing is deleted: you can restore it here, then set a new PIN on the roster.)`)) return;
    try { await teacherVisitorRemove(hash, r.id, !r.removed); load(); } catch (e) { alert(errText(e)); }
  };
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading visitors…</p>;
  return (
    <div>
      <h2 className="pixel-title mb-1 text-2xl">👋 Visitors ({rows.filter((r) => !r.removed).length} active)</h2>
      <p className="mb-3 text-sm text-muted">Past students and guests from the <Link href="/visitors/" className="underline">Visitors page</Link>. An account switches off by itself 90 days after the last visit. Visitors show on the roster under period &quot;Visitor&quot;.</p>
      {!rows.length ? <p className="font-bold text-muted">No visitor accounts yet.</p> : (
        <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[760px] text-sm">
          <thead><tr>{["Visitor", "Board name", "Joined", "Last visit", "Switches off", "Days", "Game XP", "Alien", ""].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className={r.removed ? "opacity-60" : ""}>
              <td className={TD + " font-bold"}>{r.name}</td><td className={TD}>{r.board_name}</td><td className={TD}>{when(r.joined)}</td><td className={TD}>{when(r.last_seen)}</td>
              <td className={TD}>{r.removed ? (r.removed_why === "expired" ? "Expired" : "Removed") : day(r.expires)}</td><td className={TD}>{r.days}</td><td className={TD}>{r.game_xp}</td><td className={TD}>{r.pet ? "🪨" : "—"}</td>
              <td className={TD}><button className={`${btn} ${r.removed ? "" : "!text-crimson"}`} onClick={() => toggle(r)}>{r.removed ? "Restore" : "Remove"}</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
