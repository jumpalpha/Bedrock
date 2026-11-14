// Generates 16x16 pixel-art block textures as SVGs in public/tex/. Seeded, so output is stable.
// Run: node scripts/gen-textures.mjs
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("public/tex", { recursive: true });
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
function svg(cells) {
  let r = "";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${cells[y][x]}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${r}</svg>`;
}
function grid(fn) { return Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => fn(x, y))); }
const DIRT = ["#8b5a2b", "#7a4e24", "#9a6634", "#6b4220", "#86562a"];
const STONE = ["#8a8a8a", "#7d7d7d", "#949494", "#6f6f6f", "#858585"];
const GRASS = ["#5fa83a", "#4f9a2e", "#6bb544", "#58a234"];
const blocks = {
  dirt: grid(() => pick(DIRT)),
  stone: grid(() => pick(STONE)),
  cobble: grid((x, y) => ((x % 5 === 0 || y % 4 === 0) && rnd() > 0.3 ? "#5e5e5e" : pick(STONE))),
  grass_top: grid(() => pick(GRASS)),
  grass_side: (() => { const d = grid(() => pick(DIRT)); for (let x = 0; x < 16; x++) { const h = 3 + Math.floor(rnd() * 3); for (let y = 0; y < h; y++) d[y][x] = pick(GRASS); } return d; })(),
  bedrock: grid(() => pick(["#2b2b2b", "#3c3c3c", "#565656", "#1d1d1d", "#4a4a4a"])),
  sand: grid(() => pick(["#dccf9a", "#d4c58c", "#e3d7a6", "#cfc085"])),
  water: grid((x, y) => ((y + x) % 7 === 0 ? "#5aa0ea" : pick(["#2f6fd0", "#3a7bdc", "#2a66c4"]))),
  snow: grid(() => pick(["#f4f8fb", "#e8eef3", "#ffffff", "#dde6ec"])),
  lava: grid(() => pick(["#e8590c", "#f08c00", "#d9480f", "#ffa94d"])),
  leaves: grid(() => pick(["#2f7d32", "#256b28", "#3a8f3d", "#1e5a21", "#2f7d32"])),
  ice: grid(() => pick(["#a5d8ff", "#bfe3ff", "#91c9f5", "#cfeaff"])),
  obsidian: grid(() => pick(["#1a1027", "#22163a", "#2d1f4a", "#120b1c"])),
  sky: grid(() => pick(["#7ec8f0", "#86ccf2", "#79c3ec"])),
  netherrack: grid(() => pick(["#6b2a2a", "#7a3030", "#5c2222", "#853838"])),
};
function ore(fleck) { const s = grid(() => pick(STONE)); for (let i = 0; i < 6; i++) { const x = 1 + Math.floor(rnd() * 13), y = 1 + Math.floor(rnd() * 13); s[y][x] = fleck[0]; s[y][x + 1] = fleck[1]; s[y + 1][x] = fleck[1]; } return s; }
Object.assign(blocks, {
  coal_ore: ore(["#1f1f1f", "#333333"]), iron_ore: ore(["#d8af93", "#c49276"]), copper_ore: ore(["#e07b39", "#b8622a"]),
  gold_ore: ore(["#fcee4b", "#e0c22e"]), redstone_ore: ore(["#ff1f1f", "#aa0000"]), lapis_ore: ore(["#2546bd", "#1a3290"]),
  emerald_ore: ore(["#17dd62", "#0c9e43"]), diamond_ore: ore(["#4aedd9", "#2bb5a4"]), amethyst: grid(() => pick(["#8e5fd6", "#a77bea", "#7a4cc2", "#b28df0"])),
});
for (const [k, v] of Object.entries(blocks)) writeFileSync(`public/tex/${k}.svg`, svg(v));
console.log(Object.keys(blocks).length, "textures");
