"use client";
// ── wave-x7a ── shared browser text-to-speech helpers for /listen/ and /book-studio/.
// Everything runs on the device (Web Speech API): no server, no API key.
import { useEffect, useState } from "react";

/** Chapter markdown → plain text a voice can read ("- " bullets, **bold**, *italic*, links). */
export function speechText(md: string) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .split("\n")
    .map((l) => l.trim().replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
    .map((l) => (l && !/[.!?:;"”)]$/.test(l) ? l + "." : l)) // a bullet with no period still gets a pause
    .filter(Boolean)
    .join("\n");
}

/** Split text into sentence-sized pieces (short utterances are far more reliable than long ones). */
export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    const p = para.trim();
    if (!p) continue;
    const parts = p.match(/[^.!?]+(?:[.!?]+["”’)]*|$)/g) ?? [p];
    let buf = "";
    for (const raw of parts) {
      const s = raw.trim();
      if (!s) continue;
      // keep "e.g." / "U.S." / "Dr." style pieces glued to the next one
      if (buf && buf.length < 4) { buf += " " + s; continue; }
      if (buf) out.push(buf);
      buf = s;
    }
    if (buf) out.push(buf);
  }
  // very long sentences: split at commas so Chrome doesn't cut them off
  return out.flatMap((s) => (s.length < 260 ? [s] : s.split(/(?<=[,;])\s+/).reduce<string[]>((a, piece) => {
    if (a.length && (a[a.length - 1] + " " + piece).length < 220) a[a.length - 1] += " " + piece; else a.push(piece);
    return a;
  }, [])));
}

export const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

function voiceScore(v: SpeechSynthesisVoice) {
  let s = 0;
  if (/^en[-_]US/i.test(v.lang)) s += 4; else if (/^en/i.test(v.lang)) s += 2;
  if (/natural|neural|enhanced|premium|online/i.test(v.name)) s += 6;
  if (/google|microsoft|samantha|ava|evan|aria|jenny|guy|andrew/i.test(v.name)) s += 2;
  if (v.localService) s += 1;
  if (/compact|espeak/i.test(v.name)) s -= 4;
  return s;
}

/** English voices on this device, best-sounding first. Empty when the browser has no speech. */
export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const en = all.filter((v) => /^en/i.test(v.lang));
      setVoices((en.length ? en : all).slice().sort((a, b) => voiceScore(b) - voiceScore(a)));
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);
  return voices;
}

export const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

/**
 * Speak one piece. Calls onDone once when it finishes (or when the browser silently drops it:
 * a watchdog fires after a generous estimate so playback never gets stuck).
 */
export function speakOne(text: string, opts: { rate: number; voice?: SpeechSynthesisVoice | null; onDone: () => void; onError?: () => void }) {
  let finished = false;
  const done = () => { if (finished) return; finished = true; clearTimeout(watch); opts.onDone(); };
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate;
  if (opts.voice) { u.voice = opts.voice; u.lang = opts.voice.lang; } else u.lang = "en-US";
  u.onend = done;
  u.onerror = (e) => {
    if (finished) return;
    if (e.error === "interrupted" || e.error === "canceled") { finished = true; clearTimeout(watch); return; }
    finished = true; clearTimeout(watch); (opts.onError ?? opts.onDone)();
  };
  const est = (words(text) / (2.6 * opts.rate)) * 1000;
  const watch = setTimeout(() => { if (!window.speechSynthesis.speaking) done(); else { const again = setInterval(() => { if (finished) clearInterval(again); else if (!window.speechSynthesis.speaking) { clearInterval(again); done(); } }, 1000); } }, est * 2 + 4000);
  window.speechSynthesis.speak(u);
  return () => { finished = true; clearTimeout(watch); };
}

export function stopSpeech() { try { window.speechSynthesis.cancel(); } catch {} }

export const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k: string) { try { localStorage.removeItem(k); } catch {} },
};
// ── end wave-x7a ──
