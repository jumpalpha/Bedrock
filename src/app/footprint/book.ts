// ── wave-twinB ── Footprint Quest: the Swap Shop book (twin of Dopps Class wcq_recipes.js, the Island Recipe Book).
// The computer decides which low-impact swaps a group can use from its 15 everyday items.
//
// ITEMS:   key -> [display name, book unit, match regex, book numbers per unit or null, hidden?]
//          book numbers: [water gal, electricity kWh, natural gas therms, gasoline gal, CO2 lb] (null = look it up).
//          They are rough, "about" numbers for hints only; every amount on the page comes from the student's own meter readings.
// SWAPS:   [id, name, tag, [[key, amount, altKey?, altAmount?], ...]] amounts are in the student's OWN units.
//          A key starting with "?" is optional (used only if it's on the list). altKey = "or use this one".
// Teacher-added swaps (b_fp_book) and class-made swaps (b_fp_made) come from the database in the same shape.

export const NK = ["water", "kwh", "therm", "gas", "co2"] as const;
export type NKey = (typeof NK)[number];
export const NLABEL: Record<NKey, string> = { water: "Water (gal)", kwh: "Electricity (kWh)", therm: "Natural gas (therms)", gas: "Gasoline (gal)", co2: "CO₂ (lb)" };
export const NSHORT: Record<NKey, string> = { water: "gal water", kwh: "kWh", therm: "therms", gas: "gal gas", co2: "lb CO₂" };

// CO2 from burning each fuel (U.S. EIA, rounded). Electricity uses the U.S. grid average; Idaho's grid is cleaner (lots of hydro).
export const F_KWH = 0.8;    // about 0.8 lb CO2 per kWh, U.S. average
export const F_THERM = 11.7; // about 11.7 lb CO2 per therm of natural gas
export const F_GAL = 19.4;   // about 19.4 lb CO2 per gallon of gasoline (with 10% ethanol)

type Ref = (number | null)[];
type Item = [string, string, RegExp, Ref | null, boolean?];
export const ITEMS: Record<string, Item> = {
  shower:     ["Showers", "8-minute shower", /\bshowers?\b/, [20, 0, 0.1, 0, 1.2]],
  bath:       ["Baths", "bath", /\bbath(s|tub)?\b|\btub\b/, null],
  toilet:     ["Toilet flushes", "flush", /\btoilets?\b|\bflush\w*/, [1.6, 0, 0, 0, 0]],
  dishwasher: ["Dishwasher", "load", /\bdish ?wash(er|ing machine)\b/, [4, 1.2, 0, 0, 1]],
  handdishes: ["Hand-washed dishes", "sink of dishes", /\bdishes\b/, [20, 0, 0.1, 0, 1.2]],
  hairdryer:  ["Hair dryer", "10 minutes", /\bhair ?dryer\b|\bblow ?dry\w*|\bcurling iron\b|\bstraightener\b/, [0, 0.25, 0, 0, 0.2]],
  washer:     ["Laundry (washer)", "load", /\blaundry\b|\bwashing machine\b|\bwasher\b|\bwashing clothes\b/, [20, 0.3, 0, 0, 0.24]],
  dryer:      ["Clothes dryer", "load", /\bdryer\b|\bdrying clothes\b/, [0, 2.5, 0, 0, 2]],
  faucet:     ["Faucet / brushing teeth", "2 minutes of running tap", /\bfaucet\b|\btap\b|\bsink\b|\bbrush\w*|\bteeth\b|\bwash\w* (my )?(hands|face)\b/, [4, 0, 0, 0, 0]],
  lawn:       ["Lawn & garden watering", "hour of sprinkler", /\blawn\b|\bsprinklers?\b|\bgarden\w*|\bwatering\b|\bhose\b|\byard\b/, null],
  car:        ["Car rides", "mile", /\bcar\b|\bcars\b|\bdriv\w*|\btrucks?\b|\bsuv\b|\bminivan\b|\brides?\b/, [0, 0, 0, 0.04, 0.78]],
  bus:        ["Bus rides", "mile", /\bbus\b|\bbuses\b/, null],
  bike:       ["Bike or walk", "mile", /\bbik\w*|\bwalk\w*|\bscooter\b|\bskateboard\w*|\bbicycle\b/, [0, 0, 0, 0, 0]],
  flight:     ["Flights", "hour of flying", /\bfl(y|ying|ights?)\b|\bplanes?\b|\bairplanes?\b/, null],
  phone:      ["Phone charging", "full charge", /\bphones?\b|\bcell\b|\biphone\b|\bcharg\w*/, [0, 0.015, 0, 0, 0.012]],
  laptop:     ["Laptop / computer", "hour", /\blaptops?\b|\bcomputers?\b|\bchromebooks?\b|\bpc\b|\btablets?\b|\bipads?\b/, [0, 0.05, 0, 0, 0.04]],
  tv:         ["TV & video games", "hour", /\btv\b|\btelevision\b|\bvideo games?\b|\bgaming\b|\bconsoles?\b|\bxbox\b|\bplaystation\b|\bnintendo\b|\bnetflix\b|\bstream\w*/, [0, 0.15, 0, 0, 0.12]],
  led:        ["LED lights", "bulb-hour", /\bleds?\b/, [0, 0.01, 0, 0, 0.008]],
  lights:     ["Lights (old-style bulbs)", "bulb-hour", /\blights?\b|\blamps?\b|\bbulbs?\b|\bincandescent\b/, [0, 0.06, 0, 0, 0.048]],
  fridge:     ["Refrigerator", "day", /\bfridge\b|\brefrigerator\b|\bfreezer\b/, [0, 1.1, 0, 0, 0.88]],
  ac:         ["Air conditioning", "hour", /\bair condition\w*|\bac\b|\ba c\b|\bswamp cooler\b/, [0, 3, 0, 0, 2.4]],
  heater:     ["Space heater", "hour", /\bspace heaters?\b|\bheaters?\b|\belectric blankets?\b/, [0, 1.5, 0, 0, 1.2]],
  furnace:    ["Home heating (furnace)", "day", /\bfurnace\b|\bheat(ing)?\b|\bthermostat\b|\bfireplace\b|\bwood stove\b/, null],
  microwave:  ["Microwave", "5 minutes", /\bmicrowav\w*/, [0, 0.08, 0, 0, 0.064]],
  oven:       ["Oven / stove", "hour", /\bovens?\b|\bstoves?\b|\bbak(e|ing)\b|\bcook\w*|\bair fryer\b/, null],
  burger:     ["Beef & burgers", "quarter-pound patty", /\bbeef\b|\bburgers?\b|\bhamburgers?\b|\bcheeseburgers?\b|\bsteaks?\b/, [460, 0, 0, 0, 15], true],
  chicken:    ["Chicken", "4 oz serving", /\bchicken\b|\bnuggets?\b/, [130, 0, 0, 0, 2.5], true],
  cheese:     ["Cheese", "1 oz", /\bcheese\b/, [38, 0, 0, 0, 1.5], true],
  milk:       ["Milk", "cup", /\bmilk\b/, [65, 0, 0, 0, 1.7], true],
  potato:     ["Idaho potatoes", "medium potato", /\bpo\w{0,3}tato\w*|\bspuds?\b|\bfries\b|\btots\b/, [15, 0, 0, 0, 0.2], true],
  beans:      ["Beans & lentils", "1/2 cup", /\bbeans?\b|\blentils?\b|\bchickpeas?\b/, null, true],
  tshirt:     ["Cotton T-shirts", "shirt", /\bt ?shirts?\b|\btees?\b|\bcotton\b/, [700, null, null, null, null], true],
  jeans:      ["Jeans", "pair", /\bjeans\b|\bdenim\b/, null, true],
  bottle:     ["Bottled water", "bottle", /\bbottled water\b|\bwater bottles?\b|\bplastic bottles?\b/, null, true],
};
// Where a book number comes from, or why there isn't one (shown under the meter card).
export const ITEM_NOTE: Record<string, string> = {
  shower: "Showerheads sold in the U.S. use at most 2.5 gallons a minute (WaterSense ones about 2). Electric water heater? Use about 2 kWh instead of 0.1 therm.",
  bath: "A full bathtub can hold about 70 gallons (EPA WaterSense). Most baths use less. Estimate how full yours is.",
  toilet: "Toilets made since 1994 use at most 1.6 gallons a flush; WaterSense toilets about 1.28. Very old toilets can use 3.5 or more.",
  dishwasher: "ENERGY STAR dishwashers use about 3.5 gallons or less a load. The electricity includes heating the water.",
  handdishes: "Washing a full load by hand with the tap running can use up to about 27 gallons (ENERGY STAR).",
  washer: "Older top-loaders can use 20+ gallons a load; ENERGY STAR washers use less. Hot water adds energy.",
  dryer: "An electric dryer is one of the biggest electricity users in a home. A gas dryer uses natural gas instead.",
  faucet: "Bathroom faucets flow about 1.5 to 2.2 gallons a minute. Turning it off while you brush saves most of that.",
  lawn: "Sprinklers vary a lot. Put an empty can on the lawn, run the sprinkler, and check your water bill. In Idaho summers, outdoor watering is often the biggest home water use.",
  car: "A car that gets about 25 miles per gallon burns about 0.04 gallons a mile (EPA: a typical car emits about 0.9 lb CO₂ a mile).",
  bus: "Count your share: divide the bus's fuel by the number of riders. A full school bus is far better per rider than one car.",
  bike: "Zero fuel, zero water from the tap. Your muscles do the work.",
  flight: "Flying burns jet fuel. Look up a flight carbon calculator and divide by your trip.",
  phone: "A phone battery holds about 0.015 kWh: a full charge costs less than a penny.",
  laptop: "A laptop uses about 30–60 watts while it's working.",
  tv: "A TV plus a game console can draw about 100–200 watts.",
  led: "An LED bulb uses about 75% less energy than an old incandescent bulb (U.S. Department of Energy).",
  lights: "An old 60-watt incandescent bulb uses 0.06 kWh every hour it's on.",
  fridge: "An ENERGY STAR refrigerator uses about 400 kWh a year, about 1.1 kWh a day.",
  ac: "Central air uses about 3 kWh an hour while it runs; swamp coolers (common in dry Idaho) use much less.",
  heater: "Most plug-in space heaters max out at 1,500 watts = 1.5 kWh an hour.",
  furnace: "Heating is usually a home's biggest energy use. Use your gas or power bill: winter therms ÷ days in the bill ÷ people.",
  microwave: "A microwave uses about 1,000 watts, but only for a few minutes.",
  oven: "An electric oven can use about 2 kWh an hour; a gas range burns natural gas. Check the label on yours.",
  burger: "Beef needs about 1,800 gallons of water per pound counting the feed crops (Water Footprint Network) and about 60 lb CO₂-equivalent per pound (Our World in Data), mostly from cattle methane and land use.",
  chicken: "Chicken has a much smaller footprint than beef: about 520 gallons of water and roughly 10 lb CO₂-equivalent per pound.",
  cheese: "Cheese takes a lot of milk to make, so its footprint per ounce is high for a dairy food.",
  milk: "Most of milk's footprint is the water and feed for the cows.",
  potato: "Idaho grows about a third of the nation's potatoes. Potatoes have one of the smallest footprints of any staple food.",
  beans: "Beans and lentils have a very small carbon footprint. They even add nitrogen back to the soil. Look up a number for your serving.",
  tshirt: "Growing the cotton for one T-shirt takes about 700 gallons of water (WWF). The CO₂ depends on how and where it was made.",
  jeans: "Estimates for one pair of jeans range from about 1,000 to 2,000 gallons of water, most of it for growing cotton.",
  bottle: "Making the plastic bottle and shipping it uses energy. Tap water uses almost none.",
};
const MATCH_ORDER = ["hairdryer", "dishwasher", "led", "shower", "bath", "toilet", "handdishes", "washer", "dryer", "lawn", "bus", "bike", "flight", "phone", "laptop", "tv",
  "lights", "fridge", "ac", "heater", "furnace", "microwave", "oven", "burger", "chicken", "cheese", "milk", "potato", "beans", "tshirt", "jeans", "bottle", "faucet", "car"];

export type Part = [string, number, ...(string | number)[]];
// [id, name, tag, parts]
export const SWAPS: [string, string, string, Part[]][] = [
  ["short-shower", "Half-length shower", "W", [["shower", 0.5]]],
  ["quick-rinse", "Quick rinse instead of a bath", "W", [["shower", 0.5]]],
  ["tap-off", "Tap off while brushing", "W", [["faucet", 0.25]]],
  ["tap-bottle", "Refill a bottle from the tap", "W", [["faucet", 0.05]]],
  ["full-dishwasher", "Full dishwasher load", "W", [["dishwasher", 1]]],
  ["basin-dishes", "Fill-the-sink dishwashing (tap off)", "W", [["handdishes", 0.5]]],
  ["cold-line-dry", "Cold wash + line-dried laundry", "W", [["washer", 1]]],
  ["full-loads", "Full loads only (half as many)", "W", [["washer", 0.5], ["?dryer", 0.5]]],
  ["dry-brush", "Brown lawn is OK: water at night, half as long", "W", [["lawn", 0.5]]],
  ["carpool", "Carpool to school with 3 friends (your share)", "T", [["car", 0.25, "bus", 1]]],
  ["bike-school", "Bike or walk to school", "T", [["bike", 2]]],
  ["bus-school", "Ride the bus", "T", [["bus", 3]]],
  ["errand-chain", "Combine errands into one trip", "T", [["car", 0.6]]],
  ["led-evening", "LED evening (5 bulbs × 4 hours)", "P", [["led", 20, "lights", 4]]],
  ["laptop-show", "Watch on a laptop instead of the big TV", "P", [["laptop", 1, "phone", 0.2]]],
  ["air-dry", "Air-dry hair (half the dryer time)", "P", [["hairdryer", 0.5]]],
  ["microwave-leftovers", "Microwave leftovers instead of the oven", "P", [["microwave", 1]]],
  ["sweater-heat", "Thermostat 2°F lower + a sweater", "P", [["furnace", 0.9, "heater", 0.5]]],
  ["fan-not-ac", "Fan and open windows at night, AC half as long", "P", [["ac", 0.5]]],
  ["chicken-swap", "Chicken instead of beef", "F", [["chicken", 1]]],
  ["half-burger", "Half beef, half bean burger", "F", [["burger", 0.5], ["beans", 0.5]]],
  ["potato-bar", "Idaho baked potato bar", "F", [["potato", 2], ["?cheese", 0.5]]],
  ["bean-burrito", "Bean burrito night", "F", [["beans", 1], ["?cheese", 0.5]]],
  ["small-milk", "Half-glass of milk", "F", [["milk", 0.5]]],
  ["wear-twice", "Wear jeans twice before washing", "S", [["washer", 0.5]]],
];

export const CATS: Record<string, string> = { water: "Water use", power: "Electricity", heat: "Heating", travel: "Travel", food: "Food", stuff: "Stuff I buy", waste: "Trash & waste" };
// Swap templates for an item the class taught the book. X = the new item, in the group's own units.
const TEMPLATES: Record<string, [string, Part[]][]> = {
  water: [["Half-time {X}", [["X", 0.5]]], ["{X}, then turn it off", [["X", 0.75]]]],
  power: [["{X} on a timer", [["X", 0.5]]], ["{X}, unplugged when done", [["X", 0.8]]]],
  heat: [["{X} turned down a little", [["X", 0.85]]]],
  travel: [["Shared {X} (4 riders)", [["X", 0.25]]], ["{X}: one trip instead of two", [["X", 0.5]]]],
  food: [["Smaller {X}", [["X", 0.5]]], ["{X} leftovers night", [["X", 1]]]],
  stuff: [["Make your {X} last twice as long", [["X", 0.5]]]],
  waste: [["Recycle half the {X}", [["X", 0.5]]]],
};
export const TAGS: Record<string, string> = { W: "Water swap", T: "Travel swap", P: "Power swap", F: "Food swap", S: "Stuff swap", U: "Class-made swap", M: "My swap", X: "New-item swap", B: "Teacher swap" };

export const norm = (n: string) => String(n || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
export const normKey = (n: string) => norm(n).replace(/(es|s)$/, "");
export const title = (n: string) => String(n).trim().replace(/\s+/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
export function frac(n: number) {
  const w = Math.floor(n + 1e-9), r = n - w;
  const F: [number, string][] = [[0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
  let best = F[0], d = 9;
  F.forEach((f) => { const x = Math.abs(r - f[0]); if (x < d) { d = x; best = f; } });
  if (d > 0.06) return String(Math.round(n * 100) / 100);
  if (Math.abs(r - 1) < 0.06) return String(w + 1);
  return (w ? w + (best[1] ? " " : "") : "") + (best[1] || (w ? "" : "0"));
}

/** Which book item is this everyday use? */
export function matchItem(name: string) {
  const n = " " + String(name || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ") + " ";
  for (const k of MATCH_ORDER) if (ITEMS[k][2].test(n)) return k;
  return null;
}
export function refText(key: string | null) {
  if (!key || !ITEMS[key] || !ITEMS[key][3]) return "";
  const r = ITEMS[key][3]!;
  return NK.map((k, j) => (r[j] == null || (r[j] === 0 && k !== "water" && k !== "co2") ? "" : `${r[j]} ${NSHORT[k]}`)).filter(Boolean).join(" · ");
}

export type Use = { name: string; type: "" | "D" | "H" };
export type Meter = { unit: string; water: string | number; kwh: string | number; therm: string | number; gas: string | number; co2: string | number };
export type Extra = { id: string; name: string; ings: (string | number)[][]; tag?: string };
export type SwapPart = { k: string; i: number; a: number; nut: number[] };
export type Swap = { id: string; name: string; tag: string; parts: SwapPart[]; nut: Record<NKey, number> };

/** shop(items, meters, extra, learned) -> which swaps this list can use, which are 1 item away, and items the book doesn't know.
 *  Every amount is "uses of that item", priced with the student's own meter numbers. */
export function shop(items: Use[], meters: Meter[], extra: Extra[], learned: Record<string, string>) {
  const map: Record<string, number> = {}, customs: { i: number; lk: string; cat: string; name: string }[] = [], unknown: { i: number; lk: string; name: string }[] = [];
  items.forEach((f, i) => {
    if (!f || !String(f.name || "").trim()) return;
    const k = matchItem(f.name);
    if (k) { if (map[k] == null) map[k] = i; return; }
    const lk = normKey(f.name); if (!lk) return;
    if (map["x:" + lk] == null) map["x:" + lk] = i;
    if (learned[lk] && TEMPLATES[learned[lk]]) customs.push({ i, lk, cat: learned[lk], name: title(f.name) });
    else unknown.push({ i, lk, name: f.name });
  });
  const tpl: Extra[] = [];
  customs.forEach((c) => TEMPLATES[c.cat].forEach(([nm, ings], n) => tpl.push({ id: "t-" + c.lk.replace(/ /g, "-") + "-" + n, name: nm.replace("{X}", c.name), tag: "X",
    ings: ings.map((e) => (e[0] === "X" ? ["x:" + c.lk, e[1]] : e)) })));
  const all: Extra[] = extra.filter((r) => r.tag === "M")
    .concat(SWAPS.map((r) => ({ id: r[0], name: r[1], tag: r[2], ings: r[3] })))
    .concat(tpl).concat(extra.filter((r) => r.tag !== "M"));
  const can: Swap[] = [], almost: { id: string; name: string; missing: string }[] = [], byId: Record<string, Swap> = {};
  const seen = new Set<string>();
  const label = (k: string) => (k.startsWith("x:") ? title(k.slice(2)) : ITEMS[k] ? ITEMS[k][0] : k);
  all.forEach((r) => {
    if (seen.has(r.id)) return; seen.add(r.id);
    const parts: SwapPart[] = [], missing: string[] = [];
    (r.ings || []).forEach((e) => {
      let k = String(e[0]); const opt = k.startsWith("?"); if (opt) k = k.slice(1);
      const choices: [string, number][] = [[k, +e[1]]]; for (let j = 2; j + 1 < e.length; j += 2) choices.push([String(e[j]), +e[j + 1]]);
      const use = choices.find((c) => map[c[0]] != null) || null;
      if (!use) { if (!opt) missing.push(choices.map((c) => label(c[0])).join(" or ")); return; }
      if (parts.some((p) => p.k === use[0])) return;
      const m = meters[map[use[0]]] || ({} as Meter);
      parts.push({ k: use[0], i: map[use[0]], a: use[1], nut: NK.map((x) => (+m[x] || 0) * use[1]) });
    });
    if (!missing.length && parts.length) {
      const nut = { water: 0, kwh: 0, therm: 0, gas: 0, co2: 0 } as Record<NKey, number>;
      parts.forEach((p) => NK.forEach((x, j) => { nut[x] += p.nut[j]; }));
      const d: Swap = { id: r.id, name: r.name, tag: r.tag || "U", parts, nut };
      can.push(d); byId[r.id] = d;
    } else if (missing.length === 1 && parts.length && r.tag !== "M") almost.push({ id: r.id, name: r.name, missing: missing[0] });
  });
  can.sort((a, b) => a.name.localeCompare(b.name)); almost.sort((a, b) => a.name.localeCompare(b.name));
  return { map, can, almost, byId, unknown };
}
// ── end wave-twinB ──
