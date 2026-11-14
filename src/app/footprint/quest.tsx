"use client";
// ── wave-twinB ── Footprint Quest: twin of Dopps Class "Weight Control Quest" (weight-control-quest.html).
// Same 9 steps, checks, test, balance check with tries, report, turn-in and certificate, with Earth science content:
// 15 everyday uses -> meter readings (water, electricity, natural gas, gasoline, CO2) -> a 3-day log built from
// uses and low-impact swaps (the Swap Shop = the Island Kitchen) -> top 5 -> the footprint goal check (= energy balance)
// -> a test on your own numbers -> report -> certificate.
// Saves: signed in = b_fp_save (supabase/migrations/008_twinsB.sql), practice = this device only (bedrock_fp_practice).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStudent } from "@/lib/db";
import { fpGet, fpLearned, fpLearnItem, fpMakeSwap, fpSave, notInstalled, twinReady, type FpLearned } from "@/lib/twinB";
import {
  Big, Box, Button, Count, Donut, Field, Grid, H3, HBar, INPUT, Lead, NavBtns, PIE, StepHead, StepPath, Table, Tile, Tiles,
  cx, fmt, fmt1, r0, r1, seeded, sgn, shuffle, store,
} from "@/components/twinb-kit";
import { CATS, F_GAL, F_KWH, F_THERM, ITEMS, ITEM_NOTE, NK, NLABEL, NSHORT, SWAPS, TAGS, frac, matchItem, norm, normKey, refText, shop, title,
  type Extra, type Meter, type NKey, type Swap, type Use } from "./book";

const N = 15, DIRECT = 13, HIDDEN = 2, PASS = 6, QN = 8;
const SLOTS = ["Morning", "School day", "Evening", "Night"];
const STEPS = ["Intro", "My 15", "Meters", "3 Days", "Top 5", "Goal", "Test", "Report", "Certificate"];
type Item = { f: string; s: string | number };
type Body = { people: string; kwh: string; therms: string; miles: string; mpg: string; goal: string };
type BalLog = { co2: number; need: number; pct: number; ok: boolean };
type Data = {
  v: number; group: string; town: string; items: Use[]; meters: Meter[]; log: Item[][][]; body: Body;
  cats: Record<string, string>; mySwaps: Extra[]; seen4: boolean; quiz: { tries: number; best: number; passed: boolean };
  tryCount: number; submitted: boolean; lastStep: number; bal: { tries: number; passed: boolean; last: string; log: BalLog[]; at?: string };
  certSeen: boolean; reportSeen: boolean;
};
const blank = (): Data => ({
  v: 1, group: "", town: "", items: Array.from({ length: N }, () => ({ name: "", type: "" as const })),
  meters: Array.from({ length: N }, () => ({ unit: "", water: "", kwh: "", therm: "", gas: "", co2: "" })),
  log: [0, 1, 2].map(() => SLOTS.map(() => [] as Item[])), body: { people: "", kwh: "", therms: "", miles: "", mpg: "25", goal: "" },
  cats: {}, mySwaps: [], seen4: false, quiz: { tries: 0, best: 0, passed: false }, tryCount: 0, submitted: false, lastStep: 0,
  bal: { tries: 0, passed: false, last: "", log: [] }, certSeen: false, reportSeen: false,
});
function merge(x: Partial<Data> | null): Data {
  const b = blank();
  if (!x || x.v !== 1) return b;
  const o = Object.assign(b, x) as Data;
  o.items = blank().items.map((f, i) => Object.assign(f, (x.items || [])[i] || {}));
  o.meters = blank().meters.map((n, i) => Object.assign(n, (x.meters || [])[i] || {}));
  o.log = blank().log.map((dm, d) => dm.map((_, k) => (((x.log || [])[d] || [])[k] || []).map((it) => ({ f: it.f, s: it.s }))));
  o.body = Object.assign(blank().body, x.body || {});
  o.quiz = Object.assign({ tries: 0, best: 0, passed: false }, x.quiz || {});
  o.bal = Object.assign({ tries: 0, passed: false, last: "", log: [] }, x.bal || {});
  o.mySwaps = x.mySwaps || []; o.cats = x.cats || {};
  return o;
}
const numOk = (v: unknown) => v !== "" && v !== null && v !== undefined && isFinite(+v!) && +v! >= 0;
const swapOf = (f: string) => (typeof f === "string" && f.startsWith("d:") ? f.slice(2) : null);
const zero = (): Record<NKey, number> => ({ water: 0, kwh: 0, therm: 0, gas: 0, co2: 0 });
const LIMIT = 0.25; // the plan must land within ±25% of the goal (the ±10 lb a year of Weight Control Quest)
const GOALS: [string, string][] = [["0.1", "Cut 10% (a small, steady change)"], ["0.2", "Cut 20% (a real challenge)"], ["0.3", "Cut 30% (big changes at home)"]];

type Quiz = { q: string; opts: string[]; ans: string };

export function FootprintQuest() {
  const { student, ready } = useStudent();
  const mode: "cloud" | "practice" = student && twinReady ? "cloud" : "practice";
  const localKey = student ? "bedrock_fp_" + student.id : "bedrock_fp_practice";
  const [D, setD] = useState<Data>(blank);
  const [cur, setCur] = useState(0);
  const [day, setDay] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [save, setSaveState] = useState<[string, string]>(["Not saved yet", ""]);
  const [quizLive, setQuizLive] = useState<{ qs: Quiz[]; picked: Record<number, string>; graded?: { right: number; pass: boolean } } | null>(null);
  const [learn, setLearn] = useState<FpLearned>({ items: [], swaps: [], book: [] });
  const [kq, setKq] = useState(""); const [kAll, setKAll] = useState(false);
  const [mkOpen, setMkOpen] = useState(false); const [mkMsg, setMkMsg] = useState<ReactNode>(""); const [mkName, setMkName] = useState(""); const [mkAmt, setMkAmt] = useState<Record<number, string>>({});
  const [gtab, setGtab] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stageRef = useRef(0);
  const saving = useRef(false), again = useRef(false), latest = useRef(D);

  // ---------- swap shop ----------
  const LEARN = useMemo(() => { const m: Record<string, string> = {}; learn.items.forEach((f) => { m[normKey(f.n)] = f.cat; }); return m; }, [learn]);
  const K = useMemo(() => {
    const extra: Extra[] = (D.mySwaps || []).map((d) => ({ ...d, tag: "M" }))
      .concat(learn.swaps.map((d) => ({ ...d, tag: "U" })), learn.book.map((d) => ({ ...d, tag: "B" })));
    return shop(D.items, D.meters, extra, { ...LEARN, ...(D.cats || {}) });
  }, [D.items, D.meters, D.mySwaps, D.cats, learn, LEARN]);
  const named = D.items.map((f, i) => ({ i, name: f.name.trim() })).filter((f) => f.name);
  const swapName = (id: string) => K.byId[id]?.name ?? SWAPS.find((x) => x[0] === id)?.[1] ?? (D.mySwaps || []).concat(learn.swaps, learn.book).find((x) => x.id === id)?.name ?? id;
  const itemName = (it: Item) => { const id = swapOf(it.f); if (id) return swapName(id); return D.items[+it.f]?.name ?? ""; };

  // ---------- checks ----------
  const step1 = () => {
    const nat = D.items.filter((f) => f.name.trim() && f.type === "D").length, com = D.items.filter((f) => f.name.trim() && f.type === "H").length;
    const names = D.items.map((f) => f.name.trim().toLowerCase()).filter(Boolean);
    const dupes = names.length !== new Set(names).size;
    return { nat, com, dupes, ok: nat === DIRECT && com === HIDDEN && !dupes };
  };
  const meterCheck = (i: number, d: Data = D): { ok: boolean; msg: string; blank?: boolean; bad?: string[] } => {
    const n = d.meters[i], hidden = d.items[i].type === "H";
    if (!String(n.unit).trim()) return { ok: false, msg: "Add a unit (example: 1 shower, 1 mile, 1 load, 1 hour).", blank: true };
    for (const k of NK) if (!numOk(n[k])) return { ok: false, msg: "Fill in all five numbers (use 0 if there is none).", blank: true };
    const w = +n.water, e = +n.kwh, t = +n.therm, g = +n.gas, c = +n.co2;
    if (w > 5000) return { ok: false, msg: "Over 5,000 gallons for one use? Check your unit.", bad: ["water"] };
    if (e > 200 || t > 20 || g > 50) return { ok: false, msg: "One of those energy numbers is way too high for one use. Check the label, bill or meter again.", bad: ["kwh", "therm", "gas"] };
    if (c > 500) return { ok: false, msg: "Over 500 lb of CO₂ for one use? Check your unit.", bad: ["co2"] };
    const est = e * F_KWH + t * F_THERM + g * F_GAL, gap = Math.abs(c - est), tol = Math.max(0.5, 0.25 * Math.max(c, est));
    const work = `${r1(e)}×${F_KWH} + ${r1(t)}×${F_THERM} + ${r1(g)}×${F_GAL} = ${fmt1(est)} lb`;
    if (hidden) {
      if (c + tol < est) return { ok: false, msg: `Hidden footprints include the fuel you listed plus farming or factory emissions, so CO₂ can't be less than the fuel part: ${work}. You entered ${fmt1(c)}.`, bad: ["co2"] };
      return { ok: true, msg: `✓ Checks out (fuel part ${fmt1(est)} lb + ${fmt1(Math.max(0, c - est))} lb from farming, factories or shipping)` };
    }
    if (gap > tol) return { ok: false, msg: `Numbers don't match: ${work} of CO₂, but you entered ${fmt1(c)}. Look again.`, bad: ["co2", "kwh", "therm", "gas"] };
    return { ok: true, msg: `✓ Checks out (${fmt1(est)} lb from the fuel vs. ${fmt1(c)} lb you entered)` };
  };
  const step2count = () => D.items.reduce((a, f, i) => a + (f.name.trim() && meterCheck(i).ok ? 1 : 0), 0);
  const step2ok = () => step1().ok && step2count() === N;
  const slotKey = (m: Item[]) => m.filter((it) => it.f !== "" && it.f != null).map((it) => String(it.f)).sort().filter((v, i, a) => a.indexOf(v) === i).join(",");
  const slotStatus = () => {
    const keys: string[] = [];
    D.log.forEach((dm) => dm.forEach((m) => keys.push(slotKey(m))));
    return keys.map((key, idx) => {
      const m = D.log[Math.floor(idx / 4)][idx % 4];
      const gone = m.some((it) => swapOf(it.f) && !K.byId[swapOf(it.f)!]);
      const bad = gone || m.some((it) => it.f !== "" && !(+it.s > 0));
      const filled = key !== "" && !bad, dup = filled && keys.some((k2, j) => j !== idx && k2 === key);
      return { filled, dup, bad, gone, ok: filled && !dup };
    });
  };
  const step3ok = () => step2ok() && slotStatus().every((s) => s.ok);

  // ---------- totals ----------
  const totals = () => {
    const per = Array.from({ length: N }, () => ({ ...zero(), srv: 0 }));
    const days = [0, 1, 2].map(zero), slotT: Record<NKey, number>[] = [], swapSrv: Record<string, number> = {};
    D.log.forEach((dm, d) => dm.forEach((m) => {
      const t = zero();
      m.forEach((it) => {
        if (it.f === "" || it.f == null) return;
        const s = +it.s || 0, did = swapOf(it.f);
        if (did) {
          const dd = K.byId[did]; if (!dd) return;
          swapSrv[did] = (swapSrv[did] || 0) + s;
          dd.parts.forEach((p) => { NK.forEach((key, j) => { const v = p.nut[j] * s; t[key] += v; per[p.i][key] += v; days[d][key] += v; }); per[p.i].srv += s * p.a; });
          return;
        }
        const n = D.meters[+it.f];
        NK.forEach((key) => { const v = (+n[key] || 0) * s; t[key] += v; per[+it.f][key] += v; days[d][key] += v; });
        per[+it.f].srv += s;
      });
      slotT.push(t);
    }));
    const all = days.reduce((a, x) => { NK.forEach((k) => (a[k] += x[k])); return a; }, zero());
    const avg = zero(); NK.forEach((k) => (avg[k] = all[k] / 3));
    const rank = per.map((p, i) => ({ i, ...p })).filter((p) => D.items[p.i].name.trim()).sort((a, b) => b.co2 - a.co2);
    const top5 = rank.slice(0, 5).reduce((a, p) => a + p.co2, 0);
    const direct = per.reduce((a, p, i) => a + (D.items[i].type === "D" ? p.co2 : 0), 0) / 3;
    const hidden = per.reduce((a, p, i) => a + (D.items[i].type === "H" ? p.co2 : 0), 0) / 3;
    return { per, days, slotT, all, avg, rank, swapSrv, top5share: all.co2 ? (top5 / all.co2) * 100 : 0, used: rank.filter((p) => p.srv > 0).length, direct, hidden };
  };
  // household baseline from bills (= BMR + activity in Weight Control Quest)
  const homeCalc = () => {
    const b = D.body, people = +b.people, kwh = +b.kwh, therms = +(b.therms || 0), miles = +(b.miles || 0), mpg = +b.mpg, goal = +b.goal;
    if (!(people >= 1 && people <= 20) || !(numOk(b.kwh) && kwh <= 10000) || !(therms >= 0 && therms <= 1000) || !(miles >= 0 && miles <= 3000) || !(mpg >= 5 && mpg <= 150) || !goal) return null;
    const elec = (kwh * F_KWH) / 30.4 / people, heat = (therms * F_THERM) / 30.4 / people, car = ((miles / mpg) * F_GAL) / 7 / people;
    const base = elec + heat + car;
    return { people, kwh, therms, miles, mpg, goal, elec, heat, car, base, target: base * (1 - goal) };
  };
  const balance = () => {
    const c = homeCalc(); if (!c) return null;
    const t = totals(), gap = t.direct - c.target, lo = c.target * (1 - LIMIT), hi = c.target * (1 + LIMIT);
    const cut = c.base ? (1 - t.direct / c.base) * 100 : 0;
    return { c, t, gap, lo, hi, cut, yr: (t.direct - c.base) * 365, ok: t.direct >= lo && t.direct <= hi };
  };
  const step5ok = () => step3ok() && !!homeCalc() && !!balance()?.ok;
  const doneList = () => [!!D.group.trim(), step1().ok, step2ok(), step3ok(), step3ok() && D.seen4, step5ok() && D.seen4, D.quiz.passed,
    D.submitted || (D.reportSeen && mode !== "cloud"), D.quiz.passed && step5ok() && !!D.certSeen];
  const canEnter = (i: number) => { const d = doneList(); for (let k = 0; k < i; k++) if (!d[k]) return false; return true; };
  const stageCompleted = (d: boolean[]) => d.slice(1, 7).filter(Boolean).length;

  // ---------- saving ----------
  const flush = useCallback(async () => {
    if (saving.current) { again.current = true; return; }
    saving.current = true;
    const d = latest.current;
    try {
      const r = await fpSave({ ...d, tryCount: d.quiz.tries }, stageRef.current, !!d.submitted);
      setSaveState([r.submitted ? "Turned in ✓ (changes still save)" : "Saved ✓", "font-extrabold text-emerald"]);
    } catch (e) { setSaveState(["Saved on this device. Cloud save failed: " + (e as Error).message, "font-extrabold text-crimson"]); }
    saving.current = false;
    if (again.current) { again.current = false; flush(); }
  }, []);
  const queueSave = (d: Data) => {
    latest.current = d;
    store.set(localKey, JSON.stringify(d));
    if (mode !== "cloud") { setSaveState(["Practice mode: saved on this device only", ""]); return; }
    setSaveState(["Saving…", ""]); clearTimeout(timer.current); timer.current = setTimeout(flush, 900);
  };
  /** change the draft: copy, edit, render, save */
  const ch = (fn: (d: Data) => void) => setD((old) => { const n = structuredClone(old); fn(n); queueSave(n); return n; });

  // ---------- load ----------
  useEffect(() => {
    if (!ready) return;
    let off = false;
    (async () => {
      let d: Data;
      const local = (() => { try { return JSON.parse(store.get(localKey) || "null"); } catch { return null; } })();
      if (mode === "cloud") {
        setSaveState(["Loading…", ""]);
        try { const row = await fpGet(); d = merge((row?.data as Partial<Data>) || local); setSaveState([d.submitted ? "Turned in ✓" : "Saved ✓", "font-extrabold text-emerald"]); }
        catch (e) { d = merge(local); setSaveState([notInstalled(e) ? "Saved on this device (the class database isn't switched on for this quest yet)" : "Could not load saved work: " + (e as Error).message, "font-extrabold text-crimson"]); }
      } else d = merge(local);
      if (off) return;
      latest.current = d; setD(d); setLoaded(true);
    })();
    fpLearned().then((L) => { if (!off) setLearn(L); }).catch(() => {});
    return () => { off = true; };
  }, [ready, mode, localKey]);
  // first render after load: jump to the last step the student can open
  const jumped = useRef(false);
  useEffect(() => {
    if (!loaded || jumped.current) return; jumped.current = true;
    let s = Number.isInteger(D.lastStep) ? D.lastStep : 0;
    while (s > 0 && !canEnter(s)) s--;
    setCur(s);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const done = doneList();
  stageRef.current = stageCompleted(done);
  const go = (i: number) => {
    if (!canEnter(i) || (quizLive && !quizLive.graded)) return;
    setCur(i); ch((d) => { d.lastStep = i; if (i === 7) d.reportSeen = true; if (i === 8) d.certSeen = true; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // balance tries: one try every time the Goal step sends a student back (each different too-high / too-low result)
  const noteBalance = () => {
    const b = step3ok() ? balance() : null; if (!b || D.bal.passed) return;
    const key = r1(b.t.direct) + "|" + r1(b.c.target);
    if (key === D.bal.last) return;
    ch((d) => {
      d.bal.last = key; d.bal.log.push({ co2: r1(b.t.direct), need: r1(b.c.target), pct: r0(b.cut), ok: b.ok });
      if (!b.ok) d.bal.tries++; else { d.bal.passed = true; d.bal.at = new Date().toISOString(); }
    });
  };
  useEffect(() => { if (loaded && (cur === 5 || cur === 8)) noteBalance(); }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return <div className="block-panel mx-auto max-w-5xl animate-pulse p-10 text-center text-muted">Opening your footprint ledger…</div>;
  const t = totals(), st = slotStatus(), c = homeCalc(), bb = balance();
  const nextOk = canEnter(cur + 1);
  const next = (label: string) => <Button onClick={() => go(cur + 1)} disabled={!nextOk}>{label}</Button>;
  const back = () => <Button kind="ghost" onClick={() => go(cur - 1)}>← Back</Button>;
  const nm = (i: number) => D.items[i].name.trim();

  // ---------- quiz ----------
  const numOpts = (correct: number, pool: number[], R: () => number, unit: string, round: (v: number) => number) => {
    const cc = round(correct), out = [cc];
    const cands = shuffle(pool.map(round).filter((v) => v >= 0), R).concat([cc * 2, cc * 0.5, cc * 1.5, cc + 10, cc * 3].map(round));
    for (const v of cands) { if (out.length >= 4) break; if (out.every((o) => Math.abs(o - v) > Math.max(0.15 * Math.max(o, v), round === r1 ? 0.15 : 1))) out.push(v); }
    let k = 1; while (out.length < 4) { const v = round(cc + (round === r1 ? 0.5 : 5) * k * (k % 2 ? 1 : -1) + (round === r1 ? 0.3 : 3)); if (v >= 0 && !out.includes(v)) out.push(v); k++; }
    const f = (v: number) => (round === r1 ? r1(v).toLocaleString("en-US") : fmt(v)) + unit;
    return { opts: shuffle(out.map(f), R), ans: f(cc) };
  };
  const buildQuiz = (seed: number): Quiz[] => {
    const R = seeded(seed), items = named.map((f) => f.i), used = t.rank.filter((p) => p.srv > 0).map((p) => p.i);
    const qs: Quiz[] = [], pick = <T,>(arr: T[], n: number) => shuffle(arr.slice(), R).slice(0, n);
    const rw = (v: number) => (v >= 20 ? Math.round(v / 5) * 5 : Math.round(v));
    const [a, b] = pick(used.slice(0, 6).length >= 2 ? used.slice(0, 6) : items, 2);
    const wq = [a, b].find((i) => +D.meters[i].water > 0) ?? items.find((i) => +D.meters[i].water > 0);
    if (wq != null) qs.push({ q: `About how many gallons of water does one ${D.meters[wq].unit} of ${nm(wq)} use, by your numbers?`, ...numOpts(+D.meters[wq].water, items.map((j) => +D.meters[j].water), R, " gal", rw) });
    [a, b].forEach((i) => qs.push({ q: `About how much CO₂ comes from one ${D.meters[i].unit} of ${nm(i)}?`, ...numOpts(+D.meters[i].co2, items.filter((j) => j !== i).map((j) => +D.meters[j].co2), R, " lb", r1) }));
    let most = 0;
    shuffle([["water", "water"], ["kwh", "electricity"], ["co2", "CO₂"]] as [NKey, string][], R).forEach(([k, word]) => {
      if (most >= 2) return;
      const v = (i: number) => +D.meters[i][k];
      const winners = items.filter((i) => items.filter((j) => v(j) < v(i)).length >= 3);
      if (!winners.length) return;
      const win = pick(winners, 1)[0], four = [win, ...pick(items.filter((j) => v(j) < v(win)), 3)];
      qs.push({ q: `Per use, which of these takes the most ${word}?`, opts: shuffle(four.map(nm), R), ans: nm(win) }); most++;
    });
    const top = t.rank[0], others = pick(t.rank.slice(1).map((p) => p.i), 3);
    qs.push({ q: "Which item made the most CO₂ over your 3 days?", opts: shuffle([top.i, ...others].map(nm), R), ans: nm(top.i) });
    const sh = Math.round(t.top5share / 5) * 5, shOpts = [sh];
    [-30, 30, -15, 15, -45, 45].forEach((dd) => { const v = sh + dd; if (shOpts.length < 4 && v >= 5 && v <= 100) shOpts.push(v); });
    qs.push({ q: "About what share of your CO₂ came from your top 5 items?", opts: shuffle(shOpts.map((v) => v + "%"), R), ans: sh + "%" });
    if (R() < 0.5 && c) qs.push({ q: "By your bills, about how many pounds of CO₂ a day does each person in your home make (your baseline)?", ...numOpts(c.base, [c.base * 0.5, c.base * 1.6, c.target], R, " lb", r1) });
    else qs.push({ q: "Your 3 days averaged about how many gallons of water a day?", ...numOpts(t.avg.water, [t.avg.water * 0.6, t.avg.water * 1.4, t.avg.water * 1.8], R, " gal", rw) });
    while (qs.length < QN) {
      const fi = pick(items, 1)[0];
      qs.push({ q: `How many kWh of electricity does one ${D.meters[fi].unit} of ${nm(fi)} use?`, ...numOpts(+D.meters[fi].kwh, items.map((j) => +D.meters[j].kwh), R, " kWh", r1) });
    }
    return shuffle(qs, R).slice(0, QN);
  };
  const startQuiz = () => setQuizLive({ qs: buildQuiz(Date.now() & 0xffffffff), picked: {} });
  const gradeQuiz = () => {
    if (!quizLive) return;
    const missing = quizLive.qs.filter((_, n) => !quizLive.picked[n]).length;
    if (missing) { alert("Answer every question first (" + missing + " left)."); return; }
    const right = quizLive.qs.filter((q, n) => quizLive.picked[n] === q.ans).length, pass = right >= PASS;
    ch((d) => { d.quiz.tries++; d.quiz.best = Math.max(d.quiz.best, right); if (pass) d.quiz.passed = true; });
    setQuizLive({ ...quizLive, graded: { right, pass } });
  };

  // ---------- make a swap ----------
  const makeSwap = async () => {
    const name = mkName.trim().replace(/\s+/g, " ");
    const picks = named.map((f) => [f.i, +(mkAmt[f.i] || 0)] as [number, number]).filter((x) => x[1] > 0);
    if (name.length < 3) { setMkMsg(<span className="font-extrabold text-crimson">Give your swap a name.</span>); return; }
    if (!picks.length) { setMkMsg(<span className="font-extrabold text-crimson">Put at least one item in your swap.</span>); return; }
    const ings: [string, number][] = picks.map(([i, n]) => [matchItem(D.items[i].name) || "x:" + normKey(D.items[i].name), n]);
    const id = "s-" + norm(name).replace(/ /g, "-");
    if (SWAPS.some((r) => norm(r[1]) === norm(name))) { setMkMsg(<span className="font-extrabold text-crimson">&ldquo;{name}&rdquo; is already in the Swap Shop. Look it up above.</span>); return; }
    ch((d) => { d.mySwaps = (d.mySwaps || []).filter((x) => x.id !== id).concat([{ id, name: title(name), ings }]); });
    setMkOpen(false); setMkName(""); setMkAmt({});
    let msg: ReactNode = <span className="font-extrabold text-emerald">&ldquo;{title(name)}&rdquo; is in your Swap Shop. Add it to your log below!</span>;
    if (mode === "cloud") {
      try { const r = await fpMakeSwap(name, ings); msg = <>{msg} {r.shared ? <b>2 students have made it, so it&apos;s now in everyone&apos;s Swap Shop.</b> : "If one more student makes a swap with this name, everyone gets it."}</>; }
      catch (e) { if (!notInstalled(e)) { ch((d) => { d.mySwaps = d.mySwaps.filter((x) => x.id !== id); }); msg = <span className="font-extrabold text-crimson">{(e as Error).message}</span>; } }
    }
    setMkMsg(msg);
  };
  const teachItem = (lk: string, name: string, cat: string) => {
    ch((d) => { d.cats = { ...(d.cats || {}), [lk]: cat }; });
    if (mode === "cloud") fpLearnItem(name, cat).catch(() => {});
  };

  // ---------- sample ----------
  const fillSample = () => {
    if (!confirm("Replace this page with sample data?")) return;
    const F: [string, "D" | "H", string, number, number, number, number, number][] = [
      ["Showers", "D", "1 shower (8 min)", 20, 0, 0.1, 0, 1.2], ["Toilet flushes", "D", "1 flush", 1.6, 0, 0, 0, 0], ["Brushing teeth", "D", "2 min of tap", 4, 0, 0, 0, 0],
      ["Dishwasher", "D", "1 load", 4, 1.2, 0, 0, 1], ["Laundry", "D", "1 load", 20, 0.3, 0, 0, 0.24], ["Clothes dryer", "D", "1 load", 0, 2.5, 0, 0, 2],
      ["Car rides", "D", "1 mile", 0, 0, 0, 0.04, 0.78], ["Bike", "D", "1 mile", 0, 0, 0, 0, 0], ["Phone charging", "D", "1 charge", 0, 0.015, 0, 0, 0.012],
      ["Laptop", "D", "1 hour", 0, 0.05, 0, 0, 0.04], ["Video games", "D", "1 hour", 0, 0.15, 0, 0, 0.12], ["LED lights", "D", "1 bulb-hour", 0, 0.01, 0, 0, 0.008],
      ["Furnace heat", "D", "1 day (my share)", 0, 0.5, 1, 0, 12.1], ["Hamburgers", "H", "1 quarter-pound patty", 460, 0, 0, 0, 15], ["Idaho potatoes", "H", "1 medium potato", 15, 0, 0, 0, 0.2]];
    const d = blank(); d.group = "Sample group"; d.town = "Idaho Falls";
    F.forEach((f, i) => { d.items[i] = { name: f[0], type: f[1] }; d.meters[i] = { unit: f[2], water: f[3], kwh: f[4], therm: f[5], gas: f[6], co2: f[7] }; });
    const M: [number, number][][] = [[[0, 1], [1, 2], [2, 1]], [[6, 2], [9, 2]], [[13, 1], [10, 1], [12, 0.5]], [[11, 5], [8, 1], [12, 0.25]],
      [[0, 1], [2, 1], [3, 1]], [[7, 4], [1, 3], [9, 3]], [[14, 2], [4, 1], [5, 1], [12, 0.5]], [[11, 4], [12, 0.25], [10, 1]],
      [[0, 0.5], [1, 2]], [[6, 4], [9, 1], [1, 1], [8, 1]], [[13, 1], [10, 2], [12, 0.5], [3, 1]], [[11, 4], [8, 1], [12, 0.25], [2, 1]]];
    M.forEach((m, idx) => { d.log[Math.floor(idx / 4)][idx % 4] = m.map(([f, s]) => ({ f: String(f), s })); });
    d.body = { people: "4", kwh: "900", therms: "60", miles: "150", mpg: "25", goal: "0.2" };
    queueSave(d); setD(d); setCur(0);
  };

  // =====================================================================
  const meterCls = (i: number) => { const r = meterCheck(i); return r.ok ? "border-emerald/50" : r.blank ? "border-line" : "border-crimson/60"; };
  const swapCard = (d: Swap) => (
    <div key={d.id} className="rounded-xl border border-line bg-fg/[0.03] p-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-sky">{TAGS[d.tag] || ""}</div>
      <div className="font-extrabold">🔁 {d.name}</div>
      <div className="my-1 text-[13px] font-extrabold">{fmt1(d.nut.water)} gal · {fmt1(d.nut.kwh)} kWh · {fmt1(d.nut.co2)} lb CO₂</div>
      <div className="text-xs leading-snug text-muted">{d.parts.map((p) => `${D.items[p.i].name} ×${frac(p.a)}`).join(" · ")}</div>
      {d.tag === "M" && <Button kind="ghost" small className="mt-1.5" onClick={() => ch((x) => { x.mySwaps = x.mySwaps.filter((s) => s.id !== d.id); })}>Remove my swap</Button>}
    </div>
  );
  const kitchen = () => {
    const q = kq.trim().toLowerCase();
    const can = q ? K.can.filter((d) => d.name.toLowerCase().includes(q)) : K.can, almost = q ? K.almost.filter((d) => d.name.toLowerCase().includes(q)) : K.almost;
    const shown = q || kAll ? can : can.slice(0, 6);
    return (
      <div className="my-2 rounded-2xl border-2 border-gold/50 bg-gold/[0.06] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><b className="font-display text-xl font-extrabold">🔁 Swap Shop</b><Count ok>You can use {K.can.length} swaps</Count></div>
        <p className="my-1.5 text-sm text-muted">The Swap Shop checked your 15 uses against its book. These are the lower-impact swaps you can log instead. Each one is priced with the numbers from <b className="text-fg">your</b> meters. The shop keeps growing as students teach it new items and make new swaps.</p>
        {K.unknown.map((u) => (
          <Box tone="warn" key={u.lk}>🤔 The Swap Shop doesn&apos;t know <b>{u.name}</b> yet. What kind of use is it?
            <div className="mt-1.5 flex flex-wrap gap-1.5">{Object.keys(CATS).map((k) => <Button key={k} kind="ghost" small onClick={() => teachItem(u.lk, u.name, k)}>{CATS[k]}</Button>)}</div>
          </Box>
        ))}
        <input type="search" value={kq} onChange={(e) => setKq(e.target.value)} placeholder="Look up a swap (shower, carpool, LED…)" aria-label="Look up a swap" className={INPUT} />
        {q && !can.length && (almost.length
          ? <Box tone="warn">You can&apos;t use <b>{kq}</b> yet: {almost.map((a, i) => <span key={a.id}>{i ? "; " : ""}<b>{a.name}</b> needs {a.missing}</span>)}.</Box>
          : <Box tone="warn"><b>{kq}</b> isn&apos;t in the Swap Shop yet. If you could do it with your 15 uses, make it below!</Box>)}
        <div className="my-2.5 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(230px,100%),1fr))" }}>{shown.map(swapCard)}</div>
        {!q && can.length > 6 && <Button kind="ghost" small onClick={() => setKAll(!kAll)}>{kAll ? "Show fewer" : `Show all ${can.length} swaps`}</Button>}
        {!q && almost.length > 0 && (
          <details className="mt-2.5"><summary className="cursor-pointer font-extrabold text-amber">Almost! {almost.length} more swaps are missing just 1 use</summary>
            <div className="mt-1.5 text-sm text-muted">{almost.map((a, i) => <span key={a.id}>{i ? " · " : ""}{a.name} <i>(needs {a.missing})</i></span>)}</div></details>
        )}
        <div className="mt-2.5 border-t border-dashed border-line pt-2.5 text-sm">
          Want a swap that isn&apos;t here? <b>Make your own</b> from your 15 uses. <Button kind="ink" small onClick={() => { setMkOpen(!mkOpen); setMkMsg(""); if (!mkOpen && q && !can.length) setMkName(kq); }}>{mkOpen ? "Close" : "🔁 Make a swap"}</Button>
          {mkMsg && <div className="my-2">{mkMsg}</div>}
          {mkOpen && (
            <form className="mt-2 grid gap-2" onSubmit={(e) => { e.preventDefault(); makeSwap(); }}>
              <Field label="Swap name"><input className={INPUT} maxLength={50} value={mkName} onChange={(e) => setMkName(e.target.value)} placeholder="Example: Bucket shower" /></Field>
              <div><b>How many uses of each item go into one swap?</b> <span className="text-muted">(leave 0 for items it doesn&apos;t use; ½ = 0.5)</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{named.map((f) => (
                  <label key={f.i} className="flex items-center gap-1.5 rounded-full border border-line bg-fg/[0.03] px-2.5 py-1 text-[13px] font-bold">{f.name}
                    <input type="number" min={0} max={20} step={0.25} value={mkAmt[f.i] ?? "0"} onChange={(e) => setMkAmt({ ...mkAmt, [f.i]: e.target.value })} className="w-16 rounded-lg border border-line bg-ink px-1.5 py-0.5 text-fg" aria-label={`Uses of ${f.name}`} /></label>))}</div></div>
              <div><Button type="submit" small>Add to my Swap Shop</Button></div>
              <div className="text-xs text-muted">You can use your swap right away. When 2 students make a swap with the same name, it goes in everyone&apos;s Swap Shop.</div>
            </form>
          )}
        </div>
      </div>
    );
  };

  const step = (() => {
    switch (cur) {
      case 0: return (
        <>
          <StepHead num="Intro" title="Spaceship Earth" />
          <Box tone="story">
            <p>Earth is a closed system, like a spaceship. No new water arrives from space, and every pound of carbon dioxide we make stays in the same thin atmosphere. Your mission: find out <b>exactly</b> how much water and energy your everyday life uses, and whether you can shrink it.</p>
            <p className="mt-2">Every day you shower, ride somewhere, charge a phone and eat. Each one leaves a <b>footprint</b>: water that has to be pumped and cleaned, and carbon dioxide from burning coal, natural gas and gasoline. Some footprints are <b>hidden</b>: a hamburger used water and made greenhouse gases on a farm long before it reached your plate.</p>
            <p className="mt-2">With your group, you&apos;ll pick <b>15 everyday uses</b>, read their &ldquo;meters,&rdquo; log 3 typical days, and see what your life adds up to. Then you&apos;ll set a goal and use <b>swaps</b> to hit it.</p>
          </Box>
          <Box><b>Why this matters:</b> most of a person&apos;s footprint comes from a handful of things done over and over. Know those few, and you can change the most with the least effort. (Chapter 25: Earth&apos;s Resources and Energy · Chapter 26: Human Impact.)</Box>
          <Grid>
            <Field label="Your group members" small="Everyone in your group enters the same 15 uses in their own account."><input className={INPUT} value={D.group} onChange={(e) => ch((d) => { d.group = e.target.value; })} placeholder="Example: Maya, Josh, Ellie" /></Field>
            <Field label="Your town" small="Just for your report."><input className={INPUT} value={D.town} onChange={(e) => ch((d) => { d.town = e.target.value; })} placeholder="Example: Pocatello" /></Field>
          </Grid>
          <NavBtns><span />{next("Choose our 15 uses →")}</NavBtns>
        </>
      );
      case 1: { const s1 = step1(); return (
        <>
          <StepHead num="Step 1" title="Pick Your 15" />
          <Box tone="story">Your group gets <b>one list</b>. Whatever you write here is what you&apos;ll measure. Pick things you really do every week.</Box>
          <Lead>Choose exactly <b>13 direct uses</b> and <b>2 hidden footprints</b>.</Lead>
          <Box><b>Direct use</b> = water or energy you use yourself, at home or on the road: showers, toilet flushes, laundry, car miles, phone charging, lights, the furnace.<br />
            <b>Hidden footprint</b> = something you buy or eat that used water and energy before you got it: a hamburger, a cotton T-shirt, jeans, bottled water.<br />Be specific: &ldquo;8-minute showers,&rdquo; not &ldquo;water.&rdquo; &ldquo;Car rides to school,&rdquo; not &ldquo;travel.&rdquo;</Box>
          <div>{D.items.map((f, i) => (
            <div key={i} className="grid grid-cols-[30px_1fr] items-center gap-2.5 border-b border-line py-2 last:border-0 sm:grid-cols-[34px_1fr_200px]">
              <span className="text-center font-black text-muted">{i + 1}</span>
              <input className={INPUT} value={f.name} maxLength={60} placeholder={`Use ${i + 1}`} aria-label={`Use ${i + 1}`} onChange={(e) => ch((d) => { d.items[i].name = e.target.value; })} />
              <select className={cx(INPUT, "col-start-2 sm:col-start-auto")} value={f.type} aria-label={`Use ${i + 1} type`} onChange={(e) => ch((d) => { d.items[i].type = e.target.value as Use["type"]; })}>
                <option value="">Direct or hidden?</option><option value="D">Direct use</option><option value="H">Hidden footprint</option>
              </select>
            </div>))}
          </div>
          <div className="my-3 flex flex-wrap gap-2">
            <Count ok={s1.nat === DIRECT}>Direct: {s1.nat} / {DIRECT}</Count><Count ok={s1.com === HIDDEN}>Hidden: {s1.com} / {HIDDEN}</Count>
            {s1.dupes && <Count bad>Two uses have the same name</Count>}{s1.ok && <Count ok>List ready ✓</Count>}
          </div>
          <NavBtns>{back()}{next("Read the meters →")}</NavBtns>
        </>
      ); }
      case 2: return (
        <>
          <StepHead num="Step 2" title="Read the Meters" />
          <Box tone="story">Every use has a meter somewhere: the water meter, the power meter, the gas meter, the gas pump. These 15 uses are now <b>your footprint</b>, so you need to know exactly what each one takes.</Box>
          <Lead>For each use, pick a unit and enter its water, electricity, natural gas, gasoline and CO₂ for <b>one unit</b>.</Lead>
          <Box>Where to look: appliance labels (watts × hours ÷ 1,000 = kWh), your family&apos;s power, gas and water bills, the <a className="font-bold text-sky underline" href="https://www.energy.gov/energysaver/estimating-appliance-and-home-electronic-energy-use" target="_blank" rel="noopener noreferrer">Energy Saver appliance guide</a>, or the hints under each card.<br />
            <b>Check your work:</b> CO₂ comes from burning fuel. kWh × {F_KWH} + therms × {F_THERM} + gallons of gasoline × {F_GAL} should land close to the CO₂ (about {F_KWH} lb per kWh on the U.S. grid; Idaho&apos;s hydropower-heavy grid is cleaner). Hidden footprints can be higher, never lower.</Box>
          <div className="my-3"><Count ok={step2count() === N}>{step2count()} / 15 checked</Count></div>
          {D.items.map((f, i) => {
            const n = D.meters[i], r = meterCheck(i), key = matchItem(f.name), ref = refText(key);
            const inp = (k: NKey) => (
              <label key={k} className="flex flex-col gap-0.5 text-xs font-extrabold text-muted">{NLABEL[k]}
                <input type="number" min={0} step="any" inputMode="decimal" value={n[k]} placeholder="0"
                  className={cx(INPUT, "!px-2 !py-1.5", r.bad?.includes(k) && "!border-crimson")} onChange={(e) => ch((d) => { d.meters[i][k] = e.target.value; })} /></label>
            );
            return (
              <div key={i} className={cx("my-2.5 rounded-xl border bg-fg/[0.02] p-3.5", meterCls(i))}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 font-black"><span>{i + 1}. {f.name || "Use " + (i + 1)}</span><span className="text-xs font-extrabold text-muted">{f.type === "H" ? "Hidden footprint" : "Direct use"}</span></div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[2fr_repeat(5,1fr)]">
                  <label className="col-span-2 flex flex-col gap-0.5 text-xs font-extrabold text-muted sm:col-span-1">Unit<input className={cx(INPUT, "!px-2 !py-1.5")} value={n.unit} maxLength={40} placeholder="1 shower" onChange={(e) => ch((d) => { d.meters[i].unit = e.target.value; })} /></label>
                  {NK.map(inp)}
                </div>
                {(ref || (key && ITEM_NOTE[key])) && <div className="mt-1.5 text-xs leading-snug text-muted">📘 {ref && <>Book estimate per {ITEMS[key!][1]}: <b className="text-fg">about {ref}</b>. </>}{key && ITEM_NOTE[key]}</div>}
                {!(r.blank && !n.unit && !n.co2) && <div className={cx("mt-1.5 text-[13px] font-extrabold", r.ok ? "text-emerald" : r.blank ? "text-muted" : "text-crimson")}>{r.msg}</div>}
              </div>
            );
          })}
          <NavBtns>{back()}{next("Log our 3 days →")}</NavBtns>
        </>
      );
      case 3: {
        const swapOpts = K.can.map((d) => <option key={d.id} value={"d:" + d.id}>🔁 {d.name} ({fmt1(d.nut.co2)} lb CO₂)</option>);
        const useOpts = named.map((f) => <option key={f.i} value={String(f.i)}>{f.name} ({D.meters[f.i].unit})</option>);
        return (
          <>
            <StepHead num="Step 3" title="Your First 3 Days" />
            <Box tone="story">Now log <b>3 typical days</b>: what you do in the <b>morning, school day, evening and night</b>, using only your 15 uses and the swaps you can make from them.<br />One rule from the mission: <b>no copy-paste days.</b> Real days are different, so all 12 time blocks must be different mixes.</Box>
            {kitchen()}
            <Box>Build each block from <b>swaps</b> 🔁 and/or <b>plain uses</b>, and choose how many units (½ = 0.5). The totals add up for you. A block counts as a repeat if it uses exactly the same swaps and uses as another block.</Box>
            <div className="my-3 flex flex-wrap gap-2">{[0, 1, 2].map((dd) => (
              <button key={dd} onClick={() => setDay(dd)} aria-pressed={dd === day} className={cx("rounded-full border-2 border-fg/70 px-4 py-1.5 font-black", dd === day ? "bg-fg text-ink" : "text-fg")}>Day {dd + 1}{st.slice(dd * 4, dd * 4 + 4).every((s) => s.ok) ? " ✓" : ""}</button>))}</div>
            {SLOTS.map((name, k) => {
              const idx = day * 4 + k, m = D.log[day][k], s = st[idx], mt = t.slotT[idx];
              const msg = s.dup ? "This block is a repeat of another block. Change it up!" : s.gone ? "One swap can't be made from your list anymore. Pick something else." : s.bad ? "Every item needs a number of units." : "";
              return (
                <div key={k} className={cx("my-2.5 rounded-xl border bg-fg/[0.02] p-3.5", s.dup ? "border-crimson" : "border-line")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-[17px]">{s.ok ? "✅" : "🕒"} Day {day + 1} · {name}</b><span className="text-[13px] font-extrabold text-muted">{fmt1(mt.water)} gal · {fmt1(mt.kwh)} kWh · {fmt1(mt.co2)} lb CO₂</span></div>
                  {m.map((it, j) => {
                    const did = swapOf(it.f), gone = did && !K.byId[did];
                    return (
                      <div key={j} className="mt-2 grid grid-cols-[1fr_96px_40px] items-end gap-2 sm:grid-cols-[1fr_120px_40px]">
                        <select className={INPUT} value={it.f} aria-label={`${name} swap or use`} onChange={(e) => ch((d) => { d.log[day][k][j].f = e.target.value; })}>
                          <option value="">Choose a swap or use</option>
                          {gone && <option value={it.f}>⚠ {swapName(did!)}: can&apos;t make it now</option>}
                          {swapOpts.length > 0 && <optgroup label="🔁 Swaps you can make">{swapOpts}</optgroup>}
                          <optgroup label="Plain uses">{useOpts}</optgroup>
                        </select>
                        <label className="text-xs font-extrabold text-muted">Units<input type="number" min={0.25} max={50} step={0.25} inputMode="decimal" className={INPUT} value={it.s} onChange={(e) => ch((d) => { d.log[day][k][j].s = e.target.value; })} /></label>
                        <button type="button" className="h-10 rounded-lg bg-fg/[0.08] font-black" aria-label="Remove" onClick={() => ch((d) => { d.log[day][k].splice(j, 1); })}>✕</button>
                      </div>
                    );
                  })}
                  {msg && <div className="mt-1.5 text-[13px] font-extrabold text-crimson">{msg}</div>}
                  <Button kind="ghost" small className="mt-2" onClick={() => ch((d) => { d.log[day][k].push({ f: "", s: 1 }); })}>+ Add a swap or use</Button>
                </div>
              );
            })}
            <div className="mt-2.5 rounded-xl bg-fg/[0.05] px-4 py-2.5 font-black">Day {day + 1} total: {fmt1(t.days[day].water)} gal water · {fmt1(t.days[day].kwh)} kWh · {fmt1(t.days[day].therm)} therms · {fmt1(t.days[day].gas)} gal gasoline · {fmt1(t.days[day].co2)} lb CO₂</div>
            {bb && <Box tone={bb.ok ? "ok" : "warn"}>🎯 <b>Goal target:</b> {fmt1(bb.lo)}–{fmt1(bb.hi)} lb CO₂ a day from your direct uses (3-day average). You&apos;re at <b>{fmt1(bb.t.direct)}</b>, about {r0(Math.abs(bb.cut))}% {bb.cut >= 0 ? "below" : "above"} your baseline. {bb.ok ? "Inside the goal range ✓" : "Must be inside the goal range to pass Step 5."}</Box>}
            <div className="my-3"><Count ok={st.every((s) => s.ok)}>{st.filter((s) => s.ok).length} / 12 blocks</Count></div>
            <NavBtns>{back()}{next("See what really adds up →")}</NavBtns>
          </>
        );
      }
      case 4: {
        const max = t.rank.length ? t.rank[0].co2 : 1, unused = t.rank.filter((p) => p.srv === 0).map((p) => D.items[p.i].name);
        const topBy = (k: NKey) => { const b = t.rank.slice().sort((a, x) => +D.meters[x.i][k] - +D.meters[a.i][k])[0]; return b ? `${D.items[b.i].name} (${fmt1(+D.meters[b.i][k])} ${NSHORT[k]} per ${D.meters[b.i].unit})` : "—"; };
        return (
          <>
            <StepHead num="Step 4" title="What Really Adds Up" />
            <Box tone="story">After 3 days, look at your log. You picked 15 uses… but did they all count the same?</Box>
            <Box tone="ok"><Big>Your top 5 uses = {r0(t.top5share)}% of your CO₂</Big>
              You chose 15 uses, but just 5 of them made about {r0(t.top5share)} out of every 100 pounds of CO₂.{unused.length > 0 && <> You never used <b>{unused.join(", ")}</b> at all.</>} That&apos;s how real life works too: a few big uses make most of the footprint. <b>Those are the ones to swap.</b></Box>
            <H3>CO₂ from each use (3 days)</H3>
            {t.rank.map((p, k) => <HBar key={p.i} top={k < 5} name={`${k + 1}. ${D.items[p.i].name}`} w={max ? (p.co2 / max) * 100 : 0} pct={(t.all.co2 ? r0((p.co2 / t.all.co2) * 100) : 0) + "%"} />)}
            <H3>Your daily average</H3>
            <Tiles>
              <Tile k="Water" v={fmt1(t.avg.water) + " gal"} s="per day · Americans use about 82 gallons a day at home (EPA)" />
              <Tile k="Electricity" v={fmt1(t.avg.kwh) + " kWh"} s="per day" />
              <Tile k="Natural gas" v={fmt1(t.avg.therm) + " therms"} s="per day" />
              <Tile k="Gasoline" v={fmt1(t.avg.gas) + " gal"} s="per day" />
              <Tile k="CO₂" v={fmt1(t.avg.co2) + " lb"} s={`${fmt1(t.direct)} lb direct + ${fmt1(t.hidden)} lb hidden`} />
            </Tiles>
            <Box><b>Your biggest:</b><br />Water user: {topBy("water")}<br />Electricity user: {topBy("kwh")}<br />CO₂ maker: {topBy("co2")}</Box>
            {t.all.co2 > 0 && t.hidden / Math.max(t.avg.co2, 0.001) > 0.4 && <Box tone="warn">Hidden footprints are over 40% of your CO₂. Food and products count, even though they never show up on a bill. Which swap in the Swap Shop could shrink them?</Box>}
            {t.avg.water > 82 && <Box tone="warn">More water than the average American uses at home. Idaho farms and towns share the same rivers and the Snake River Plain aquifer, so every gallon counts.</Box>}
            <NavBtns>{back()}<Button onClick={() => { ch((d) => { d.seen4 = true; d.lastStep = 5; }); setCur(5); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={!step3ok()}>Got it: set our goal →</Button></NavBtns>
          </>
        );
      }
      case 5: {
        const b = D.body;
        const setB = (k: keyof Body, v: string) => ch((d) => { d.body[k] = v; });
        const goalTabs: [string, number][] = [["10% cut", 0.1], ["20% cut", 0.2], ["30% cut", 0.3]];
        return (
          <>
            <StepHead num="Step 5" title="Footprint In vs. Footprint Goal" />
            <Box tone="story">Your bills are the real meter for your whole home. Use them to find your <b>baseline</b>: how many pounds of CO₂ a day each person in your home makes from electricity, natural gas and the family car. Then set a goal, and see if your 3-day log reaches it.</Box>
            <Box>Your numbers are only seen by you and Mr. Dopp. Ask a parent or guardian for one month&apos;s bills, or use the typical numbers in the hints. This is a science estimate, not a grade on your family.</Box>
            <Box>🎯 <b>Goal check:</b> before you can take the test, your 3-day log of <b>direct uses</b> has to land within <b>±{LIMIT * 100}% of your goal</b>. If it doesn&apos;t, go back to Step 3 and swap or change amounts. (Hidden footprints aren&apos;t on any bill, so they don&apos;t count here.)</Box>
            <Grid>
              <Field label="People in your home"><input className={INPUT} type="number" min={1} max={20} inputMode="numeric" value={b.people} onChange={(e) => setB("people", e.target.value)} /></Field>
              <Field label="Electricity in one month (kWh)" small="On the power bill. A typical U.S. home uses about 900 kWh a month (EIA)."><input className={INPUT} type="number" min={0} inputMode="decimal" value={b.kwh} onChange={(e) => setB("kwh", e.target.value)} /></Field>
              <Field label="Natural gas in one month (therms)" small="On the gas bill. Leave 0 if your home has no gas."><input className={INPUT} type="number" min={0} inputMode="decimal" value={b.therms} onChange={(e) => setB("therms", e.target.value)} /></Field>
              <Field label="Family car miles in a week"><input className={INPUT} type="number" min={0} inputMode="decimal" value={b.miles} onChange={(e) => setB("miles", e.target.value)} /></Field>
              <Field label="Car miles per gallon" small="Many cars get about 25 mpg; check yours."><input className={INPUT} type="number" min={5} max={150} inputMode="decimal" value={b.mpg} onChange={(e) => setB("mpg", e.target.value)} /></Field>
              <Field label="Your goal"><select className={INPUT} value={b.goal} onChange={(e) => setB("goal", e.target.value)}><option value="">Choose</option>{GOALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            </Grid>
            {!c ? <Lead><span className="mt-3 block">Fill in every box to see your results.</span></Lead> : (
              <>
                <H3>Your baseline</H3>
                <Box tone="ok"><Big>{fmt1(c.base)} lb of CO₂ per person per day</Big>About {r1((c.base * 365) / 2000)} tons a year from your home and car alone. This is your <b>baseline</b>: what your share of the bills adds up to.</Box>
                <Tiles>
                  <Tile k="Electricity" v={fmt1(c.elec) + " lb"} s={`${fmt(c.kwh)} kWh × ${F_KWH} ÷ 30.4 days ÷ ${c.people}`} />
                  <Tile k="+ Natural gas" v={fmt1(c.heat) + " lb"} s={`${fmt(c.therms)} therms × ${F_THERM} ÷ 30.4 ÷ ${c.people}`} />
                  <Tile k="+ Car" v={fmt1(c.car) + " lb"} s={`${fmt(c.miles)} mi ÷ ${c.mpg} mpg × ${F_GAL} ÷ 7 ÷ ${c.people}`} />
                  <Tile k="= Baseline" v={fmt1(c.base) + " lb"} s="per person per day" />
                </Tiles>
                {bb && (bb.ok
                  ? <Box tone="ok"><Big>✅ Goal check passed</Big>Your 3-day log averages <b>{fmt1(bb.t.direct)} lb</b> of CO₂ a day from direct uses. Your goal range is <b>{fmt1(bb.lo)}–{fmt1(bb.hi)} lb</b>, so you cut about <b>{r0(bb.cut)}%</b> from your baseline: about {fmt(Math.abs(bb.yr))} lb of CO₂ a year {bb.yr <= 0 ? "less" : "more"}. You can take the test.</Box>
                  : <Box tone="bad"><Big>⚠️ Goal check: {bb.gap > 0 ? "not there yet" : "too low to be real"}</Big>
                    Your log averages <b>{fmt1(bb.t.direct)} lb</b> of CO₂ a day from direct uses. To move on it has to be between <b>{fmt1(bb.lo)} and {fmt1(bb.hi)} lb</b> (your {r0(c.goal * 100)}% goal, ±{LIMIT * 100}%).
                    <p className="mt-2"><b>How to fix it:</b></p>
                    <ul className="ml-5 list-disc">{bb.gap > 0 ? <>
                      <li>Use your biggest CO₂ uses less{t.rank.filter((p) => p.co2 > 0 && D.items[p.i].type === "D").slice(0, 3).length ? <>: <b>{t.rank.filter((p) => p.co2 > 0 && D.items[p.i].type === "D").slice(0, 3).map((p) => D.items[p.i].name).join(", ")}</b></> : null}.</li>
                      <li>Log swaps from the Swap Shop instead of plain uses (carpool, LED evening, cold wash, thermostat down).</li>
                      <li>Pick a smaller goal if this one needs changes your family can&apos;t really make.</li></> : <>
                      <li>A log this far below your bills probably leaves out big uses: heating, hot water, the fridge, car trips.</li>
                      <li>Add the uses you really do, or log more units of them.</li>
                      <li>Check your Step 2 meters: a unit with too little energy makes everything look small.</li></>}
                      <li>Only change your <b>bill numbers</b> if they were wrong. Be honest; use the real bill.</li>
                    </ul>
                    <Button kind="ink" small className="mt-2" onClick={() => go(3)}>← Fix my log (Step 3)</Button>
                    <p className="mt-3"><b>Why it matters:</b> {bb.gap > 0 ? "Carbon dioxide from burning fossil fuels traps heat in the atmosphere and is the main driver of today's climate change (Chapter 22). Small daily cuts add up over a year, and over millions of homes." : "A footprint plan only helps if it matches real life. Scientists always check a model against measurements, and your bills are the measurement here."}</p>
                  </Box>)}
                <H3>Your log vs. your baseline</H3>
                <Tiles>
                  <Tile k="Log (direct uses)" v={fmt1(t.direct) + " lb"} s="3-day average per day" />
                  <Tile k="Baseline" v={fmt1(c.base) + " lb"} s="from your bills" />
                  <Tile k="Hidden footprint" v={fmt1(t.hidden) + " lb"} s="food & products, not on any bill" />
                </Tiles>
                <H3>Same electricity, different power plants</H3>
                <Table head={<tr><th>If your {fmt(c.kwh)} kWh came from…</th><th className="n">CO₂ a month</th></tr>}>
                  {([["Coal plants (about 2.2 lb/kWh)", 2.2], ["Natural gas plants (about 1 lb/kWh)", 1], ["The U.S. grid average (about 0.8 lb/kWh)", F_KWH], ["Hydropower, wind or solar (almost none while running)", 0]] as [string, number][]).map(([n, f]) => (
                    <tr key={n} className={f === F_KWH ? "bg-gold/10 font-black" : ""}><td>{n}{f === F_KWH ? " ← used here" : ""}</td><td className="n">{fmt(c.kwh * f)} lb</td></tr>))}
                </Table>
                <Box>Idaho makes most of its own electricity from hydropower on the Snake River and its tributaries, so Idaho homes usually make less CO₂ per kWh than the U.S. average. Ask your utility for its number to see how much.</Box>
                <H3>Water in context</H3>
                <Table head={<tr><th>Water per person per day</th><th className="n">Gallons</th></tr>}>
                  <tr className="bg-gold/10 font-black"><td>Your 3-day log ← you</td><td className="n">{fmt1(t.avg.water)}</td></tr>
                  <tr><td>Average American at home (EPA WaterSense)</td><td className="n">about 82</td></tr>
                  <tr><td>Basic needs: drinking, cooking, washing (United Nations)</td><td className="n">about 13–26</td></tr>
                </Table>
                <H3>Goal targets</H3>
                <div className="my-2 flex flex-wrap gap-1.5">{goalTabs.map(([l], i) => <button key={l} onClick={() => setGtab(i)} aria-pressed={i === gtab} className={cx("rounded-full border-2 border-fg/70 px-3.5 py-1 text-sm font-black", i === gtab ? "bg-fg text-ink" : "")}>{l}</button>)}</div>
                <p className="text-muted"><b className="text-fg">{goalTabs[gtab][0]}: {fmt1(c.base * (1 - goalTabs[gtab][1]))} lb a day</b>, about {fmt(c.base * goalTabs[gtab][1] * 365)} lb less CO₂ a year for you. For a family of {c.people}, that&apos;s about {fmt(c.base * goalTabs[gtab][1] * 365 * c.people)} lb a year.</p>
              </>
            )}
            <NavBtns>{back()}{next("Take the footprint test →")}</NavBtns>
          </>
        );
      }
      case 6: {
        const q = D.quiz;
        return (
          <>
            <StepHead num="Step 6" title="Do You Know Your Footprint?" />
            <Box tone="story">Before the mission ends, you get tested. If this is your real life, you should know it by heart. Every question is about <b>your own 15 uses and your own log</b>.</Box>
            {quizLive ? (
              <>
                <Lead>Answer all {quizLive.qs.length}. You need {PASS} right to pass. While the test is open you can&apos;t go back to your notes.</Lead>
                {quizLive.qs.map((qq, n) => (
                  <div key={n} className="my-3 rounded-xl border border-line bg-fg/[0.02] p-3.5">
                    <div className="mb-2 font-black">{n + 1}. {qq.q}</div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(200px,100%),1fr))" }}>
                      {qq.opts.map((o) => {
                        const g = quizLive.graded, picked = quizLive.picked[n] === o;
                        return (
                          <label key={o} className={cx("flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 font-bold",
                            g ? (o === qq.ans ? "border-emerald bg-emerald/15" : picked ? "border-crimson bg-crimson/15" : "border-line") : picked ? "border-fg bg-fg/10" : "border-line")}>
                            <input type="radio" name={"q" + n} checked={picked} disabled={!!g} onChange={() => setQuizLive({ ...quizLive, picked: { ...quizLive.picked, [n]: o } })} /> {o}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {quizLive.graded ? (
                  <><Box tone={quizLive.graded.pass ? "ok" : "bad"}><b>{quizLive.graded.right} / {quizLive.qs.length} right.</b> {quizLive.graded.pass ? "You passed! 🌍" : `Not yet. You need ${PASS}. Correct answers are in green. Study up and try again.`}</Box>
                    <Button onClick={() => setQuizLive(null)}>{quizLive.graded.pass ? "Continue" : "OK"}</Button></>
                ) : <div className="flex flex-wrap gap-2"><Button onClick={gradeQuiz}>Check my answers</Button><Button kind="ghost" onClick={() => setQuizLive(null)}>Quit this try</Button></div>}
              </>
            ) : (
              <>
                {q.passed ? <Box tone="ok"><b>Passed! Best score: {q.best} / {QN}.</b> You know your footprint. You can retake it for practice or move on to your report.</Box>
                  : q.tries ? <Box tone="warn">Best so far: {q.best} / {QN}. You need {PASS}. Go back and study your meters and log, then try again. You&apos;ll get new questions.</Box>
                  : <><Lead>{QN} questions built from your own uses and log. Get {PASS} right to pass. You can retake it as many times as you need; the questions change each time.</Lead><Box>Study tip: go back to Steps 2–5 first. Know the water and CO₂ of your top uses, which uses take the most water, electricity and CO₂, and your daily average.</Box></>}
                <div className="flex flex-wrap gap-2"><Button onClick={startQuiz}>{q.tries ? "Take the test again" : "Start the test"}</Button>{q.passed && <Button kind="ink" onClick={() => go(7)}>Go to my report →</Button>}</div>
              </>
            )}
            <NavBtns>{back()}<span /></NavBtns>
          </>
        );
      }
      case 7: return (
        <>
          <StepHead num="Finish" title="Footprint Report" />
          <p className="mt-2"><b>{student?.name ?? ""}</b> {D.group && <>· Group: {D.group}</>} {D.town && <>· {D.town}</>}</p>
          <H3>Our 15 Uses</H3>
          <Table head={<tr><th>Use</th><th>Type</th><th>Unit</th><th className="n">Water</th><th className="n">kWh</th><th className="n">Therms</th><th className="n">Gasoline</th><th className="n">CO₂</th><th className="n">3-day share</th></tr>}>
            {D.items.map((f, i) => { const n = D.meters[i]; return <tr key={i}><td>{f.name}</td><td>{f.type === "H" ? "Hidden" : "Direct"}</td><td>{n.unit}</td><td className="n">{fmt1(+n.water)}</td><td className="n">{r1(+n.kwh)}</td><td className="n">{r1(+n.therm)}</td><td className="n">{r1(+n.gas)}</td><td className="n">{r1(+n.co2)} lb</td><td className="n">{t.all.co2 ? r0((t.per[i].co2 / t.all.co2) * 100) : 0}%</td></tr>; })}
          </Table>
          <H3>What We Learned</H3>
          <p><b>Top 5 uses = {r0(t.top5share)}% of CO₂.</b> Daily average: {fmt1(t.avg.water)} gal water · {fmt1(t.avg.kwh)} kWh · {fmt1(t.avg.therm)} therms · {fmt1(t.avg.gas)} gal gasoline · {fmt1(t.avg.co2)} lb CO₂.</p>
          {c && bb && <p className="mt-1"><b>Goal:</b> baseline {fmt1(c.base)} lb/day per person from bills · goal {r0(c.goal * 100)}% cut → target {fmt1(c.target)} lb · our log {fmt1(t.direct)} lb ({sgn(-bb.cut)}{r0(Math.abs(bb.cut))}% vs. baseline).</p>}
          <p className="mt-1"><b>Know-Your-Footprint test:</b> best {D.quiz.best} / {QN} ({D.quiz.tries} {D.quiz.tries === 1 ? "try" : "tries"}).</p>
          {Object.keys(t.swapSrv).length > 0 && (<><H3>Our Swaps</H3>
            <Table head={<tr><th>Swap</th><th>Made from</th><th className="n">Water</th><th className="n">kWh</th><th className="n">CO₂</th><th className="n">Times used</th></tr>}>
              {Object.keys(t.swapSrv).map((id) => { const d = K.byId[id]; if (!d) return null; return <tr key={id}><td>{d.name}</td><td>{d.parts.map((p) => D.items[p.i].name + " ×" + frac(p.a)).join(", ")}</td><td className="n">{fmt1(d.nut.water)}</td><td className="n">{r1(d.nut.kwh)}</td><td className="n">{r1(d.nut.co2)} lb</td><td className="n">{r1(t.swapSrv[id])}</td></tr>; })}
            </Table></>)}
          <H3>3-Day Log</H3>
          <Table head={<tr><th>Day</th><th>Block</th><th>Uses</th><th className="n">CO₂</th></tr>}>
            {D.log.map((dm, d) => dm.map((m, k) => <tr key={d + "-" + k}><td>{d + 1}</td><td>{SLOTS[k]}</td><td>{m.filter((it) => it.f !== "").map((it) => (swapOf(it.f) ? "🔁 " : "") + itemName(it) + " ×" + it.s).join(", ")}</td><td className="n">{r1(t.slotT[d * 4 + k].co2)} lb</td></tr>))}
          </Table>
          <div className="mt-4 print:hidden">
            {D.submitted ? <Box tone="ok"><b>Turned in ✓</b> Mr. Dopp can see your work. If you change anything it still saves.</Box>
              : mode !== "cloud" ? <Box tone="warn">You are in practice mode, so this can&apos;t be turned in. Log in (top right), then come back.</Box>
              : <><Box>Everything looks done. Turn it in so it shows on Mr. Dopp&apos;s dashboard.</Box><Button onClick={() => ch((d) => { d.submitted = true; })}>Turn in my Footprint Report</Button></>}
          </div>
          <NavBtns>{back()}<span className="flex flex-wrap gap-2"><Button kind="ink" onClick={() => window.print()}>🖨 Print / Save PDF</Button>{next("🏆 See my certificate →")}</span></NavBtns>
        </>
      );
      case 8: {
        if (!c || !bb) return <Box tone="warn">Finish Step 5 first.</Box>;
        const name = student?.name || "Earth Steward";
        const top = t.rank.filter((p) => p.co2 > 0), five = top.slice(0, 5), rest = top.slice(5).reduce((a, p) => a + p.co2, 0);
        const slices = five.map((p) => ({ n: D.items[p.i].name, v: p.co2 })).concat(rest > 0 ? [{ n: "Other " + (top.length - 5) + " uses", v: rest }] : []);
        const pct = (v: number) => (t.all.co2 ? r0((v / t.all.co2) * 100) : 0);
        const tries = D.bal.tries || 0, log = D.bal.log || [];
        const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const tips: ReactNode[] = [];
        const best = (k: NKey) => named.slice().sort((a, x) => +D.meters[x.i][k] - +D.meters[a.i][k])[0]?.name ?? "your biggest use";
        if (t.avg.co2 && t.hidden / t.avg.co2 > 0.35) tips.push(<><b>Eat lower on the food chain.</b> Hidden footprints were {r0((t.hidden / t.avg.co2) * 100)}% of your CO₂. Beef has one of the biggest footprints of any food; chicken, beans and Idaho potatoes are much smaller.</>);
        if (t.avg.water > 60) tips.push(<><b>Save water.</b> You averaged {fmt1(t.avg.water)} gallons a day. Shorter showers and full loads cut <b>{best("water")}</b>, your biggest water user.</>);
        const carCo2 = t.per.reduce((a, p, i) => a + (matchItem(D.items[i].name) === "car" ? p.co2 : 0), 0);
        if (t.all.co2 && carCo2 / t.all.co2 > 0.25) tips.push(<><b>Share the ride.</b> Car miles were {r0((carCo2 / t.all.co2) * 100)}% of your CO₂. Carpooling, the bus or a bike cut that fast.</>);
        if (t.top5share > 80) tips.push(<><b>Focus on your top 5.</b> They were {r0(t.top5share)}% of your footprint. One swap there beats ten swaps anywhere else.</>);
        if (t.avg.kwh > 5) tips.push(<><b>Turn it off.</b> You averaged {fmt1(t.avg.kwh)} kWh a day. LED bulbs use about 75% less energy than old bulbs, and unplugging chargers and consoles stops small, steady drains.</>);
        if (tips.length < 2) tips.push(<><b>Fix leaks.</b> A dripping faucet or running toilet wastes water all day and night. Check yours with a few drops of food coloring in the toilet tank.</>);
        if (tips.length < 2) tips.push(<><b>Keep it up.</b> Your plan is balanced. Share your best swap with your family; a whole household multiplies it.</>);
        return (
          <>
            <StepHead num="🏆" title="Footprint Certificate" />
            <Box className="print:hidden">📸 <b>Turn it in:</b> take a <b>screenshot</b> of your whole certificate and upload it to the <b>Footprint Quest assignment in Schoology</b>.<br /><small>Chromebook: <b>Ctrl + Shift + Show windows</b>, then drag around the certificate. Windows: <b>Win + Shift + S</b>. Mac: <b>Cmd + Shift + 4</b>. Phone/iPad: power + volume up.</small></Box>
            <div className="relative mx-auto mt-2 max-w-3xl rounded-2xl border-[3px] border-double border-gold bg-ink-2 px-4 py-7 text-center shadow-[inset_0_0_0_8px_color-mix(in_srgb,var(--color-gold)_10%,transparent)] sm:px-10">
              <div className="text-5xl leading-none">🌍</div>
              <div className="mt-1.5 font-mono text-xs uppercase tracking-[0.25em] text-gold">Footprint Quest · Earth Science</div>
              <h3 className="mb-2.5 mt-1 font-display text-3xl font-black sm:text-4xl">Certificate of Footprint Balance</h3>
              <div>This certifies that</div>
              <div className="mx-auto my-1.5 inline-block border-b-2 border-gold px-5 font-display text-3xl font-black text-gold">{name}</div>
              {D.group && <div className="text-sm text-muted">Group: {D.group}</div>}
              <p className="mx-auto my-3 max-w-xl text-[17px]"><b>measured their water and carbon footprint and planned 3 days that met their goal.</b> They logged their 15 uses and swaps and <b>stayed within ±{LIMIT * 100}% of a {r0(c.goal * 100)}% cut</b> from their real bills.</p>
              <div className="my-4 grid gap-2.5 text-left" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(170px,100%),1fr))" }}>
                <Tile k="CO₂ in my log" v={fmt1(t.direct) + " lb"} s="per day from direct uses (3-day average)" />
                <Tile k="My baseline" v={fmt1(c.base) + " lb"} s="per person per day, from bills" />
                <Tile k="Cut" v={r0(bb.cut) + "%"} s={`about ${fmt(Math.abs(bb.yr))} lb of CO₂ a year · water ${fmt1(t.avg.water)} gal/day`} />
                <Tile k="Tries" v={tries} s={tries === 0 ? "met the goal on the first plan!" : `time${tries === 1 ? "" : "s"} sent back to change the log`} />
              </div>
              {log.length > 0 && (
                <div className="mx-auto mb-4 max-w-xl text-left text-sm"><b>My tries to land within ±{LIMIT * 100}% of my goal</b>
                  <Table head={<tr><th>#</th><th className="n">Log / day</th><th className="n">Goal / day</th><th className="n">Cut</th><th>Result</th></tr>}>
                    {log.map((x, k) => <tr key={k} className={x.ok ? "font-extrabold text-emerald" : ""}><td>{x.ok ? "✓" : "Try " + log.slice(0, k + 1).filter((y) => !y.ok).length}</td><td className="n">{x.co2} lb</td><td className="n">{x.need} lb</td><td className="n">{x.pct}%</td><td>{x.ok ? "Goal met ✓" : x.co2 > x.need ? "Not there yet: sent back" : "Too low to be real: sent back"}</td></tr>)}
                  </Table></div>)}
              <div><b>Where my CO₂ came from</b></div>
              <div className="my-2 flex flex-wrap items-center justify-center gap-5 text-left">
                <Donut slices={slices} center={fmt1(t.avg.co2)} sub="lb CO₂ / day" label="Where my CO2 came from" />
                <ul className="text-sm">{slices.map((x, k) => <li key={k} className="my-1 flex items-center gap-2"><i className="size-3.5 flex-none rounded" style={{ background: PIE[k] }} />{x.n}: <b>{pct(x.v)}%</b></li>)}</ul>
              </div>
              <div className="text-sm text-muted">Water {fmt1(t.avg.water)} gal/day · Electricity {fmt1(t.avg.kwh)} kWh/day · Top 5 uses = {r0(t.top5share)}% of CO₂ · Footprint test {D.quiz.best}/{QN}</div>
              <div className="mx-auto mt-3 max-w-xl rounded-lg border-l-4 border-sky bg-sky/10 px-4 py-2.5 text-left text-[15px]"><b>💡 To shrink it even more:</b><ol className="ml-5 mt-1 list-decimal">{tips.slice(0, 2).map((x, i) => <li key={i}>{x}</li>)}</ol></div>
              <div className="mt-6 flex flex-wrap justify-between gap-4 text-sm text-muted"><div className="min-w-[160px] flex-1 border-t border-fg pt-1">Mr. Dopp · Earth Scientist</div><div className="min-w-[160px] flex-1 border-t border-fg pt-1">{date}</div></div>
            </div>
            <NavBtns><Button kind="ghost" onClick={() => go(7)}>← Back to my report</Button><Button kind="ink" onClick={() => window.print()}>🖨 Print / Save PDF</Button></NavBtns>
          </>
        );
      }
    }
  })();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <StepPath steps={STEPS} cur={cur} done={done} canEnter={canEnter} onGo={go} locked={!!quizLive && !quizLive.graded}
        saveText={save[0]} saveCls={save[1]} extra={mode === "practice" ? <Button kind="ghost" small onClick={fillSample}>Fill sample data</Button> : undefined} />
      {mode === "practice" && ready && (
        <Box tone="warn">🔑 <b>You are not logged in.</b> Your work saves on this device only and can&apos;t be turned in. Log in (top right), then come back. <Link href="/quest/" className="font-bold underline">My Quest</Link></Box>
      )}
      <section className="block-panel mt-4 p-5 sm:p-8">{step}</section>
    </div>
  );
}
// ── end wave-twinB ──
