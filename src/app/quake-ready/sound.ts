"use client";
// ── wave-twinA ── WebAudio for Quake Ready (no files): blips, alarm tones and a low rumble for shaking.
import { useEffect, useMemo, useRef, useState } from "react";

const KEY = "bedrock_quake_muted";

export function useQuakeSound() {
  const [muted, setMuted] = useState(false);
  const m = useRef(false);
  const ac = useRef<AudioContext | null>(null);
  const rum = useRef<{ g: GainNode; src: AudioBufferSourceNode } | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved choice is only readable in the browser
  useEffect(() => { try { const v = localStorage.getItem(KEY) === "1"; m.current = v; setMuted(v); } catch {} }, []);

  const api = useMemo(() => {
    const ctx = () => {
      if (!ac.current) {
        const A = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!A) return null;
        ac.current = new A();
      }
      if (ac.current.state === "suspended") ac.current.resume().catch(() => {});
      return ac.current;
    };
    const tone = (freq: number, when: number, dur: number, vol: number, type: OscillatorType = "square") => {
      const a = ctx(); if (!a || m.current) return;
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = freq; o.type = type;
      g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g).connect(a.destination); o.start(when); o.stop(when + dur + 0.02);
    };
    const blip = (ok: boolean) => { const a = ctx(); if (a) tone(ok ? 880 : 220, a.currentTime, ok ? 0.12 : 0.2, 0.05); };
    const alarm = () => { const a = ctx(); if (a) [0, 0.25, 0.5].forEach((d) => tone(660, a.currentTime + d, 0.18, 0.1)); };
    /** level 0..1: brown-noise rumble through a low-pass filter. */
    const rumble = (level: number) => {
      const want = m.current ? 0 : Math.max(0, Math.min(1, level)) * 0.5;
      if (!rum.current) {
        if (want <= 0) return;
        const a = ctx(); if (!a) return;
        const len = a.sampleRate * 2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
        const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 140;
        const g = a.createGain(); g.gain.value = 0;
        src.connect(lp).connect(g).connect(a.destination); src.start();
        rum.current = { g, src };
      }
      const a = ac.current!;
      rum.current.g.gain.setTargetAtTime(want, a.currentTime, 0.08);
    };
    const toggle = () => {
      m.current = !m.current; setMuted(m.current);
      try { localStorage.setItem(KEY, m.current ? "1" : "0"); } catch {}
      if (m.current) rumble(0);
    };
    const unlock = () => { ctx(); };
    return { tone, blip, alarm, rumble, toggle, unlock };
  }, []);

  useEffect(() => () => { try { rum.current?.src.stop(); } catch {} ac.current?.close().catch(() => {}); }, []);
  return { ...api, muted };
}
