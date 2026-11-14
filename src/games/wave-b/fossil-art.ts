// Inline SVG card faces for Fossil Memory (stand-ins for Dopps Class's dopp_faces.js). viewBox 0 0 100 100.
const BONE = "#e9dcc2", DARK = "#5a4632", MID = "#8a6a4a";

const svg = (body: string) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">${body}</svg>`;

function spiral() { const p: string[] = []; for (let t = 0; t <= Math.PI * 7; t += 0.2) { const r = 2 + t * 1.6; p.push(`${(50 + Math.cos(t) * r).toFixed(1)},${(52 + Math.sin(t) * r).toFixed(1)}`); } return p.join(" "); }

function ribs(n: number, f: (i: number) => string) { let s = ""; for (let i = 0; i < n; i++) s += f(i); return s; }

export const FOSSILS: { name: string; fact: string; art: string }[] = [
  {
    name: "Trilobite",
    fact: "Trilobites were sea animals with three-lobed bodies that lived for nearly 300 million years.",
    art: svg(`<ellipse cx="50" cy="54" rx="26" ry="36" fill="${MID}" stroke="${DARK}" stroke-width="3"/>
      <path d="M24 34 Q50 4 76 34 Q50 26 24 34Z" fill="#a07e58" stroke="${DARK}" stroke-width="3"/>
      <rect x="42" y="30" width="16" height="56" rx="8" fill="#a07e58" stroke="${DARK}" stroke-width="2"/>
      ${ribs(7, (i) => `<path d="M26 ${40 + i * 7} Q50 ${46 + i * 7} 74 ${40 + i * 7}" fill="none" stroke="${DARK}" stroke-width="2"/>`)}
      <circle cx="40" cy="24" r="3" fill="${DARK}"/><circle cx="60" cy="24" r="3" fill="${DARK}"/>`),
  },
  {
    name: "Ammonite",
    fact: "Ammonites were coiled-shell relatives of squid. They died out with the dinosaurs 66 million years ago.",
    art: svg(`<circle cx="50" cy="52" r="38" fill="#c9a26a" stroke="${DARK}" stroke-width="3"/>
      <polyline points="${spiral()}" fill="none" stroke="${DARK}" stroke-width="3" stroke-linecap="round"/>
      ${ribs(14, (i) => { const a = (i / 14) * Math.PI * 2; return `<line x1="${50 + Math.cos(a) * 26}" y1="${52 + Math.sin(a) * 26}" x2="${50 + Math.cos(a) * 36}" y2="${52 + Math.sin(a) * 36}" stroke="${MID}" stroke-width="2"/>`; })}`),
  },
  {
    name: "Shark Tooth",
    fact: "Sharks shed thousands of teeth in a lifetime, so shark teeth are some of the most common fossils.",
    art: svg(`<path d="M18 74 L50 10 L82 74 Q66 66 50 74 Q34 66 18 74Z" fill="#4a4a52" stroke="#222" stroke-width="3" stroke-linejoin="round"/>
      <path d="M22 70 l6 -4 l-2 -6 l6 -2 l-1 -7" fill="none" stroke="#888" stroke-width="2"/>
      <path d="M78 70 l-6 -4 l2 -6 l-6 -2 l1 -7" fill="none" stroke="#888" stroke-width="2"/>
      <path d="M24 74 Q50 92 76 74 Q66 70 50 76 Q34 70 24 74Z" fill="#8a6a4a" stroke="#222" stroke-width="3"/>
      <path d="M44 22 L36 58" stroke="#9aa" stroke-width="3" stroke-linecap="round" opacity=".6"/>`),
  },
  {
    name: "Fern",
    fact: "Fossil ferns are often found in coal. Coal formed from swamp plants buried about 300 million years ago.",
    art: svg(`<rect x="8" y="8" width="84" height="84" rx="12" fill="#6b6460"/>
      <path d="M30 88 Q50 50 70 12" fill="none" stroke="#2a2420" stroke-width="3"/>
      ${ribs(9, (i) => { const t = 0.12 + i * 0.09, x = 30 + 40 * t, y = 88 - 76 * t, l = 16 - i; return `<path d="M${x} ${y} q${-l} ${-2} ${-l - 4} ${-10}" fill="none" stroke="#2a2420" stroke-width="3" stroke-linecap="round"/><path d="M${x} ${y} q${l} ${4} ${l + 6} ${-2}" fill="none" stroke="#2a2420" stroke-width="3" stroke-linecap="round"/>`; })}`),
  },
  {
    name: "T. rex Tooth",
    fact: "A T. rex tooth could be over 30 cm long with the root. Its teeth were serrated like steak knives.",
    art: svg(`<path d="M34 90 Q30 50 44 26 Q52 12 62 8 Q58 30 66 60 Q70 80 66 90Z" fill="#d9c49a" stroke="${DARK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M34 90 L66 90 L64 76 Q50 72 36 76Z" fill="${MID}" stroke="${DARK}" stroke-width="3"/>
      <path d="M44 30 Q40 50 42 70" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/>`),
  },
  {
    name: "Crinoid",
    fact: "Crinoids, or sea lilies, are animals related to starfish. Their stem pieces look like tiny stacked coins.",
    art: svg(`${ribs(9, (i) => `<rect x="44" y="${50 + i * 5}" width="12" height="4" rx="2" fill="${MID}" stroke="${DARK}" stroke-width="1.5"/>`)}
      <path d="M38 50 Q50 58 62 50 L60 40 Q50 44 40 40Z" fill="#a07e58" stroke="${DARK}" stroke-width="2.5"/>
      ${ribs(5, (i) => { const x = 36 + i * 7; return `<path d="M${x + 4} 42 Q${x - 10 + i * 5} 20 ${x - 6 + i * 6} 8" fill="none" stroke="${DARK}" stroke-width="3.5" stroke-linecap="round"/>`; })}`),
  },
  {
    name: "Brachiopod",
    fact: "Brachiopods look like clams but are a different animal group. They are common fossils in Idaho limestone.",
    art: svg(`<path d="M50 88 Q12 70 14 40 Q20 14 50 12 Q80 14 86 40 Q88 70 50 88Z" fill="#c4a27a" stroke="${DARK}" stroke-width="3"/>
      ${ribs(9, (i) => { const a = Math.PI * (0.15 + i * 0.0875); return `<line x1="50" y1="84" x2="${50 - Math.cos(a) * 40}" y2="${84 - Math.sin(a) * 70}" stroke="${DARK}" stroke-width="2" opacity=".7"/>`; })}
      <path d="M40 86 Q50 96 60 86" fill="#a07e58" stroke="${DARK}" stroke-width="3"/>`),
  },
  {
    name: "Fossil Fish",
    fact: "Fossil fish from Wyoming's Green River lake beds are 50 million years old and preserved bone by bone.",
    art: svg(`<rect x="6" y="18" width="88" height="64" rx="10" fill="#d8c8a8"/>
      <path d="M16 50 Q40 26 70 44 L88 32 L84 50 L88 68 L70 56 Q40 74 16 50Z" fill="none" stroke="${DARK}" stroke-width="3" stroke-linejoin="round"/>
      <line x1="20" y1="50" x2="74" y2="50" stroke="${DARK}" stroke-width="3"/>
      ${ribs(8, (i) => `<line x1="${30 + i * 5}" y1="${40 + (i % 2)}" x2="${32 + i * 5}" y2="${60 - (i % 2)}" stroke="${DARK}" stroke-width="2"/>`)}
      <circle cx="24" cy="46" r="3" fill="${DARK}"/>`),
  },
  {
    name: "Dino Footprint",
    fact: "Footprints are trace fossils. They show how an animal moved, not what its body looked like.",
    art: svg(`<rect x="6" y="6" width="88" height="88" rx="12" fill="#c98a52"/>
      <path d="M50 86 Q34 84 36 66 L22 30 Q20 22 28 24 L44 56 L46 18 Q50 10 54 18 L56 56 L72 24 Q80 22 78 30 L64 66 Q66 84 50 86Z" fill="#7a4a26" stroke="#4a2a12" stroke-width="2.5" stroke-linejoin="round"/>`),
  },
  {
    name: "Amber",
    fact: "Amber is fossilized tree resin. It can trap insects and keep them for tens of millions of years.",
    art: svg(`<path d="M30 14 Q60 4 80 26 Q94 52 78 78 Q56 96 30 84 Q8 70 12 44 Q16 22 30 14Z" fill="#f2a12c" stroke="#a85a08" stroke-width="3"/>
      <ellipse cx="34" cy="30" rx="10" ry="5" fill="#fff" opacity=".45" transform="rotate(-30 34 30)"/>
      <ellipse cx="52" cy="54" rx="6" ry="10" fill="#3a2410"/><circle cx="52" cy="42" r="4" fill="#3a2410"/>
      <path d="M46 50 l-10 -6 M46 56 l-10 2 M46 62 l-8 8 M58 50 l10 -6 M58 56 l10 2 M58 62 l8 8" stroke="#3a2410" stroke-width="2"/>
      <ellipse cx="44" cy="48" rx="8" ry="3" fill="#e9f4ff" opacity=".7" transform="rotate(-25 44 48)"/><ellipse cx="60" cy="48" rx="8" ry="3" fill="#e9f4ff" opacity=".7" transform="rotate(25 60 48)"/>`),
  },
  {
    name: "Hagerman Horse",
    fact: "Idaho's state fossil is the Hagerman Horse, a zebra-like horse that lived about 3.5 million years ago.",
    art: svg(`<path d="M20 30 Q30 14 50 16 Q66 18 72 30 L88 70 Q90 82 80 84 Q72 86 68 78 L56 54 Q44 56 34 50 Q18 44 20 30Z" fill="${BONE}" stroke="${DARK}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="44" cy="30" r="6" fill="${DARK}"/>
      <path d="M70 78 l4 -3 l3 4 l4 -3" stroke="${DARK}" stroke-width="2" fill="none"/>
      <path d="M58 50 Q66 58 72 70" stroke="${MID}" stroke-width="2" fill="none"/>`),
  },
  {
    name: "Petrified Wood",
    fact: "Petrified wood forms when minerals like quartz slowly replace a buried log, cell by cell.",
    art: svg(`<circle cx="50" cy="50" r="40" fill="#8a4a2e" stroke="#4a2414" stroke-width="3"/>
      <circle cx="50" cy="50" r="31" fill="#c46a3a"/><circle cx="50" cy="50" r="23" fill="#e8a05a"/>
      <circle cx="50" cy="50" r="15" fill="#d98a8a"/><circle cx="50" cy="50" r="7" fill="#f0d0a0"/>
      <path d="M50 12 L54 40 M86 54 L60 52" stroke="#4a2414" stroke-width="2"/>`),
  },
];

export const fossilByName = (n: string) => FOSSILS.find((f) => f.name === n);
