// Earth science stand-ins for the Dopps good-item vs. bad-item lists (wave-arcadeA games).
// GOOD = things you want to collect, HAZARD = things that hurt. Every name has a sprite or a procedural fallback.
export const GOOD = ["crystal", "star-garnet", "fossil", "water-drop", "gold-nugget", "geode"];
export const HAZARD = ["lava-bomb", "meteor", "boulder", "storm-cloud", "tornado"];

export const GOOD_FACTS: Record<string, string> = {
  crystal: "In a crystal, atoms line up in a repeating pattern.",
  "star-garnet": "Idaho is one of only two places on Earth with star garnets.",
  fossil: "Fossils are almost always found in sedimentary rock.",
  "water-drop": "Less than 1% of Earth's water is fresh liquid water we can use.",
  "gold-nugget": "Gold is so soft you can scratch it with a knife (hardness 2.5–3).",
  geode: "A geode forms when minerals slowly crystallize inside a hollow in rock.",
};

export const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
