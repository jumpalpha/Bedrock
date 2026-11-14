// ── wave-twinA ── made-up example home safety maps for the Family Disaster Plan (like Dopps Class's example family maps).
import type { ReactNode } from "react";

const INK = "#1c2419";
const Room = ({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) => (
  <g><rect x={x} y={y} width={w} height={h} fill="#fffdf6" stroke={INK} strokeWidth="2.5" />
    <text x={x + w / 2} y={y + 18} textAnchor="middle" fontSize="13" fontWeight="800" fill="#5c6754">{label}</text></g>
);
/** symbol badge: a short code in a circle or box */
const Sym = ({ x, y, t, c = "#1c2419", bg = "#fff", box }: { x: number; y: number; t: string; c?: string; bg?: string; box?: boolean }) => (
  <g>{box ? <rect x={x - 15} y={y - 10} width="30" height="20" rx="4" fill={bg} stroke={c} strokeWidth="2" /> : <circle cx={x} cy={y} r="11" fill={bg} stroke={c} strokeWidth="2" />}
    <text x={x} y={y + 4.5} textAnchor="middle" fontSize={t.length > 1 ? 10 : 12} fontWeight="900" fill={c}>{t}</text></g>
);
const Arrow = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#059669" strokeWidth="4" markerEnd="url(#exitA)" />
);
const Haz = ({ x, y }: { x: number; y: number }) => (
  <g><path d={`M${x} ${y - 11} L${x + 11} ${y + 8} L${x - 11} ${y + 8} Z`} fill="#fde047" stroke="#b45309" strokeWidth="2" /><text x={x} y={y + 6} textAnchor="middle" fontSize="11" fontWeight="900" fill="#7c2d12">!</text></g>
);
const Safe = ({ x, y }: { x: number; y: number }) => <path d={`M${x} ${y - 10} L${x + 10} ${y + 7} L${x - 10} ${y + 7} Z`} fill="#38bdf8" stroke="#075985" strokeWidth="2" />;
const Star = ({ x, y, n }: { x: number; y: number; n: string }) => (
  <g><text x={x} y={y + 8} textAnchor="middle" fontSize="26" fill="#f59e0b" stroke="#7c2d12" strokeWidth="1">★</text><text x={x + 13} y={y - 4} fontSize="11" fontWeight="900" fill="#7c2d12">{n}</text></g>
);
const Defs = () => (
  <defs><marker id="exitA" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" refX="7" refY="7" orient="auto"><path d="M0 0 L14 7 L0 14 Z" fill="#059669" /></marker></defs>
);
const Note = ({ x, y, children, anchor = "start" }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end" }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize="11.5" fontWeight="700" fill="#5c6754">{children}</text>
);

export function MainMap() {
  return (
    <svg viewBox="0 0 700 400" role="img" aria-label="Example home safety map of a made-up one-story house: two bedrooms, a hall, bathroom, kitchen, living room and garage, with exits, shutoffs, alarms, safe spots, hazards and a meeting place at the mailbox.">
      <Defs />
      <rect width="700" height="400" fill="#fffef6" />
      <rect x="0" y="335" width="700" height="65" fill="#e5e7eb" />
      <text x="350" y="388" textAnchor="middle" fontSize="13" fontWeight="800" fill="#6b7280" letterSpacing=".2em">STREET</text>
      <Room x={40} y={40} w={160} h={115} label="Bedroom 1" />
      <Room x={40} y={155} w={160} h={145} label="Bedroom 2 (ME)" />
      <Room x={200} y={40} w={60} h={260} label="Hall" />
      <Room x={260} y={40} w={100} h={95} label="Bath" />
      <Room x={360} y={40} w={200} h={130} label="Kitchen" />
      <Room x={260} y={135} w={300} h={165} label="Living room" />
      <Room x={560} y={110} w={120} h={190} label="Garage" />
      {/* exits: doors + bedroom windows */}
      <Arrow x1={60} y1={95} x2={18} y2={95} /><Arrow x1={60} y1={240} x2={18} y2={240} />
      <Arrow x1={410} y1={280} x2={410} y2={326} /><Arrow x1={640} y1={280} x2={640} y2={326} />
      <Arrow x1={500} y1={60} x2={500} y2={18} />
      <Note x={4} y={116} anchor="start">window</Note><Note x={4} y={261} anchor="start">window</Note>
      <Note x={420} y={322}>front door</Note><Note x={510} y={24}>back door</Note>
      {/* gear */}
      <Sym x={575} y={95} t="G" c="#a16207" bg="#fef9c3" /><Note x={590} y={90}>gas meter (outside)</Note>
      <Sym x={600} y={140} t="W" c="#1d4ed8" bg="#dbeafe" /><Sym x={640} y={140} t="E" c="#7c3aed" bg="#ede9fe" />
      <Sym x={400} y={70} t="FE" box c="#b91c1c" bg="#fee2e2" />
      <Sym x={120} y={70} t="SA" box /><Sym x={230} y={200} t="SA" box /><Sym x={120} y={185} t="SA" box /><Sym x={230} y={100} t="CO" box />
      <Sym x={310} y={110} t="✚" c="#b91c1c" bg="#fff" />
      <Sym x={450} y={270} t="GB" box c="#065f46" bg="#d1fae5" /><Note x={466} y={292}>go-bag in closet</Note>
      {/* safe spots + hazards */}
      <Safe x={470} y={120} /><Note x={482} y={124}>kitchen table</Note>
      <Safe x={100} y={260} /><Note x={112} y={265}>by inside wall</Note>
      <Haz x={300} y={175} /><Note x={314} y={180}>tall bookcase</Note>
      <Haz x={620} y={240} /><Note x={600} y={262} anchor="middle">water heater</Note>
      <Haz x={80} y={130} /><Note x={94} y={134}>mirror over bed</Note>
      {/* meeting place */}
      <rect x="672" y="318" width="10" height="20" fill="#6b7280" /><rect x="664" y="306" width="26" height="14" rx="4" fill="#9ca3af" stroke={INK} strokeWidth="1.5" />
      <Star x={650} y={366} n="1" /><Note x={556} y={372} anchor="start">mailbox</Note>
    </svg>
  );
}

export function ApartmentMap() {
  return (
    <svg viewBox="0 0 700 300" role="img" aria-label="Example map of a made-up third-floor apartment with two stairwells, no elevators in an emergency, and a meeting place across the parking lot.">
      <Defs />
      <rect width="700" height="300" fill="#fffef6" />
      <rect x="20" y="40" width="660" height="40" fill="#f3f4f6" stroke={INK} strokeWidth="2" />
      <text x="350" y="65" textAnchor="middle" fontSize="13" fontWeight="800" fill="#6b7280">3rd-floor hallway</text>
      <Room x={20} y={80} w={70} h={150} label="Stairs A" /><Room x={610} y={80} w={70} h={150} label="Stairs B" />
      <Room x={300} y={80} w={80} h={70} label="Elevator" />
      <line x1="305" y1="150" x2="375" y2="85" stroke="#b91c1c" strokeWidth="4" /><line x1="305" y1="85" x2="375" y2="150" stroke="#b91c1c" strokeWidth="4" />
      <Room x={120} y={80} w={170} h={150} label="Our apartment" />
      <Room x={390} y={80} w={210} h={150} label="Neighbors" />
      <Arrow x1={140} y1={70} x2={80} y2={70} /><Arrow x1={270} y1={70} x2={600} y2={70} />
      <Sym x={160} y={130} t="GB" box c="#065f46" bg="#d1fae5" /><Sym x={220} y={130} t="FE" box c="#b91c1c" bg="#fee2e2" /><Sym x={260} y={190} t="SA" box />
      <Safe x={170} y={190} /><Note x={182} y={195}>under table</Note>
      <Sym x={45} y={258} t="W" c="#1d4ed8" bg="#dbeafe" /><Note x={60} y={262}>shutoffs: ask the building manager</Note>
      <Star x={600} y={262} n="1" /><Note x={590} y={266} anchor="end">across the parking lot, by the big tree</Note>
      <Note x={340} y={172} anchor="middle">no elevators in an emergency</Note>
    </svg>
  );
}

export function RanchMap() {
  return (
    <svg viewBox="0 0 700 300" role="img" aria-label="Example map of a made-up foothills ranch in wildfire country: two driveways out, a well pump, a propane tank shutoff, an animal trailer and two meeting places.">
      <Defs />
      <rect width="700" height="300" fill="#f7f3df" />
      <path d="M0 40 Q120 10 240 40 T480 30 T700 40 L700 0 L0 0 Z" fill="#a3b18a" />
      <text x="350" y="22" textAnchor="middle" fontSize="12" fontWeight="800" fill="#3f4d2c">dry grass and brush hills (wildfire risk)</text>
      <Room x={260} y={90} w={190} h={110} label="House" />
      <Room x={500} y={110} w={120} h={90} label="Barn" />
      <path d="M355 200 L355 280 M80 280 L620 280" stroke="#9ca3af" strokeWidth="14" fill="none" />
      <path d="M260 150 L120 150 L80 280" stroke="#9ca3af" strokeWidth="10" fill="none" />
      <Note x={360} y={250}>driveway 1</Note><Note x={92} y={210}>driveway 2</Note>
      <Arrow x1={300} y1={210} x2={300} y2={262} />
      <Sym x={235} y={110} t="P" c="#a16207" bg="#fef9c3" /><Note x={180} y={90}>propane tank valve</Note>
      <Sym x={470} y={225} t="W" c="#1d4ed8" bg="#dbeafe" /><Note x={486} y={230}>well pump switch</Note>
      <Sym x={560} y={225} t="GB" box c="#065f46" bg="#d1fae5" /><Note x={584} y={250}>animal trailer + feed</Note>
      <Sym x={300} y={130} t="SA" box /><Sym x={400} y={130} t="FE" box c="#b91c1c" bg="#fee2e2" />
      <Haz x={180} y={60} /><Note x={194} y={64}>brush close to the road</Note>
      <Star x={640} y={290} n="1" /><Note x={630} y={272} anchor="end">front gate</Note>
      <Star x={40} y={260} n="2" /><Note x={30} y={238}>church in town</Note>
    </svg>
  );
}
