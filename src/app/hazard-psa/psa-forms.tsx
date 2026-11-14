"use client";
// ── wave-twinA ── Hazard PSA: the group's turn-in (b_psa_submit) and each member's own reflection (b_project_save 'hazard_psa').
// Dopps Class sent groups to a Google Form; here the video link and the roster go straight to Mr. Dopp's dashboard.
import { useEffect, useState } from "react";
import { dbReady, psaMine, psaSubmit, useStudent, type Psa, type PsaInput } from "@/lib/db";
import { useProjectSave } from "@/lib/twinA-save";

import { HAZARDS, RUBRIC } from "./psa-data";

const inp = "mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-[15px] font-semibold";
const lbl = "block text-sm font-extrabold";
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function Gate({ children }: { children: React.ReactNode }) {
  const { student, ready } = useStudent();
  if (!ready) return null;
  if (!dbReady) return <p className="rounded-xl border border-amber/50 bg-amber/10 p-3 text-sm font-bold">Preview: turning in opens once the class database is connected.</p>;
  if (!student) return <p className="rounded-xl border border-gold/50 bg-gold/10 p-3 text-sm font-bold">Log in (top right) to turn in your group&apos;s PSA and your own reflection.</p>;
  return <>{children}</>;
}

export function PsaSubmit() {
  return <Gate><SubmitForm /></Gate>;
}

const EMPTY: PsaInput = { group_name: "", title: "", hazard: "", link: "", length_sec: "", roster: "", ai_tools: "", contributions: "", on_camera: false, source: "" };

function SubmitForm() {
  const [mine, setMine] = useState<Psa | null | undefined>(undefined);
  const [f, setF] = useState<PsaInput>(EMPTY);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    psaMine().then((p) => {
      setMine(p);
      if (p) setF({ group_name: p.group_name, title: p.title, hazard: p.hazard, link: p.link, length_sec: p.length_sec ? String(p.length_sec) : "", roster: p.roster,
        ai_tools: p.ai_tools ?? "", contributions: p.contributions ?? "", on_camera: p.on_camera, source: p.source ?? "" });
    }).catch((e) => { setErr((e as Error).message); setMine(null); });
  }, []);
  const set = (k: keyof PsaInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((o) => ({ ...o, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { const p = await psaSubmit(f); setMine(p); setEdit(false); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  if (mine === undefined) return <p className="text-sm font-bold text-muted">Loading…</p>;

  if (mine && !edit) return (
    <div className="rounded-2xl border border-line bg-white/[0.03] p-4">
      <p className="font-extrabold">{mine.graded_at ? "✅ Scored by Mr. Dopp" : "📬 Turned in · waiting for Mr. Dopp"}</p>
      <p className="mt-1 text-sm"><b>{mine.title}</b> by {mine.group_name} · {mine.hazard}{mine.length_sec ? ` · ${mine.length_sec} s` : ""} · <a href={mine.link} target="_blank" rel="noopener noreferrer" className="font-bold text-gold underline">watch</a></p>
      {mine.graded_at && mine.scores && (
        <div className="mt-3">
          <table className="pj-table"><tbody>
            {RUBRIC.map(([k, t, max]) => <tr key={k}><td>{t}</td><td className="pts">{mine.scores![k]} / {max}</td></tr>)}
            <tr className="total"><td>Total</td><td className="pts">{mine.total} / 100</td></tr>
          </tbody></table>
          {mine.note && <p className="mt-2 rounded-xl border border-gold/40 bg-gold/10 p-2.5 text-sm font-semibold">Mr. Dopp: {mine.note}</p>}
        </div>
      )}
      {!mine.graded_at && <button type="button" onClick={() => setEdit(true)} className="btn-block mt-3 !text-sm">Edit what we turned in</button>}
    </div>
  );

  return (
    <form onSubmit={send} className="grid gap-3 rounded-2xl border border-line bg-white/[0.03] p-4 sm:grid-cols-2">
      <label className={lbl}>Group name<input required maxLength={80} value={f.group_name} onChange={set("group_name")} className={inp} /></label>
      <label className={lbl}>PSA title<input required maxLength={120} value={f.title} onChange={set("title")} className={inp} /></label>
      <label className={lbl}>Hazard
        <select required value={f.hazard} onChange={set("hazard")} className={inp}><option value="">Pick one…</option>{HAZARDS.map((h) => <option key={h}>{h}</option>)}</select>
      </label>
      <label className={lbl}>Length (seconds)<input inputMode="numeric" pattern="\d{1,4}" maxLength={4} value={f.length_sec} onChange={set("length_sec")} placeholder="e.g. 95" className={inp} /></label>
      <label className={`${lbl} sm:col-span-2`}>Video link (Google Drive shared with Mr. Dopp, or YouTube)<input required type="url" pattern="https://.*" maxLength={500} value={f.link} onChange={set("link")} placeholder="https://…" className={inp} /></label>
      <label className={`${lbl} sm:col-span-2`}>Group roster: every member and their role(s)<textarea required rows={3} maxLength={2000} value={f.roster} onChange={set("roster")} placeholder="First names only, e.g. Maya: director, actor · Leo: editor, actor" className={inp} /></label>
      <label className={lbl}>AI tools you used, and for what<textarea rows={3} maxLength={2000} value={f.ai_tools} onChange={set("ai_tools")} placeholder="None, or e.g. a chatbot for 10 ideas, an AI voice for the narrator" className={inp} /></label>
      <label className={lbl}>What each member contributed<textarea rows={3} maxLength={3000} value={f.contributions} onChange={set("contributions")} className={inp} /></label>
      <label className={`${lbl} sm:col-span-2`}>Where your facts came from (agency + page)<input maxLength={300} value={f.source} onChange={set("source")} placeholder="e.g. Ready.gov Earthquakes, USGS, National Weather Service" className={inp} /></label>
      <label className="flex items-start gap-2 text-sm font-extrabold sm:col-span-2"><input type="checkbox" checked={f.on_camera} onChange={set("on_camera")} className="mt-1 size-4" /> Every member appears on camera with their real face clearly visible.</label>
      {err && <p className="text-sm font-bold text-crimson sm:col-span-2">{err}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button disabled={busy || !f.on_camera} className="btn-block btn-grass disabled:opacity-50">{busy ? "Turning in…" : mine ? "Save changes" : "⬆ Turn in our PSA"}</button>
        {mine && <button type="button" onClick={() => setEdit(false)} className="btn-block">Cancel</button>}
      </div>
      {!f.on_camera && <p className="text-xs font-bold text-muted sm:col-span-2">Check the on-camera box to turn it in. Everyone has to appear.</p>}
    </form>
  );
}

type R = { group: string; title: string; contribution: string; learned: string };
export function PsaReflection() {
  return <Gate><ReflectionForm /></Gate>;
}
function ReflectionForm() {
  const { data, save, row, loaded } = useProjectSave<R>("hazard_psa", { group: "", title: "", contribution: "", learned: "" });
  const [f, setF] = useState<R>(data);
  const [msg, setMsg] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- copy the saved answer into the form once it loads
  useEffect(() => { if (loaded) setF(data); }, [loaded]);
  const ok = words(f.contribution) >= 15 && words(f.learned) >= 15;
  if (!loaded) return <p className="text-sm font-bold text-muted">Loading…</p>;
  return (
    <form className="grid gap-3 rounded-2xl border border-line bg-white/[0.03] p-4" onSubmit={async (e) => { e.preventDefault(); const r = await save(f, ok); setMsg(r === "cloud" ? (ok ? "✓ Saved and turned in." : "✓ Draft saved.") : "Saved on this device only."); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>Group name<input maxLength={80} value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} className={inp} /></label>
        <label className={lbl}>PSA title<input maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inp} /></label>
      </div>
      <label className={lbl}>What did you contribute to this project? <span className="font-semibold text-muted">({words(f.contribution)} words, 15+)</span>
        <textarea rows={4} maxLength={4000} value={f.contribution} onChange={(e) => setF({ ...f, contribution: e.target.value })} className={inp} /></label>
      <label className={lbl}>What did you learn, about the hazard and about making a PSA? <span className="font-semibold text-muted">({words(f.learned)} words, 15+)</span>
        <textarea rows={4} maxLength={4000} value={f.learned} onChange={(e) => setF({ ...f, learned: e.target.value })} className={inp} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-block btn-grass">{ok ? "Save & turn in my answer" : "Save draft"}</button>
        {(msg || row?.done_at) && <span className="text-sm font-extrabold text-emerald">{msg ?? "✓ Turned in."}</span>}
      </div>
    </form>
  );
}
