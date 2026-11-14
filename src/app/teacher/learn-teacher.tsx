"use client";

// ── wave-learnB: teacher views for Classwork and the Reflection Coach ──
// Every call is checked against the Dopps Class teacher code in the database (supabase/migrations/004).

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { chapterByRef, realms } from "@/data/site";
import { cwTeacherList, cwTeacherLive, cwTeacherReturn, teacherReflections, type CwTeacherRow } from "@/lib/db";

const when = (t?: string | null) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const label = (ref: number) => chapterByRef(ref)?.label ?? String(ref);
const btn = "btn-block !px-3 !py-1.5 !text-xs";

export function ClassworkTeacher({ hash }: { hash: string }) {
  const [realm, setRealm] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof cwTeacherList>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "draft" | "not_started">("all");
  const [period, setPeriod] = useState("all");
  const load = useCallback(async () => {
    try { setData(await cwTeacherList(hash, realm)); setErr(null); }
    catch (e) { setErr(`${(e as Error).message}. Has supabase/migrations/004_classwork_reflection.sql been run?`); }
  }, [hash, realm]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect -- async load
  const periods = useMemo(() => [...new Set((data?.rows ?? []).map((r) => r.period))], [data]);

  const tabs = (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {realms.map((r) => <button key={r.n} onClick={() => { setRealm(r.n); setOpen(null); setData(null); }} className={`${btn} ${realm === r.n ? "btn-grass" : ""}`}>Realm {r.n}</button>)}
    </div>
  );
  if (err) return <>{tabs}<p className="font-bold text-crimson">{err}</p></>;
  if (!data) return <>{tabs}<p className="font-bold text-muted">Loading classwork…</p></>;
  const inPeriod = data.rows.filter((r) => period === "all" || r.period === period);
  const rows = inPeriod.filter((r) => filter === "all" || r.status === filter);
  const n = (s: string) => inPeriod.filter((r) => r.status === s).length;
  const needAll = data.chapters.reduce((t, c) => t + (data.need[String(c)] ?? 3), 0);

  return (
    <div>
      <div className="block-panel mb-4 flex flex-wrap items-center gap-3 p-4">
        <b>{data.live ? "🟢 Classwork is open for every student" : "🔒 Hidden: students see “Coming soon”"}</b>
        <button className={btn} onClick={async () => {
          if (!confirm(data.live ? "Hide Classwork from students?" : "Open Classwork for every student?")) return;
          try { await cwTeacherLive(hash, !data.live); load(); } catch (e) { alert((e as Error).message); }
        }}>{data.live ? "Hide it" : "Open it for everyone"}</button>
        <span className="text-xs text-muted">Student page: /classwork/</span>
      </div>
      {tabs}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {([["all", `All ${inPeriod.length}`], ["submitted", `Turned in ${n("submitted")}`], ["draft", `Working ${n("draft")}`], ["not_started", `Not started ${n("not_started")}`]] as const).map(([k, l]) =>
          <button key={k} onClick={() => setFilter(k)} className={`${btn} ${filter === k ? "btn-grass" : ""}`}>{l}</button>)}
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-xl border border-line bg-ink px-3 py-1.5 text-sm font-bold">
          <option value="all">All periods</option>{periods.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button onClick={load} className={btn}>Refresh</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-fg/5 text-left"><tr>
            <th className="p-2">Student</th><th className="p-2">Period</th><th className="p-2">Learn avg</th><th className="p-2">Stories</th>
            <th className="p-2">Story avg</th><th className="p-2">Classwork</th><th className="p-2">Review Test</th><th className="p-2">Status</th><th className="p-2" />
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = data.chapters.reduce((t, c) => t + (r.ch_stories[String(c)] ?? []).filter(Boolean).length, 0);
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-line align-top">
                    <td className="p-2 font-extrabold">{r.name}</td><td className="p-2">{r.period}</td>
                    <td className="p-2">{r.status === "not_started" ? "—" : `${r.learn_avg ?? 0}%`}</td>
                    <td className="p-2">{r.status === "not_started" ? "—" : `${st}/${needAll}`}</td>
                    <td className="p-2">{r.story_avg == null ? "—" : `${r.story_avg}%`}</td>
                    <td className="p-2">{r.final_score == null ? "—" : <b>{r.final_score}%</b>}</td>
                    <td className="p-2">{r.unit_tries ? <>{r.unit_best}%<br /><small className="text-muted">{r.unit_tries} tries</small></> : "—"}</td>
                    <td className="p-2">{r.status === "submitted" ? <><b className="text-emerald">Turned in</b><br /><small className="text-muted">{when(r.submitted_at)}</small></>
                      : r.status === "draft" ? <b className="text-amber">Working</b> : <span className="text-muted">Not started</span>}</td>
                    <td className="p-2">{r.status !== "not_started" && <button className={btn} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Close" : "Read"}</button>}</td>
                  </tr>
                  {open === r.id && <tr><td colSpan={9} className="p-3"><Detail r={r} chapters={data.chapters} onReturn={async () => {
                    if (!confirm("Return this realm so the student can change it and turn it in again?")) return;
                    try { await cwTeacherReturn(hash, r.id, realm); load(); } catch (e) { alert((e as Error).message); }
                  }} /></td></tr>}
                </Fragment>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted">No students here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ r, chapters, onReturn }: { r: CwTeacherRow; chapters: number[]; onReturn: () => void }) {
  return (
    <div>
      {chapters.map((c) => {
        const ct = r.ch_test[String(c)];
        return (
          <div key={c} className="mb-3">
            <h4 className="font-extrabold">Chapter {label(c)} · Learn best {r.learn_best[String(c)] ?? 0}% (avg {r.learn_grade[String(c)] ?? 0}%, {r.learn_tries[String(c)] ?? 0} tries) · Chapter Test {ct ? `${ct.best}% (${ct.tries} tries)` : "—"}</h4>
            {(r.ch_stories[String(c)] ?? []).map((s, i) => !s ? <p key={i} className="text-sm"><b>Story {i + 1}:</b> <i className="text-muted">not written yet</i></p> : (
              <div key={i} className="my-1.5 rounded-lg border-l-4 border-gold bg-fg/5 px-3 py-2 text-sm">
                <b>Story {i + 1}</b> · {s.a} + {s.b} · <b>{s.score.total}/100</b> <small className="text-muted">(length {s.score.length}/40, words {s.score.used}/30, detail {s.score.detail}/30)</small>
                <p className="mt-1 whitespace-pre-wrap">{s.text}</p>
              </div>
            ))}
          </div>
        );
      })}
      {r.swapped.length > 0 && <p className="text-sm"><b>No-story swaps:</b> {r.swapped.map((x) => `${x.term} (Ch ${label(x.ref)}): “${x.reason}”`).join("; ")}</p>}
      {r.status === "submitted" && <button onClick={onReturn} className={`${btn} mt-2`}>Return for changes</button>}
    </div>
  );
}

type RefRow = Awaited<ReturnType<typeof teacherReflections>>[number];
type Draft = { title?: string; tone?: string; ans?: Record<string, { a?: string; skip?: boolean; fu?: { q: string; a?: string | null } }> };
const PARTS: [string, string][] = [["before", "Before"], ["story", "A real moment"], ["learned", "What I learned"], ["connect", "Where I see it"], ["ahead", "Looking ahead"]];

export function ReflectionsTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<RefRow[] | null>(null);
  const [ref, setRef] = useState<number | null>(null);
  const [full, setFull] = useState<RefRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { teacherReflections(hash).then(setRows).catch((e) => setErr(`${e.message}. Has supabase/migrations/004_classwork_reflection.sql been run?`)); }, [hash]);
  useEffect(() => { if (ref != null) teacherReflections(hash, ref).then(setFull).catch((e) => setErr(e.message)); }, [hash, ref]);
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading reflections…</p>;
  const byRef = new Map<number, RefRow[]>();
  for (const x of rows) byRef.set(x.ref, [...(byRef.get(x.ref) ?? []), x]);
  return (
    <div>
      <p className="mb-3 text-sm text-muted">Reflection Coach drafts saved by logged-in students (logged-out drafts stay in the student&apos;s browser). Pick a chapter to read them.</p>
      {rows.length === 0 && <p className="font-bold text-muted">No reflections saved yet.</p>}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[...byRef.keys()].sort((a, b) => a - b).map((r) => (
          <button key={r} onClick={() => { setRef(r); setFull(null); }} className={`${btn} ${ref === r ? "btn-grass" : ""}`}>
            Ch {label(r)} · {byRef.get(r)!.filter((x) => x.done).length}/{byRef.get(r)!.length} done
          </button>
        ))}
      </div>
      {ref != null && !full && <p className="font-bold text-muted">Loading…</p>}
      {full?.map((x) => {
        const d = (x.data ?? {}) as Draft;
        return (
          <details key={x.student} className="block-panel mb-3 p-4">
            <summary className="cursor-pointer font-extrabold">{x.name} <span className="font-semibold text-muted">({x.period}) · {x.words} words · {x.done ? "✓ done" : "in progress"} · {when(x.updated_at)}</span></summary>
            {d.title && <p className="mt-2 font-display text-lg font-extrabold">{d.title}</p>}
            {PARTS.map(([k, name]) => {
              const it = d.ans?.[k];
              if (!it) return null;
              return (
                <div key={k} className="mt-2 text-sm">
                  <b>{name}:</b> {it.skip && !it.a ? <i className="text-muted">skipped</i> : <span className="whitespace-pre-wrap">{it.a}</span>}
                  {it.fu?.a && <p className="mt-1 pl-4 text-muted"><i>{it.fu.q}</i> {it.fu.a}</p>}
                </div>
              );
            })}
          </details>
        );
      })}
    </div>
  );
}
// ── end wave-learnB ──
