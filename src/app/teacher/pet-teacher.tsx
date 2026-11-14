"use client";
// ── wave-pet: Teacher → Aliens (Dopps Class sprite_admin + name approvals) ──
import { useEffect, useState } from "react";
import { petTeacherDelete, petTeacherList, petTeacherName, petTeacherNamesOk, type PetTeacherRow } from "@/lib/db";
import { stageInfo } from "@/data/pet";
import { Alien } from "@/components/alien";

export function AliensTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<PetTeacherRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [need, setNeed] = useState<boolean | null>(null);
  const load = () => Promise.all([petTeacherList(hash).then(setRows), petTeacherNamesOk(hash, null).then(setNeed)]).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [hash]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await load(); } catch (e) { alert((e as Error).message); } };
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading aliens…</p>;
  const pending = rows.filter((r) => !r.name_ok);
  return (
    <div className="space-y-6">
      <section className="block-panel flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">Name approval is {need ? "ON" : "OFF"}</div>
          <div className="text-sm text-muted">{need ? "New names and renames wait for you before classmates see them." : "Alien names show to the class right away. You can still rename or delete any alien below."}</div>
        </div>
        <button disabled={need === null} onClick={() => act(() => petTeacherNamesOk(hash, !need))} className={`btn-block !text-sm ${need ? "" : "btn-grass"}`}>
          {need ? "Turn approval off" : "Turn approval on"}
        </button>
      </section>
      <section>
        <h2 className="pixel-title mb-2 text-2xl">Names waiting for you ({pending.length})</h2>
        <p className="mb-3 text-sm text-muted">Only used while name approval is on. Deny puts back the last approved name (or “Geode”).</p>
        {pending.length === 0 ? <p className="font-bold text-muted">Nothing waiting.</p> : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.student} className="block-panel flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1"><b className="text-lg">“{r.name}”</b> <span className="text-sm text-muted">by {r.student_name} ({r.period}){r.approved_name ? ` · was “${r.approved_name}”` : ""}</span></div>
                <button onClick={() => act(() => petTeacherName(hash, r.student, "approve"))} className="btn-block btn-grass !text-sm">Approve</button>
                <button onClick={() => act(() => petTeacherName(hash, r.student, "deny"))} className="btn-block !text-sm">Deny</button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="mb-3 flex items-center gap-3"><h2 className="pixel-title text-2xl">Every alien ({rows.length})</h2><button onClick={load} className="btn-block !text-sm">Refresh</button></div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-white/[0.04] text-left"><tr><th className="p-2" /><th className="p-2">Alien</th><th className="p-2">Student</th><th className="p-2">Stage</th><th className="p-2">Health</th><th className="p-2">Care</th><th className="p-2">Gear</th><th className="p-2">Last care</th><th className="p-2" /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student} className="border-t border-line">
                  <td className="p-1"><Alien a={{ stage: r.stage, color: r.color, alive: r.alive }} size={40} anim={false} /></td>
                  <td className="p-2 font-extrabold">{r.name}{!r.name_ok && <span className="ml-1 text-xs text-amber">(pending)</span>}</td>
                  <td className="p-2">{r.student_name} <span className="text-muted">({r.period})</span></td>
                  <td className="p-2">{r.alive ? stageInfo(r.stage).name : "💤 Dormant"}</td>
                  <td className="p-2">{r.health}</td><td className="p-2">{r.care_points}</td><td className="p-2">{r.upgrades}</td>
                  <td className="p-2 text-xs text-muted">{new Date(r.last_care).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap p-2">
                    <button className="underline" onClick={() => { const n = prompt(`New name for ${r.student_name}'s alien?`, r.name); if (n) act(() => petTeacherName(hash, r.student, "rename", n)); }}>Rename</button>{" · "}
                    <button className="text-crimson underline" onClick={() => { if (confirm(`Delete ${r.student_name}'s alien “${r.name}”? They can adopt a new one; crystals from graded work carry over.`)) act(() => petTeacherDelete(hash, r.student)); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
// ── end wave-pet ──
