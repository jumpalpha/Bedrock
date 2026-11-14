"use client";
// ── wave-twinB ── Home Energy Budget: twin of Dopps Class "The Cost of Your Future" (finance.html + finance_calc.js).
// Same 9 steps: a concept check, choose your home, predict + LOCK, research real costs with sources, compare,
// energy sources & upgrades (payback math, what-if), a checked reflection, review & submit, certificate.
// Saves: logged in = b_eb_save (supabase/migrations/008_twinsB.sql); not logged in = practice on this device.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStudent } from "@/lib/db";
import { ebGet, ebImage, ebSave, ebSubmit, notInstalled, twinReady } from "@/lib/twinB";
import { Box, Button, Field, Grid, H3, INPUT, Lead, NavBtns, StepHead, StepPath, Table, Tile, Tiles, cx, store } from "@/components/twinb-kit";
import * as F from "./calc";

const STEPS = ["Energy", "Home", "Predict", "Research", "Compare", "Upgrade", "Reflect", "Submit", "Certificate"];
const usd = (n: number, d?: number) => (n < 0 ? "−" : "") + "$" + Math.abs(n || 0).toLocaleString("en-US", { minimumFractionDigits: d === 0 ? 0 : 2, maximumFractionDigits: d === 0 ? 0 : 2 });
const pct = (n: number | null) => (n == null ? "—" : (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(0) + "%");
const n0 = (n: number) => Math.round(n).toLocaleString("en-US");
type Meta = { status: "draft" | "submitted"; image: string | null; scores: Record<string, number | null> | null; teacher_note: string | null; submitted_at: string | null; returned_at?: string | null };
type D = F.Draft & {
  v: number; step0: { w: unknown; h: unknown; c: unknown; quiz: string }; home: F.Home; predicted: Record<string, unknown>;
  research: { location?: string; household?: string; url?: string; values: Record<string, { v?: unknown; src?: string; note?: string }> };
  grid: F.Grid; ups: Record<string, F.Up>; whatif: null | { budget: number; values: Record<string, number> }; reflection: string;
  done: Record<number, boolean>; visited: Record<number, boolean>; lastStep?: number; reflChecks?: number; showReflHints?: boolean;
};
const blank = (): D => ({ v: 1, step0: { w: 1500, h: 2, c: 11, quiz: "" }, home: { budgetSource: "", heat: "" }, predicted: {}, research: { values: {} },
  grid: { mode: "us", factor: "" }, ups: {}, whatif: null, reflection: "", done: {}, visited: {} });

/** A money / number box that only accepts real numbers (like the original's bindMoney). */
function Money({ value, onChange, max, disabled, id, className, placeholder = "0", prefix = "$" }: { value: unknown; onChange: (v: number | "") => void; max?: number; disabled?: boolean; id?: string; className?: string; placeholder?: string; prefix?: string }) {
  const [txt, setTxt] = useState(value === "" || value == null ? "" : String(value));
  const [err, setErr] = useState("");
  const last = useRef(value);
  useEffect(() => { if (value !== last.current) { last.current = value; setTxt(value === "" || value == null ? "" : String(value)); } }, [value]);
  return (
    <span className="flex flex-col gap-0.5">
      <span className={cx("flex items-center gap-1 rounded-xl border-2 border-line bg-ink px-2.5 focus-within:border-gold/70", className)}>
        {prefix && <span className="font-black text-muted">{prefix}</span>}
        <input id={id} inputMode="decimal" autoComplete="off" disabled={disabled} placeholder={placeholder} value={txt} aria-invalid={!!err}
          className="w-full min-w-0 bg-transparent py-2 text-base text-fg outline-none disabled:opacity-60"
          onChange={(e) => { setTxt(e.target.value); const c = F.checkMoney(e.target.value, max); setErr(c.ok ? "" : c.msg || ""); if (!c.ok) return; const v = c.blank ? "" : c.value!; last.current = v; onChange(v); }} />
      </span>
      {err && <span className="text-xs font-extrabold text-crimson">{err}</span>}
    </span>
  );
}
const Chip = ({ children, checked, onChange, name, disabled }: { children: ReactNode; checked: boolean; onChange: () => void; name: string; disabled?: boolean }) => (
  <label className={cx("inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 font-bold", checked ? "border-gold bg-gold/10" : "border-line")}>
    <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} /> {children}
  </label>
);
const Pill = ({ k }: { k: string }) => (
  <span className={cx("ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wide", k === "bill" ? "bg-emerald/15 text-emerald" : k === "calc" ? "bg-amber/15 text-amber" : "bg-sky/15 text-sky")}>
    {k === "bill" ? "ON A BILL" : k === "calc" ? "CALCULATE" : "YOUR GOAL"}</span>
);

export function EnergyBudget() {
  const { student, ready } = useStudent();
  const mode: "cloud" | "demo" = student && twinReady ? "cloud" : "demo";
  const backupKey = student ? "bedrock_eb_unsynced_" + student.id : "bedrock_eb_practice";
  const [d, setDraft] = useState<D>(blank);
  const [meta, setMeta] = useState<Meta>({ status: "draft", image: null, scores: null, teacher_note: null, submitted_at: null });
  const [cur, setCur] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<[string, string]>(["", ""]);
  const [lockMsg, setLockMsg] = useState<ReactNode>(null);
  const [imgErr, setImgErr] = useState("");
  const [cv, setCv] = useState<{ w: unknown; h: unknown; to: string }>({ w: "", h: "", to: "lighting" });
  const [subMsg, setSubMsg] = useState<ReactNode>(null);
  const latest = useRef(d), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), saving = useRef(false), again = useRef(false), dirty = useRef(false);
  const submitted = meta.status === "submitted", locked = !!d.predLockedAt;

  const flush = async (): Promise<boolean> => {
    if (mode === "demo") { dirty.current = false; setSave(["Saved on this device (practice mode)", "font-extrabold text-emerald"]); return true; }
    if (saving.current) { again.current = true; return false; }
    saving.current = true; dirty.current = false;
    try {
      const r = await ebSave(JSON.parse(JSON.stringify(latest.current)));
      if (r.pred_locked_at && !latest.current.predLockedAt) setDraft((o) => ({ ...o, predLockedAt: r.pred_locked_at }));
      if (!dirty.current) store.del(backupKey);
      setSave(["Saved ✓ " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), "font-extrabold text-emerald"]);
    } catch (e) {
      dirty.current = true;
      const m = (e as Error).message;
      if (/submitted/i.test(m)) { await loadCloud(); }
      else if (notInstalled(m)) setSave(["Saved on this device (the class database isn't switched on for this yet)", "font-extrabold text-amber"]);
      else { setSave(["Not saved yet, will retry (your work is kept on this device)", "font-extrabold text-crimson"]); clearTimeout(timer.current); timer.current = setTimeout(flush, 5000); }
      saving.current = false; return false;
    }
    saving.current = false;
    if (again.current) { again.current = false; return flush(); }
    return true;
  };
  const queueSave = (n: D, m: Meta = meta) => {
    if (m.status === "submitted") return;
    dirty.current = true; latest.current = n;
    store.set(backupKey, JSON.stringify(mode === "demo" ? { at: Date.now(), data: n, meta: m } : { at: Date.now(), data: n }));
    setSave(["Saving…", ""]); clearTimeout(timer.current); timer.current = setTimeout(flush, 900);
  };
  const ch = (fn: (x: D) => void) => { if (submitted) return; setDraft((o) => { const n = structuredClone(o); fn(n); queueSave(n); return n; }); };

  const loadCloud = async () => {
    const row = await ebGet();
    let backup: { at: number; data: D } | null = null;
    try { backup = JSON.parse(store.get(backupKey) || "null"); } catch {}
    let n = blank(), m: Meta = { status: "draft", image: null, scores: null, teacher_note: null, submitted_at: null };
    if (row) {
      m = { status: row.status, image: row.image, scores: row.scores, teacher_note: row.teacher_note, submitted_at: row.submitted_at, returned_at: row.returned_at };
      n = Object.assign(blank(), row.data || {}) as D;
      if (row.pred_locked_at) n.predLockedAt = row.pred_locked_at;
      if (backup && m.status !== "submitted" && backup.at > Date.parse(row.updated_at || "0")) {
        const keep = n.predLockedAt ? n.predicted : null;
        n = Object.assign(blank(), backup.data);
        if (keep) { n.predicted = keep as Record<string, unknown>; n.predLockedAt = row.pred_locked_at; }
        queueSave(n, m);
      }
    } else if (backup) { n = Object.assign(blank(), backup.data); queueSave(n, m); }
    latest.current = n; setDraft(n); setMeta(m);
    return n;
  };
  useEffect(() => {
    if (!ready) return;
    (async () => {
      let n: D;
      if (mode === "cloud") {
        try { n = await loadCloud(); setSave(["Saved ✓", "font-extrabold text-emerald"]); }
        catch (e) {
          let b = null; try { b = JSON.parse(store.get(backupKey) || "null"); } catch {}
          n = Object.assign(blank(), b?.data || {}); latest.current = n; setDraft(n);
          setSave([notInstalled(e) ? "Saved on this device (the class database isn't switched on for this yet)" : "Could not load: " + (e as Error).message, "font-extrabold text-amber"]);
        }
      } else {
        let b: { data: D; meta?: Meta } | null = null; try { b = JSON.parse(store.get(backupKey) || "null"); } catch {}
        n = Object.assign(blank(), b?.data || {}); if (b?.meta) setMeta(b.meta);
        latest.current = n; setDraft(n);
      }
      let s = Number.isInteger(n.lastStep) ? n.lastStep! : 0;
      while (s > 0 && !canEnterWith(n, s, false)) s--;
      setCur(s); setLoaded(true);
    })();
  }, [ready, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current && mode === "cloud") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [mode]);

  // ---------- navigation ----------
  const step1Complete = (x: D = d) => { const h = x.home; return !F.isBlank(h.place) && !F.isBlank(h.type) && F.num(h.people) >= 1 && F.num(h.budget) > 0 && F.num(h.elec) > 0 && !F.isBlank(h.heat) && !!h.budgetSource; };
  const step3Complete = (x: D = d) => { const r = x.research; return (["location", "household", "url"] as const).every((k) => !F.isBlank(r[k])) && F.KEYS.every((k) => r.values[k] && !F.isBlank(r.values[k].v) && !(r.values[k].src === "own" && F.isBlank(r.values[k].note))); };
  function canEnterWith(x: D, n: number, sub: boolean) { return n === 8 ? sub : n <= 2 ? true : !!x.predLockedAt; }
  const canEnter = (n: number) => canEnterWith(d, n, submitted);
  const go = (n: number) => {
    n = Math.max(0, Math.min(8, n));
    if (!canEnter(n)) { if (n !== 8) { setCur(2); setLockMsg(<Box tone="warn">Finish and <b>lock</b> your estimates first. Research comes after you guess.</Box>); } return; }
    const from = cur;
    setCur(n);
    setDraft((o) => {
      const x = structuredClone(o); x.visited[n] = true;
      if (n > from && !submitted) {
        if (from === 0 && x.step0.quiz) x.done[0] = true;
        if (from === 1 && step1Complete(x)) x.done[1] = true;
        if (from === 3 && step3Complete(x)) x.done[3] = true;
        if (from === 6 && F.reflectionQuality(x).ok) x.done[6] = true;
      }
      if (!submitted) { x.lastStep = n; queueSave(x); }
      return x;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const lockPredictions = () => {
    if (locked) { go(3); return; }
    const miss = F.CATS.filter((c) => F.isBlank(d.predicted[c.key]));
    if (miss.length) { setLockMsg(<Box tone="warn">Fill in every category first (use 0 if you won&apos;t pay it). Missing: {miss.map((c) => c.label).join(", ")}.</Box>); return; }
    if (!confirm("Lock your estimates?\n\nAfter this you can't change them. That's how we keep the comparison honest.")) return;
    const n = structuredClone(d); n.predLockedAt = new Date().toISOString(); n.done[2] = true; n.visited[3] = true; n.lastStep = 3;
    latest.current = n; setDraft(n); setLockMsg(null);
    if (mode === "demo") store.set(backupKey, JSON.stringify({ at: Date.now(), data: n, meta }));
    queueSave(n); flush(); setCur(3); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------- image ----------
  const shrink = (file: File) => new Promise<string>((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      let w = img.naturalWidth, h = img.naturalHeight; const max = 1400;
      if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const cx2 = c.getContext("2d")!; cx2.fillStyle = "#fff"; cx2.fillRect(0, 0, w, h); cx2.drawImage(img, 0, 0, w, h);
      let q = 0.8, out = c.toDataURL("image/jpeg", q);
      while (out.length > 650000 && q > 0.35) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      if (out.length > 650000) { c.width = Math.round(w / 2); c.height = Math.round(h / 2); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); out = c.toDataURL("image/jpeg", 0.6); }
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("bad image")); };
    img.src = u;
  });
  const onImage = async (file: File | undefined) => {
    setImgErr(""); if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setImgErr("Please choose a PNG, JPG, or WebP picture."); return; }
    if (file.size > 15 * 1024 * 1024) { setImgErr("That picture is too big (15 MB max)."); return; }
    try {
      const url = await shrink(file);
      if (mode === "cloud") { try { await ebImage(url); } catch (e) { setImgErr("Could not save the picture: " + (e as Error).message); return; } }
      const m = { ...meta, image: url }; setMeta(m);
      if (mode === "demo") store.set(backupKey, JSON.stringify({ at: Date.now(), data: d, meta: m }));
    } catch { setImgErr("Could not read that picture."); }
  };
  const removeImage = async () => {
    if (mode === "cloud") { try { await ebImage(null); } catch (e) { setImgErr((e as Error).message); return; } }
    const m = { ...meta, image: null }; setMeta(m);
    if (mode === "demo") store.set(backupKey, JSON.stringify({ at: Date.now(), data: d, meta: m }));
  };

  // ---------- submit ----------
  const doSubmit = async () => {
    const miss = F.missing(d);
    if (miss.length) { setSubMsg(<Box tone="bad"><b>Not ready yet. Still missing:</b><ul className="ml-5 mt-1 list-disc">{miss.map((x) => <li key={x}>{x}</li>)}</ul></Box>); return; }
    if (mode === "demo") { setSubMsg(<Box tone="warn">You&apos;re in practice mode, so this can&apos;t be turned in. Log in (top right), then come back.</Box>); return; }
    if (!confirm("Submit your Home Energy Budget?\n\nAfter you submit, you can't change it unless Mr. Dopp returns it.")) return;
    clearTimeout(timer.current);
    const n = structuredClone(d); n.done[7] = true; latest.current = n; setDraft(n);
    if (!(await flush())) { setSubMsg(<Box tone="bad">Couldn&apos;t save your latest work. Check your connection and try again.</Box>); return; }
    try { const r = await ebSubmit(); setMeta({ ...meta, status: "submitted", submitted_at: r.submitted_at }); setSubMsg(null); setSave(["Submitted ✓", "font-extrabold text-emerald"]); }
    catch (e) { setSubMsg(<Box tone="bad">{(e as Error).message}</Box>); }
  };

  if (!loaded) return <div className="block-panel mx-auto max-w-5xl animate-pulse p-10 text-center text-muted">Reading the meters…</div>;

  // ---------- numbers ----------
  const P: F.Plan = { home: d.home, values: d.research.values as Record<string, unknown>, grid: d.grid, ups: d.ups };
  const plan = F.plan(P), cmp = F.compare(d.predicted, d.research.values as Record<string, unknown>);
  const home = F.homeInfo(d.home);
  const dis = submitted;
  const setHome = (k: keyof F.Home, v: unknown) => ch((x) => { (x.home as Record<string, unknown>)[k] = v; });

  const dash = (pl: ReturnType<typeof F.plan>, title?: string) => {
    const m = pl.meter;
    return (
      <>
        {title && <H3>{title}</H3>}
        <Tiles>
          <Tile k="Monthly energy budget" v={usd(pl.budget, 0)} s={`${usd(pl.budget * 12, 0)} a year`} />
          <Tile k="Bills now" v={usd(pl.t.billsMonthly, 0)} s="11 categories, per month" />
          <Tile k="Upgrade savings" v={usd(pl.savings, 0)} s={`per month from ${pl.on.length} upgrade${pl.on.length === 1 ? "" : "s"}`} />
          <Tile k="Bills after upgrades" v={usd(pl.after, 0)} s="per month" />
          <Tile k="Upgrade fund" v={usd(pl.t.fundMonthly, 0)} s="saved each month" />
          <Tile tone={pl.surplus >= 0 ? "pos" : "neg"} k={pl.surplus >= 0 ? "Left over per month" : "Short per month"} v={usd(pl.surplus, 0)} s={`${usd(pl.surplus * 12, 0)} a year`} />
          <Tile k="Upgrades cost" v={usd(pl.cost, 0)} s={pl.payback == null ? "pick an upgrade below" : `pays for itself in about ${pl.payback.toFixed(1)} years`} />
          <Tile k="CO₂ a year" v={`${n0(pl.afterC.lbYear)} lb`} s={`was ${n0(pl.before.lbYear)} lb before upgrades (${n0(pl.before.kwh)} kWh, ${n0(pl.before.therms)} therms, ${n0(pl.before.gal)} gal gasoline a month)`} />
        </Tiles>
        <div className="my-3 rounded-xl border border-line p-3" aria-label={`Budget: ${m.label}`}>
          <div className="relative h-3.5 rounded-full bg-gradient-to-r from-crimson via-gold to-emerald"><div className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-full border-4 border-fg bg-ink" style={{ left: m.pos + "%" }} /></div>
          <div className="mt-1.5 flex justify-between text-xs font-extrabold text-muted"><span>Shortfall</span><span>Balanced</span><span>Surplus</span></div>
          <div className={cx("mt-1 text-center font-display text-2xl font-black", m.level === "shortfall" ? "text-crimson" : m.level === "balanced" ? "text-amber" : "text-emerald")}>{m.label}</div>
          <div className="text-center text-sm text-muted">{m.level === "shortfall" ? "Your budget doesn't cover these bills yet. Try the what-if box: what would have to change?" : m.level === "balanced" ? "You can just cover it, with less than 5% to spare. One cold January could tip you over." : "Your budget covers this home's energy with money to spare."}</div>
        </div>
      </>
    );
  };

  const steps: ReactNode[] = [];
  // ═════════ STEP 0 ═════════
  const k0 = F.kwhOf(d.step0.w, d.step0.h), c0 = F.costOf(k0, d.step0.c);
  steps[0] = (
    <>
      <StepHead num="Step 0" title="Understanding Energy" />
      <Lead>Before you plan a home&apos;s energy, know how it&apos;s measured. A <b className="text-fg">watt</b> is how fast something uses energy. A <b className="text-fg">kilowatt-hour (kWh)</b> is how much it used: 1,000 watts for 1 hour. Power companies bill by the kWh.</Lead>
      <Grid>
        <Field label="Appliance power (watts)"><Money prefix="" value={d.step0.w} max={100000} disabled={dis} onChange={(v) => ch((x) => { x.step0.w = v; })} /></Field>
        <Field label="Hours it runs a day"><Money prefix="" value={d.step0.h} max={24} disabled={dis} onChange={(v) => ch((x) => { x.step0.h = v; })} /></Field>
        <Field label="Price (cents per kWh)" small="Idaho's is one of the lowest in the U.S., about 11¢ (EIA)."><Money prefix="¢" value={d.step0.c} max={200} disabled={dis} onChange={(v) => ch((x) => { x.step0.c = v; })} /></Field>
      </Grid>
      <Tiles>
        <Tile k="Energy each day" v={`${(Math.round(k0 * 100) / 100).toLocaleString()} kWh`} s={`${F.num(d.step0.w).toLocaleString()} W × ${F.num(d.step0.h)} h ÷ 1,000`} />
        <Tile k="Cost each day" v={usd(c0)} s="kWh × price" />
        <Tile k="Cost each month" v={usd(c0 * 30)} s="× 30 days" />
        <Tile k="CO₂ each month" v={`${n0(k0 * 30 * F.F_KWH)} lb`} s={`at the U.S. average, about ${F.F_KWH} lb per kWh`} />
      </Tiles>
      <Box><b>Watts vs. kilowatt-hours:</b> a 1,500-watt space heater and a 10-watt LED bulb are both &ldquo;on,&rdquo; but the heater uses energy 150 times faster. Time matters too: a small thing left on all day can use more than a big thing used for a minute. Natural gas is billed in <b>therms</b> and gasoline in <b>gallons</b>, but the idea is the same.</Box>
      <H3>Check your understanding</H3>
      <p>A <b>1,000-watt</b> space heater runs for <b>5 hours</b>. How much energy does it use?</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
        {([["a", "0.2 kWh"], ["b", "5 kWh"], ["c", "200 kWh"], ["d", "5,000 kWh"]] as const).map(([v, l]) => <Chip key={v} name="quiz" disabled={dis} checked={d.step0.quiz === v} onChange={() => ch((x) => { x.step0.quiz = v; x.done[0] = true; })}>{l}</Chip>)}
      </div>
      {d.step0.quiz && (d.step0.quiz === "b" ? <Box tone="ok">✅ Right. 1,000 W × 5 h = 5,000 watt-hours = <b>5 kWh</b>. At 11¢ that&apos;s about 55¢.</Box>
        : <Box tone="bad">Not quite. kWh = watts × hours ÷ 1,000: 1,000 × 5 ÷ 1,000 = <b>5 kWh</b>. (5,000 is the answer in watt-hours, before dividing by 1,000.)</Box>)}
      <NavBtns><span /><Button onClick={() => go(1)}>Next: Choose Your Home →</Button></NavBtns>
    </>
  );
  // ═════════ STEP 1 ═════════
  const h = d.home;
  steps[1] = (
    <>
      <StepHead num="Step 1" title="Choose Your Home" />
      <Lead>Pick a home you could really see yourself living in after high school, in Idaho or anywhere. This is a plan for your future self, not your family&apos;s real bills.</Lead>
      <Grid>
        <Field label="Town and state"><input className={INPUT} disabled={dis} maxLength={80} value={h.place || ""} placeholder="e.g. Idaho Falls, ID" onChange={(e) => setHome("place", e.target.value)} /></Field>
        <Field label="Home type"><select className={INPUT} disabled={dis} value={h.type || ""} onChange={(e) => setHome("type", e.target.value)}><option value="">Choose…</option>{["Apartment", "Townhouse", "House", "Manufactured home", "Cabin", "Other"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Size (square feet)" small="Optional"><Money prefix="" value={h.sqft} max={20000} disabled={dis} onChange={(v) => setHome("sqft", v)} /></Field>
        <Field label="People living there"><Money prefix="" value={h.people} max={20} disabled={dis} onChange={(v) => setHome("people", v)} /></Field>
        <Field label="Heat and hot water come from"><select className={INPUT} disabled={dis} value={h.heat || ""} onChange={(e) => setHome("heat", e.target.value)}><option value="">Choose…</option><option value="gas">Natural gas</option><option value="electric">Electricity (baseboard, furnace or heat pump)</option><option value="other">Propane or wood</option></select></Field>
        <Field label="Monthly energy budget" small="What you plan to spend on power, heat and car fuel."><Money value={h.budget} max={100000} disabled={dis} onChange={(v) => setHome("budget", v)} /></Field>
        <Field label="Electricity price (cents per kWh)" small="On a power bill or your utility's rate page."><Money prefix="¢" value={h.elec} max={200} disabled={dis} onChange={(v) => setHome("elec", v)} /></Field>
        <Field label="Natural gas price ($ per therm)" small="Skip if no gas. Propane: use $ per gallon."><Money value={h.gasPrice} max={100} disabled={dis} onChange={(v) => setHome("gasPrice", v)} /></Field>
        <Field label="Gasoline price ($ per gallon)"><Money value={h.fuelPrice} max={100} disabled={dis} onChange={(v) => setHome("fuelPrice", v)} /></Field>
      </Grid>
      <H3>Where did your budget number come from?</H3>
      <div className="flex flex-wrap gap-2">
        <Chip name="bsrc" disabled={dis} checked={h.budgetSource === "researched"} onChange={() => setHome("budgetSource", "researched")}>I researched it</Chip>
        <Chip name="bsrc" disabled={dis} checked={h.budgetSource === "guess"} onChange={() => setHome("budgetSource", "guess")}>It&apos;s my guess</Chip>
      </div>
      {h.budgetSource === "researched" && (
        <div className="mt-3">
          <Field label="Where you found it (web address)"><input className={INPUT} disabled={dis} inputMode="url" maxLength={300} value={h.budgetUrl || ""} placeholder="https://www.eia.gov/…" onChange={(e) => setHome("budgetUrl", e.target.value.trim())} /></Field>
          <p className="mt-1 text-sm text-muted">Good places to look: the <a className="font-bold text-sky underline" href="https://www.eia.gov/electricity/state/idaho/" target="_blank" rel="noopener noreferrer">EIA Idaho electricity profile</a>, your utility&apos;s residential rates page, or <a className="font-bold text-sky underline" href="https://www.energystar.gov/" target="_blank" rel="noopener noreferrer">ENERGY STAR</a>.</p>
        </div>
      )}
      <Tiles>
        <Tile k="Budget per year" v={F.num(h.budget) ? usd(home.annual, 0) : "—"} s="monthly × 12" />
        <Tile k="Per person per month" v={home.perPerson == null || !F.num(h.budget) ? "—" : usd(home.perPerson)} />
        <Tile k="kWh your budget buys" v={home.kwhBuys == null || !F.num(h.budget) ? "—" : n0(home.kwhBuys) + " kWh"} s="if it all went to electricity · a typical U.S. home uses about 900 kWh a month (EIA)" />
      </Tiles>
      {h.budgetSource === "researched" ? (h.budgetUrl ? <Box tone="ok">📚 Researched budget: source recorded.</Box> : <Box tone="warn">Add the web address where you found your number, or mark it as a guess.</Box>)
        : h.budgetSource === "guess" ? <Box tone="warn">🤔 This budget is a <b>guess</b>. That&apos;s allowed, but a researched number earns more credit and gives you a truer answer.</Box> : null}
      <NavBtns><Button kind="ghost" onClick={() => go(0)}>← Back</Button><Button onClick={() => go(2)}>Next: Predict Your Bills →</Button></NavBtns>
    </>
  );
  // ═════════ STEP 2 ═════════
  const tp = F.totals(d.predicted);
  steps[2] = (
    <>
      <StepHead num="Step 2" title="Predict Your Bills" />
      <Lead>Before you look anything up, guess what <b className="text-fg">your home</b> would spend <b className="text-fg">each month</b> on each kind of energy use. No research yet: the point is to see how close your instincts are. Put 0 for anything you won&apos;t pay.</Lead>
      {locked ? <Box tone="ok">🔒 Locked {new Date(d.predLockedAt!).toLocaleString()}. Your estimates can&apos;t change now. That keeps the comparison honest.</Box> : lockMsg}
      <Table head={<tr><th>Category</th><th className="n">My estimate per month</th></tr>} foot={<><tr><td>Monthly total</td><td className="n">{usd(tp.monthly)}</td></tr><tr><td>Annual total (× 12)</td><td className="n">{usd(tp.annual)}</td></tr></>}>
        {F.CATS.map((c) => <tr key={c.key}><td><label htmlFor={"p_" + c.key}>{c.label}</label></td><td className="n"><div className="ml-auto max-w-[180px]"><Money id={"p_" + c.key} value={d.predicted[c.key]} max={1e6} disabled={locked || dis} className="!border-sky/50" onChange={(v) => ch((x) => { x.predicted[c.key] = v; })} /></div></td></tr>)}
      </Table>
      <NavBtns><Button kind="ghost" onClick={() => go(1)}>← Back</Button><Button onClick={lockPredictions}>{locked ? "Next: Research →" : "🔒 Lock my estimates & start research"}</Button></NavBtns>
    </>
  );
  // ═════════ STEP 3 ═════════
  const r = d.research, tr = F.totals(r.values as Record<string, unknown>);
  const cvK = F.kwhOf(cv.w, cv.h) * 30, cvD = F.costOf(cvK, h.elec);
  steps[3] = (
    <>
      <StepHead num="Step 3" title="Research Real Energy Costs" />
      <Lead>Now find out what this home&apos;s energy really costs. Your locked guesses are shown in <b className="text-sky">blue</b>; put what you find in the <b className="text-gold">gold</b> boxes.</Lead>
      <ol className="ml-5 list-decimal space-y-1 text-[15px]">
        <li>Best source: a real <b>power bill and gas bill</b> (ask at home), or your utility&apos;s rates page.</li>
        <li>For appliances, use the <a className="font-bold text-sky underline" href="https://www.energy.gov/energysaver/appliance-energy-calculator" target="_blank" rel="noopener noreferrer"><b>Energy Saver appliance calculator</b></a> or the converter below: watts × hours a day × 30 ÷ 1,000 = kWh a month.</li>
        <li>Yellow <b>EnergyGuide</b> labels on fridges, water heaters and dishwashers list the yearly kWh or cost. Divide by 12.</li>
      </ol>
      <Box tone="warn">This page does <b>not</b> look up numbers for you. Every number must come from your own research.</Box>
      <H3>About your research</H3>
      <Grid>
        <Field label="Location researched"><input className={INPUT} disabled={dis} maxLength={100} value={r.location || ""} placeholder="e.g. Idaho Falls Power" onChange={(e) => ch((x) => { x.research.location = e.target.value; })} /></Field>
        <Field label="Where most numbers came from"><select className={INPUT} disabled={dis} value={r.household || ""} onChange={(e) => ch((x) => { x.research.household = e.target.value; })}><option value="">Choose…</option>{["My family's real bills", "My utility's website", "Energy Saver / EIA data", "Appliance EnergyGuide labels", "A mix of sources", "Other"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Source web address" small="Copy the address of the exact page you used most."><input className={INPUT} disabled={dis} inputMode="url" maxLength={300} value={r.url || ""} placeholder="https://www.energy.gov/…" onChange={(e) => ch((x) => { x.research.url = e.target.value.trim(); })} /></Field>
      </Grid>
      <details className="my-3 rounded-xl border border-line p-3" open>
        <summary className="cursor-pointer font-extrabold">Appliance → monthly cost converter</summary>
        <div className="mt-2.5 grid items-end gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(160px,100%),1fr))" }}>
          <Field label="Watts"><Money prefix="" value={cv.w} max={100000} onChange={(v) => setCv({ ...cv, w: v })} placeholder="60" /></Field>
          <Field label="Hours a day"><Money prefix="" value={cv.h} max={24} onChange={(v) => setCv({ ...cv, h: v })} placeholder="5" /></Field>
          <Tile k="kWh a month → $ a month" v={F.num(h.elec) ? usd(cvD) : "—"} s={`${(Math.round(cvK * 10) / 10).toLocaleString()} kWh × ${F.num(h.elec)}¢${F.num(h.elec) ? "" : " (add your price in Step 1)"}`} />
          <Field label="Put it in"><select className={INPUT} value={cv.to} onChange={(e) => setCv({ ...cv, to: e.target.value })}>{F.CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
          <Button kind="ink" disabled={dis || !cvD} onClick={() => ch((x) => { x.research.values[cv.to] = { src: "data", note: "", ...x.research.values[cv.to], v: F.round2(cvD) }; })}>Use this number</Button>
        </div>
      </details>
      <H3>Category by category</H3>
      <p className="text-sm text-muted"><Pill k="bill" /> = it&apos;s on a power, gas or fuel bill. <Pill k="calc" /> = figure it from watts × hours. <Pill k="none" /> = no bill shows it; set your own goal. If you use your own number, say where it came from.</p>
      {F.CATS.map((c) => {
        const v = r.values[c.key] || {}, src = v.src || (c.src === "none" ? "own" : "data");
        const row = (fn: (o: { v?: unknown; src?: string; note?: string }) => void) => ch((x) => { const o = (x.research.values[c.key] = x.research.values[c.key] || { v: "", src: c.src === "none" ? "own" : "data", note: "" }); fn(o); });
        return (
          <div key={c.key} className="grid gap-2.5 border-b border-line py-3 sm:grid-cols-[1.4fr_110px_1fr_1.2fr] sm:items-start">
            <div className="font-extrabold">{c.label} <Pill k={c.src} /><div className="mt-0.5 text-xs font-semibold text-muted">{c.note}</div></div>
            <div><div className="text-xs text-muted">My estimate</div><div className="font-black text-sky">{F.isBlank(d.predicted[c.key]) ? "—" : usd(F.num(d.predicted[c.key]))}</div></div>
            <Field label={<span className="text-xs text-muted">Researched / month</span>}><Money value={v.v} max={1e6} disabled={dis} className="!border-gold/60" onChange={(val) => row((o) => { o.v = val; })} /></Field>
            <Field label={<span className="text-xs text-muted">Where this number came from</span>}>
              <select className={INPUT} disabled={dis} value={src} onChange={(e) => row((o) => { o.src = e.target.value; })}><option value="data">A bill, label or calculator</option><option value="own">My own estimate</option></select>
              {src === "own" && <input className={INPUT} disabled={dis} maxLength={160} value={v.note || ""} placeholder="How you figured it" onChange={(e) => row((o) => { o.note = e.target.value; })} />}
            </Field>
          </div>
        );
      })}
      <Table head={<tr><th>Totals</th><th className="n" /></tr>}><tr><td>Researched monthly total</td><td className="n font-black">{usd(tr.monthly)}</td></tr><tr><td>Researched annual total (× 12)</td><td className="n font-black">{usd(tr.annual)}</td></tr></Table>
      <H3>Evidence screenshot <small className="font-semibold text-muted">(optional)</small></H3>
      <p className="text-sm text-muted">A photo of a bill (cover the account number and address!) or a screenshot of the calculator. Pictures are shrunk before they are saved.</p>
      {!dis && <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Add a screenshot" onChange={(e) => { onImage(e.target.files?.[0]); e.target.value = ""; }} className="mt-2 text-sm" />}
      {imgErr && <div className="mt-1 text-sm font-extrabold text-crimson">{imgErr}</div>}
      {meta.image && <div className="mt-2">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={meta.image} alt="Your evidence screenshot" className="max-h-80 rounded-xl border border-line" />{!dis && <Button kind="ghost" small className="mt-2" onClick={removeImage}>Remove picture</Button>}</div>}
      <NavBtns><Button kind="ghost" onClick={() => go(2)}>← Back</Button><Button onClick={() => go(4)}>Next: Compare →</Button></NavBtns>
    </>
  );
  // ═════════ STEP 4 ═════════
  const max = Math.max(1, ...cmp.rows.map((x) => Math.max(x.predicted, x.researched)));
  const a4 = Math.abs(cmp.pct || 0);
  steps[4] = (
    <>
      <StepHead num="Step 4" title="Compare Predictions With Reality" />
      <Lead>How close were your instincts? Difference = researched − your estimate. A <b className="text-crimson">red +</b> means real life costs more than you guessed.</Lead>
      <Table head={<tr><th>Category</th><th className="n">My estimate</th><th className="n">Researched</th><th className="n">Difference</th><th className="n">% of real cost</th></tr>}
        foot={<><tr><td>Monthly total</td><td className="n">{usd(cmp.predictedMonthly)}</td><td className="n">{usd(cmp.researchedMonthly)}</td><td className={cx("n", cmp.diffMonthly > 0 ? "text-crimson" : "text-emerald")}>{cmp.diffMonthly > 0 ? "+" : ""}{usd(cmp.diffMonthly)}</td><td className="n">{pct(cmp.pct)}</td></tr>
          <tr><td>Annual total</td><td className="n">{usd(cmp.predictedAnnual)}</td><td className="n">{usd(cmp.researchedAnnual)}</td><td className={cx("n", cmp.diffAnnual > 0 ? "text-crimson" : "text-emerald")}>{cmp.diffAnnual > 0 ? "+" : ""}{usd(cmp.diffAnnual)}</td><td /></tr></>}>
        {cmp.rows.map((x) => <tr key={x.key}><td>{x.label}</td><td className="n">{usd(x.predicted)}</td><td className="n">{usd(x.researched)}</td><td className={cx("n", x.diff > 0 ? "text-crimson" : x.diff < 0 ? "text-emerald" : "")}>{x.diff > 0 ? "+" : ""}{usd(x.diff)}</td><td className="n">{pct(x.pct)}</td></tr>)}
      </Table>
      <p className="mt-2 text-sm text-muted">Want to change a number? Researched costs can be edited in Step 3. Your estimates stay locked so the comparison stays honest.</p>
      <Tiles>
        <Tile k="Biggest underestimate" v={cmp.under ? cmp.under.label : "None"} s={cmp.under ? `real cost was ${usd(cmp.under.diff)}/mo more` : "you never guessed too low"} />
        <Tile k="Biggest overestimate" v={cmp.over ? cmp.over.label : "None"} s={cmp.over ? `real cost was ${usd(-cmp.over.diff)}/mo less` : "you never guessed too high"} />
        <Tile k="Overall" v={pct(cmp.pct)} s={cmp.diffMonthly >= 0 ? "reality costs more than you guessed" : "you guessed higher than reality"} />
      </Tiles>
      <div className="my-3 rounded-xl border border-line p-3" role="img" aria-label="Bar chart comparing estimates with researched costs">
        <div className="mb-2 flex gap-4 text-xs font-extrabold"><span className="flex items-center gap-1"><i className="size-3 rounded bg-sky" />My estimate</span><span className="flex items-center gap-1"><i className="size-3 rounded bg-gold" />Researched</span></div>
        {cmp.rows.map((x) => (
          <div key={x.key} className="my-1.5 grid grid-cols-[110px_1fr] items-center gap-2 text-xs sm:grid-cols-[190px_1fr]">
            <span className="truncate text-right font-bold">{x.label}</span>
            <span className="space-y-0.5"><i className="block h-2.5 rounded bg-sky" style={{ width: (x.predicted / max) * 100 + "%" }} title={`${x.label} estimate ${usd(x.predicted)}`} /><i className="block h-2.5 rounded bg-gold" style={{ width: (x.researched / max) * 100 + "%" }} title={`${x.label} researched ${usd(x.researched)}`} /></span>
          </div>))}
      </div>
      {!cmp.researchedMonthly ? <Box>Add your researched costs in Step 3 to see how you did.</Box>
        : a4 <= 10 ? <Box tone="ok">🎯 Sharp instincts: your total was within 10% of reality. Look at the individual lines: even good totals can hide big misses that cancel out.</Box>
        : cmp.diffMonthly > 0 ? <Box>💡 Real energy costs about <b>{usd(cmp.diffMonthly, 0)} more per month</b> than you expected. That&apos;s really common: heating and hot water hide inside one bill, and most people your age have never seen it. Now you know, and knowing is the whole point.</Box>
        : <Box>💡 You guessed <b>{usd(-cmp.diffMonthly, 0)} more per month</b> than the research shows. Idaho&apos;s low electricity prices (lots of cheap hydropower) surprise a lot of people.</Box>}
      <NavBtns><Button kind="ghost" onClick={() => go(3)}>← Back</Button><Button onClick={() => { ch((x) => { x.done[4] = true; }); go(5); }}>Next: Sources &amp; Upgrades →</Button></NavBtns>
    </>
  );
  // ═════════ STEP 5 ═════════
  const ensureWhatif = (x: D) => { if (x.whatif) return; const v: Record<string, number> = {}; F.KEYS.forEach((k) => (v[k] = F.num(x.research.values[k]?.v))); x.whatif = { budget: F.num(x.home.budget), values: v }; };
  const wPlan = d.whatif ? F.plan({ ...P, home: { ...d.home, budget: d.whatif.budget }, values: Object.fromEntries(F.KEYS.map((k) => [k, { v: d.whatif!.values[k] }])) }) : null;
  steps[5] = (
    <>
      <StepHead num="Step 5" title="Energy Sources & Upgrades" />
      <Lead>Where does this home&apos;s energy come from, and what would it take to use less of it? Pick upgrades, see how long each one takes to pay for itself, and check whether your budget covers the bills.</Lead>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Electricity source">
        {([["us", "U.S. average grid"], ["custom", "My utility's number"]] as const).map(([v, l]) => <button key={v} type="button" disabled={dis} onClick={() => ch((x) => { x.grid.mode = v; })} aria-pressed={(d.grid.mode || "us") === v} className={cx("rounded-full border-2 border-fg/70 px-3.5 py-1.5 text-sm font-black", (d.grid.mode || "us") === v ? "bg-fg text-ink" : "")}>{l}</button>)}
      </div>
      {d.grid.mode === "custom"
        ? <Box><b>Your utility&apos;s number:</b> many utilities publish their pounds of CO₂ per kWh (look for a &ldquo;fuel mix&rdquo; or &ldquo;power content&rdquo; label). Idaho&apos;s in-state electricity comes mostly from hydropower on the Snake River and its tributaries, so Idaho utilities are often well below the U.S. average.
            <div className="mt-2 max-w-[260px]"><Field label="Pounds of CO₂ per kWh"><Money prefix="" value={d.grid.factor} max={3} disabled={dis} onChange={(v) => ch((x) => { x.grid.factor = v; })} /></Field></div></Box>
        : <Box><b>U.S. average grid:</b> about {F.F_KWH} lb of CO₂ per kWh (EIA). Coal plants make about 2.2 lb per kWh, natural gas plants about 1 lb, and hydropower, wind and solar almost none while running. Natural gas heat makes about {F.F_THERM} lb per therm, and gasoline about {F.F_GAL} lb per gallon.</Box>}
      {dash(plan)}
      <H3>Efficiency upgrades</H3>
      <p className="text-sm text-muted">Costs and savings start at classroom estimates. Change them to what you find (a real quote, a store price). Savings come off <b className="text-fg">your researched</b> cost for that category. Payback = cost ÷ yearly savings.</p>
      <div className="space-y-2">
        {plan.ups.map((u) => {
          const s = d.ups[u.key] || {};
          const setU = (k: keyof F.Up, v: unknown) => ch((x) => { x.ups[u.key] = { ...(x.ups[u.key] || {}), [k]: v }; });
          return (
            <div key={u.key} className={cx("rounded-xl border p-3", u.on ? "border-emerald/60 bg-emerald/[0.06]" : "border-line")}>
              <label className="flex cursor-pointer items-start gap-2.5"><input type="checkbox" className="mt-1 size-4" disabled={dis} checked={u.on} onChange={(e) => setU("on", e.target.checked)} />
                <span className="min-w-0 flex-1"><b>{u.label}</b><span className="block text-xs text-muted">{u.why}</span></span></label>
              <div className="mt-2 grid items-end gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(140px,100%),1fr))" }}>
                {u.key === "solar" ? <>
                  <Field label={<span className="text-xs">System size (kW)</span>}><Money prefix="" value={F.isBlank(s.kw) ? 4 : s.kw} max={50} disabled={dis} onChange={(v) => setU("kw", v)} /></Field>
                  <Field label={<span className="text-xs">Cost ($ per watt)</span>}><Money value={F.isBlank(s.cost) ? u.cost : s.cost} max={20} disabled={dis} onChange={(v) => setU("cost", v)} /></Field>
                </> : <>
                  <Field label={<span className="text-xs">Cost</span>}><Money value={F.isBlank(s.cost) ? u.cost : s.cost} max={200000} disabled={dis} onChange={(v) => setU("cost", v)} /></Field>
                  <Field label={<span className="text-xs">Saves (% of {F.CATS.find((c) => c.key === u.cat)?.label.toLowerCase()})</span>}><Money prefix="%" value={F.isBlank(s.pct) ? u.pct : s.pct} max={100} disabled={dis} onChange={(v) => setU("pct", v)} /></Field>
                </>}
                <div className="text-sm"><div className="text-xs font-bold text-muted">Saves</div><b>{usd(u.monthly)}/mo</b>{u.key === "solar" && <span className="block text-xs text-muted">{n0(u.kwh)} kWh a month</span>}</div>
                <div className="text-sm"><div className="text-xs font-bold text-muted">Total cost · payback</div><b>{usd(u.total, 0)}</b> · {u.payback == null ? "never (no savings)" : u.payback.toFixed(1) + " yr"}</div>
              </div>
            </div>
          );
        })}
      </div>
      <details className="my-4 rounded-xl border border-line p-3" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !d.whatif && !dis) ch(ensureWhatif); }}>
        <summary className="cursor-pointer font-extrabold">🧪 Try a what-if (this never changes what you turn in)</summary>
        <p className="mt-1 text-sm text-muted">Experiment: a bigger budget, a colder winter, a car that gets better mileage… Your real numbers stay saved exactly as they are.</p>
        {d.whatif && <>
          <Grid min={180}>
            <Field label="What-if budget per month"><Money value={d.whatif.budget} max={1e6} disabled={dis} onChange={(v) => ch((x) => { ensureWhatif(x); x.whatif!.budget = F.num(v); })} /></Field>
            {(["heating", "cooling", "hotwater", "transport", "upgrades"] as const).map((k) => <Field key={k} label={`What-if ${F.CATS.find((c) => c.key === k)!.label.toLowerCase()}`}><Money value={d.whatif!.values[k]} max={1e6} disabled={dis} onChange={(v) => ch((x) => { ensureWhatif(x); x.whatif!.values[k] = F.num(v); })} /></Field>)}
          </Grid>
          {wPlan && dash(wPlan, "What-if result")}
          <Button kind="ghost" disabled={dis} onClick={() => ch((x) => { x.whatif = null; ensureWhatif(x); })}>Reset what-if to my real numbers</Button>
        </>}
      </details>
      <label className="mt-2 inline-flex items-center gap-2 rounded-xl border-2 border-line px-3 py-2 font-bold"><input type="checkbox" disabled={dis} checked={!!d.done[5]} onChange={(e) => ch((x) => { x.done[5] = e.target.checked; })} /> I looked at my results and checked whether my budget covers this home&apos;s energy.</label>
      <NavBtns><Button kind="ghost" onClick={() => go(4)}>← Back</Button><Button onClick={() => go(6)}>Next: Reflection →</Button></NavBtns>
    </>
  );
  // ═════════ STEP 6 ═════════
  const q = F.reflectionQuality(d), s6 = F.sentences(d.reflection);
  const u6 = cmp.under, pl = plan;
  const hints: [string, string, ReactNode][] = [
    ["surprise", "What surprised you most about your home's energy use?", <>Name one thing that surprised you and why. {cmp.researchedMonthly ? <>Your numbers: this home&apos;s energy costs <b>{usd(cmp.researchedMonthly, 0)} a month</b>{cmp.pct != null && <>: {pct(cmp.pct)} compared with your guess</>}.</> : null} <i className="text-muted">Try: &ldquo;I was surprised that…&rdquo;</i></>],
    ["under", "Which cost did you underestimate the most?", u6 ? <>Name it and say by how much. Your numbers: <b>{u6.label}</b>: you guessed {usd(u6.predicted, 0)}, research says {usd(u6.researched, 0)} ({usd(u6.diff, 0)} more a month). <i className="text-muted">Try: &ldquo;I underestimated {u6.label.toLowerCase()} the most…&rdquo;</i></> : <>Say which cost was closest to or farthest from your guess, and what that tells you.</>],
    ["budget", "Can your budget cover this home's bills?", <>Answer yes or no and explain with numbers. Your numbers: budget <b>{usd(pl.budget, 0)} a month</b>, bills after upgrades <b>{usd(pl.after, 0)}</b> plus a {usd(pl.t.fundMonthly, 0)} upgrade fund → <b>{pl.meter.label}</b> of {usd(Math.abs(pl.surplus), 0)} a month.</>],
    ["changes", "Which upgrades or changes would help most?", <>Name at least one: LEDs, a smart thermostat, sealing and insulation, a heat pump, solar panels, line-drying, turning things off.{pl.payback != null && <> Your upgrades would pay for themselves in about <b>{pl.payback.toFixed(1)} years</b>.</>}</>],
    ["learned", "What did you learn about energy resources?", <>End with the big idea you&apos;ll keep: renewable vs. nonrenewable resources, Idaho&apos;s hydropower, fossil fuels and carbon dioxide, or why efficiency is the cheapest energy. <i className="text-muted">Try: &ldquo;I learned that…&rdquo;</i></>],
    ["numbers", "Use your own numbers", <>Put at least one real number from Steps 3–5 in your writing: a dollar amount, kWh, therms, pounds of CO₂, years of payback, or a percent.</>],
    ["length", `Write at least ${q.minWords} words`, <>You have {q.words}. Explain your answers: tell <i>why</i>, not just <i>what</i>.</>],
    ["sentences", "At least 5 complete sentences", <>You have {q.sentences}. Each one needs 4+ words and a period, question mark, or exclamation point.</>],
    ["repeat", "Write it in your own words", <>Repeating the same words over and over doesn&apos;t count.</>],
  ];
  steps[6] = (
    <>
      <StepHead num="Step 6" title="Written Reflection" />
      <Lead>Write at least <b className="text-fg">five complete sentences</b> in your own words. Answer each question:</Lead>
      <ol className="ml-5 list-decimal space-y-0.5">
        <li>What surprised you most about your home&apos;s energy use?</li>
        <li>Which cost did you underestimate the most? {u6 && <span className="text-sm text-muted">(Your numbers say: {u6.label}.)</span>}</li>
        <li>Can your budget cover this home&apos;s energy bills?</li>
        <li>Which upgrades or changes would help most, and how long until they pay for themselves?</li>
        <li>What did you learn about energy resources?</li>
      </ol>
      <textarea aria-label="Your reflection" className={cx(INPUT, "mt-3 min-h-[220px] leading-relaxed")} maxLength={6000} disabled={dis} placeholder="Start writing here…" value={d.reflection}
        onChange={(e) => ch((x) => { x.reflection = e.target.value; const ok = F.reflectionQuality(x).ok; if (ok !== !!x.done[6]) x.done[6] = ok; })} />
      <div className="mt-1 flex justify-between text-sm"><span className={s6.meaningful >= 5 ? "font-extrabold text-emerald" : ""}>{s6.meaningful} of 5 complete sentences{s6.meaningful >= 5 ? " ✓" : ""}</span><span className="text-muted">{d.reflection ? s6.words : 0} words</span></div>
      <p className="mt-2 text-sm text-muted">A complete sentence has at least four words and ends with a period, question mark, or exclamation point. A quality reflection answers <b className="text-fg">all five questions</b>, uses <b className="text-fg">your own numbers</b>, and is at least <b className="text-fg">80 words</b>. Your writing saves automatically.</p>
      {q.ok ? (d.showReflHints && <Box tone="ok">✅ Great reflection: it answers every question and uses your own numbers. On to Review &amp; Submit!</Box>)
        : d.showReflHints && (
          <div className="my-3 rounded-xl border border-amber/50 bg-amber/[0.06] p-4">
            <h3 className="font-display text-lg font-extrabold">✏️ Not quite yet: your reflection needs {q.problems.length} more thing{q.problems.length === 1 ? "" : "s"}</h3>
            <p className="mb-1.5 text-sm text-muted">These turn green as you fix them. You can check again as many times as you need.</p>
            <ul className="space-y-2">{hints.filter(([k]) => q.problems.includes(k) || k in q.checks).map(([k, hh, tip]) => { const ok = !q.problems.includes(k); return (
              <li key={k} className={cx("flex gap-2", ok && "opacity-70")}><span className={cx("font-black", ok ? "text-emerald" : "text-amber")}>{ok ? "✓" : "○"}</span><div><b>{hh}</b><div className="text-sm">{tip}</div></div></li>); })}</ul>
          </div>)}
      <NavBtns><Button kind="ghost" onClick={() => go(5)}>← Back</Button>
        <Button onClick={() => { if (submitted) { go(7); return; } if (q.ok) { ch((x) => { x.done[6] = true; }); go(7); return; } ch((x) => { x.reflChecks = (x.reflChecks || 0) + 1; x.showReflHints = true; }); }}>Check my reflection &amp; continue →</Button></NavBtns>
    </>
  );
  // ═════════ STEP 7 ═════════
  const miss = F.missing(d);
  const sc = meta.scores, tot = sc ? F.RUBRIC.reduce((a, [k]) => a + (sc[k] == null ? 0 : sc[k]!), 0) : 0;
  steps[7] = (
    <>
      <StepHead num="Step 7" title="Review and Submit" />
      {submitted && <Box tone="ok"><b>Submitted ✓</b> {meta.submitted_at && new Date(meta.submitted_at).toLocaleString()}. Mr. Dopp can see your work. If you need to change something, ask him to return it.</Box>}
      {meta.returned_at && !submitted && <Box tone="warn">Mr. Dopp returned your plan on {new Date(meta.returned_at).toLocaleDateString()}. Fix what he asked for, then submit again.</Box>}
      {sc && <><H3>Mr. Dopp&apos;s score</H3><Table head={<tr><th>Rubric</th><th className="n">Points</th></tr>} foot={<tr><td>Total{F.RUBRIC.every(([k]) => sc[k] != null) ? "" : " (so far)"}</td><td className="n">{tot} / 100</td></tr>}>
        {F.RUBRIC.map(([k, l, m]) => <tr key={k}><td>{l}</td><td className="n">{sc[k] == null ? "—" : sc[k]} / {m}</td></tr>)}</Table>{meta.teacher_note && <Box>{meta.teacher_note}</Box>}</>}
      <H3>Home</H3>
      <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1 text-sm sm:grid-cols-[200px_1fr]">
        <dt className="font-bold text-muted">Home</dt><dd>{h.type || "—"} in {h.place || "—"}{F.num(h.sqft) ? `, ${n0(F.num(h.sqft))} sq ft` : ""} · {F.num(h.people)} people · heat: {h.heat === "gas" ? "natural gas" : h.heat === "electric" ? "electric" : h.heat === "other" ? "propane/wood" : "—"}</dd>
        <dt className="font-bold text-muted">Monthly budget</dt><dd>{usd(F.num(h.budget), 0)} <span className="rounded bg-fg/10 px-1.5 text-xs font-black">{h.budgetSource === "researched" ? "RESEARCHED" : h.budgetSource === "guess" ? "GUESS" : "—"}</span>{h.budgetUrl && <> <a className="text-sky underline" href={h.budgetUrl} target="_blank" rel="noopener noreferrer">source</a></>}</dd>
        <dt className="font-bold text-muted">Prices</dt><dd>{F.num(h.elec)}¢/kWh · {F.num(h.gasPrice) ? usd(F.num(h.gasPrice)) + "/therm" : "no gas"} · {F.num(h.fuelPrice) ? usd(F.num(h.fuelPrice)) + "/gal gasoline" : "—"}</dd>
      </dl>
      <H3>Budget: my estimate vs. research</H3>
      <Table head={<tr><th>Category</th><th className="n">Estimate</th><th className="n">Researched</th><th className="n">Difference</th><th>Source</th></tr>}
        foot={<><tr><td>Monthly</td><td className="n">{usd(cmp.predictedMonthly)}</td><td className="n">{usd(cmp.researchedMonthly)}</td><td className="n">{usd(cmp.diffMonthly)}</td><td /></tr><tr><td>Annual</td><td className="n">{usd(cmp.predictedAnnual)}</td><td className="n">{usd(cmp.researchedAnnual)}</td><td className="n">{usd(cmp.diffAnnual)}</td><td /></tr></>}>
        {cmp.rows.map((x) => { const v = r.values[x.key] || {}; return <tr key={x.key}><td>{x.label}</td><td className="n">{usd(x.predicted)}</td><td className="n">{usd(x.researched)}</td><td className="n">{x.diff > 0 ? "+" : ""}{usd(x.diff)}</td><td>{v.src === "own" ? "Own: " + (v.note || "") : "Bill/label/calculator"}</td></tr>; })}
      </Table>
      <H3>Sources &amp; upgrades</H3>
      <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1 text-sm sm:grid-cols-[200px_1fr]">
        <dt className="font-bold text-muted">Upgrades chosen</dt><dd>{plan.on.length ? plan.on.map((u) => `${u.label} (${usd(u.total, 0)}, ${u.payback == null ? "no payback" : u.payback.toFixed(1) + " yr payback"})`).join("; ") : "None"}</dd>
        <dt className="font-bold text-muted">Bills after upgrades</dt><dd>{usd(plan.after, 0)} / month + {usd(plan.t.fundMonthly, 0)} upgrade fund</dd>
        <dt className="font-bold text-muted">{plan.surplus >= 0 ? "Left over" : "Short"}</dt><dd>{usd(plan.surplus, 0)} / month · {plan.meter.label}</dd>
        <dt className="font-bold text-muted">CO₂</dt><dd>{n0(plan.before.lbYear)} → {n0(plan.afterC.lbYear)} lb a year ({d.grid.mode === "custom" ? `my utility, ${F.num(d.grid.factor)} lb/kWh` : `U.S. average, ${F.F_KWH} lb/kWh`})</dd>
      </dl>
      <H3>Research evidence</H3>
      <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1 text-sm sm:grid-cols-[200px_1fr]"><dt className="font-bold text-muted">Location</dt><dd>{r.location || "—"}</dd><dt className="font-bold text-muted">Numbers from</dt><dd>{r.household || "—"}</dd>
        <dt className="font-bold text-muted">Source</dt><dd className="break-all">{r.url ? <a className="text-sky underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.url}</a> : "—"}</dd><dt className="font-bold text-muted">Screenshot</dt><dd>{meta.image ? "Added ✓" : "None (optional)"}</dd></dl>
      <H3>Reflection</H3>
      <div className="whitespace-pre-wrap rounded-xl border border-line bg-fg/[0.03] p-3 text-[15px]">{d.reflection || "—"}</div>
      {!submitted && (miss.length ? <Box tone="warn"><b>Before you can submit:</b><ul className="ml-5 mt-1 list-disc">{miss.map((x) => <li key={x}>{x}</li>)}</ul></Box> : <Box tone="ok">Everything required is done. Submit when you&apos;re ready.</Box>)}
      {subMsg}
      <NavBtns><Button kind="ghost" onClick={() => go(6)}>← Back</Button>
        <span className="flex flex-wrap gap-2"><Button kind="ghost" onClick={() => window.print()}>🖨 Print / Save as PDF</Button>
          {submitted ? <Button onClick={() => go(8)}>🏆 See my certificate →</Button> : <Button onClick={doSubmit}>Submit Assignment</Button>}</span></NavBtns>
    </>
  );
  // ═════════ STEP 8 ═════════
  steps[8] = (
    <>
      <StepHead num="🏆" title="Your Certificate" />
      <Box className="print:hidden">📸 <b>Turn it in:</b> take a <b>screenshot</b> of your whole certificate and upload it to the <b>Home Energy Budget assignment in Schoology</b>.<br /><small>Chromebook: <b>Ctrl + Shift + Show windows</b>, then drag around the certificate. Windows: <b>Win + Shift + S</b>. Mac: <b>Cmd + Shift + 4</b>. Phone/iPad: power + volume up.</small></Box>
      <div className="mx-auto mt-2 max-w-3xl rounded-2xl border-[3px] border-double border-gold bg-ink-2 px-4 py-7 text-center sm:px-10">
        <div className="text-5xl leading-none">⚡</div>
        <div className="mt-1.5 font-mono text-xs uppercase tracking-[0.25em] text-gold">Home Energy Budget · Earth Science</div>
        <h3 className="mb-2.5 mt-1 font-display text-3xl font-black sm:text-4xl">Certificate of Energy Readiness</h3>
        <div>This certifies that</div>
        <div className="mx-auto my-1.5 inline-block border-b-2 border-gold px-5 font-display text-3xl font-black text-gold">{student?.name || "Energy Planner"}</div>
        <p className="mx-auto my-3 max-w-xl text-[17px]"><b>planned a real home energy budget</b> for a {h.type?.toLowerCase() || "home"} in {h.place || "Idaho"}: predicted the bills, researched the real costs, compared energy sources and worked out the payback on efficiency upgrades.</p>
        <div className="my-4 grid gap-2.5 text-left" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(170px,100%),1fr))" }}>
          <Tile k="Real energy cost" v={usd(cmp.researchedMonthly, 0) + "/mo"} s={`my guess was ${usd(cmp.predictedMonthly, 0)} (${pct(cmp.pct)})`} />
          <Tile k="Budget check" v={plan.meter.label} s={`${usd(plan.budget, 0)} budget vs. ${usd(plan.need, 0)} needed`} />
          <Tile k="Upgrades" v={plan.on.length ? usd(plan.savings, 0) + "/mo" : "None"} s={plan.payback == null ? "no upgrades picked" : `saved · pays back in ${plan.payback.toFixed(1)} years`} />
          <Tile k="CO₂ a year" v={n0(plan.afterC.lbYear) + " lb"} s={`down from ${n0(plan.before.lbYear)} lb`} />
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-4 text-sm text-muted"><div className="min-w-[160px] flex-1 border-t border-fg pt-1">Mr. Dopp · Earth Scientist</div><div className="min-w-[160px] flex-1 border-t border-fg pt-1">{new Date(meta.submitted_at || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div></div>
      </div>
      <NavBtns><Button kind="ghost" onClick={() => go(7)}>← Back to my review</Button><Button kind="ghost" onClick={() => window.print()}>🖨 Print / Save as PDF</Button></NavBtns>
    </>
  );

  const doneArr = STEPS.map((_, i) => (i === 7 ? submitted : i === 8 ? submitted && !!d.visited[8] : !!d.done[i]));
  const nDone = Object.keys(d.done).filter((k) => d.done[+k] && +k < 8).length;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      {mode === "demo" && <Box tone="warn">🔑 <b>Practice mode:</b> you aren&apos;t logged in, so your plan saves on this device only and can&apos;t be submitted. Log in (top right) to save it to your account.</Box>}
      <StepPath steps={STEPS} cur={cur} done={doneArr} canEnter={canEnter} onGo={go} saveText={submitted ? "Submitted" : `${nDone} of 8 steps complete`} extra={<span className={save[1]}>{save[0]}</span>} />
      {submitted && cur < 7 && <Box tone="ok">Submitted ✓ Your plan is read-only now. Ask Mr. Dopp to return it if you need to change something.</Box>}
      <section className="block-panel mt-4 p-5 sm:p-8">{steps[cur]}</section>
    </div>
  );
}
// ── end wave-twinB ──
