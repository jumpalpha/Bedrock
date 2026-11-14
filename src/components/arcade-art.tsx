"use client";

import Image from "next/image";
import { useState } from "react";

// Game cover from /art/game-<slug>.png, or the emoji until that file exists.
export function ArcadeArt({ slug, emoji, size }: { slug: string; emoji: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span style={{ fontSize: size * 0.55, lineHeight: 1 }} aria-hidden>{emoji}</span>;
  return (
    <Image
      src={`/art/game-${slug}.png`}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      onError={() => setFailed(true)}
      className="object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
    />
  );
}
