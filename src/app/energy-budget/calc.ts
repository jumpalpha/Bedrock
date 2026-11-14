// ── wave-twinB ── Home Energy Budget: all the math (twin of Dopps Class finance_calc.js).
// Pure functions only. Money is in dollars; "monthly" values are per month, "annual" per year (monthly × 12, once).

// The 12 categories. src: where the research usually comes from.
//   'bill'   = it shows on (or can be split from) a power, gas or fuel bill
//   'calc'   = figure it from the appliance's watts × hours (Energy Saver appliance calculator)
//   'none'   = not on any bill: set your own number (the upgrade fund)
export const CATS = [
  { key: "heating", label: "Space heating", src: "bill", fuel: "heat", note: "Usually the biggest home energy use in Idaho winters. Gas heat: winter therms minus summer therms. Electric heat: winter kWh minus summer kWh." },
  { key: "cooling", label: "Cooling (AC / swamp cooler / fans)", src: "bill", fuel: "elec", note: "Summer kWh minus spring kWh is a good estimate. Swamp coolers use far less than central air." },
  { key: "hotwater", label: "Water heating", src: "bill", fuel: "heat", note: "Often the 2nd biggest use. Gas or electric: check the label on the water heater (the yellow EnergyGuide sticker)." },
  { key: "lighting", label: "Lighting", src: "calc", fuel: "elec", note: "Count bulbs × watts × hours a day. LEDs use about 75% less than old bulbs." },
  { key: "fridge", label: "Refrigerator & freezer", src: "calc", fuel: "elec", note: "The EnergyGuide label lists kWh per year. Divide by 12." },
  { key: "cooking", label: "Cooking", src: "calc", fuel: "elec", note: "Oven, stove, microwave, toaster. A gas range shows on the gas bill instead." },
  { key: "laundry", label: "Laundry (washer & dryer)", src: "calc", fuel: "elec", note: "The dryer is the big one. Loads a week × kWh per load × 4.3 weeks." },
  { key: "dishes", label: "Dishwasher", src: "calc", fuel: "elec", note: "The EnergyGuide label lists kWh per year. Hand washing uses hot water instead." },
  { key: "electronics", label: "TV, games & computers", src: "calc", fuel: "elec", note: "Watts × hours a day × 30 ÷ 1,000 = kWh a month. Include consoles, monitors, routers." },
  { key: "plugs", label: "Other plug-ins & standby", src: "calc", fuel: "elec", note: "Chargers, small appliances, things that stay on all the time. A plug-in power meter shows these." },
  { key: "transport", label: "Car fuel", src: "bill", fuel: "fuel", note: "Gallons a month × price per gallon. Miles a month ÷ mpg = gallons." },
  { key: "upgrades", label: "Upgrade fund", src: "none", fuel: "none", note: "No bill shows this. Set your own monthly savings goal for efficiency upgrades." },
] as const;
export type Key = (typeof CATS)[number]["key"];
export const KEYS = CATS.map((c) => c.key) as Key[];
export const BILL_KEYS = KEYS.filter((k) => k !== "upgrades");

export const F_KWH = 0.8, F_THERM = 11.7, F_GAL = 19.4; // lb CO2 per kWh (U.S. grid average), therm, gallon of gasoline (EIA, rounded)

export function num(v: unknown) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
export const isBlank = (v: unknown) => v === "" || v === null || v === undefined || (typeof v === "string" && v.trim() === "");
export const round2 = (x: number) => Math.round(x * 100) / 100;
export function checkMoney(v: unknown, max?: number): { ok: boolean; blank?: boolean; value?: number; msg?: string } {
  if (isBlank(v)) return { ok: true, blank: true, value: 0 };
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) return { ok: false, msg: "Numbers only" };
  if (n < 0) return { ok: false, msg: "Can't be negative" };
  if (n > (max || 1e7)) return { ok: false, msg: "That number is too large" };
  return { ok: true, blank: false, value: n };
}

// ── Step 0: energy units ── watts × hours ÷ 1,000 = kWh, × price = cost
export const kwhOf = (watts: unknown, hours: unknown) => (num(watts) * num(hours)) / 1000;
export const costOf = (kwh: number, centsPerKwh: unknown) => (kwh * num(centsPerKwh)) / 100;

// ── Step 1: the home ──
export function homeInfo(h: Home) {
  const budget = num(h.budget), people = num(h.people), elec = num(h.elec);
  return { annual: budget * 12, perPerson: people > 0 ? budget / people : null, kwhBuys: elec > 0 ? (budget / elec) * 100 : null };
}

// ── Steps 2–4: budgets ──
type Vals = Record<string, unknown> | undefined;
export function val(values: Vals, k: string) { const x = values && values[k]; return num(x !== null && typeof x === "object" ? (x as { v: unknown }).v : x); }
export function totals(values: Vals) {
  let monthly = 0, bills = 0;
  KEYS.forEach((k) => { const v = val(values, k); monthly += v; if (k !== "upgrades") bills += v; });
  return { monthly, annual: monthly * 12, billsMonthly: bills, billsAnnual: bills * 12, fundMonthly: monthly - bills, fundAnnual: (monthly - bills) * 12 };
}
export type Row = { key: Key; label: string; predicted: number; researched: number; diff: number; pct: number | null };
/** diff = researched − predicted. Positive = you UNDERestimated. */
export function compare(predicted: Vals, researched: Vals) {
  const rows: Row[] = CATS.map((c) => { const p = val(predicted, c.key), r = val(researched, c.key), diff = r - p; return { key: c.key, label: c.label, predicted: p, researched: r, diff, pct: r > 0 ? (diff / r) * 100 : null }; });
  const tp = totals(predicted), tr = totals(researched), diff = tr.monthly - tp.monthly;
  let under: Row | null = null, over: Row | null = null;
  rows.forEach((row) => { if (row.diff > 0 && (!under || row.diff > under.diff)) under = row; if (row.diff < 0 && (!over || row.diff < over.diff)) over = row; });
  return { rows, predictedMonthly: tp.monthly, researchedMonthly: tr.monthly, predictedAnnual: tp.annual, researchedAnnual: tr.annual,
    diffMonthly: diff, diffAnnual: diff * 12, pct: tr.monthly > 0 ? (diff / tr.monthly) * 100 : null, under: under as Row | null, over: over as Row | null };
}

// ── Step 5: energy sources and upgrades ──
// Upgrade defaults are classroom starting points ("about"), not quotes. Students change cost and savings to what they find.
export const UPGRADES = [
  { key: "led", label: "Switch every bulb to LED", cat: "lighting", cost: 60, pct: 75, why: "LEDs use about 75% less energy than incandescent bulbs and last far longer (U.S. DOE)." },
  { key: "thermostat", label: "Smart / programmable thermostat", cat: "heating", cost: 150, pct: 8, why: "ENERGY STAR estimates a certified smart thermostat saves about 8% on heating and cooling." },
  { key: "seal", label: "Air sealing + attic insulation", cat: "heating", cost: 1500, pct: 15, why: "ENERGY STAR estimates sealing and insulating saves about 15% on heating and cooling." },
  { key: "hpwh", label: "Heat pump water heater", cat: "hotwater", cost: 2000, pct: 60, why: "Heat pump water heaters move heat instead of making it, using a fraction of the energy of a standard electric tank." },
  { key: "heatpump", label: "Heat pump for heating and cooling", cat: "heating", cost: 9000, pct: 40, why: "A heat pump moves heat from outside air, even in cold weather. Savings depend a lot on what it replaces." },
  { key: "linedry", label: "Line-dry half your laundry", cat: "laundry", cost: 25, pct: 40, why: "A clothesline uses sunshine and Idaho's dry air instead of electricity." },
  { key: "solar", label: "Rooftop solar panels", cat: "solar", cost: 3, pct: 0, why: "In southern Idaho, each kW of panels makes roughly 1,400 kWh a year. Cost here is dollars per watt; check a real quote." },
] as const;
export type UpKey = (typeof UPGRADES)[number]["key"];
export type Up = { on?: boolean; cost?: string | number; pct?: string | number; kw?: string | number };
export const SOLAR_KWH_PER_KW = 1400;

export type Home = {
  place?: string; type?: string; sqft?: string | number; people?: string | number; heat?: string; budget?: string | number; elec?: string | number;
  gasPrice?: string | number; fuelPrice?: string | number; budgetSource?: string; budgetUrl?: string;
};
export type Grid = { mode?: "us" | "custom"; factor?: string | number };
export type Plan = { home: Home; values: Vals; grid: Grid; ups: Record<string, Up> };

export function upgradeRows(p: Plan) {
  const elec = num(p.home.elec);
  return UPGRADES.map((u) => {
    const s = p.ups?.[u.key] || {}, on = !!s.on, cost = isBlank(s.cost) ? u.cost : num(s.cost), pct = isBlank(s.pct) ? u.pct : num(s.pct);
    let monthly = 0, total = 0, kwh = 0;
    if (u.key === "solar") {
      const kw = isBlank(s.kw) ? 4 : num(s.kw);
      kwh = (kw * SOLAR_KWH_PER_KW) / 12;
      const elecSpend = CATS.filter((c) => c.fuel === "elec" || (c.fuel === "heat" && p.home.heat === "electric")).reduce((a, c) => a + val(p.values, c.key), 0);
      monthly = Math.min((kwh * elec) / 100, elecSpend);
      total = cost * kw * 1000;
    } else { monthly = (val(p.values, u.cat) * pct) / 100; total = cost; }
    const yearly = monthly * 12;
    return { ...u, on, cost, pct, total, monthly, yearly, kwh, payback: yearly > 0 ? total / yearly : null };
  });
}
/** CO2 from the monthly bills: dollars ÷ price = kWh, therms, gallons. */
export function carbon(p: Plan, after?: ReturnType<typeof upgradeRows>) {
  const h = p.home, elec = num(h.elec) / 100, gas = num(h.gasPrice), fuel = num(h.fuelPrice);
  const factor = p.grid?.mode === "custom" ? Math.min(Math.max(num(p.grid.factor), 0), 3) : F_KWH;
  const cut: Record<string, number> = {};
  let solarKwh = 0;
  (after || []).filter((u) => u.on).forEach((u) => { if (u.key === "solar") solarKwh += u.kwh; else cut[u.cat] = Math.min(1, (cut[u.cat] || 0) + u.pct / 100); });
  let kwh = 0, therms = 0, gal = 0;
  CATS.forEach((c) => {
    const v = val(p.values, c.key) * (1 - (cut[c.key] || 0));
    if (c.fuel === "elec" || (c.fuel === "heat" && h.heat === "electric")) kwh += elec > 0 ? v / elec : 0;
    else if (c.fuel === "heat") therms += gas > 0 ? v / gas : 0;
    else if (c.fuel === "fuel") gal += fuel > 0 ? v / fuel : 0;
  });
  const gridKwh = Math.max(0, kwh - solarKwh);
  const lb = gridKwh * factor + therms * F_THERM + gal * F_GAL;
  return { kwh, gridKwh, therms, gal, factor, lbMonth: lb, lbYear: lb * 12 };
}
export function plan(p: Plan) {
  const t = totals(p.values), ups = upgradeRows(p), on = ups.filter((u) => u.on);
  const savings = on.reduce((a, u) => a + u.monthly, 0), cost = on.reduce((a, u) => a + u.total, 0);
  const budget = num(p.home.budget);
  const after = Math.max(0, t.billsMonthly - savings), need = after + t.fundMonthly;
  const surplus = budget - need;
  const before = carbon(p), afterC = carbon(p, ups);
  return { t, ups, on, savings, cost, budget, after, need, surplus, payback: savings > 0 ? cost / (savings * 12) : null,
    fundYears: t.fundMonthly > 0 ? cost / (t.fundMonthly * 12) : null, before, afterC, meter: meter(surplus * 12, need * 12) };
}
// Surplus: more than 5% of yearly costs left over. Balanced: 0–5%. Shortfall: below 0.
export function meter(surplus: number, need: number) {
  const n = Math.max(0, num(need)), ratio = n > 0 ? surplus / n : surplus >= 0 ? 1 : -1;
  const level = surplus < 0 ? "shortfall" : ratio < 0.05 ? "balanced" : "surplus";
  const label = { surplus: "Surplus", balanced: "Balanced", shortfall: "Shortfall" }[level];
  return { level, label, ratio, pos: Math.max(0, Math.min(100, 50 + ratio * 100)) };
}

// ── Step 6: sentences + reflection quality ──
export function sentences(text: unknown) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return { total: 0, meaningful: 0, words: 0 };
  const parts = s.match(/[^.!?]+[.!?]+/g) || [];
  return { total: parts.length, meaningful: parts.filter((p) => p.trim().split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length >= 4).length, words: s.split(/\s+/).length };
}
export const REFL_MIN_WORDS = 80;
export type Draft = {
  step0?: { w?: unknown; h?: unknown; quiz?: string }; home?: Home; predicted?: Record<string, unknown>; predLockedAt?: string | null;
  research?: { location?: string; household?: string; url?: string; values?: Record<string, { v?: unknown; src?: string; note?: string }> };
  grid?: Grid; ups?: Record<string, Up>; reflection?: string; done?: Record<number, boolean>; [k: string]: unknown;
};
export function reflectionQuality(d: Draft) {
  const raw = String(d.reflection || ""), t = raw.toLowerCase(), s = sentences(raw);
  const words = t.match(/[a-z0-9']+/g) || [], uniq = new Set(words).size;
  const cmp = compare(d.predicted, d.research?.values as Vals);
  const underWord = cmp.under ? cmp.under.label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3) : [];
  const has = (re: RegExp) => re.test(t);
  const checks = {
    surprise: has(/surpris|shock|didn'?t (expect|know|realize|think)|did not (expect|know|realize|think)|unexpected|amaz|crazy|eye.?open|never (knew|thought|realized)|i thought|wow/),
    under: has(/under.?estimat|guess(ed)? (way |too )?low|more than i (thought|guessed|expected|predicted|estimated)|cost(s|ed)? (way |a lot )?more|higher than (i|my)|way more|low.?ball/) ||
      (underWord.some((w) => t.includes(w)) && has(/guess|estimat|predict|thought|expect/)),
    budget: has(/budget|afford|bill|cover|pay for|enough|can'?t|cannot|surplus|shortfall|balanced|left ?over/),
    changes: has(/led|bulb|insulat|seal|thermostat|solar|panel|heat pump|upgrade|unplug|turn (off|down)|line.?dry|clothesline|cold water|shorter shower|carpool|bike|bus|payback|efficien|energy star|sweater/),
    learned: has(/learn|realiz|understand|now know|know now|lesson|important|resource|renewable|nonrenewable|fossil|hydro|climate|carbon|co2|matters|need to/),
    numbers: /\$\s?\d|\d[\d,.]*\s?(dollars|kwh|therms?|gallons?|lb|pounds|years?|\/ ?mo|per month|a month|each month|a year|per year|%)|\b\d{2,}\b/.test(raw.replace(/,(?=\d{3})/g, "")),
  };
  const problems: string[] = [];
  if (s.meaningful < 5) problems.push("sentences");
  if (words.length < REFL_MIN_WORDS) problems.push("length");
  if (words.length >= 20 && uniq / words.length < 0.4) problems.push("repeat");
  (Object.keys(checks) as (keyof typeof checks)[]).forEach((k) => { if (!checks[k]) problems.push(k); });
  return { ok: problems.length === 0, problems, checks, words: words.length, sentences: s.meaningful, minWords: REFL_MIN_WORDS, cmp };
}

// ── Submission check (the database repeats the important parts) ──
export function missing(d: Draft) {
  const m: string[] = [], h = d.home || {};
  if (!d.step0 || isBlank(d.step0.quiz)) m.push("Step 0: answer the energy question");
  if (isBlank(h.place)) m.push("Step 1: where the home is");
  if (isBlank(h.type)) m.push("Step 1: home type");
  if (!(num(h.people) >= 1 && num(h.people) <= 20)) m.push("Step 1: people in the home (1–20)");
  if (!(num(h.budget) > 0)) m.push("Step 1: monthly energy budget");
  if (!(num(h.elec) > 0)) m.push("Step 1: electricity price");
  if (h.budgetSource === "researched" && isBlank(h.budgetUrl)) m.push("Step 1: where you found your budget (or mark it a guess)");
  KEYS.forEach((k) => { if (!d.predicted || isBlank(d.predicted[k])) m.push("Step 2: your estimate for " + CATS.find((x) => x.key === k)!.label); });
  if (!d.predLockedAt) m.push("Step 2: lock your estimates");
  const r = d.research || {};
  if (isBlank(r.location)) m.push("Step 3: location researched");
  if (isBlank(r.household)) m.push("Step 3: where your numbers came from");
  if (isBlank(r.url) || !/^https?:\/\/\S+\.\S+/i.test(String(r.url).trim())) m.push("Step 3: source web address (starts with https://)");
  KEYS.forEach((k) => {
    const x = r.values?.[k];
    if (!x || isBlank(x.v)) m.push("Step 3: researched cost for " + CATS.find((c) => c.key === k)!.label);
    else if (x.src === "own" && isBlank(x.note)) m.push("Step 3: say where your " + CATS.find((c) => c.key === k)!.label + " number came from");
  });
  if (sentences(d.reflection).meaningful < 5) m.push("Step 6: at least 5 complete sentences");
  else if (!reflectionQuality(d).ok) m.push("Step 6: reflection needs more. Answer every question and use your own numbers");
  return m;
}

export const RUBRIC: [string, string, number][] = [
  ["home", "Home and budget research", 10], ["predictions", "Original energy predictions", 15], ["research", "Researched costs and evidence", 25],
  ["calc", "Accurate calculations and comparison", 20], ["reflection", "Written reflection", 20], ["completion", "Completion and submission", 10],
];
/** Suggested rubric points (the teacher reviews and can override every line). Reflection is left for the teacher. */
export function suggestScores(d: Draft, opts: { hasImage?: boolean; submitted?: boolean }) {
  const h = d.home || {}, r = d.research || {}, vals = r.values || {};
  const filled = (obj: Record<string, unknown> | undefined, k: string) => !!obj && !isBlank(obj[k] && typeof obj[k] === "object" ? (obj[k] as { v: unknown }).v : obj[k]);
  let home = 0;
  if (!isBlank(h.place) && !isBlank(h.type)) home += 2;
  if (num(h.budget) > 0) home += 2;
  if (num(h.elec) > 0 && num(h.people) > 0) home += 2;
  if (h.budgetSource === "researched" && !isBlank(h.budgetUrl)) home += 4;
  const predN = KEYS.filter((k) => filled(d.predicted, k)).length;
  const predictions = Math.round((predN / 12) * 13) + (d.predLockedAt ? 2 : 0);
  const resN = KEYS.filter((k) => filled(vals as Record<string, unknown>, k) && !(vals[k]?.src === "own" && isBlank(vals[k]?.note))).length;
  let research = Math.round((resN / 12) * 15);
  (["location", "household"] as const).forEach((f) => { if (!isBlank(r[f])) research += 1; });
  if (/^https?:\/\/\S+\.\S+/i.test(String(r.url || "").trim())) research += 4;
  if (opts.hasImage) research += 4;
  let calc = 0;
  if (d.step0?.quiz === "b") calc += 4;
  if (d.done?.[4]) calc += 8;
  if (d.done?.[5]) calc += 8;
  return { home, predictions, research, calc, reflection: null as number | null, completion: opts.submitted ? 10 : 0 };
}
// ── end wave-twinB ──
