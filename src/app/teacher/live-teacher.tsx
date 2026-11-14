"use client";

// ── wave-live ── teacher views: Ask Mr. Dopp inbox and Live games (hosting links + sub codes).
// Every call is checked against the Dopps Class teacher code in the database (supabase/migrations/006_live.sql).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { askTeacherDelete, askTeacherList, askTeacherSet, subCreate, subList, subRevoke, type AskRow, type AskStatus, type SubCode } from "@/lib/live";

const btn = "btn-block !px-3 !py-1.5 !text-xs";
const LABEL: Record<AskStatus, string> = { new: "🆕 New", posted: "📌 Posted to class", in_class: "🗣 Answered in class", skipped: "⏭ Skipped" };
const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function AskTeacher({ hash }: { hash: string }) {
  const [Q, setQ] = useState<AskRow[] | null>(null);
  const [view, setView] = useState<AskStatus | "all">("new");
  const [err, setErr] = useState("");
  const [edits, setEdits] = useState<Record<string, { body: string; answer: string }>>({});
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setQ(await askTeacherList(hash)); setErr(""); }
    catch (e) { setErr(`${(e as Error).message}. Has supabase/migrations/006_live.sql been run?`); }
  }, [hash]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect -- async load

  const val = (q: AskRow) => edits[q.id] ?? { body: q.body, answer: q.answer ?? "" };
  const act = async (q: AskRow, what: AskStatus | "delete") => {
    setErr("");
    try {
      if (what === "delete") {
        if (confirmDel !== q.id) { setConfirmDel(q.id); return; }
        setQ(await askTeacherDelete(hash, q.id)); setConfirmDel(null);
      } else {
        const v = val(q);
        if (what === "posted" && !v.answer.trim()) { setErr("Write an answer first. Students will see the question and your answer."); return; }
        setQ(await askTeacherSet(hash, q.id, v.answer.trim(), what, v.body));
      }
      setEdits((e) => { const n = { ...e }; delete n[q.id]; return n; });
    } catch (e) { setErr("Could not save: " + (e as Error).message); }
  };

  const n = (s: AskStatus) => (Q ?? []).filter((q) => q.status === s).length;
  const list = (Q ?? []).filter((q) => view === "all" || q.status === view);
  const tabs: [AskStatus | "all", string][] = [["new", "🆕 New"], ["posted", "📌 Posted"], ["in_class", "🗣 In class"], ["skipped", "⏭ Skipped"], ["all", "All"]];
  return (
    <div className="space-y-4" data-testid="ask-teacher">
      <div className="block-panel p-4 text-sm leading-relaxed text-muted">
        Students ask from <a href="/ask/" target="_blank" rel="noopener" className="font-bold text-gold underline">/ask/</a>. Questions are saved with <b className="text-fg">no name and no time</b>, so you can&apos;t reply to one person.
        <b className="text-fg"> Post</b> puts the question and your answer on the class board; <b className="text-fg">Answered in class</b> keeps it off the board. You can edit the question&apos;s wording before posting.
        If a question suggests a student may be unsafe, consider addressing it with the whole class and pointing everyone to the counselor and 988.
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([k, t]) => <button key={k} onClick={() => setView(k)} className={`${btn} ${view === k ? "btn-grass" : ""}`}>{t}{k !== "all" ? ` (${n(k)})` : ""}</button>)}
        <button className={btn} onClick={load}>↻ Refresh</button>
      </div>
      {err && <p className="font-bold text-crimson">{err}</p>}
      {!Q ? <p className="font-bold text-muted">Loading questions…</p>
        : !list.length ? <p className="text-muted">{view === "new" ? "No new questions. 🎉" : "Nothing here yet."}</p>
        : list.map((q) => (
          <div key={q.id} className="block-panel space-y-2 p-4" data-question={q.id}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
              <span className="rounded bg-sky/15 px-1.5 py-0.5 uppercase tracking-wide text-sky">{q.topic}</span><span>{day(q.day)}</span><span className="ml-auto">{LABEL[q.status]}</span>
            </div>
            <textarea className="w-full rounded-xl border border-line bg-ink p-2.5 text-sm font-bold" rows={3} maxLength={1000} title="You can tidy the wording (typos, names) before posting"
              value={val(q).body} onChange={(e) => setEdits({ ...edits, [q.id]: { ...val(q), body: e.target.value } })} />
            <textarea className="w-full rounded-xl border border-line bg-ink p-2.5 text-sm" rows={4} maxLength={4000} placeholder="Your answer (needed to post it to the class board)"
              value={val(q).answer} onChange={(e) => setEdits({ ...edits, [q.id]: { ...val(q), answer: e.target.value } })} data-testid="ask-answer" />
            <div className="flex flex-wrap gap-1.5">
              <button className={`${btn} btn-grass`} onClick={() => act(q, "posted")} data-testid="ask-post">📌 Post answer to class</button>
              <button className={btn} onClick={() => act(q, "in_class")}>🗣 Answered in class</button>
              {q.status === "new" ? <button className={btn} onClick={() => act(q, "skipped")}>⏭ Skip</button> : <button className={btn} onClick={() => act(q, "new")}>↩ Back to New</button>}
              <button className={`${btn} !text-crimson`} onClick={() => act(q, "delete")}>{confirmDel === q.id ? "Tap again to delete" : "🗑 Delete"}</button>
            </div>
          </div>
        ))}
    </div>
  );
}

export function LiveTeacher({ hash }: { hash: string }) {
  const [subs, setSubs] = useState<SubCode[] | null>(null);
  const [until, setUntil] = useState("");
  const [labelText, setLabelText] = useState("");
  const [made, setMade] = useState<{ code: string; expires_at: string } | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { setSubs(await subList(hash)); setErr(""); }
    catch (e) { setErr(`${(e as Error).message}. Has supabase/migrations/006_live.sql been run?`); }
  }, [hash]);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- async load; today's date is only known in the browser */
    load();
    setUntil(new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  const links: [string, string, string][] = [
    ["/live/host/", "⚔️ Host a live game", "Pick a Side Live, Showdown, Realm Raid or Gold Rush Live. Put it on the projector."],
    ["/live/", "📱 Student join page", "Students type the 6-digit code from the projector."],
    ["/partner/", "🤝 Partner Games", "Tic-Tac-Toe, Connect 4, Core Sample Hunt, Dots & Boxes, Fossil Memory on two devices."],
    ["/ask/", "🙋 Ask Mr. Dopp", "The anonymous question box students see."],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map(([href, t, s]) => (
          <Link key={href} href={href} className="accent-card rounded-2xl p-4"><b className="block font-display text-lg">{t}</b><span className="mt-1 block text-sm text-muted">{s}</span></Link>
        ))}
      </div>
      <div className="block-panel p-5">
        <h3 className="font-display text-xl font-extrabold">Sub codes</h3>
        <p className="mt-1 text-sm text-muted">A day-pass code a substitute can type on the host screen to start live games. It can&apos;t open this dashboard, and it stops working after its last day (14 days at most).</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-sm font-bold">Good through<input type="date" className="mt-1 block rounded-xl border border-line bg-ink px-3 py-2" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <label className="text-sm font-bold">Label (optional)<input className="mt-1 block rounded-xl border border-line bg-ink px-3 py-2" maxLength={60} placeholder="Sub for 3rd period" value={labelText} onChange={(e) => setLabelText(e.target.value)} /></label>
          <button className="btn-block btn-grass !py-2" onClick={async () => {
            setErr(""); setMade(null);
            try { setMade(await subCreate(hash, until, labelText)); setLabelText(""); load(); } catch (e) { setErr((e as Error).message); }
          }}>Make a sub code</button>
        </div>
        {made && <p className="mt-3 rounded-xl border border-emerald/45 bg-emerald/10 p-3 font-bold">New code: <span className="font-mono text-xl text-emerald" data-testid="sub-code">{made.code}</span> · works until {new Date(made.expires_at).toLocaleString()}. Write it down now: it won&apos;t be shown again.</p>}
        {err && <p className="mt-2 font-bold text-crimson">{err}</p>}
        <div className="mt-3 space-y-1.5">
          {subs?.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-[var(--panel)] px-3 py-2 text-sm">
              <b>{s.label || "Sub code"}</b><span className="text-muted">until {new Date(s.expires_at).toLocaleString()}</span>
              <span className={`ml-auto font-bold ${s.active ? "text-emerald" : "text-muted"}`}>{s.active ? "Active" : s.revoked ? "Cancelled" : "Expired"}</span>
              {s.active && <button className={btn} onClick={async () => { await subRevoke(hash, s.id); load(); }}>Cancel</button>}
            </div>
          ))}
          {subs && !subs.length && <p className="text-sm text-muted">No sub codes yet.</p>}
        </div>
      </div>
    </div>
  );
}
