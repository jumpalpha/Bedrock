"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX, Trophy, Gamepad2 } from "lucide-react";
import type { Api, GameModule, HeroPose, InputType, Medal } from "./types";
import { HERO_COLORS, type HeroColor, loadSprite, spriteOrFallback, tintedSprite } from "./assets";

type Phase = Api["state"] | "loading";
type Over = { score: number; best: number; isBest: boolean; won: boolean; medal: Medal | null; fact: string };

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

const POSE_SPRITE: Record<HeroPose, string> = { happy: "hero", wings: "hero-wings", run: "hero-run", hurt: "hero-hurt", back: "hero-back" };
const KEYS: Record<string, InputType> = {
  Space: "tap", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};

export function ArcadeGame({ game }: { game: GameModule }) {
  const cfg = game.config;
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<Api | null>(null);
  const startRef = useRef<() => void>(() => {});
  const pauseRef = useRef<(p: boolean) => void>(() => {});

  const [phase, setPhase] = useState<Phase>("loading");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState<Over | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const [color, setColor] = useState<HeroColor>("emerald");
  const [size, setSize] = useState({ w: cfg.W, h: cfg.H });

  const medalFor = useCallback((s: number) => cfg.medals.reduce<Medal | null>((m, x) => (s >= x.at ? x : m), null), [cfg.medals]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const logic = game.create();
    const parts: { x: number; y: number; vx: number; vy: number; life: number; t: number; c: string; r: number }[] = [];
    const floats: { text: string; x: number; y: number; t: number; c: string }[] = [];
    let shakeT = 0, shakeA = 0, flashT = 0, lastMedal: Medal | null = null, overLock = 0, raf = 0;
    let heroColor = store.get<HeroColor>("bedrock_arcade_color", "emerald");
    let isMuted = store.get("bedrock_arcade_muted", false);
    let audio: AudioContext | null = null;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    const displayFont = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "system-ui, sans-serif";

    (cfg.sprites ?? []).concat(Object.values(POSE_SPRITE)).forEach(loadSprite);

    const tone = (f: number, d: number, type: OscillatorType = "square", vol = 0.08, slide?: number) => {
      if (isMuted) return;
      try {
        audio = audio || new AudioContext();
        const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + d);
      } catch {}
    };

    const A: Api = {
      W: cfg.W, H: cfg.H, ctx, state: "menu", score: 0, best: store.get(cfg.key + "_best", 0), time: 0, won: false, store,
      addScore(n) {
        A.score += n;
        setScore(A.score);
        milestones();
      },
      setScore(n) {
        A.score = n;
        setScore(n);
        milestones();
      },
      win(text) {
        if (A.won) return;
        A.won = true;
        A.sfx("win");
        A.flash(0.25);
        A.toast(`🏆 Quest complete! ${text || cfg.winText || "Keep going for a new best!"}`, 2800);
        store.set(cfg.key + "_wins", store.get(cfg.key + "_wins", 0) + 1);
      },
      gameOver(quiet) {
        if (A.state !== "play") return;
        A.state = "dying";
        setPhase("dying");
        if (!quiet) {
          A.sfx("hit");
          A.shake(12, 0.4);
          A.flash(0.2);
        }
        setTimeout(() => {
          A.state = "over";
          const isBest = A.score > A.best;
          if (isBest) {
            A.best = A.score;
            store.set(cfg.key + "_best", A.best);
            setBest(A.best);
          }
          setOver({ score: A.score, best: A.best, isBest, won: A.won, medal: medalFor(A.score), fact: cfg.facts[Math.floor(Math.random() * cfg.facts.length)] ?? "" });
          setPhase("over");
          overLock = Date.now() + 600;
        }, cfg.deathDelay ?? 700);
      },
      particles: {
        burst(x, y, c, n = 12, speed = 160, sz = 4) {
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
            parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.6 + Math.random() * 0.4, t: 0, c, r: sz * (0.6 + Math.random() * 0.8) });
          }
        },
        trail(x, y, c) {
          parts.push({ x, y, vx: -60 - Math.random() * 40, vy: (Math.random() - 0.5) * 30, life: 0.4, t: 0, c, r: 2 + Math.random() * 2 });
        },
      },
      float: (text, x, y, c = "#FFD166") => floats.push({ text, x, y, t: 0, c }),
      shake: (amt = 8, dur = 0.3) => { shakeA = amt; shakeT = dur; },
      flash: (d = 0.15) => { flashT = d; },
      sfx(name) {
        switch (name) {
          case "flap": tone(420, 0.09, "triangle", 0.07, 760); break;
          case "jump": tone(300, 0.16, "square", 0.05, 640); break;
          case "coin": tone(880, 0.07, "square", 0.05); setTimeout(() => tone(1320, 0.1, "square", 0.05), 60); break;
          case "point": tone(660, 0.06, "triangle", 0.06); break;
          case "swipe": tone(500, 0.07, "sine", 0.06, 300); break;
          case "click": tone(520, 0.04, "triangle", 0.05); break;
          case "drop": tone(200, 0.08, "triangle", 0.07, 120); break;
          case "clear": [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.1, "triangle", 0.07), i * 60)); break;
          case "hit": tone(160, 0.35, "sawtooth", 0.12, 40); break;
          case "win": [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.08), i * 110)); break;
          case "medal": [784, 988].forEach((f, i) => setTimeout(() => tone(f, 0.14, "triangle", 0.07), i * 90)); break;
        }
      },
      toast(text, ms = 1800) {
        setToast({ text, id: Date.now() });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => setToast(null), ms);
      },
      sprite(name) {
        return spriteOrFallback(name);
      },
      drawSprite(name, x, y, sz, rot = 0, alpha = 1, flipX = false) {
        const img = A.sprite(name);
        if (!img) return false;
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        if (flipX) ctx.scale(-1, 1);
        if (alpha !== 1) ctx.globalAlpha *= alpha;
        ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
        return true;
      },
      drawHero(x, y, sz, rot = 0, pose = "happy") {
        const img = tintedSprite(POSE_SPRITE[pose], heroColor) ?? tintedSprite("hero", heroColor);
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        if (img) {
          ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
        } else {
          ctx.fillStyle = "#b8b0a6"; // ── wave-pet2 ── stone-gray blob while the alien sprite loads
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.36, 0, 7);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(sz * 0.1, -sz * 0.06, sz * 0.09, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      },
      drawHeroAs(color, x, y, sz, rot = 0, pose = "happy") {
        const img = tintedSprite(POSE_SPRITE[pose], color as HeroColor) ?? tintedSprite("hero", color as HeroColor);
        if (!img) return;
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      },
      rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      },
      font: (size, weight = 800) => `${weight} ${size}px ${displayFont}`,
      heroSwatch: () => HERO_COLORS.find((c) => c.id === heroColor)!.swatch,
    };
    apiRef.current = A;

    function milestones() {
      const m = medalFor(A.score);
      if (m && m !== lastMedal) {
        lastMedal = m;
        A.sfx("medal");
        A.toast(`${m.icon} ${m.name} medal!`);
      }
      if (!A.won && cfg.winAt && A.score >= cfg.winAt) A.win();
    }

    function start() {
      A.state = "play";
      A.score = 0;
      A.time = 0;
      A.won = false;
      lastMedal = null;
      parts.length = 0;
      floats.length = 0;
      store.set(cfg.key + "_plays", store.get(cfg.key + "_plays", 0) + 1);
      setScore(0);
      setOver(null);
      setPhase("play");
      logic.reset(A);
      overLock = Date.now() + 250;
    }
    startRef.current = start;

    pauseRef.current = (p: boolean) => {
      if (p && A.state === "play") {
        A.state = "paused";
        setPhase("paused");
      } else if (!p && A.state === "paused") {
        A.state = "play";
        setPhase("play");
        last = performance.now();
      }
    };

    // ---- input ----
    function send(type: InputType) {
      if (A.state === "menu" && (type === "tap" || type === "up")) return;
      if (A.state === "over") {
        if ((type === "tap" || type === "up") && Date.now() > overLock) start();
        return;
      }
      if (A.state === "play") logic.input?.(type, A);
    }
    (window as unknown as { __send?: typeof send }).__send = send;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyP" || e.code === "Escape") {
        pauseRef.current(A.state !== "paused");
        return;
      }
      if (e.code === "Enter" && (A.state === "menu" || (A.state === "over" && Date.now() > overLock))) {
        start();
        return;
      }
      if (A.state === "play") logic.key?.(e.code, A);
      const t = e.code === "Space" && cfg.spaceType ? cfg.spaceType : cfg.keys?.[e.code] ?? KEYS[e.code];
      if (!t) return;
      e.preventDefault();
      if (e.repeat && (!cfg.repeatKeys || t === cfg.spaceType)) return;
      send(t);
      if (t === "up" && cfg.upIsTap) send("tap");
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const t = KEYS[e.code];
      if (t) send(("release-" + t) as InputType);
    };
    const logical = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * A.W, ((e.clientY - r.top) / r.height) * A.H];
    };
    let sx = 0, sy = 0, st = 0, swiped = false, ptrDown = false;
    const stage = stageRef.current!;
    const isUi = (e: Event) => e.target instanceof Element && !!e.target.closest("button,a,[data-ui]");
    const onDown = (e: PointerEvent) => {
      if (isUi(e)) return;
      if (logic.pointer && A.state === "play") {
        ptrDown = true;
        logic.pointer("down", ...logical(e), A);
      }
      sx = e.clientX; sy = e.clientY; st = Date.now(); swiped = false;
      if (!cfg.swipe) send("tap");
    };
    const onMove = (e: PointerEvent) => {
      if (logic.pointer && A.state === "play" && (ptrDown || e.pointerType === "mouse")) logic.pointer(ptrDown ? "drag" : "move", ...logical(e), A);
      if (!cfg.swipe || swiped || !st) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 28) {
        swiped = true;
        send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
      }
    };
    const onUp = (e: PointerEvent) => {
      if (ptrDown && logic.pointer && A.state === "play") logic.pointer("up", ...logical(e), A);
      ptrDown = false;
      if (isUi(e)) return;
      if (cfg.swipe && st && !swiped && Date.now() - st < 300) send("tap");
      send("release-tap");
      st = 0;
    };
    const noScroll = (e: TouchEvent) => { if (A.state === "play") e.preventDefault(); };
    const onVis = () => { if (document.hidden) pauseRef.current(true); };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    stage.addEventListener("touchmove", noScroll, { passive: false });
    document.addEventListener("visibilitychange", onVis);

    // ---- sizing ----
    function resize() {
      const wrap = wrapRef.current!;
      const maxW = wrap.clientWidth;
      const padH = cfg.pad && (cfg.padAlways || matchMedia("(hover:none)").matches) ? 84 : 0;
      const maxH = Math.max(320, window.innerHeight - 150 - padH);
      const scale = Math.min(maxW / A.W, maxH / A.H);
      const cw = Math.floor(A.W * scale), ch = Math.floor(A.H * scale);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.imageSmoothingQuality = "high";
      setSize({ w: cw, h: ch });
    }
    resize();
    window.addEventListener("resize", resize);

    // ---- loop ----
    let last = performance.now();
    function frame(now: number) {
      let dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (A.state === "paused") dt = 0;
      if (A.state === "play") A.time += dt;
      const k = A.state === "play" ? 1 : A.state === "dying" ? 0.25 : A.state === "paused" ? 0 : 0.35;
      logic.update(dt * k, A);

      ctx.save();
      if (shakeT > 0) {
        shakeT -= dt;
        const s = shakeT > 0 ? shakeA : 0;
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      }
      logic.draw(ctx, A);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t > p.life) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
        ctx.globalAlpha = 1 - p.t / p.life;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.font = A.font(22);
      ctx.lineJoin = "round";
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.t += dt;
        if (f.t > 0.9) { floats.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - f.t / 0.9;
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(7,7,26,.85)";
        ctx.strokeText(f.text, f.x, f.y - f.t * 50);
        ctx.fillStyle = f.c;
        ctx.fillText(f.text, f.x, f.y - f.t * 50);
      }
      ctx.globalAlpha = 1;
      if (flashT > 0) {
        flashT -= dt;
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, flashT * 3)})`;
        ctx.fillRect(-20, -20, A.W + 40, A.H + 40);
      }
      ctx.restore();
      raf = requestAnimationFrame(frame);
    }

    setBest(A.best);
    setMuted(isMuted);
    setColor(heroColor);
    logic.reset(A);
    setPhase("menu");
    raf = requestAnimationFrame(frame);

    // color/mute changes from React
    const onPrefs = (e: Event) => {
      const d = (e as CustomEvent).detail as { color?: HeroColor; muted?: boolean };
      if (d.color) heroColor = d.color;
      if (d.muted !== undefined) isMuted = d.muted;
    };
    window.addEventListener("arcade-prefs", onPrefs);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(toastTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      stage.removeEventListener("touchmove", noScroll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      window.removeEventListener("arcade-prefs", onPrefs);
      audio?.close().catch(() => {});
    };
  }, [game, cfg, medalFor]);

  const pickColor = (c: HeroColor) => {
    setColor(c);
    store.set("bedrock_arcade_color", c);
    window.dispatchEvent(new CustomEvent("arcade-prefs", { detail: { color: c } }));
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    store.set("bedrock_arcade_muted", m);
    window.dispatchEvent(new CustomEvent("arcade-prefs", { detail: { muted: m } }));
  };
  const send = (t: InputType) => (window as unknown as { __send?: (t: InputType) => void }).__send?.(t);
  const bestMedal = medalFor(best);
  const accent = cfg.accent ?? "#FFD166";
  const showPad = !!cfg.pad;

  // Short frames (landscape games on a portrait phone) cannot fit the cards, so they go below the frame.
  const compact = size.h < 470;
  const Wrap = compact ? Below : Overlay;
  const cards = (
    <>
        {/* MENU */}
        {phase === "menu" && (
          <Wrap>
            <Card>
              <h1 className="arc-gradient font-display text-3xl font-extrabold tracking-tight">{cfg.title}</h1>
              <p className="mt-1 text-sm font-medium text-muted">{cfg.subtitle}</p>
              {!cfg.heroless && (
                <>
                  <div className="mx-auto my-3 grid size-28 arc-float place-items-center">
                    <Image src="/sprites/hero.png" alt="" width={112} height={112} className="drop-shadow-[0_12px_20px_rgba(0,0,0,.5)]" style={{ filter: `hue-rotate(${HERO_COLORS.find((c) => c.id === color)!.hue}deg)` }} />
                  </div>
                  <div className="flex justify-center gap-2">
                    {HERO_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => pickColor(c.id)}
                        aria-label={`${c.label} sprite`}
                        className={`size-8 rounded-full border-2 transition ${color === c.id ? "scale-110 border-white" : "border-transparent opacity-70 hover:opacity-100"}`}
                        style={{ background: c.swatch, boxShadow: color === c.id ? `0 0 0 3px ${c.swatch}55` : undefined }}
                      />
                    ))}
                  </div>
                </>
              )}
              <p className="mt-4 text-sm leading-relaxed text-[#d9dbf3]" dangerouslySetInnerHTML={{ __html: cfg.howTo }} />
              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
                <Trophy className="size-4 text-gold" /> Best <b className="text-gold">{best.toLocaleString()}</b>
                {bestMedal && <span>· {bestMedal.icon} {bestMedal.name}</span>}
                {cfg.winAt ? <span>· Goal {cfg.winAt.toLocaleString()}</span> : null}
              </div>
              <PlayBtn onClick={() => startRef.current()}>
                <Play className="size-5 fill-current" /> Play
              </PlayBtn>
              <p className="mt-3 font-mono text-[11px] text-muted/80">{cfg.controls}</p>
            </Card>
          </Wrap>
        )}

        {phase === "paused" && (
          <Wrap>
            <Card>
              <h2 className="font-display text-3xl font-extrabold">Paused</h2>
              <PlayBtn onClick={() => pauseRef.current(false)}>
                <Play className="size-5 fill-current" /> Resume
              </PlayBtn>
            </Card>
          </Wrap>
        )}

        {phase === "over" && over && (
          <Wrap>
            <Card>
              <h2 className="arc-gradient font-display text-3xl font-extrabold tracking-tight">{over.won ? "🏆 Quest Complete!" : cfg.overTitle ?? "Game Over"}</h2>
              <div className="mt-2 font-display text-7xl font-extrabold leading-none tracking-tighter text-white [text-shadow:0_6px_24px_rgba(0,0,0,.5)]">
                {over.score.toLocaleString()}
              </div>
              <div className="mt-2 text-sm font-semibold text-muted">
                {over.isBest ? <span className="text-emerald">✨ New best!</span> : <>Best <b className="text-gold">{over.best.toLocaleString()}</b></>}
              </div>
              {over.medal ? (
                <div className="mt-3 inline-flex rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-sm font-bold text-gold">
                  {over.medal.icon} {over.medal.name} medal
                </div>
              ) : cfg.medals[0] ? (
                <div className="mt-3 inline-flex rounded-full border border-line bg-white/5 px-3 py-1 text-sm text-muted">
                  {cfg.medals[0].icon} {cfg.medals[0].name} at {cfg.medals[0].at}
                </div>
              ) : null}
              {over.fact && (
                <div className="mt-4 rounded-2xl border border-sky/25 bg-sky/10 p-3 text-left text-sm leading-relaxed text-[#d9dbf3]">💡 {over.fact}</div>
              )}
              <PlayBtn onClick={() => startRef.current()}>
                <RotateCcw className="size-5" /> Play again
              </PlayBtn>
              <Link href="/arcade/" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:brightness-110">
                <Gamepad2 className="size-4" /> More games
              </Link>
            </Card>
          </Wrap>
        )}

    </>
  );

  return (
    <div ref={wrapRef} className="flex w-full flex-col items-center select-none">
      <style>{ARCADE_CSS}</style>
      <div
        ref={stageRef}
        className="relative touch-none overflow-hidden rounded-3xl"
        style={{ width: size.w, height: size.h, boxShadow: `0 0 0 1px rgba(255,255,255,.1), 0 40px 100px -40px rgba(0,0,0,.95), 0 0 80px -30px ${accent}` }}
      >
        <canvas ref={canvasRef} className="block" style={{ width: size.w, height: size.h }} aria-label={`${cfg.title} game`} />

        {/* HUD */}
        {(phase === "play" || phase === "dying" || phase === "paused") && (
          <div className="pointer-events-none absolute inset-x-0 top-3 text-center">
            <span key={score} className="inline-block arc-pop font-display text-5xl font-extrabold tracking-tight text-white [text-shadow:0_4px_18px_rgba(0,0,0,.6),0_2px_0_rgba(0,0,0,.35)]">
              {score.toLocaleString()}
            </span>
          </div>
        )}
        <div data-ui className="absolute left-3 top-3 flex gap-2">
          {(phase === "play" || phase === "paused") && (
            <IconBtn label={phase === "paused" ? "Resume" : "Pause"} onClick={() => pauseRef.current(phase === "play")}>
              {phase === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}
            </IconBtn>
          )}
        </div>
        <div data-ui className="absolute right-3 top-3">
          <IconBtn label={muted ? "Sound on" : "Sound off"} onClick={toggleMute}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </IconBtn>
        </div>

        {toast && (
          <div key={toast.id} className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4">
            <div className="arc-rise rounded-full bg-gradient-to-r from-gold to-amber px-5 py-2 text-center text-sm font-bold text-ink shadow-[0_10px_30px_-10px_rgba(255,159,28,.9)]">
              {toast.text}
            </div>
          </div>
        )}

        {!compact && cards}
        {compact && (phase === "menu" || phase === "over" || phase === "paused") && (
          <div data-ui className="absolute inset-0 grid place-items-center bg-ink/45 backdrop-blur-[3px]">
            <div className="flex flex-col items-center gap-1">
              {phase === "over" && over && <div className="font-display text-4xl font-extrabold text-white [text-shadow:0_4px_18px_rgba(0,0,0,.6)]">{over.score.toLocaleString()}</div>}
              <button
                onClick={() => (phase === "paused" ? pauseRef.current(false) : startRef.current())}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] px-7 py-3 font-display text-lg font-extrabold text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.9)] active:scale-95"
              >
                {phase === "over" ? <RotateCcw className="size-5" /> : <Play className="size-5 fill-current" />}
                {phase === "over" ? "Play again" : phase === "paused" ? "Resume" : "Play"}
              </button>
            </div>
          </div>
        )}
        {phase === "loading" && <div className="absolute inset-0 grid place-items-center bg-ink text-muted">Loading…</div>}
      </div>

      {compact && cards}

      {showPad && (
        <div className={`mt-4 w-full justify-center gap-3 ${cfg.padAlways ? "flex" : "hidden [@media(hover:none)]:flex"}`}>
          {cfg.pad!.map((b) => (
            <button
              key={b.type}
              type="button"
              onPointerDown={(e) => { e.preventDefault(); send(b.type); if (b.type === "up" && cfg.upIsTap) send("tap"); }}
              onPointerUp={(e) => { e.preventDefault(); send(("release-" + b.type) as InputType); }}
              onPointerCancel={() => send(("release-" + b.type) as InputType)}
              className={`glass h-16 flex-1 touch-none rounded-2xl text-xl font-bold active:bg-gold/25 ${b.wide ? "max-w-40" : "max-w-24"}`}
              dangerouslySetInnerHTML={{ __html: b.label }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Keyframes the arcade needs, kept here so the games don't depend on globals.css.
const ARCADE_CSS = `
@keyframes arc-pop{50%{transform:scale(1.25)}}
@keyframes arc-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes arc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.arc-pop{animation:arc-pop .25s ease}
.arc-rise{animation:arc-rise .5s cubic-bezier(.2,.7,.2,1) both}
.arc-float{animation:arc-float 4s ease-in-out infinite}
.arc-gradient{background:linear-gradient(90deg,#fff4d6,#ffd166 45%,#ff8c42);-webkit-background-clip:text;background-clip:text;color:transparent}
`;

function Below({ children }: { children: React.ReactNode }) {
  return <div data-ui className="mt-4 flex w-full justify-center">{children}</div>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div data-ui className="absolute inset-0 grid place-items-center overflow-auto bg-ink/55 p-4 backdrop-blur-[6px]">{children}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm arc-rise rounded-3xl border border-line bg-gradient-to-b from-[#171634]/95 to-[#0c0c20]/95 p-6 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,.85)]">
      {children}
    </div>
  );
}

function PlayBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold via-amber to-[#ff6b3d] py-3.5 text-lg font-bold text-ink shadow-[0_12px_34px_-10px_rgba(255,159,28,.85)] transition hover:-translate-y-0.5"
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid size-10 place-items-center rounded-xl border border-white/15 bg-ink/60 text-white backdrop-blur transition hover:bg-ink/80">
      {children}
    </button>
  );
}
