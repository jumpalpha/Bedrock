"use client";

// ── wave-pet: hues re-tuned for the rock-alien hero (gray body, purple amethyst belly = hue 0 is violet) ──
export const HERO_COLORS = [
  { id: "emerald", label: "Emerald", hue: -120, swatch: "#3ddc84" },
  { id: "sky", label: "Sky", hue: -65, swatch: "#38bfff" },
  { id: "violet", label: "Violet", hue: 0, swatch: "#a855f7" },
  { id: "rose", label: "Rose", hue: 70, swatch: "#ff5c8a" },
  { id: "gold", label: "Gold", hue: 140, swatch: "#ffc93c" },
] as const;

export type HeroColor = (typeof HERO_COLORS)[number]["id"];

import { fallbackSprite } from "./fallback-sprites";

const cache = new Map<string, HTMLImageElement>();
const failed = new Set<string>();
const tinted = new Map<string, HTMLCanvasElement>();

export function loadSprite(name: string): HTMLImageElement {
  let img = cache.get(name);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onerror = () => failed.add(name);
    img.src = `/sprites/${name}.png`;
    cache.set(name, img);
  }
  return img;
}

export function ready(img: HTMLImageElement | undefined | null): img is HTMLImageElement {
  return !!img && img.complete && img.naturalWidth > 0;
}

// The PNG if it loaded; a procedural stand-in once the PNG is known to be missing; null while loading.
export function spriteOrFallback(name: string): HTMLImageElement | HTMLCanvasElement | null {
  const img = loadSprite(name);
  if (img.complete && img.naturalWidth > 0) return img;
  // complete with no pixels = the load failed (some browsers settle this before onerror fires)
  if (failed.has(name) || img.complete) return fallbackSprite(name);
  return null;
}

// Hero recolor: bake a hue-rotated copy once per color so drawing stays cheap.
export function tintedSprite(name: string, color: HeroColor, size = 256): HTMLImageElement | HTMLCanvasElement | null {
  // ── wave-pet2: a missing hero PNG falls back to the drawn rock alien ──
  const img = spriteOrFallback(name);
  if (!img) return null;
  const hue = HERO_COLORS.find((c) => c.id === color)?.hue ?? 0;
  if (!hue) return img;
  const key = `${name}|${color}`;
  let c = tinted.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d")!;
    x.filter = `hue-rotate(${hue}deg) saturate(1.1)`;
    x.drawImage(img, 0, 0, size, size);
    tinted.set(key, c);
  }
  return c;
}
