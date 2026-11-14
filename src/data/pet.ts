// ── wave-pet: the class rock alien (Bedrock's version of the Dopps Class Wellness Sprite) ──
// Rules live in the database (supabase/migrations/005_pet.sql). This file is look and words only.
import glossary from "./content/glossary.json";
import { chapters, realms } from "./site";
import type { PetMood, PetStage } from "@/lib/db";

type Gloss = { term: string; definition: string; chapter: number };
const GLOSSARY = glossary as Gloss[];

/** Body stages, in rock-cycle order. `realms` = realms cleared to reach it (the server uses the same numbers). */
export const STAGES: { key: PetStage; name: string; realms: number; why: string }[] = [
  { key: "geode", name: "Sealed Geode", realms: 0, why: "Your alien is curled up inside its crash-landed geode. Care for it once to wake it up." },
  { key: "pebble", name: "Pebble", realms: 0, why: "Weathering breaks big rocks into loose bits of sediment, like a pebble." },
  { key: "sandstone", name: "Sandstone", realms: 1, why: "Layers of sand were buried, pressed (compaction) and glued (cementation) into sedimentary rock." },
  { key: "quartzite", name: "Quartzite", realms: 3, why: "Deep heat and pressure changed sandstone into hard, shiny metamorphic quartzite, without melting it." },
  { key: "magma", name: "Molten", realms: 5, why: "Pushed even deeper, the rock got hot enough to melt into magma." },
  { key: "granite", name: "Granite", realms: 7, why: "Magma that cools slowly underground grows big crystals and becomes granite, an intrusive igneous rock." },
  { key: "titan", name: "Mountain Titan", realms: 9, why: "Uplift raised the granite into mountains, like the Idaho Batholith in the Sawtooths. Diamond rank!" },
];
export const stageInfo = (s: PetStage) => STAGES.find((x) => x.key === s) ?? STAGES[1];
export const stageIndex = (s: PetStage) => STAGES.findIndex((x) => x.key === s);
export const FORM_NAME: Record<string, string> = { radiant: "Radiant", steady: "Steady", dusty: "Dusty", rusty: "Rusty" };

/** Crystal colors chosen at adoption: the CSS hue shift from the art's purple-and-teal crystals. */
export const PET_COLORS: { key: string; name: string; hex: string; hue: number }[] = [
  { key: "amethyst", name: "Amethyst", hex: "#a78bfa", hue: 0 },
  { key: "sapphire", name: "Sapphire", hex: "#60a5fa", hue: -45 },
  { key: "emerald", name: "Emerald", hex: "#34d399", hue: -120 },
  { key: "citrine", name: "Citrine", hex: "#f6c453", hue: 150 },
  { key: "ruby", name: "Ruby", hex: "#f25c45", hue: 85 },
];
export const petColor = (k: string) => PET_COLORS.find((c) => c.key === k) ?? PET_COLORS[0];

/** Real-life field habits (honor system), like Dopps Class's healthy habits. Keys match the database. */
export const HABITS = [
  { k: "rock", ico: "🪨", label: "Noticed a rock, soil or landform outside", tip: "Every rock outside has a story: igneous, sedimentary or metamorphic?" },
  { k: "sky", ico: "☁️", label: "Checked the sky or the weather", tip: "Cloud shapes can hint at the weather coming next." },
  { k: "moon", ico: "🌙", label: "Looked for the Moon or stars", tip: "The Moon's phase changes because we see different amounts of its sunlit side." },
  { k: "water", ico: "💧", label: "Saved water or traced where it flows", tip: "Every drop that runs off joins a watershed on its way downhill." },
  { k: "explain", ico: "🗣️", label: "Explained an Earth science idea to someone", tip: "Teaching an idea is one of the best ways to remember it." },
  { k: "litter", ico: "♻️", label: "Picked up litter or recycled", tip: "Recycling metal saves ore that would have to be mined." },
];

export const MOOD_TEXT: Record<PetMood, (n: string) => string> = {
  happy: (n) => `${n} is glowing and happy!`,
  hungry: (n) => `${n} is low on minerals. Spot some rocks or answer vocab questions.`,
  cold: (n) => `${n} is cooling down. It recharges under the Moon and stars.`,
  dusty: (n) => `${n} is covered in dust. Help clean up its home planet.`,
  sad: (n) => `${n} feels lonely. Explain some science to someone!`,
  sick: (n) => `${n} is crumbling! Keep up your field habits to patch it up.`,
  rusty: (n) => `${n} ate too much space junk and feels rusty…`,
  dormant: (n) => `${n} has gone dormant: cold, gray and still.`,
};
export const MOOD_BUBBLE: Record<PetMood | "geode", string> = {
  happy: "Feeling rock solid!", hungry: "Need… minerals…", cold: "Brrr, my crystals are dimming…", dusty: "I'm so dusty…",
  sad: "Kinda lonely on this planet…", sick: "I feel crumbly…", rusty: "Ugh, too much space junk!", dormant: "…zzz…", geode: "*tap tap* …hello?",
};

// ── Speech: words it learned ──
/** Hand-written lines for key words (accurate, short). Everything else uses the glossary definition. */
const LINES: Record<string, string> = {
  basalt: "Basalt! Cooled fast from lava, like my crash site!",
  obsidian: "Obsidian! Lava that cooled so fast it turned to glass.",
  pumice: "Pumice is so full of gas holes it can float. Wheee!",
  granite: "Granite! Magma that cooled slowly underground, so its crystals grew big.",
  magma: "Magma is melted rock underground. Once it reaches the surface, it's lava!",
  lava: "Lava! Melted rock at the surface. Craters of the Moon is covered in old lava.",
  sandstone: "Sandstone: sand grains pressed and glued together. I used to be layers!",
  quartzite: "Quartzite! Sandstone squeezed and heated until it's super hard.",
  "igneous rock": "Igneous rocks form when melted rock cools. That's my whole family!",
  "sedimentary rock": "Sedimentary rock forms from sediment pressed and glued together.",
  "metamorphic rock": "Metamorphic rocks change from heat and pressure, without melting.",
  "rock cycle": "The rock cycle never stops. I've been a pebble, and someday I'll be a mountain!",
  erosion: "Erosion moves weathered bits to new places. Hold on to my crystals!",
  weathering: "Weathering breaks rock into smaller pieces right where it sits.",
  mineral: "Minerals are natural, inorganic solids with a crystal structure. Like my belly!",
  crystal: "In a crystal, atoms line up in a repeating pattern. Mine sparkle!",
  meteorite: "A meteorite is a space rock that lands on Earth. Hi, that's me!",
  meteor: "A meteor is a shooting star burning up in the atmosphere. That was almost me!",
  hotspot: "The Yellowstone hotspot helped make the Snake River Plain, where I landed.",
  volcano: "A volcano is an opening where magma, gas and ash escape. I love those!",
  "cinder cone": "Cinder cones are small, steep volcanoes. Craters of the Moon has lots of them!",
  batholith: "The Idaho Batholith is a huge mass of granite. Goals!",
  intrusive: "Intrusive rock cooled slowly underground, so it has big crystals.",
  extrusive: "Extrusive rock cooled fast at the surface, so its crystals are tiny.",
  compaction: "Compaction: sediment pressed together. Squish!",
  cementation: "Cementation glues sediment into rock. Nature's glue stick!",
  sediment: "Sediment is loose bits of rock, sand, mud and shells.",
  luster: "Luster is how a mineral shines. Metallic or nonmetallic, I shine either way!",
  streak: "A mineral's streak is the color of its powder. Don't scratch me, please!",
  fossil: "Fossils are traces of ancient life saved in rock. So cool!",
  uplift: "Uplift raises Earth's crust. That's how I'll become a mountain!",
  earthquake: "Earthquakes happen when rocks suddenly slip along a fault. Hold on!",
  aurora: "Auroras glow when solar particles hit the air near the poles. Pretty!",
  crust: "The crust is Earth's thin, rocky outer layer. I live on it now!",
  mantle: "The mantle is hot and flows very slowly under the crust.",
  asteroid: "Asteroids are rocky chunks orbiting the Sun. My cousins!",
  comet: "Comets are icy bodies that grow a glowing tail near the Sun.",
};
const byTerm = new Map(GLOSSARY.map((g) => [g.term.toLowerCase(), g]));
export function lineFor(term: string) {
  const k = term.toLowerCase();
  if (LINES[k]) return LINES[k];
  const g = byTerm.get(k);
  const name = term.replace(/\s*\([^)]*\)/g, "");
  if (g && g.definition.length <= 90) return `${name}! That's ${g.definition.replace(/\.$/, "")}. I learned it!`;
  return `I learned a new word: ${name}!`;
}

/** Chapter ids (as in chapters.json) whose words count as learned from the browser's practice + the server's quiz tasks. */
export function learnedChapters(learn: { vocab: Record<string, Record<string, number>>; mastery: Record<string, { passed: boolean }> },
  doneTasks: Set<string>, vocabPass: number) {
  return chapters.filter((c) => doneTasks.has(`ch${c.id}_quiz`) || learn.mastery[c.id]?.passed
    || Object.values(learn.vocab[c.id] ?? {}).some((v) => v >= vocabPass)).map((c) => c.n);
}
/** Every word the alien knows: right answers on its own vocab questions + glossary words of learned chapters. */
export function knownWords(serverWords: string[], chapterNs: number[]) {
  const set = new Set(chapterNs);
  const words = new Map<string, string>();
  for (const w of serverWords) words.set(w.toLowerCase(), w);
  for (const g of GLOSSARY) if (set.has(g.chapter)) words.set(g.term.toLowerCase(), g.term);
  return [...words.values()];
}

/** Chapter picker for the vocab questions: database refs (12, 1201) with labels. */
export const quizChapters = chapters.map((c) => ({ ref: c.ref, label: `Ch ${c.label}: ${c.title}` }));
export const DIAMOND_REALMS = realms.length;

export const SLOT_NAME: Record<string, string> = {
  hat: "⛑️ Hats", face: "🥽 Eyewear", hand: "🔨 Tools", body: "🦺 Clothes", feet: "🥾 Boots", back: "🎒 Packs",
  skin: "💎 Crystal colors", neck: "🏅 Medals", aura: "✨ Auras", stand: "🪨 Stands", scene: "🌌 Backdrops",
};
// ── end wave-pet ──
