"use client";
// ── wave-twinB: teacher views for Footprint Quest, Home Energy Budget and The Idaho Trail (migration 008) ──
// Twins of the Dopps Class Weight Control Quest summary + recipes_teacher.js, finance_teacher.js and the trail teacher card.
import { useEffect, useState } from "react";
import {
  ebTeacherImage, ebTeacherList, ebTeacherReturn, ebTeacherScore, fpTeacherBookAdd, fpTeacherGet, fpTeacherLearning, fpTeacherList, fpTeacherRemove,
  notInstalled, trailTeacherList, type EbTeacherRow, type FpTeacherLearning, type FpTeacherRow, type TrailTeacherRow,
} from "@/lib/twinB";
import * as EB from "@/app/energy-budget/calc";
import { CATS, ITEMS, title } from "@/app/footprint/book";

export type TwinTab = "footprint" | "energy" | "trail";
export const TWIN_TABS: [TwinTab, string][] = [["footprint", "Footprint Quest"], ["energy", "Energy Budget"], ["trail", "Idaho Trail"]];

const when = (s: string | null) => (s ? new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");
const TH = "border-b border-line px-2 py-1.5 text-left text-xs uppercase tracking-wide text-muted";
const TD = "border-b border-line px-2 py-1.5";
const btn = "btn-block !rounded-xl !px-3 !py-1.5 !text-sm";
const errText = (e: unknown, file = "supabase/migrations/008_twinsB.sql") => (notInstalled(e) ? `Needs the database update (${file}).` : (e as Error).message);

export function TwinTeacher({ hash, tab }: { hash: string; tab: TwinTab }) {
  return tab === "footprint" ? <FootprintTeacher hash={hash} /> : tab === "energy" ? <EnergyTeacher hash={hash} /> : <TrailTeacher hash={hash} />;
}

// ---------- Footprint Quest ----------
function FootprintTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<FpTeacherRow[] | null>(null);
  const [L, setL] = useState<FpTeacherLearning | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; data: Record<string, unknown> | null } | null>(null);
  const [nm, setNm] = useState(""); const [ings, setIngs] = useState(""); const [msg, setMsg] = useState("");
  useEffect(() => {
    fpTeacherList(hash).then(setRows).catch((e) => setErr(errText(e)));
    fpTeacherLearning(hash).then(setL).catch(() => {});
  }, [hash]);
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading Footprint Quest…</p>;
  const view = async (id: string) => { try { setOpen({ id, data: await fpTeacherGet(hash, id) }); } catch (e) { alert((e as Error).message); } };
  const remove = async (kind: "item" | "swap" | "book", n: string) => { if (!confirm("Remove this from the Swap Shop?")) return; try { setL(await fpTeacherRemove(hash, kind, n)); } catch (e) { alert((e as Error).message); } };
  const add = async () => {
    // "shower 0.5, faucet 0.25" -> [["shower", 0.5], ["faucet", 0.25]]
    const parts = ings.split(",").map((x) => x.trim().split(/\s+/)).filter((x) => x.length === 2 && ITEMS[x[0]] && +x[1] > 0).map((x) => [x[0], +x[1]] as [string, number]);
    if (!parts.length) { setMsg("Use item keys from the list below, like: shower 0.5, faucet 0.25"); return; }
    try { setL(await fpTeacherBookAdd(hash, nm, parts)); setNm(""); setIngs(""); setMsg("Added. Every student whose list has those items can use it now."); } catch (e) { setMsg((e as Error).message); }
  };
  const d = open?.data as { items?: { name: string; type: string }[]; group?: string; town?: string; quiz?: { best: number; tries: number }; bal?: { tries: number; log: { co2: number; need: number; pct: number; ok: boolean }[] }; body?: Record<string, string> } | null;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="pixel-title mb-2 text-2xl">Footprint Quest ({rows.filter((r) => r.updated_at).length} started · {rows.filter((r) => r.submitted).length} turned in)</h2>
        <p className="mb-3 text-sm text-muted">Stage = steps done out of 6 (list, meters, 3-day log, top 5, goal check, test). Tries = times the goal check sent a student back to change their log.</p>
        <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-sm"><thead><tr>{["Student", "Period", "Group", "Stage", "Turned in", "Tries", "Test", "Updated", ""].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td className={TD + " font-bold"}>{r.name}</td><td className={TD}>{r.period}</td><td className={TD}>{r.group}</td><td className={TD}>{r.stage} / 6</td><td className={TD}>{r.submitted ? "✓ " + when(r.submitted_at) : "—"}</td><td className={TD}>{r.tries ?? "—"}</td><td className={TD}>{r.test == null ? "—" : r.test + " / 8"}</td><td className={TD}>{when(r.updated_at)}</td>
            <td className={TD}>{r.updated_at && <button className={btn} onClick={() => view(r.id)}>View</button>}</td></tr>)}</tbody></table></div>
        {open && (
          <div className="block-panel mt-3 p-4 text-sm">
            <div className="flex justify-between gap-2"><b>{rows.find((r) => r.id === open.id)?.name}</b><button className={btn} onClick={() => setOpen(null)}>Close</button></div>
            {!d ? <p className="text-muted">Nothing saved yet.</p> : <>
              <p className="mt-1">Group: {d.group || "—"} · Town: {d.town || "—"} · Test best {d.quiz?.best ?? 0}/8 ({d.quiz?.tries ?? 0} tries) · Goal tries {d.bal?.tries ?? 0}</p>
              <p className="mt-1"><b>15 uses:</b> {(d.items || []).filter((x) => x.name).map((x) => `${x.name} (${x.type === "H" ? "hidden" : "direct"})`).join(", ") || "—"}</p>
              {d.body && <p className="mt-1"><b>Bills:</b> {d.body.people} people · {d.body.kwh} kWh · {d.body.therms || 0} therms · {d.body.miles || 0} mi/week at {d.body.mpg} mpg · goal {Math.round(+d.body.goal * 100) || "—"}%</p>}
              {(d.bal?.log || []).length > 0 && <p className="mt-1"><b>Goal check log:</b> {d.bal!.log.map((x) => `${x.co2} lb vs ${x.need} lb ${x.ok ? "✓" : "✗"}`).join(" · ")}</p>}
            </>}
          </div>
        )}
      </section>
      <section>
        <h2 className="pixel-title mb-2 text-2xl">Swap Shop</h2>
        <p className="mb-3 text-sm text-muted">The Swap Shop learns on its own: items students taught it (most votes wins) and swaps students made (shared with everyone once 2 students make the same one). Remove anything that doesn&apos;t belong, or add your own swaps.</p>
        {!L ? <p className="text-sm text-muted">Loading…</p> : <>
          <h3 className="mb-1 mt-3 font-bold">New items students taught it ({L.items.length})</h3>
          {L.items.length ? L.items.map((f) => <div key={f.n} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm"><span><b>{f.name}</b> → {CATS[f.cat] || f.cat} <span className="text-muted">({Object.entries(f.votes || {}).map(([c, n]) => `${CATS[c] || c} ${n}`).join(" · ")})</span></span><button className={btn + " !text-crimson"} onClick={() => remove("item", f.n)}>Remove</button></div>) : <p className="text-sm text-muted">None yet.</p>}
          <h3 className="mb-1 mt-4 font-bold">Swaps students made ({L.swaps.length})</h3>
          {L.swaps.length ? L.swaps.map((s) => <div key={s.n} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm"><span><b>{s.name}</b>: {s.ings.map((e) => (String(e[0]).startsWith("x:") ? title(String(e[0]).slice(2)) : ITEMS[e[0]]?.[0] ?? e[0]) + " ×" + e[1]).join(", ")} <span className={s.makers >= 2 ? "text-emerald" : "text-muted"}>· {s.makers} student{s.makers === 1 ? "" : "s"}{s.makers >= 2 ? " · shared with everyone" : " · waiting for a 2nd student"}</span></span><button className={btn + " !text-crimson"} onClick={() => remove("swap", s.n)}>Remove</button></div>) : <p className="text-sm text-muted">None yet.</p>}
          <h3 className="mb-1 mt-4 font-bold">Your swaps ({L.book.length})</h3>
          {L.book.map((b) => <div key={b.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm"><span><b>{b.name}</b>: {b.ings.map((e) => (ITEMS[e[0]]?.[0] ?? e[0]) + " ×" + e[1]).join(", ")}</span><button className={btn + " !text-crimson"} onClick={() => remove("book", b.id)}>Remove</button></div>)}
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <input className="rounded-xl border border-line bg-ink px-3 py-2" placeholder="Swap name (e.g. Rain-barrel garden)" value={nm} onChange={(e) => setNm(e.target.value)} />
            <input className="rounded-xl border border-line bg-ink px-3 py-2" placeholder="Items and amounts: lawn 0.5, faucet 0.1" value={ings} onChange={(e) => setIngs(e.target.value)} />
            <button className={btn + " btn-grass"} onClick={add}>Add swap</button>
          </div>
          {msg && <p className="mt-1 text-sm font-bold">{msg}</p>}
          <p className="mt-2 text-xs text-muted">Item keys: {Object.keys(ITEMS).join(", ")}. Amounts are in each student&apos;s own units (0.5 = half of one use).</p>
        </>}
      </section>
    </div>
  );
}

// ---------- Home Energy Budget ----------
function EnergyTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<EbTeacherRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [sc, setSc] = useState<Record<string, string>>({}); const [note, setNote] = useState(""); const [msg, setMsg] = useState("");
  const load = () => ebTeacherList(hash).then(setRows).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); }, [hash]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading Home Energy Budgets…</p>;
  const r = rows.find((x) => x.id === sel);
  const open = (x: EbTeacherRow) => {
    setSel(x.id); setImg(null); setMsg("");
    const sug = EB.suggestScores((x.data || {}) as EB.Draft, { hasImage: x.has_image, submitted: x.status === "submitted" });
    const cur = x.scores || {};
    setSc(Object.fromEntries(EB.RUBRIC.map(([k]) => [k, cur[k] != null ? String(cur[k]) : sug[k as keyof typeof sug] != null ? String(sug[k as keyof typeof sug]) : ""])));
    setNote(x.teacher_note || "");
    if (x.has_image) ebTeacherImage(hash, x.id).then(setImg).catch(() => {});
  };
  const saveScores = async () => {
    if (!r) return;
    const clean: Record<string, number | null> = {};
    EB.RUBRIC.forEach(([k]) => { clean[k] = sc[k] === "" || sc[k] == null ? null : +sc[k]; });
    try { await ebTeacherScore(hash, r.id, clean, note); setMsg("Saved ✓"); load(); } catch (e) { setMsg((e as Error).message); }
  };
  const ret = async () => { if (!r || !confirm("Return this plan so the student can change it and submit again?")) return; try { await ebTeacherReturn(hash, r.id); setMsg("Returned ✓"); load(); } catch (e) { setMsg((e as Error).message); } };
  const d = (r?.data || {}) as EB.Draft;
  const cmp = EB.compare(d.predicted, d.research?.values as Record<string, unknown>);
  const pl = r ? EB.plan({ home: d.home || {}, values: d.research?.values as Record<string, unknown>, grid: d.grid || {}, ups: d.ups || {} }) : null;
  const total = EB.RUBRIC.reduce((a, [k]) => a + (+sc[k] || 0), 0);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="pixel-title mb-2 text-2xl">Home Energy Budget ({rows.filter((x) => x.status === "submitted").length} submitted · {rows.filter((x) => x.status === "draft").length} working)</h2>
        <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-sm"><thead><tr>{["Student", "Period", "Status", "Estimates", "Home", "Score", "Updated", ""].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((x) => { const s = x.scores; const t = s ? EB.RUBRIC.reduce((a, [k]) => a + (s[k] ?? 0), 0) : null; const h = (x.data as EB.Draft | null)?.home; return (
            <tr key={x.id} className={x.id === sel ? "bg-gold/10" : ""}><td className={TD + " font-bold"}>{x.name}</td><td className={TD}>{x.period}</td>
              <td className={TD}>{x.status === "submitted" ? "✓ Submitted " + when(x.submitted_at) : x.status === "draft" ? "Working" + (x.returned_at ? " (returned)" : "") : "Not started"}</td>
              <td className={TD}>{x.pred_locked_at ? "🔒 locked" : "—"}</td><td className={TD}>{h ? `${h.type || ""} ${h.place ? "· " + h.place : ""}` : "—"}</td>
              <td className={TD}>{t == null ? "—" : t + " / 100"}</td><td className={TD}>{when(x.updated_at)}</td>
              <td className={TD}>{x.status !== "not_started" && <button className={btn} onClick={() => open(x)}>Grade</button>}</td></tr>); })}</tbody></table></div>
      </section>
      {r && pl && (
        <section className="block-panel p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-xl font-extrabold">{r.name} · {r.period}</h3><button className={btn} onClick={() => setSel(null)}>Close</button></div>
          <p className="mt-1">Home: {d.home?.type || "—"} in {d.home?.place || "—"} · {EB.num(d.home?.people)} people · budget {usd(EB.num(d.home?.budget))}/mo ({d.home?.budgetSource || "—"}{d.home?.budgetUrl ? <> · <a className="text-sky underline" href={d.home.budgetUrl} target="_blank" rel="noopener noreferrer">source</a></> : null}) · {EB.num(d.home?.elec)}¢/kWh</p>
          <div className="mt-2 overflow-x-auto"><table className="w-full"><thead><tr>{["Category", "Estimate", "Researched", "Diff", "Source"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>{cmp.rows.map((x) => { const v = d.research?.values?.[x.key]; return <tr key={x.key}><td className={TD}>{x.label}</td><td className={TD}>{usd(x.predicted)}</td><td className={TD}>{usd(x.researched)}</td><td className={TD}>{x.diff > 0 ? "+" : ""}{usd(x.diff)}</td><td className={TD}>{v?.src === "own" ? "Own: " + (v.note || "") : "Bill/label/calculator"}</td></tr>; })}
              <tr className="font-bold"><td className={TD}>Monthly</td><td className={TD}>{usd(cmp.predictedMonthly)}</td><td className={TD}>{usd(cmp.researchedMonthly)}</td><td className={TD}>{usd(cmp.diffMonthly)}</td><td className={TD} /></tr></tbody></table></div>
          <p className="mt-2">Research: {d.research?.location || "—"} · {d.research?.household || "—"} · {d.research?.url ? <a className="break-all text-sky underline" href={d.research.url} target="_blank" rel="noopener noreferrer">{d.research.url}</a> : "no source"}</p>
          <p className="mt-1">Upgrades: {pl.on.length ? pl.on.map((u) => `${u.label} (${usd(u.total)}, ${u.payback == null ? "no payback" : u.payback.toFixed(1) + " yr"})`).join("; ") : "none"} · bills after {usd(pl.after)}/mo · {pl.meter.label} · CO₂ {Math.round(pl.before.lbYear).toLocaleString()} → {Math.round(pl.afterC.lbYear).toLocaleString()} lb/yr</p>
          {img && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={img} alt="Evidence screenshot" className="mt-2 max-h-72 rounded-lg border border-line" /></>}
          <h4 className="mt-3 font-bold">Reflection ({EB.sentences(d.reflection).meaningful} sentences · {EB.reflectionQuality(d).words} words)</h4>
          <div className="mt-1 whitespace-pre-wrap rounded-lg border border-line bg-fg/[0.03] p-2.5">{d.reflection || "—"}</div>
          <h4 className="mt-3 font-bold">Rubric (suggested points filled in; reflection is yours to score)</h4>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {EB.RUBRIC.map(([k, l, m]) => <label key={k} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2 py-1.5"><span>{l} <span className="text-muted">/ {m}</span></span>
              <input type="number" min={0} max={m} value={sc[k] ?? ""} onChange={(e) => setSc({ ...sc, [k]: e.target.value })} className="w-16 rounded-md border border-line bg-ink px-1.5 py-0.5" /></label>)}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Note to the student (they see it after you save)" className="mt-2 w-full rounded-lg border border-line bg-ink p-2" />
          <div className="mt-2 flex flex-wrap items-center gap-2"><b>Total {total} / 100</b><button className={btn + " btn-grass"} onClick={saveScores}>Save score</button>{r.status === "submitted" && <button className={btn} onClick={ret}>Return to student</button>}{msg && <span className="font-bold">{msg}</span>}</div>
        </section>
      )}
    </div>
  );
}

// ---------- The Idaho Trail ----------
function TrailTeacher({ hash }: { hash: string }) {
  const [rows, setRows] = useState<TrailTeacherRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { trailTeacherList(hash).then(setRows).catch((e) => setErr(errText(e))); }, [hash]);
  if (err) return <p className="font-bold text-crimson">{err}</p>;
  if (!rows) return <p className="font-bold text-muted">Loading the Idaho Trail…</p>;
  return (
    <section>
      <h2 className="pixel-title mb-2 text-2xl">The Idaho Trail ({rows.length} travelers · {rows.reduce((a, r) => a + r.finished, 0)} finishes this term)</h2>
      <p className="mb-3 text-sm text-muted">Each student can travel 200 miles per day (Denver time); the database enforces it, and starting over never resets it. 1,200 miles to finish.</p>
      {rows.length === 0 ? <p className="font-bold text-muted">Nobody has hit the trail yet.</p> : (
        <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full text-sm"><thead><tr>{["Student", "Period", "On the trail now", "Today", "Journeys", "Finishes", "Best score", "Last played"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td className={TD + " font-bold"}>{r.name}</td><td className={TD}>{r.period}</td><td className={TD}>{r.miles == null ? "—" : `mile ${r.miles} · day ${r.day ?? "?"}`}</td><td className={TD}>{r.today} / 200 mi</td><td className={TD}>{r.runs}</td><td className={TD}>{r.finished}</td><td className={TD}>{r.best ?? "—"}</td><td className={TD}>{when(r.last)}</td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}
// ── end wave-twinB ──
