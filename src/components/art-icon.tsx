"use client";

import Image from "next/image";
import { useState } from "react";

export function ArtIcon({ slug, fallback, size, className = "" }: { slug?: string | null; fallback: string; size: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!slug || failed) {
    return <span className={className} style={{ fontSize: size * 0.55, lineHeight: 1 }}>{fallback}</span>;
  }
  return (
    <Image
      src={`/art/${slug}.png`}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      unoptimized
      onError={() => setFailed(true)}
      className={`object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)] ${className}`}
    />
  );
}
