import type { Metadata } from "next";
import { GoldRushHost } from "../gold-rush-host";

// ── wave-live ── Gold Rush Live projector screen (set up on /live/host/)
export const metadata: Metadata = { title: "Gold Rush Live Host", robots: { index: false } };

export default function GoldRushLiveHostPage() {
  return <GoldRushHost />;
}
