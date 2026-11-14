"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Coins, Gamepad2, Trophy } from "lucide-react";

// ── wave-twinB ── The Idaho Trail: twin of the Dopps Class Wellness Trail (src/games/wellness-trail.tsx + classic trail.html).
// Same engine, rules and numbers (1,200 miles, 200 a day, pace, rations, supplies, events, river crossings, forts with
// Realm Trials, foraging, partner wagons, rigs and score). New content: a trek across Idaho's geology (idaho-trail-data.ts).
// Logged in: the journey, the 200-mile daily limit and finishes are kept by the database (b_trail_*, migration 008) and
// finishes post to the trail leaderboard. Not logged in: everything saves on this device (bedrock_trail_* keys).
import glossary from "@/data/content/glossary.json";
import { useStudent } from "@/lib/db";
import { notInstalled, trailBoard, trailLoad, trailSave, trailStart, twinReady, type TrailBoard } from "@/lib/twinB";
import * as TD from "./idaho-trail-data";
import type { Fx, Realm, Landmark, Ev, Luck, Rig, Pace, Ration } from "./idaho-trail-data";

type Why = { sick?: string; hurt?: string };
type Vocab = Record<string, { title: string; terms: [string, string][] }>;
type Data = {
  TOTAL: number; CAP: number; REALMS: Realm[]; LMS: Landmark[]; PACE: Record<string, Pace>; RAT: Record<string, Ration>;
  PRICES: Record<string, [number, number, string]>; BOTS: string[]; COMP: string[]; EVENTS: Ev[]; LUCK: Luck[]; RIGS: Rig[]; VOCAB: Vocab;
};
// Realm Trial words come from the public glossary (never the graded question bank).
function vocab(): Vocab {
  const v: Vocab = {};
  (glossary as { term: string; definition: string; chapter: number }[]).forEach((g) => {
    if (!g.definition || g.definition.length > 220) return;
    const k = String(g.chapter);
    (v[k] = v[k] || { title: "Chapter " + k, terms: [] }).terms.push([g.term, g.definition]);
  });
  return v;
}
type Net = { on: boolean; runId: string | null; left: number; finished: number; best: number; run: State | null };

// ---------- state ----------
type Res = { food: number; water: number; meds: number; parts: number; coins: number };
type Tri = { body: number; mind: number; social: number };
type Trav = { n: string; hp: number; st: "ok" | "sick" | "hurt" | "out"; cond: string };
type Bot = { n: string; hp: number; food: number; sick: boolean; out: boolean; askedDay?: number };
type State = {
  v: number; day: number; miles: number; pace: string; rations: string; res: Res; tri: Tri; party: Trav[]; bots: Bot[];
  right: number; asked: number; seen: string[]; log: string[]; trials: Record<string, { c: number; n: number }>; lmDone: number[];
  forageDay: number; helped: number; done: boolean; over: boolean; warnFood?: number; warnWater?: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]): T => a[rnd(a.length)];
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};
const denverDay = () => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); } };
// Emoji newer than Windows 10's font show as empty boxes there; swap them for older lookalikes.
const EMOJI_FIX: Record<string, string> = { "🪨": "🏔️", "🦬": "🐃", "🫐": "🍇", "🪦": "🚑", "🛞": "↩️", "🪣": "💦" };
const fixE = (s: string) => s.replace(/🪨|🦬|🫐|🪦|🛞|🪣/gu, (m) => EMOJI_FIX[m] || m);

// ---------- rig & scene SVG (ported verbatim from the original) ----------
const INK = "#1A1030";
function animalSVG(t: number) {
  const st = 'stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"';
  if (t === 0) return '<ellipse cx="14" cy="14" rx="15" ry="10" fill="#7a4e2a" ' + st + '/><circle cx="30" cy="9" r="6" fill="#7a4e2a" ' + st + '/><path d="M27 3 l-3 -4 M33 3 l3 -4" stroke="#f4ecd8" stroke-width="2.5"/><path d="M4 22 v8 M12 23 v8 M20 23 v8 M26 22 v8" stroke="' + INK + '" stroke-width="3"/>';
  if (t === 1) return '<path d="M3 12 q-7 5 -4 13" stroke="#3b2412" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M6 19 v12 M12 20 v11 M24 20 v11 M30 19 v12" stroke="' + INK + '" stroke-width="3"/>' +
    '<ellipse cx="18" cy="14" rx="15" ry="8" fill="#a8693a" ' + st + '/><path d="M27 12 L33 -3 L41 -1 L34 15Z" fill="#a8693a" ' + st + '/><ellipse cx="41" cy="1" rx="7" ry="4.5" fill="#a8693a" ' + st + ' transform="rotate(25 41 1)"/>' +
    '<path d="M31 1 L33 -6 L35 -1 L36 -7 L37 0" fill="#3b2412" stroke="#3b2412" stroke-width="2"/><circle cx="40" cy="-1" r="1.3" fill="' + INK + '"/>';
  if (t === 2) return '<path d="M7 21 v10 M15 22 v9 M26 22 v9 M33 21 v10" stroke="' + INK + '" stroke-width="4"/><path d="M1 22 Q-1 6 13 4 Q23 -3 31 7 Q39 9 39 19 Q30 26 1 22Z" fill="#5a3a20" ' + st + '/>' +
    '<path d="M6 8 q8 -8 20 -4" stroke="#3a2414" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="37" cy="16" r="7.5" fill="#3a2414" ' + st + '/><path d="M33 9 q-3 -5 1 -7 M41 10 q4 -4 0 -7" stroke="#f4ecd8" stroke-width="2.5" fill="none"/><path d="M33 22 q3 6 7 0" fill="#2a180c"/><circle cx="39" cy="14" r="1.3" fill="#f4ecd8"/>';
  if (t === 3) return '<path d="M2 15 L-9 21 L3 21Z" fill="#3fae7a" ' + st + '/><path d="M6 23 v9 M13 24 v8 M22 24 v8 M28 23 v9" stroke="' + INK + '" stroke-width="4.5"/><ellipse cx="16" cy="16" rx="16" ry="10" fill="#3fae7a" ' + st + '/>' +
    '<circle cx="10" cy="12" r="2" fill="#2f8f63"/><circle cx="18" cy="9" r="2.4" fill="#2f8f63"/><circle cx="22" cy="17" r="1.8" fill="#2f8f63"/>' +
    '<circle cx="32" cy="8" r="10" fill="#f0a35a" ' + st + '/><ellipse cx="38" cy="14" rx="8" ry="6.5" fill="#3fae7a" ' + st + '/>' +
    '<path d="M37 8 l5 -10 l1 9Z M42 10 l9 -6 l-6 8Z M45 15 l7 -2 l-6 4Z" fill="#f4ecd8" stroke="' + INK + '" stroke-width="2"/><circle cx="40" cy="12" r="1.4" fill="' + INK + '"/>';
  const crown = t >= 5 ? '<path d="M33 -12 l1 -7 l3 4 l3 -6 l3 6 l3 -4 l1 7Z" fill="#FFD700" stroke="' + INK + '" stroke-width="1.8"/>' : "";
  return '<path d="M3 15 Q-9 22 -8 10 l-4 -1 l5 -3" stroke="#b8322a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M7 21 v10 M14 22 v9 M22 22 v9 M28 21 v10" stroke="' + INK + '" stroke-width="3.5"/>' +
    '<ellipse cx="16" cy="15" rx="14" ry="8" fill="#d94a3a" ' + st + '/><path d="M10 10 L15 -14 L21 2 L28 -9 L27 11Z" fill="#ffb347" ' + st + '/>' +
    '<path d="M26 12 Q33 3 35 -3" stroke="' + INK + '" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M26 12 Q33 3 35 -3" stroke="#d94a3a" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="39" cy="-5" rx="8" ry="5.5" fill="#d94a3a" ' + st + '/><path d="M38 -10 l2 -6 l2 5" fill="#f4ecd8" stroke="' + INK + '" stroke-width="1.8"/><circle cx="41" cy="-6" r="1.4" fill="' + INK + '"/>' +
    '<path d="M47 -5 l8 -3 l-3 3 l5 2 l-6 1Z" fill="#ffd23f" class="wt-twinkle"/>' + crown;
}
function wagonSVG(t: number, gid: string) {
  const W = [["#f4ecd8", "#8a5a2b", "#5a3a1a"], ["#f4ecd8", "#cd7f32", "#8a5a2b"], ["#eef2f7", "#c0c7d0", "#6f7a88"], ["#fff1b8", "#ffc928", "#a87b06"], ["url(#" + gid + ")", "#7fe3ff", "#3f8fb5"], ["url(#" + gid + ")", "#7fe3ff", "#3f8fb5"]][t];
  const sparkle = t >= 3 ? '<g class="wt-twinkle" fill="' + (t >= 4 ? "#fff" : "#fff6b0") + '"><path d="M2 2 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2Z"/><path d="M70 -4 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5Z"/></g>' : "";
  const stripe = t >= 1 && t <= 3 ? '<rect x="4" y="33" width="72" height="3" fill="' + (t === 3 ? "#fff3b0" : "rgba(255,255,255,.55)") + '"/>' : "";
  return '<path d="M8 30 Q8 2 40 2 Q72 2 72 30Z" fill="' + W[0] + '" stroke="' + INK + '" stroke-width="3"/>' +
    '<path d="M22 30 Q22 8 40 8 M58 30 Q58 8 40 8" fill="none" stroke="' + (t >= 4 ? "rgba(255,255,255,.7)" : "#d8ccb0") + '" stroke-width="2"/>' +
    '<rect x="4" y="28" width="72" height="14" rx="3" fill="' + W[1] + '" stroke="' + INK + '" stroke-width="3"/>' + stripe +
    '<g class="wt-wheel"><circle cx="18" cy="44" r="9" fill="' + W[2] + '" stroke="' + INK + '" stroke-width="3"/><path d="M18 35 V53 M9 44 H27" stroke="#f4ecd8" stroke-width="2"/></g>' +
    '<g class="wt-wheel"><circle cx="62" cy="44" r="9" fill="' + W[2] + '" stroke="' + INK + '" stroke-width="3"/><path d="M62 35 V53 M53 44 H71" stroke="#f4ecd8" stroke-width="2"/></g>' +
    '<path d="M76 34 L96 34" stroke="' + INK + '" stroke-width="3"/>' + sparkle;
}
let RBN = 0;
const RB_DEF = (id: string) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb3c7"/><stop offset=".33" stop-color="#fff3a6"/><stop offset=".66" stop-color="#a6f0ff"/><stop offset="1" stop-color="#d4b3ff"/></linearGradient>';
function rigSVG(t: number) {
  const id = "wtrb" + ++RBN;
  return '<svg viewBox="-14 -26 168 86" style="display:block;width:100%;height:auto"><defs>' + RB_DEF(id) + "</defs>" + wagonSVG(t, id) + '<g transform="translate(96 22)">' + animalSVG(t) + "</g></svg>";
}
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ---------- modal building blocks ----------
const GOLD_BTN = "mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-4 py-3 font-bold text-[#10140e] shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)] transition hover:-translate-y-0.5 disabled:opacity-50";
const GHOST_BTN = "glass flex items-center justify-center gap-2 rounded-2xl px-3 py-3 font-bold text-fg transition enabled:hover:border-gold/40 enabled:hover:bg-gold/10 disabled:opacity-40";
const Chip = ({ children }: { children: ReactNode }) => <span className="mb-2 inline-block rounded-lg bg-gold/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gold">{children}</span>;
const H = ({ children }: { children: ReactNode }) => <h2 className="font-display text-2xl font-extrabold leading-tight text-fg">{children}</h2>;
const Txt = ({ children }: { children: ReactNode }) => <p className="mb-3 mt-2 leading-relaxed text-fg/85">{children}</p>;
function ChoiceBtn({ children, onClick, disabled, tone }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: "dim" | "good" | "bad" }) {
  const t = tone === "good" ? "border-emerald bg-emerald/15" : tone === "bad" ? "border-crimson bg-crimson/15" : tone === "dim" ? "border-line bg-fg/[0.03] opacity-40" : "border-line bg-fg/[0.04]";
  return <button disabled={disabled} onClick={onClick} className={`mt-2 block w-full rounded-2xl border px-4 py-3 text-left font-semibold leading-snug text-fg transition enabled:hover:border-gold/50 enabled:hover:bg-gold/10 disabled:cursor-default ${t}`}>{children}</button>;
}
const Fb = ({ good, children }: { good: boolean; children: ReactNode }) => <div className={`mt-3 animate-rise rounded-2xl border p-4 text-[15px] leading-relaxed ${good ? "border-emerald/40 bg-emerald/10" : "border-crimson/40 bg-crimson/10"}`}>{children}</div>;
const FxLine = ({ fx }: { fx: string[] }) => (fx.length ? <div className="mt-1.5 text-sm font-bold text-gold">{fx.join(" · ")}</div> : null);
const GoldBtn = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => <button onClick={onClick} className={GOLD_BTN}>{children}</button>;

// Idaho trail food (emoji, so no art files are needed): huckleberries (the state fruit), apples, potatoes, pine nuts, trout, cherries
const GOOD_FOOD = ["🫐", "🍎", "🥔", "🌰", "🐟", "🍒"];
type Tile = { v: string; ttl: number; fx: "" | "got" | "bad" };
const fillTiles = (tiles: Tile[]) => tiles.map((x) => {
  if (!x.v && Math.random() < 0.35) return { v: Math.random() < 0.22 ? "mushroom" : pick(GOOD_FOOD), fx: "" as const, ttl: 3 + rnd(4) };
  if (x.v && x.ttl - 1 <= 0) return { ...x, v: "", ttl: 0 };
  return x.v ? { ...x, ttl: x.ttl - 1 } : x;
});
function Forage({ onEnd, after }: { onEnd: (got: number, oops: number) => void; after?: ReactNode }) {
  const [tiles, setTiles] = useState<Tile[]>(() => fillTiles(Array.from({ length: 16 }, () => ({ v: "", ttl: 0, fx: "" as const }))));
  const [time, setTime] = useState(12);
  const [gotShown, setGotShown] = useState(0);
  const t = useRef(12), got = useRef(0), oops = useRef(0), live = useRef(true), cb = useRef(onEnd);
  useEffect(() => { cb.current = onEnd; }, [onEnd]);
  useEffect(() => {
    const iv = setInterval(() => {
      if (!live.current) return;
      t.current -= 0.25;
      setTime(t.current);
      if (Math.round(t.current * 4) % 3 === 0) setTiles(fillTiles);
      if (t.current <= 0) { clearInterval(iv); live.current = false; cb.current(got.current, oops.current); }
    }, 250);
    return () => clearInterval(iv);
  }, []);
  const tap = (i: number) => {
    const x = tiles[i];
    if (!live.current || !x.v) return;
    const fx = x.v === "mushroom" ? "bad" : "got";
    if (fx === "bad") oops.current++; else { got.current += 2; setGotShown(got.current); }
    setTiles((ts) => ts.map((y, k) => (k === i ? { ...y, v: "", fx } : y)));
    setTimeout(() => setTiles((ts) => ts.map((y, k) => (k === i && !y.v ? { ...y, fx: "" } : y))), 180);
  };
  return (
    <>
      <Chip>🫐 Foraging · Ch 26</Chip>
      <H>Gather trail food!</H>
      <p className="mt-2 text-sm text-muted">Tap huckleberries (Idaho&apos;s state fruit), apples, potatoes, pine nuts and fresh trout. <b className="text-fg">Skip the wild mushrooms 🍄</b>: some deadly ones look just like safe ones.</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-fg/10"><i className="block h-full bg-gradient-to-r from-gold to-amber transition-[width] duration-100 ease-linear" style={{ width: `${(Math.max(0, time) / 12) * 100}%` }} /></div>
      <div className="my-3 grid grid-cols-4 gap-2">
        {tiles.map((x, i) => (
          <button key={i} onPointerDown={() => tap(i)} className={`grid aspect-square touch-manipulation select-none place-items-center rounded-2xl border-2 text-4xl transition active:scale-95 ${x.fx === "got" ? "border-emerald/60 bg-emerald/30" : x.fx === "bad" ? "border-crimson/60 bg-crimson/35" : "border-[#7fb069]/40 bg-[#7fb069]/15"}`}>
            {x.v === "mushroom" ? "🍄" : x.v ? <span className="pointer-events-none drop-shadow">{fixE(x.v)}</span> : null}
          </button>
        ))}
      </div>
      <p className="text-gradient text-center font-display text-3xl font-extrabold">{gotShown} lb</p>
      {after}
    </>
  );
}

function Shop({ name, D, res, onBuy }: { name: string; D: Data; res: Res; onBuy: (cart: Record<string, number>) => void }) {
  const [cart, setCart] = useState<Record<string, number>>({ food: 0, water: 0, meds: 0, parts: 0 });
  const cost = Object.keys(cart).reduce((s, k) => s + cart[k] * D.PRICES[k][1], 0);
  return (
    <>
      <Chip>🏪 Trading post · {name}</Chip>
      <H>Stock up</H>
      <p className="mt-1 text-sm text-muted">You have <b className="text-gold">{res.coins}</b> coins. Cart: <b className="text-fg">{cost}</b> coins.</p>
      <div className="mt-3 space-y-2">
        {Object.keys(cart).map((k) => {
          const [q, p, n] = D.PRICES[k];
          const btn = "grid size-9 place-items-center rounded-xl border border-line bg-fg/[0.06] text-lg font-bold text-fg transition enabled:hover:border-gold/50 disabled:opacity-30";
          return (
            <div key={k} className="flex items-center gap-2 rounded-2xl border border-line bg-fg/[0.03] px-3 py-2">
              <div className="min-w-0 flex-1"><b className="text-fg">{q} {n}</b><div className="text-xs text-muted">{p} coins · you have {res[k as keyof Res]}</div></div>
              <button className={btn} disabled={!cart[k]} onClick={() => cart[k] && setCart({ ...cart, [k]: cart[k] - 1 })}>−</button>
              <div className="w-7 text-center font-bold">{cart[k]}</div>
              <button className={btn} disabled={cost + p > res.coins} onClick={() => cost + p <= res.coins && setCart({ ...cart, [k]: cart[k] + 1 })}>+</button>
            </div>
          );
        })}
      </div>
      <button onClick={() => onBuy(cart)} className={GOLD_BTN}>{cost ? `Buy for ${cost} coins` : "Leave the trading post"}</button>
    </>
  );
}

// ---------- the game engine (same logic as the original's LOCAL mode) ----------
type UI = { show: (n: ReactNode, more?: boolean) => void; close: () => void; wait: () => Promise<string>; choose: (v: string) => void; toast: (t: string) => void; err: (t: string) => void; update: () => void; animate: () => void };

function makeEngine(D: Data, ui: UI, net: Net) {
  const { TOTAL, CAP, LMS, PACE, RAT } = D;
  let S!: State;
  const E = { has: false, busy: false, info: { finished: 0, best: 0 } };
  const C = ui.choose;

  const localDaily = (): { day: string; miles: number } => {
    let d: { day?: string; miles?: number } = {};
    try { d = JSON.parse(store.get("bedrock_trail_daily") || "{}"); } catch {}
    if (d.day !== denverDay()) d = { day: denverDay(), miles: 0 };
    return d as { day: string; miles: number };
  };
  const localLeft = () => (net.on ? net.left : CAP - localDaily().miles);
  const myFinishes = () => (net.on ? net.finished : +(store.get("bedrock_trail_finishes") || 0) || 0);
  // cloud saves run one after another, so the server always sees miles in order
  let chain: Promise<unknown> = Promise.resolve();
  const cloud = <T,>(fn: () => Promise<T>) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
  const cloudErr = (e: unknown) => ui.err("Couldn't save to the class database: " + ((e as Error).message || e) + ". Your journey is still saved on this device.");
  const rigOf = (n: number) => D.RIGS[Math.min(Math.max(n || 0, 0), D.RIGS.length - 1)];

  function newState(names: string[], nBots: number): State {
    const party: Trav[] = [{ n: "You", hp: 100, st: "ok", cond: "" }, ...names.map((n) => ({ n, hp: 100, st: "ok" as const, cond: "" }))];
    const pool = D.BOTS.slice().sort(() => Math.random() - 0.5);
    return {
      v: 1, day: 1, miles: 0, pace: "steady", rations: "balanced",
      res: { food: 300, water: 14, meds: 2, parts: 1, coins: 60 },
      tri: { body: 80, mind: 80, social: 75 },
      party, bots: pool.slice(0, nBots).map((n) => ({ n, hp: 100, food: 140, sick: false, out: false })),
      right: 0, asked: 0, seen: [], log: [], trials: {}, lmDone: [0], forageDay: -9, helped: 0, done: false, over: false,
    };
  }
  const alive = () => S.party.filter((p) => p.st !== "out");
  const realmAt = (mi: number) => D.REALMS[Math.min(4, Math.floor(Math.min(mi, TOTAL - 1) / 240))];
  const nextLm = () => LMS.find((l) => l.mi > S.miles) || LMS[LMS.length - 1];
  const log = (t: string) => { S.log.unshift(t); S.log = S.log.slice(0, 40); };

  function score() {
    const a = alive(), hpAvg = a.length ? a.reduce((s, p) => s + p.hp, 0) / a.length : 0;
    const triAvg = (S.tri.body + S.tri.mind + S.tri.social) / 3;
    const trials = Object.values(S.trials).reduce((s, t) => s + t.c, 0);
    const bots = S.bots.filter((b) => !b.out).length;
    let sc = a.length * 300 + hpAvg * 3 + triAvg * 4 + Math.min(S.right * 15, 600) + trials * 10 + bots * 100
      + Math.min(Math.floor(S.res.food / 4) + S.res.coins, 400) + Math.min(S.helped * 20, 200);
    if (!S.done) sc = sc * (S.miles / TOTAL);
    return clamp(Math.round(sc), 0, 5000);
  }
  const save = () => {
    if (!E.has) return;
    store.set("bedrock_trail_local", JSON.stringify(S));
    if (net.on && net.runId && !S.done && !S.over) {
      const id = net.runId, snap = JSON.parse(JSON.stringify(S));
      cloud(() => trailSave(id, snap)).then((r) => { net.left = r.left_today; if (r.clamped && S && S.miles > r.miles) S.miles = r.miles; ui.update(); }).catch(cloudErr);
    }
  };

  function applyFx(fx: Fx = {}, why?: Why) {
    const out: string[] = [];
    (["body", "mind", "social"] as const).forEach((k) => { const v = fx[k]; if (v) { S.tri[k] = clamp(S.tri[k] + v, 0, 100); out.push((v > 0 ? "+" : "") + v + " " + (k === "social" ? "team" : k)); } });
    (["food", "water", "meds", "parts", "coins"] as const).forEach((k) => { const v = fx[k]; if (v) { S.res[k] = Math.max(0, S.res[k] + v); out.push((v > 0 ? "+" : "") + v + " " + (k === "food" ? "lb food" : k)); } });
    if (fx.hp) { const t = pick(alive()); if (t) { t.hp = clamp(t.hp + fx.hp, 0, 100); out.push((fx.hp > 0 ? "+" : "") + fx.hp + " strength for " + t.n); } }
    if (fx.hurt) { const t = pick(alive().filter((p) => p.st === "ok")) || pick(alive()); if (t) { t.st = "hurt"; t.cond = (why && why.hurt) || pick(["a sprained ankle", "a pulled muscle", "a bad fall"]); t.hp = clamp(t.hp - 10, 0, 100); out.push(t.n + " has " + t.cond); } }
    if (fx.sick) { const t = pick(alive().filter((p) => p.st === "ok")) || pick(alive()); if (t) { t.st = "sick"; t.cond = (why && why.sick) || pick(["a bad cold", "a fever", "a stomach bug"]); t.hp = clamp(t.hp - 8, 0, 100); out.push(t.n + " has " + t.cond); } }
    if (fx.heal) { const t = alive().find((p) => p.st !== "ok"); if (t) { out.push(t.n + " is feeling better"); t.st = "ok"; t.cond = ""; t.hp = clamp(t.hp + 10, 0, 100); } }
    if (fx.day) for (let i = 0; i < fx.day; i++) { passDay({}); out.push("lost a day"); }
    return out;
  }
  const CAUSE: Record<string, Why> = {
    "x-water": { sick: "a Giardia infection" }, "r1-ash": { sick: "an ash cough" }, "r3-thin-air": { sick: "altitude sickness" },
    "x-lightning": { hurt: "a lightning-scare fall" }, "r2-aa": { hurt: "a lava-rock cut" }, "r2-heat": { hurt: "burned feet" },
    "r3-quake": { hurt: "a rockfall bruise" }, "r3-epicenter": { hurt: "a twisted ankle" }, "r5-rockfall": { hurt: "a rockfall bruise" }, "r4-flash": { hurt: "a flood-swept fall" },
  };

  function passDay(o: { moved?: boolean; rest?: boolean; fire?: boolean; quiet?: boolean }) {
    S.day++;
    const a = alive(), n = a.length, r = RAT[S.rations], p = PACE[S.pace];
    const need = r.food * n; let ate = true;
    if (S.res.food >= need) S.res.food -= need; else { S.res.food = 0; ate = false; }
    S.tri.body += ate ? r.body : -5; S.tri.mind += ate ? r.mind : -3;
    if (S.res.water >= 1) S.res.water -= 1; else { S.res.water = 0; S.tri.body -= 6; if (!o.quiet) log("🥵 Out of water. Everyone is getting dehydrated."); }
    if (!ate && !o.quiet) log("🍽️ Not enough food. The party is going hungry.");
    if (o.moved) { S.tri.body += p.body; S.tri.mind += p.mind; if (S.pace === "steady" && S.rations === "balanced") S.tri.body += 1; }
    if (o.rest) { S.tri.body += 6; S.tri.mind += 4; }
    if (o.fire) { S.tri.social += 8; S.tri.mind += 3; }
    const partners = S.bots.filter((b) => !b.out).length;
    if (!partners && !o.fire) S.tri.social -= 1;
    if (S.tri.social < 25) S.tri.mind -= 1;
    (["body", "mind", "social"] as const).forEach((k) => (S.tri[k] = clamp(S.tri[k], 0, 100)));
    a.forEach((t) => {
      if (t.st === "sick" || t.st === "hurt") {
        t.hp -= 4;
        if (Math.random() < (o.rest ? 0.35 : 0.12)) { t.st = "ok"; t.cond = ""; log("🙂 " + t.n + " recovered."); }
      } else if (S.tri.body > 60) t.hp += 2;
      if (S.tri.body < 30) t.hp -= 3;
      if (S.tri.mind < 20 && Math.random() < 0.15) t.hp -= 3;
      t.hp = clamp(t.hp, 0, 100);
      if (t.hp <= 0) bench(t, t.cond || (S.res.food === 0 ? "hunger" : S.res.water === 0 ? "thirst" : "exhaustion"));
    });
    S.bots.forEach((b) => {
      if (b.out) return;
      b.food = Math.max(0, b.food - 3);
      if (b.food === 0) b.hp -= 6;
      if (!b.sick && Math.random() < 0.03) { b.sick = true; log("🤒 " + b.n + "'s party came down with a fever."); }
      if (b.sick) { b.hp -= 4; if (Math.random() < 0.12) { b.sick = false; log("🙂 " + b.n + "'s party is feeling better."); } }
      if (b.hp > 0 && b.food > 0 && !b.sick) b.hp = Math.min(100, b.hp + 1);
      if (b.hp <= 0) { b.out = true; log("↩️ " + b.n + "'s wagon had to turn back home."); }
    });
    if (!alive().length) S.over = true;
    const perDay = RAT[S.rations].food * alive().length;
    if (perDay && S.res.food > 0 && S.res.food < perDay * 5 && !((S.warnFood ?? -99) > S.day - 4)) { S.warnFood = S.day; log("⚠️ Food is running low (about " + Math.floor(S.res.food / perDay) + " days left). Forage, or buy food at the next fort."); }
    if (S.res.water > 0 && S.res.water <= 3 && !((S.warnWater ?? -99) > S.day - 3)) { S.warnWater = S.day; log("⚠️ Only " + S.res.water + " days of water left. Next refill: " + nextWater() + "."); }
  }
  function nextWater() { const w = LMS.find((l) => l.mi > S.miles && /spring|forage|steep|river|fort|finish/.test(l.kind)); return w ? w.name + " (" + (w.mi - S.miles) + " mi)" : "Hells Canyon"; }
  function bench(t: Trav, cause: string) {
    if (t.st === "out") return;
    t.st = "out"; t.hp = 0;
    const msg = (t.n === "You" ? "You have" : t.n + " has") + " been benched" + (cause ? " with " + cause : "") + ".";
    log("🚑 " + msg); ui.toast(msg);
  }

  // ---------- actions ----------
  async function act(kind: "travel" | "rest" | "fire" | "forage") {
    if (E.busy || !E.has || S.done || S.over) return;
    ui.err("");
    if (localLeft() <= 0) { ui.err("Your party has made camp for today. The trail opens again at midnight."); return; }
    E.busy = true; ui.update();
    try {
      if (kind === "travel") await travel();
      else if (kind === "rest") { passDay({ rest: true }); log("⛺ Day " + S.day + ": The party rested and recovered."); }
      else if (kind === "fire") { passDay({ fire: true }); log("🔥 Day " + S.day + ": A long talk around the campfire. Everyone feels closer."); }
      else if (kind === "forage") { await forage(false); passDay({}); }
      await afterDay();
    } catch (e) { ui.err((e as Error).message); }
    E.busy = false; ui.update();
  }
  async function travel() {
    const p = PACE[S.pace], nx = nextLm();
    let gain = Math.min(p.mi, localLeft(), nx.mi - S.miles);
    if (S.tri.body < 25) gain = Math.max(1, Math.round(gain * 0.7));
    S.miles += gain;
    if (net.on) net.left = Math.max(0, net.left - gain);
    else { const d = localDaily(); d.miles += gain; store.set("bedrock_trail_daily", JSON.stringify(d)); }
    passDay({ moved: true });
    ui.animate();
    log("🐂 Day " + S.day + ": Traveled " + gain + " miles." + (S.tri.body < 25 ? " (The party is too worn down to go fast.)" : ""));
    if (S.over) return;
    if (S.miles >= nx.mi && S.lmDone.indexOf(nx.mi) < 0) { await landmark(nx); return; }
    const roll = Math.random();
    const needy = S.bots.find((b) => !b.out && (b.food < 25 || b.sick) && !((b.askedDay ?? -99) > S.day - 6));
    if (needy && roll < 0.5) { await botEvent(needy); return; }
    if (roll < 0.36) await quizEvent();
    else if (roll < 0.5) luckEvent();
  }
  async function afterDay() {
    if (!E.has) return;
    if (S.over && !S.done) { save(); await overScreen(); return; }
    save();
  }

  // ---------- events ----------
  async function quizEvent() {
    const realm = realmAt(S.miles).n;
    let pool = D.EVENTS.filter((e) => e.realm === realm && S.seen.indexOf(e.id) < 0);
    const extra = D.EVENTS.filter((e) => e.realm === 0 && S.seen.indexOf(e.id) < 0);
    if (extra.length && (Math.random() < 0.15 || !pool.length)) pool = extra;
    if (!pool.length) pool = D.EVENTS.filter((e) => e.realm === realm || e.realm === 0);
    const ev = pick(pool);
    S.seen.push(ev.id); S.seen = S.seen.slice(-60);
    const order = ev.choices.map((_, i) => i).sort(() => Math.random() - 0.5);
    const view = (picked: number | null, out?: ReactNode) => (
      <>
        <Chip>📖 Chapter {ev.ch}</Chip><H>{ev.title}</H><Txt>{ev.text}</Txt>
        {order.map((i) => <ChoiceBtn key={i} disabled={picked !== null} tone={picked !== null && picked !== i ? "dim" : undefined} onClick={() => C("c" + i)}>{ev.choices[i][0]}</ChoiceBtn>)}
        {out}
      </>
    );
    ui.show(view(null));
    const i = +(await ui.wait()).slice(1);
    const [, good, fx, fb] = ev.choices[i];
    S.asked++;
    const res = applyFx(Object.assign({}, fx, good ? { coins: (fx.coins || 0) + 5 } : {}), CAUSE[ev.id]);
    if (good) S.right++;
    log((good ? "✅ " : "❌ ") + ev.title + (res.length ? ": " + res.join(", ") : ""));
    ui.show(view(i, <><Fb good={good}><b>{good ? "✅ Good call!" : "❌ Not the best choice."}</b> {fb}<FxLine fx={res} /></Fb><GoldBtn onClick={() => C("ok")}>Continue</GoldBtn></>), true);
    await ui.wait(); ui.close();
  }
  function luckEvent() {
    const l = pick(D.LUCK);
    if (l.parts) {
      if (S.res.parts > 0) { S.res.parts--; log("🔧 A wagon wheel cracked. You used a spare part to fix it."); }
      else { applyFx({ day: 2 }); log("🔧 A wheel cracked and you had no spare part. Repairs took 2 days."); ui.toast("No spare part! Repairs took 2 days."); }
      return;
    }
    applyFx(l.fx);
    log("🎲 " + l.text);
  }
  async function botEvent(b: Bot) {
    b.askedDay = S.day;
    const hungry = b.food < 25;
    const view = (done: boolean, out?: ReactNode) => (
      <>
        <Chip>🤝 Convoy</Chip><H>{b.n}&apos;s wagon needs help</H>
        <Txt>{hungry ? b.n + "'s party is almost out of food. They ask if you can share 20 lb." : b.n + "'s party is sick with a fever. They ask if you can spare a first-aid kit."}</Txt>
        <ChoiceBtn disabled={done} onClick={() => C("y")}>{hungry ? "Share 20 lb of food" : "Give a first-aid kit"}</ChoiceBtn>
        <ChoiceBtn disabled={done} onClick={() => C("n")}>Sorry, we can&apos;t spare it</ChoiceBtn>
        {out}
      </>
    );
    ui.show(view(false));
    const yes = (await ui.wait()) === "y";
    let txt: string;
    if (yes && hungry && S.res.food >= 20) { S.res.food -= 20; b.food += 20; S.tri.social = clamp(S.tri.social + 8, 0, 100); S.helped++; txt = "You shared food. " + b.n + "'s party is grateful, and your convoy feels stronger. (+8 team)"; }
    else if (yes && !hungry && S.res.meds > 0) { S.res.meds--; b.sick = false; b.hp = Math.min(100, b.hp + 15); S.tri.social = clamp(S.tri.social + 8, 0, 100); S.helped++; txt = "You gave a first-aid kit. " + b.n + "'s party is recovering. (+8 team)"; }
    else if (yes) txt = "You wanted to help, but you don't have enough to spare.";
    else { S.tri.social = clamp(S.tri.social - 2, 0, 100); txt = b.n + " understands, but the convoy feels a little less close. (-2 team)"; }
    log("🤝 " + txt);
    ui.show(view(true, <><Fb good={yes}>{txt}</Fb><GoldBtn onClick={() => C("ok")}>Continue</GoldBtn></>), true);
    await ui.wait(); ui.close();
  }

  // ---------- landmarks ----------
  async function landmark(l: Landmark) {
    S.lmDone.push(l.mi);
    const icon = fixE(l.icon);
    log(icon + " Arrived at " + l.name + ".");
    const head = <><Chip>📍 Mile {l.mi}</Chip><H>{icon} {l.name}</H><Txt>{l.text}</Txt></>;
    if (l.kind === "river") return river(l, head);
    if (l.kind === "fort") {
      S.bots.forEach((b) => { if (!b.out) b.food += 80; });
      S.res.water = Math.max(S.res.water, 20); log("💧 Filled your water barrels at the fort's well (20 days).");
      await trial(l.realm || 1, head); await shop(l); return;
    }
    if (l.kind === "finish") { await trial(5, head); await finish(); return; }
    let note = "";
    if (l.kind === "spring" || l.kind === "forage" || l.kind === "steep") { S.res.water = Math.max(S.res.water, 20); note = "You refilled your water barrels (20 days). "; }
    if (l.kind === "sight") { S.tri.mind = clamp(S.tri.mind + 4, 0, 100); note = "The view lifts everyone's spirits (+4 mind). "; }
    if (l.kind === "steep") { if (S.tri.body < 55) { applyFx({ hp: -12 }); note += "The climb was brutal for a tired party. "; } else note += "Your strong party powers up the climb. "; }
    ui.show(
      <>
        {head}
        {note && <Fb good>{note}</Fb>}
        {l.kind === "forage" && <button onClick={() => C("forage")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald px-4 py-3 font-bold text-[#04241a] transition hover:-translate-y-0.5">🍇 Forage the orchard (free!)</button>}
        <GoldBtn onClick={() => C("ok")}>Continue</GoldBtn>
      </>
    );
    const b = await ui.wait();
    if (b === "forage") await forage(true); else ui.close();
  }
  async function river(l: Landmark, head: ReactNode) {
    let d = +(1.5 + Math.random() * 4.5).toFixed(1);
    for (;;) {
      const view = (done: boolean, out?: ReactNode) => (
        <>
          {head}
          <Txt>The river is <b className="text-fg">{d.toFixed(1)} feet deep</b> where the trail crosses.</Txt>
          <ChoiceBtn disabled={done} onClick={() => C("ford")}>🚶 Ford it: walk the wagon across</ChoiceBtn>
          <ChoiceBtn disabled={done} onClick={() => C("float")}>🛶 Seal the wagon and float it across</ChoiceBtn>
          <ChoiceBtn disabled={done || S.res.coins < 15} onClick={() => C("ferry")}>⛴️ Pay the ferry (15 coins)</ChoiceBtn>
          <ChoiceBtn disabled={done} onClick={() => C("wait")}>⏳ Wait a day for the water to drop</ChoiceBtn>
          <p className="mt-3 text-xs text-muted">Safety (Ch 10, 26): moving water is stronger than it looks. Never wade across water deeper than your knees.</p>
          {out}
        </>
      );
      ui.show(view(false));
      const c = await ui.wait();
      let txt = "", good = true;
      if (c === "wait") { passDay({}); d = Math.max(1.2, d - (0.5 + Math.random())); log("⏳ Waited a day at " + l.name + "."); ui.update(); continue; }
      if (c === "ferry") { S.res.coins -= 15; txt = "The ferry carries you safely across."; }
      else if (c === "ford") {
        if (d <= 2.5) txt = "The water was shallow. You crossed safely.";
        else { good = false; const r = applyFx({ food: -25, hurt: 1 }, { hurt: "a slip in the river" }); txt = "Too deep! The current knocked the wagon sideways. " + r.join(", ") + "."; }
      } else {
        if (d < 5 || Math.random() < 0.5) txt = "The sealed wagon floated across. Nice work.";
        else { good = false; const r = applyFx({ food: -15, water: -5 }); txt = "The wagon tipped and you lost supplies. " + r.join(", ") + "."; }
      }
      log("🌊 " + l.name + ": " + txt);
      const water = (w: string | null, out2?: ReactNode) => (
        <>
          <Fb good={good}>{txt}</Fb>
          <Txt><span className="mt-3 block">Fill your water barrels from the river?</span></Txt>
          <ChoiceBtn disabled={!!w} tone={w && w !== "boil" ? "dim" : undefined} onClick={() => C("boil")}>🔥 Yes, boil or filter it first</ChoiceBtn>
          <ChoiceBtn disabled={!!w} tone={w && w !== "raw" ? "dim" : undefined} onClick={() => C("raw")}>💦 Yes, as it is. It looks clean.</ChoiceBtn>
          {out2}
        </>
      );
      ui.show(view(true, water(null)), true);
      const w = await ui.wait();
      S.res.water = Math.max(S.res.water, 20);
      let t2: string;
      if (w === "boil") { S.right++; S.asked++; S.res.coins += 5; t2 = "Smart. Boiling or filtering kills microbes like Giardia that live in rivers downstream of animals (Ch 10, 26). Barrels full. (+5 coins)"; }
      else { S.asked++; if (Math.random() < 0.5) { applyFx({ sick: 1 }, { sick: "a Giardia infection" }); t2 = "Clear water can still carry microbes. Someone came down with a Giardia infection (Ch 10, 26)."; } else t2 = "You got lucky this time. Clear-looking water can still carry germs (Ch 23)."; }
      log("💧 " + t2);
      ui.show(view(true, water(w, <><Fb good={w === "boil"}>{t2}</Fb><GoldBtn onClick={() => C("ok")}>Continue</GoldBtn></>)), true);
      await ui.wait(); ui.close(); return;
    }
  }
  async function trial(realmN: number, head: ReactNode) {
    if (S.trials[realmN]) return;
    const R = D.REALMS[realmN - 1], pool: { c: number; term: string; def: string }[] = [];
    R.chs.forEach((c) => ((D.VOCAB || {})[c] || { terms: [] }).terms.forEach((t) => pool.push({ c, term: t[0], def: t[1] })));
    if (pool.length < 4) { S.trials[realmN] = { c: 0, n: 0 }; return; }
    const qs = pool.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    let right = 0;
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i], opts = [q].concat(pool.filter((p) => p.term !== q.term).sort(() => Math.random() - 0.5).slice(0, 3)).sort(() => Math.random() - 0.5);
      const view = (picked: string | null, out?: ReactNode) => (
        <>
          {i === 0 && head}
          <Chip>⚔️ Realm Trial · {R.name} · {i + 1} of 4</Chip>
          <H>Which term matches?</H>
          <Txt>&ldquo;{q.def}&rdquo;</Txt>
          {opts.map((o, k) => (
            <ChoiceBtn key={k} disabled={picked !== null} tone={picked === null ? undefined : o.term === q.term ? "good" : o.term === picked ? "bad" : "dim"} onClick={() => C("t" + o.term)}>{o.term}</ChoiceBtn>
          ))}
          {out}
        </>
      );
      ui.show(view(null));
      const t = (await ui.wait()).slice(1), ok = t === q.term;
      if (ok) { right++; S.res.coins += 10; }
      ui.show(view(t, <><Fb good={ok}>{ok ? "✅ Correct! +10 coins." : <>❌ The answer is <b>{q.term}</b> (Ch {q.c}).</>}</Fb><GoldBtn onClick={() => C("ok")}>{i < 3 ? "Next" : "Finish trial"}</GoldBtn></>), true);
      await ui.wait();
    }
    S.trials[realmN] = { c: right, n: 4 };
    if (right === 4) S.tri.mind = clamp(S.tri.mind + 5, 0, 100);
    log("⚔️ Realm Trial (" + R.name + "): " + right + " of 4 correct, +" + right * 10 + " coins.");
    ui.close();
  }
  async function shop(l: Landmark) {
    const cart = await new Promise<Record<string, number>>((res) => ui.show(<Shop key={"shop" + S.day + l.mi} name={l.name} D={D} res={S.res} onBuy={res} />));
    const cost = Object.keys(cart).reduce((s, k) => s + cart[k] * D.PRICES[k][1], 0);
    if (cost) { S.res.coins -= cost; Object.keys(cart).forEach((k) => (S.res[k as keyof Res] += cart[k] * D.PRICES[k][0])); log("🏪 Bought supplies at " + l.name + "."); }
    ui.close();
  }
  async function forage(free: boolean) {
    if (!free && S.day - S.forageDay < 3) throw new Error("You foraged recently. The bushes nearby are picked clean. Try again in a few days.");
    if (!free) S.forageDay = S.day;
    const key = "forage" + S.day + Math.random();
    const [raw, oops] = await new Promise<[number, number]>((res) => ui.show(<Forage key={key} onEnd={(g, o) => res([g, o])} />));
    const got = Math.min(raw, free ? 60 : 40);
    S.res.food += got;
    let txt = "You gathered " + got + " lb of food.";
    if (oops) { const r = applyFx({ sick: 1 }, { sick: "mushroom poisoning" }); txt += " But someone ate a wild mushroom: " + r.join(", ") + "."; }
    log("🍇 " + txt);
    ui.show(<Forage key={key} onEnd={() => {}} after={<><Fb good={!oops}>{txt}</Fb><GoldBtn onClick={() => C("ok")}>Continue</GoldBtn></>} />, true);
    await ui.wait(); ui.close();
  }
  function meds() {
    if (E.busy || !E.has) return;
    const t = alive().find((p) => p.st !== "ok");
    if (!t) return ui.toast("Nobody needs first aid right now.");
    if (!S.res.meds) return ui.toast("You're out of first-aid kits. Buy more at a trading post.");
    S.res.meds--; t.st = "ok"; t.cond = ""; t.hp = clamp(t.hp + 15, 0, 100);
    log("🩹 Used a first-aid kit on " + t.n + ".");
    save(); ui.update();
  }
  function shareFood(name: string) {
    const b = S.bots.find((x) => x.n === name); if (!b || E.busy) return;
    if (S.res.food < 15) return ui.toast("You need 15 lb to share.");
    S.res.food -= 15; b.food += 15; S.helped++; S.tri.social = clamp(S.tri.social + 4, 0, 100);
    log("🤝 Shared 15 lb of food with " + b.n + "."); save(); ui.update();
  }
  function giveMed(name: string) {
    const b = S.bots.find((x) => x.n === name); if (!b || E.busy) return;
    if (!S.res.meds) return ui.toast("No first-aid kits left.");
    S.res.meds--; b.sick = false; b.hp = Math.min(100, b.hp + 15); S.helped++; S.tri.social = clamp(S.tri.social + 4, 0, 100);
    log("🤝 Gave a first-aid kit to " + b.n + "."); save(); ui.update();
  }

  // ---------- finish / over ----------
  async function finish() {
    S.done = true;
    const sc = score(), before = myFinishes();
    store.set("bedrock_trail_local", JSON.stringify(S));
    let after = before + 1, posted = false;
    if (net.on && net.runId) {
      try { const r = await cloud(() => trailSave(net.runId!, S, "done", sc)); after = r.finished ?? after; net.finished = after; net.best = Math.max(net.best, sc); posted = r.status === "done"; }
      catch (e) { cloudErr(e); }
    } else store.set("bedrock_trail_finishes", String(after));
    E.info.finished = after;
    const oldRig = rigOf(before), newRig = rigOf(after), a = alive();
    ui.show(
      <>
        <Chip>🌄 Mile 1,200</Chip>
        <H>You reached Hells Canyon!</H>
        <p className="text-gradient my-2 text-center font-display text-5xl font-extrabold">{sc} pts</p>
        <Txt>{a.length} of 4 travelers made it{S.bots.length ? ", plus " + S.bots.filter((b) => !b.out).length + " of " + S.bots.length + " partner wagons" : ""}. You answered {S.right} of {S.asked} trail questions well, in {S.day} trail days.</Txt>
        {newRig.n > oldRig.n ? (
          <div className="my-3 rounded-2xl border border-gold/60 bg-gradient-to-br from-gold/15 to-amber/10 p-4 text-center">
            <b className="text-lg text-gold">🎉 New rig unlocked!</b>
            <div className="mx-auto my-2 w-44 overflow-hidden rounded-xl bg-gradient-to-b from-[#7fb5ff] to-[#f6e7b4]" dangerouslySetInnerHTML={{ __html: rigSVG(newRig.n) }} />
            <div className="font-bold">{fixE(newRig.icon)} {newRig.animal} · {newRig.wagon}</div>
            <div className="text-sm text-muted">Your new title: <b className="text-fg">&ldquo;{newRig.title}&rdquo;</b>.</div>
          </div>
        ) : after >= 5 ? (
          <div className="my-3 rounded-2xl border border-gold/60 bg-gradient-to-br from-gold/15 to-amber/10 p-4 text-center">
            <b className="text-gold">👑 Grand Wagon Master ×{after}</b>
            <div className="text-sm text-muted">Every finish adds to your count.</div>
          </div>
        ) : null}
        <p className="text-sm text-muted">{posted ? "🏆 Your finish is on the class leaderboard." : net.on ? "Your finish is saved on this device." : "Your finishes are saved on this device. Log in (top right) to put your finishes on the class leaderboard."}</p>
        <GoldBtn onClick={() => C("ok")}>Start a new journey</GoldBtn>
        <Link href="/arcade" className={`${GHOST_BTN} mt-2 w-full`}><Gamepad2 className="size-4" /> Back to the Arcade</Link>
      </>
    );
    await ui.wait(); ui.close();
    store.del("bedrock_trail_local");
    E.info.best = Math.max(E.info.best || 0, sc);
    if (net.on) { net.runId = null; net.run = null; }
    E.has = false; ui.update();
  }
  async function overScreen() {
    ui.show(
      <>
        <Chip>🚑 The trail is over</Chip>
        <H>Your whole party was benched</H>
        <Txt>You made it {S.miles} miles. Balanced meals, enough water, rest, and smart choices keep a party going. Start a new journey and try again!</Txt>
        <p className="text-xs text-muted">Note: your daily miles don&apos;t reset when you start over.</p>
        <GoldBtn onClick={() => C("ok")}>Start a new journey</GoldBtn>
      </>
    );
    if (net.on && net.runId) { const id = net.runId, snap = JSON.parse(JSON.stringify(S)); cloud(() => trailSave(id, snap, "over")).catch(cloudErr); net.runId = null; net.run = null; }
    await ui.wait(); ui.close();
    store.del("bedrock_trail_local"); E.has = false; ui.update();
  }

  // ---------- scene ----------
  function sceneSVG() {
    const R = realmAt(S.miles), off = -((S.miles * 6) % 400);
    const hill = (y: number, h: number, c: string, o: number) => '<g transform="translate(' + (o % 400) + ' 0)"><path d="M0 ' + y + " Q100 " + (y - h) + " 200 " + y + " T400 " + y + " T600 " + y + " T800 " + y + ' V200 H0Z" fill="' + c + '"/></g>';
    const lm = nextLm(), dist = lm.mi - S.miles, rig = rigOf(myFinishes()).n;
    return '<svg viewBox="0 0 400 170" preserveAspectRatio="xMidYMid slice" style="display:block;width:100%;height:auto"><defs>' + RB_DEF("wtRbScene") + '<linearGradient id="wtSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + R.sky[0] + '"/><stop offset="1" stop-color="' + R.sky[1] + '"/></linearGradient></defs>' +
      '<rect width="400" height="170" fill="url(#wtSky)"/><circle cx="320" cy="42" r="18" fill="#FFF3B0" opacity=".9"/>' +
      hill(110, 30, shade(R.color, -0.35), off * 0.3) + hill(128, 22, shade(R.color, -0.15), off * 0.6) +
      (dist <= 40 && dist > 0 ? '<text x="' + (360 - dist * 4) + '" y="128" font-size="26" text-anchor="middle">' + fixE(lm.icon) + "</text>" : "") +
      hill(146, 12, R.color, off) + '<rect y="146" width="400" height="24" fill="' + shade(R.color, -0.45) + '"/><rect y="150" width="400" height="6" fill="#c9a66b" opacity=".75"/>' +
      '<g class="wt-wagon" transform="translate(140 104)"><g class="wt-bob">' + wagonSVG(rig, "wtRbScene") + '<g transform="translate(96 22)">' + animalSVG(rig) + "</g></g></g></svg>";
  }

  // ---------- start / resume ----------
  const savedRun = (): State | null => { if (net.on) return net.run; try { return JSON.parse(store.get("bedrock_trail_local") || "null"); } catch { return null; } };
  async function start(names: string[], nBots: number) {
    const st = newState(names, nBots);
    st.log = ["🏕️ Day 1: Your party leaves Island Park Caldera. 1,200 miles to Hells Canyon!"];
    if (net.on) {
      try { const r = await cloud(() => trailStart(st)); net.runId = r.id; net.left = r.left_today; net.run = st; }
      catch (e) { cloudErr(e); return; }
    }
    S = st; E.has = true; save(); ui.err(""); ui.update();
  }
  function resume() { const s = savedRun(); if (!s) return; S = s; E.has = true; ui.err(""); ui.update(); }
  function quit() {
    if (net.on && net.runId && S) { const id = net.runId, snap = JSON.parse(JSON.stringify(S)); cloud(() => trailSave(id, snap, "over")).catch(cloudErr); net.runId = null; net.run = null; }
    E.has = false; store.del("bedrock_trail_local"); ui.update();
  }
  const setPlan = (k: "pace" | "rations", v: string) => { S[k] = v; ui.update(); };

  return {
    get S() { return S; }, get has() { return E.has; }, get busy() { return E.busy; }, info: E.info,
    D, net, act, meds, shareFood, giveMed, start, resume, quit, setPlan, savedRun,
    localLeft, myFinishes, rigOf, alive, realmAt, nextLm, nextWater, score, sceneSVG,
  };
}
type Engine = ReturnType<typeof makeEngine>;

// ---------- the React shell ----------
const CARD = "block-panel rounded-3xl p-5";
const INPUT = "w-full rounded-xl border border-line bg-ink px-3 py-2.5 font-semibold text-fg outline-none transition focus:border-gold/60 [&>option]:bg-ink-2 [&>option]:text-fg";

/** Class leaderboard (b_trail_board): best finishes this term and the wagons farthest along right now. */
function Board() {
  const [b, setB] = useState<TrailBoard | null>(null);
  const [off, setOff] = useState(false);
  useEffect(() => { if (!twinReady) { setOff(true); return; } trailBoard().then(setB).catch(() => setOff(true)); }, []);
  if (off) return null;
  if (!b) return <div className={`${CARD} animate-pulse text-center text-sm text-muted`}>Loading the class leaderboard…</div>;
  return (
    <div className={`${CARD} animate-rise`}>
      <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Trophy className="size-5 text-gold" /> Class leaderboard</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Best finishes this term</div>
          {b.finishers.length ? b.finishers.slice(0, 10).map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b border-line py-1 text-sm last:border-0">
              <span className="min-w-0 truncate"><b>{i + 1}.</b> {f.name} <span className="text-muted">({f.period})</span> {fixE(TD.RIGS[Math.min(f.finishes, TD.RIGS.length - 1)].icon)}{f.finishes > 1 ? " ×" + f.finishes : ""}</span>
              <b className="text-gold">{f.best}</b>
            </div>)) : <p className="text-sm text-muted">Nobody has reached Hells Canyon yet. Be the first!</p>}
        </div>
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">On the trail now ({b.wagons_out} wagon{b.wagons_out === 1 ? "" : "s"})</div>
          {b.leaders.length ? b.leaders.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-b border-line py-1 text-sm last:border-0">
              <span className="min-w-0 truncate">{l.name} <span className="text-muted">({l.period})</span></span><b>{l.miles} mi</b>
            </div>)) : <p className="text-sm text-muted">No wagons out right now.</p>}
        </div>
      </div>
    </div>
  );
}

export function IdahoTrail() {
  const { student, ready: who } = useStudent();
  const [eng, setEng] = useState<Engine | null>(null);
  const [, setTick] = useState(0);
  const [sheet, setSheet] = useState<ReactNode>(null);
  const [toasts, setToasts] = useState<{ id: number; t: string }[]>([]);
  const [err, setErr] = useState("");
  const [rolling, setRolling] = useState(false);
  const [names, setNames] = useState(["", "", ""]);
  const [bots, setBots] = useState(1);
  const resolver = useRef<((v: string) => void) | null>(null);
  const rollT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef(false);

  useEffect(() => {
    if (!who) return;
    let dead = false;
    (async () => {
      const D: Data = {
        TOTAL: TD.TOTAL, CAP: TD.DAY_CAP, REALMS: TD.REALMS, LMS: TD.LANDMARKS, PACE: TD.PACE, RAT: TD.RATIONS,
        PRICES: TD.PRICES, BOTS: TD.BOT_NAMES, COMP: TD.COMPANIONS, EVENTS: TD.EVENTS, LUCK: TD.LUCK, RIGS: TD.RIGS, VOCAB: vocab(),
      };
      const ui: UI = {
        show: (n, more) => { moreRef.current = !!more; setSheet(n); },
        close: () => setSheet(null),
        wait: () => new Promise<string>((res) => { resolver.current = res; }),
        choose: (v) => { const r = resolver.current; resolver.current = null; r?.(v); },
        toast: (t) => { const id = Math.random(); setToasts((x) => [...x, { id, t }]); setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3500); },
        err: setErr,
        update: () => setTick((n) => n + 1),
        animate: () => { setRolling(true); clearTimeout(rollT.current); rollT.current = setTimeout(() => setRolling(false), 900); },
      };
      // logged in: the database keeps the journey, the daily limit and finishes. Otherwise (or if 008 isn't run yet): this device.
      const net: Net = { on: false, runId: null, left: TD.DAY_CAP, finished: 0, best: 0, run: null };
      if (student && twinReady) {
        try {
          const r = await trailLoad();
          Object.assign(net, { on: true, left: r.left_today, finished: r.finished, best: r.best || 0, runId: r.run?.id ?? null, run: (r.run?.state as State) || null });
          if (net.run && r.run) net.run.miles = r.run.miles;
        } catch (e) { if (!notInstalled(e)) setErr("Couldn't reach the class database (" + (e as Error).message + "). Playing on this device."); }
      }
      if (dead) return;
      const comp = D.COMP.slice().sort(() => Math.random() - 0.5);
      setNames([comp[0], comp[1], comp[2]]);
      const e = makeEngine(D, ui, net);
      if (net.on) { e.info.finished = net.finished; e.info.best = net.best; }
      setEng(e);
    })();
    return () => { dead = true; };
  }, [who, student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = sheetRef.current;
    if (!sheet || !el) return;
    if (moreRef.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); else el.scrollTop = 0;
  }, [sheet]);

  const styles = (
    <style>{`.wt-wheel{transform-box:fill-box;transform-origin:center}.wt-rolling .wt-wheel{animation:wt-spin .5s linear infinite}@keyframes wt-spin{to{transform:rotate(360deg)}}.wt-rolling .wt-bob{animation:wt-bob .25s ease-in-out infinite alternate}@keyframes wt-bob{to{transform:translateY(-1.5px)}}.wt-twinkle{animation:wt-tw 1.4s ease-in-out infinite alternate}@keyframes wt-tw{from{opacity:.2}to{opacity:1}}`}</style>
  );

  // portaled to <body> so the sheet sits above the site header (the page content is its own stacking context)
  const overlay = typeof document === "undefined" ? null : createPortal(
    <>
      {sheet && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-[#05030e]/80 p-3 backdrop-blur-sm sm:items-center">
          <div ref={sheetRef} className="max-h-[92vh] w-full max-w-xl animate-rise overflow-auto rounded-3xl border border-gold/30 bg-ink-2 p-5 shadow-[0_30px_80px_-10px_rgba(0,0,0,.9)] sm:p-6">{sheet}</div>
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[210] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => <div key={t.id} className="max-w-[92vw] animate-rise rounded-2xl border border-emerald/60 bg-[#0f3a2e]/95 px-4 py-2.5 text-center font-bold text-[#eafff7] shadow-lg">{t.t}</div>)}
      </div>
    </>,
    document.body
  );

  if (!eng) {
    return <div className={`${CARD} mx-auto max-w-3xl animate-pulse py-16 text-center text-muted`}>Packing the wagon…</div>;
  }

  // ---------- start screen ----------
  if (!eng.has) {
    const saved = eng.savedRun(), f = eng.myFinishes(), r = eng.rigOf(f), nx = eng.D.RIGS[r.n + 1];
    let setupTitle = saved ? "Or start over with a new journey" : "Start a new journey";
    if (!saved && eng.info.finished) setupTitle = "Start journey #" + (eng.info.finished + 1) + " (best so far: " + (eng.info.best || 0) + " pts)";
    const begin = () => {
      if (saved && !confirm("Start a new journey? This ends the one you're on. Your daily miles don't reset.")) return;
      eng.start(names.map((n) => n.trim().replace(/[<>]/g, "").slice(0, 12) || pick(eng.D.COMP)), bots);
      window.scrollTo(0, 0);
    };
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {styles}
        <div className={`${CARD} animate-rise text-center sm:p-8`}>
          <Image src="/sprites/hero.png" alt="" width={110} height={110} className="mx-auto animate-float drop-shadow-[0_14px_24px_rgba(0,0,0,.5)]" />
          <h1 className="text-gradient mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">The Idaho Trail</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Lead your wagon 1,200 miles across Idaho&apos;s geology, from the Yellowstone hotspot over the Snake River Plain, Craters of the Moon, Borah Peak, the Bonneville Flood&apos;s path and Bruneau Dunes, all the way to Hells Canyon. Keep your party strong in <b className="text-crimson">body</b>, <b className="text-violet">mind</b> and <b className="text-sky">team</b>. Every choice on the trail comes from what we learn in class.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted">⏳ Your wagon can travel up to <b className="text-fg">{eng.D.CAP} miles a day</b>, so the fastest anyone can finish is 6 days. Every finish unlocks a new animal and wagon (horse, bison, triceratops, dragon…).</p>
          <p className="mt-3 text-xs text-muted/80">{eng.net.on ? "Logged in: your journey saves to your account, and finishes go on the class leaderboard." : student ? "Your journey saves on this device." : "Your journey saves on this device. Log in (top right) to save it to your account and get on the class leaderboard."}</p>
        </div>

        {saved && (
          <div className={`${CARD} animate-rise`}>
            <h3 className="font-display text-lg font-bold">{eng.info.finished ? `Your journey (finished ${eng.info.finished}× · best ${eng.info.best || 0} pts)` : "Your journey"}</h3>
            <p className="mt-1 text-muted">Mile {saved.miles} of 1,200 · trail day {saved.day} · {saved.party.filter((p) => p.st !== "out").length} of 4 travelers</p>
            <button onClick={() => { eng.resume(); window.scrollTo(0, 0); }} className={GOLD_BTN}>Continue the trail ▶</button>
          </div>
        )}

        <div className={`${CARD} grid animate-rise items-center gap-4 sm:grid-cols-[160px_1fr]`}>
          <div className="mx-auto w-40 overflow-hidden rounded-2xl bg-gradient-to-b from-[#7fb5ff] to-[#f6e7b4]" dangerouslySetInnerHTML={{ __html: rigSVG(r.n) }} />
          <div>
            <h3 className="font-display text-lg font-bold">Your rig: {fixE(r.icon)} {r.title}{f >= 5 ? " ×" + f : ""}</h3>
            <p className="mt-1 text-sm text-muted">
              {r.wagon} pulled by {r.n ? "a " : "an "}{r.animal.toLowerCase()}.{" "}
              {f ? `You've reached Hells Canyon ${f} time${f === 1 ? "" : "s"}.` : "Finish the trail to upgrade your rig. Every finish unlocks a new animal and wagon."}
            </p>
            {nx && <p className="mt-1 text-sm text-muted">Next finish unlocks: <b className="text-fg">{fixE(nx.icon)} {nx.animal} · {nx.wagon}</b> (&ldquo;{nx.title}&rdquo;)</p>}
          </div>
        </div>

        <div className={`${CARD} animate-rise`}>
          <h3 className="font-display text-lg font-bold">{setupTitle}</h3>
          <label className="mb-1.5 mt-3 block text-sm font-bold text-fg/85">Your three travel companions</label>
          <div className="grid grid-cols-3 gap-2">
            {names.map((n, i) => <input key={i} value={n} maxLength={12} onChange={(e) => setNames(names.map((x, k) => (k === i ? e.target.value : x)))} className={INPUT} aria-label={`Companion ${i + 1}`} />)}
          </div>
          <label htmlFor="wt-bots" className="mb-1.5 mt-3 block text-sm font-bold text-fg/85">Computer partners (extra wagons that travel with you)</label>
          <select id="wt-bots" value={bots} onChange={(e) => setBots(+e.target.value)} className={INPUT}>
            <option value={0}>None</option><option value={1}>1 partner wagon</option><option value={2}>2 partner wagons</option><option value={3}>3 partner wagons</option>
          </select>
          <button onClick={begin} className={GOLD_BTN}>🐂 Hit the trail</button>
        </div>
        <Board />
        {err && <p className="text-center text-sm font-bold text-crimson">{err}</p>}
        {overlay}
      </div>
    );
  }

  // ---------- game screen ----------
  const S = eng.S, D = eng.D, R = eng.realmAt(S.miles), nx = eng.nextLm(), left = eng.localLeft();
  const n = eng.alive().length, days = Math.floor(S.res.food / Math.max(1, D.RAT[S.rations].food * n));
  const off = eng.busy || S.done || S.over || left <= 0;
  const bar = (k: keyof Tri, c: string, label: string) => (
    <div className="grid grid-cols-[78px_1fr_34px] items-center gap-2 text-sm font-bold">
      <span style={{ color: c }}>{label}</span>
      <div className="h-3 overflow-hidden rounded-full bg-fg/10"><i className="block h-full rounded-full transition-[width] duration-500" style={{ width: S.tri[k] + "%", background: c }} /></div>
      <span className="text-right">{S.tri[k]}</span>
    </div>
  );
  const sup: [ReactNode, number, string][] = [["🥖", S.res.food, "lb food"], ["💧", S.res.water, "days water"], ["🩹", S.res.meds, "first aid"], ["🔧", S.res.parts, "parts"], [<Coins key="c" className="inline size-4 -translate-y-px text-gold" />, S.res.coins, "coins"]];

  return (
    <div className="mx-auto max-w-3xl">
      {styles}
      <div className={`relative mb-3 overflow-hidden rounded-3xl border border-line shadow-[0_20px_50px_-15px_rgba(0,0,0,.8)] ${rolling ? "wt-rolling" : ""}`}>
        <div dangerouslySetInnerHTML={{ __html: eng.sceneSVG() }} />
        <div className="absolute left-2.5 top-2 rounded-xl bg-[#0a0618]/75 px-2.5 py-1 text-xs font-bold text-white backdrop-blur sm:text-sm">Realm {R.n} · {R.name}</div>
        <div className="absolute right-2.5 top-2 rounded-xl bg-[#0a0618]/75 px-2.5 py-1 text-xs font-bold text-white backdrop-blur sm:text-sm">Trail day {S.day}</div>
      </div>

      <div className="relative mx-2 mb-4 h-10">
        <div className="absolute inset-x-0 top-[17px] h-1.5 rounded bg-fg/10" />
        <div className="absolute left-0 top-[17px] h-1.5 rounded bg-gradient-to-r from-emerald to-gold transition-[width] duration-700" style={{ width: (S.miles / D.TOTAL) * 100 + "%" }} />
        {D.LMS.map((l) => <div key={l.mi} title={l.name} className={`absolute top-0 -translate-x-1/2 text-[13px] leading-none sm:text-sm ${l.mi <= S.miles ? "" : "opacity-60 grayscale-[.7]"}`} style={{ left: (l.mi / D.TOTAL) * 100 + "%" }}>{fixE(l.icon)}</div>)}
        <div className="absolute top-6 -translate-x-1/2 whitespace-nowrap text-[10px] font-extrabold text-gold" style={{ left: clamp((S.miles / D.TOTAL) * 100, 3, 97) + "%" }}>
          <span className="absolute -top-2.5 left-1/2 -ml-1.5 size-3 rounded-full border-2 border-ink bg-gold" />{S.miles} mi
        </div>
      </div>

      <div className={`mb-3 rounded-2xl border px-4 py-2.5 text-sm font-bold ${left <= 0 ? "border-gold/40 bg-gold/10" : "border-emerald/35 bg-emerald/10"}`}>
        {left > 0 ? <>🐂 Miles left today: <b>{left}</b> of {D.CAP}</> : `⛺ Camp is set for today. You traveled your ${D.CAP} miles. The trail opens again at midnight.`}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([[S.miles, "miles of 1,200"], [Math.max(0, nx.mi - S.miles) + " mi", "to " + nx.name], [S.right, "right answers"], [eng.score(), "score so far"]] as [ReactNode, string][]).map(([v, l], i) => (
          <div key={i} className="glass rounded-2xl px-2 py-2.5 text-center">
            <b className={`block font-display text-xl font-extrabold ${i === 3 ? "text-gold" : "text-fg"}`}>{v}</b>
            <span className="text-[11px] font-semibold text-muted">{l}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <div className={CARD}>
            <h3 className="mb-3 flex items-center gap-2 font-display font-bold"><Image src="/sprites/heart.png" alt="" width={20} height={20} /> Party strength</h3>
            <div className="grid gap-2">{bar("body", "#FF6B6B", "💪 Body")}{bar("mind", "#9B8CE0", "🧠 Mind")}{bar("social", "#38BFFF", "🤝 Team")}</div>
          </div>
          <div className={CARD}>
            <h3 className="mb-3 font-display font-bold">Your party</h3>
            <div className="grid gap-1.5">
              {S.party.map((p, i) => (
                <div key={i} className={`grid grid-cols-[1fr_90px] items-center gap-2 rounded-xl bg-fg/[0.04] px-3 py-2 ${p.st === "out" ? "opacity-45" : ""}`}>
                  <div>
                    <div className="text-sm font-bold">{p.n}</div>
                    <div className={`text-xs font-semibold ${p.st === "sick" || p.st === "hurt" ? "text-amber" : "text-muted"}`}>
                      {p.st === "out" ? "Benched" : p.st === "ok" ? (p.hp > 70 ? "Strong" : p.hp > 35 ? "Tired" : "Very weak") : "Has " + p.cond}
                    </div>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-fg/10"><i className="block h-full transition-[width] duration-500" style={{ width: p.hp + "%", background: p.hp > 60 ? "var(--color-emerald)" : p.hp > 30 ? "var(--color-gold)" : "var(--color-crimson)" }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className={CARD}>
            <h3 className="mb-3 font-display font-bold">Supplies</h3>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {sup.map(([ic, v, l], i) => (
                <div key={i} className="rounded-xl bg-fg/[0.04] px-0.5 py-2">
                  <b className="block whitespace-nowrap text-[15px]">{ic} {v}</b><span className="text-[10.5px] font-semibold leading-tight text-muted">{l}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div><label htmlFor="wt-pace" className="mb-1 block text-xs font-bold text-fg/85">Pace</label>
                <select id="wt-pace" value={S.pace} onChange={(e) => eng.setPlan("pace", e.target.value)} className={INPUT}>{Object.keys(D.PACE).map((k) => <option key={k} value={k}>{D.PACE[k].label}</option>)}</select></div>
              <div><label htmlFor="wt-rat" className="mb-1 block text-xs font-bold text-fg/85">Meals</label>
                <select id="wt-rat" value={S.rations} onChange={(e) => eng.setPlan("rations", e.target.value)} className={INPUT}>{Object.keys(D.RAT).map((k) => <option key={k} value={k}>{D.RAT[k].label}</option>)}</select></div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{D.PACE[S.pace].note} · {D.RAT[S.rations].note}. Food lasts about {D.RAT[S.rations].food ? days + " days" : "—"}, water {S.res.water} days. Next water: {eng.nextWater()}.</p>
          </div>
          <div className={CARD}>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={off} onClick={() => eng.act("travel")} className={`${GOLD_BTN} col-span-2 !mt-0 py-4 text-lg`}>🐂 Travel on</button>
              <button disabled={off} onClick={() => eng.act("rest")} className={GHOST_BTN}>⛺ Rest a day</button>
              <button disabled={off} onClick={() => eng.act("fire")} className={GHOST_BTN}>🔥 Campfire talk</button>
              <button disabled={off} onClick={() => eng.act("forage")} className={GHOST_BTN}>🍇 Forage</button>
              <button disabled={eng.busy} onClick={() => eng.meds()} className={GHOST_BTN}>🩹 Use first aid</button>
            </div>
            {err && <p className="mt-2 text-sm font-bold text-crimson">{err}</p>}
          </div>
        </div>
      </div>

      <div className={`${CARD} mt-3`}>
        <h3 className="mb-3 font-display font-bold">Trail journal</h3>
        <div className="grid gap-1 text-[13.5px] leading-snug">
          {S.log.slice(0, 8).map((t, i) => <div key={S.log.length + "-" + i + t} className={`rounded-xl px-3 py-1.5 ${i === 0 ? "bg-gold/10 font-bold text-fg" : "bg-fg/[0.04] text-fg/85"}`}>{t}</div>)}
        </div>
      </div>

      <div className={`${CARD} mt-3`}>
        <h3 className="mb-3 font-display font-bold">🤝 Your convoy</h3>
        {S.bots.length ? (
          <div className="grid gap-1.5">
            {S.bots.map((b) => (
              <div key={b.n} className="rounded-xl bg-fg/[0.04] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">🤖 {b.n} <span className="ml-1 rounded-md bg-fg/10 px-1.5 py-0.5 text-[11px] font-bold text-muted">computer partner</span></span>
                  <span className="rounded-md bg-fg/10 px-2 py-0.5 text-[11px] font-bold">{b.out ? "turned back" : b.sick ? "sick" : b.food < 25 ? "low on food" : "doing fine"}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fg/10"><i className="block h-full bg-sky transition-[width] duration-500" style={{ width: (b.out ? 0 : b.hp) + "%" }} /></div>
                {!b.out && (
                  <div className="mt-1 text-xs font-semibold text-muted">
                    Food {b.food} lb · <button onClick={() => eng.shareFood(b.n)} className="font-bold text-gold hover:underline">share 15 lb food</button>
                    {b.sick && <> · <button onClick={() => eng.giveMed(b.n)} className="font-bold text-gold hover:underline">give first aid</button></>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">No computer partners on this journey.</p>}
      </div>

      <div className="mt-4 text-center">
        <button onClick={() => { if (confirm("End this journey and start a new one? Your daily miles don't reset.")) eng.quit(); }} className="glass rounded-xl px-3 py-2 text-xs font-semibold text-muted transition hover:text-fg">Start over with a new journey</button>
      </div>
      {overlay}
    </div>
  );
}
