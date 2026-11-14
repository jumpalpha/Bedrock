"use client";
// ── wave-twinA: Teacher → Be Ready (Quake Ready progress + drill check-off, Hazard PSA scoring + member reflections) ──
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { teacherProjectDrill, teacherProjects, teacherPsaGrade, teacherPsaList, type ProjectTeacherRow, type Psa, type PsaScores } from "@/lib/db";
import { RUBRIC } from "@/app/hazard-psa/psa-data";

const STEPS: [string, string][] = [["protect", "Protect"], ["spot", "Spot"], ["hold", "Hold"], ["after", "After"], ["quiz", "Check"]];
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "–");

export function BeReadyTeacher({ hash }: { hash: string }) {
  const [tab, setTab] = useState<"quake" | "psa">("quake");
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => setTab("quake")} className={`btn-block !text-sm ${tab === "quake" ? "btn-grass" : ""}`}>🌎 Quake Ready</button>
        <button onClick={() => setTab("psa")} className={`btn-block !text-sm ${tab === "psa" ? "btn-grass" : ""}`}>🎬 Hazard PSA</button>
        <Link href="/disaster-plan/" className="btn-block !text-sm">🏠 Family Disaster Plan (paper only)</Link>
      </div>
      {tab === "quake" ? <QuakeTeacher hash={hash} /> : <PsaTeacher hash={hash} />}
    </div>
  );
}

function QuakeTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<ProjectTeacherRow[] | null>(null);
  const [period, setPeriod] = useState("all");
  const [err, setErr] = useState<string | null>(null);
  const load = () => teacherProjects(hash, "quake_ready").then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [hash]); // eslint-disable-line react-hooks/exhaustive-deps
  const periods = useMemo(() => [...new Set((rows ?? []).map((r) => r.period))], [rows]);
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading Quake Ready…</p>;
  const list = rows.filter((r) => period === "all" || r.period === period);
  const drill = async (r: ProjectTeacherRow, ok: boolean) => {
    setRows((rs) => rs!.map((x) => (x.student === r.student ? { ...x, drill_ok: ok } : x)));
    try { await teacherProjectDrill(hash, r.student, ok); } catch (e) { alert((e as Error).message); load(); }
  };
  return (
    <div>
      <p className="mb-3 text-sm text-muted">The quick check finishes the online quest. Run the drill in class with the <Link href="/quake-ready/checkoff/" className="font-bold text-gold underline">paper check-off sheet</Link>, then tick &ldquo;Drill ✓&rdquo; here for each student who passed. Students see it on their Quake Ready page. Projector timer: <Link href="/quake-ready/?class=1" className="font-bold text-gold underline">Class drill timer</Link>.</p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-xl border border-line bg-ink px-3 py-2 font-bold">
          <option value="all">All periods ({rows.length})</option>{periods.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button onClick={load} className="btn-block !text-sm">Refresh</button>
        <span className="text-sm font-bold text-muted">{list.filter((r) => r.done_at).length} finished · {list.filter((r) => r.drill_ok).length} drills checked off</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-white/[0.04] text-left"><tr><th className="p-2">Student</th><th className="p-2">Period</th>{STEPS.map(([, t]) => <th key={t} className="p-2 text-center">{t}</th>)}<th className="p-2">Finished</th><th className="p-2">Drill ✓</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.student} className="border-t border-line">
                <td className="p-2 font-extrabold">{r.name}</td><td className="p-2">{r.period}</td>
                {STEPS.map(([k]) => <td key={k} className="p-2 text-center">{r.data?.[k] ? <span className="text-emerald">✓</span> : <span className="text-muted">·</span>}</td>)}
                <td className="p-2">{day(r.done_at)}</td>
                <td className="p-2"><label className="inline-flex items-center gap-2 font-bold"><input type="checkbox" checked={r.drill_ok} onChange={(e) => drill(r, e.target.checked)} className="size-4" aria-label={`Drill checked off for ${r.name}`} />{r.drill_ok ? day(r.drill_at) : ""}</label></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type PsaRow = Psa & { student: string; name: string; period: string };
function PsaTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<PsaRow[] | null>(null);
  const [refl, setRefl] = useState<ProjectTeacherRow[]>([]);
  const [allTerms, setAllTerms] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => {
    teacherPsaList(hash, allTerms ? "all" : undefined).then(setRows).catch((e) => setErr(e.message));
    teacherProjects(hash, "hazard_psa").then((r) => setRefl(r.filter((x) => x.data))).catch(() => {});
  };
  useEffect(() => { load(); }, [hash, allTerms]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading PSAs…</p>;
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="pixel-title text-2xl">PSAs turned in ({rows.length})</h2>
          <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={allTerms} onChange={(e) => setAllTerms(e.target.checked)} /> All terms</label>
          <button onClick={load} className="btn-block !text-sm">Refresh</button>
        </div>
        {rows.length === 0 && <p className="font-bold text-muted">No PSAs turned in yet.</p>}
        <div className="space-y-3">{rows.map((p) => <PsaCard key={p.id} p={p} hash={hash} onSaved={load} />)}</div>
      </section>
      <section>
        <h2 className="pixel-title mb-3 text-2xl">Member reflections ({refl.length})</h2>
        {refl.length === 0 ? <p className="font-bold text-muted">None yet.</p> : (
          <div className="space-y-2">
            {refl.map((r) => {
              const d = r.data as { group?: string; title?: string; contribution?: string; learned?: string };
              return (
                <details key={r.student} className="block-panel p-3">
                  <summary className="cursor-pointer font-extrabold">{r.name} <span className="font-semibold text-muted">({r.period}) · {d.group || "no group"}{d.title ? ` · ${d.title}` : ""} · {r.done_at ? "turned in" : "draft"}</span></summary>
                  <p className="mt-2 text-sm"><b>Contributed:</b> {d.contribution || "–"}</p>
                  <p className="mt-1 text-sm"><b>Learned:</b> {d.learned || "–"}</p>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function PsaCard({ p, hash, onSaved }: { p: PsaRow; hash: string; onSaved: () => void }) {
  const [s, setS] = useState<Record<string, string>>(() => Object.fromEntries(RUBRIC.map(([k]) => [k, p.scores ? String(p.scores[k]) : ""])));
  const [note, setNote] = useState(p.note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const total = RUBRIC.reduce((t, [k]) => t + (Number(s[k]) || 0), 0);
  const save = async (reopen = false) => {
    setBusy(true); setMsg(null);
    try {
      await teacherPsaGrade(hash, p.id, reopen ? null : (Object.fromEntries(RUBRIC.map(([k]) => [k, Number(s[k])])) as PsaScores), note);
      setMsg(reopen ? "Reopened: the group can edit it again." : "Saved."); onSaved();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="block-panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div><b className="text-lg">{p.title}</b> <span className="text-sm text-muted">by {p.group_name} · {p.hazard}{p.length_sec ? ` · ${p.length_sec} s` : ""} · turned in by {p.name} ({p.period}) · {p.term}</span></div>
        <a href={p.link} target="_blank" rel="noopener noreferrer" className="btn-block btn-grass !text-sm">▶ Watch</a>
      </div>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <p><b>Roster:</b> {p.roster}</p>
        <p><b>On camera:</b> {p.on_camera ? "✓ everyone" : "✗ not confirmed"} · <b>Source:</b> {p.source || "–"}</p>
        <p><b>AI tools:</b> {p.ai_tools || "–"}</p>
        <p><b>Contributions:</b> {p.contributions || "–"}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {RUBRIC.map(([k, t, max]) => (
          <label key={k} className="text-xs font-extrabold">{t} <span className="text-muted">/ {max}</span>
            <input type="number" min={0} max={max} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-ink px-2 py-1.5 text-base font-bold" />
          </label>
        ))}
      </div>
      <label className="mt-2 block text-xs font-extrabold">Note to the group<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-ink px-2 py-1.5 text-sm" /></label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={() => save()} className="btn-block btn-grass !text-sm disabled:opacity-50">Save score · {total} / 100</button>
        {p.graded_at && <button disabled={busy} onClick={() => save(true)} className="btn-block !text-sm">Reopen</button>}
        <span className="text-sm font-bold text-muted">{p.graded_at ? `Scored ${day(p.graded_at)}: ${p.total} / 100` : "Not scored yet"}</span>
        {msg && <span className="text-sm font-bold">{msg}</span>}
      </div>
    </div>
  );
}
// ── end wave-twinA ──
