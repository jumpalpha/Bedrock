"use client";

// ── wave-live ── arcade play-route entries (/arcade/play/<slug>/) for the cards that live on their own pages,
// so search results and older links land on the same game.
import type { ComponentType } from "react";
import { LivePlayerView } from "@/app/live/live-player";
import { PartnerGame } from "./partner-game";

const partner = (slug: string): ComponentType => {
  const C = () => <PartnerGame slug={slug} />;
  C.displayName = `Partner(${slug})`;
  return C;
};
export const liveArcadeComponents: Record<string, ComponentType> = {
  "partner-tic-tac-toe": partner("tic-tac-toe"),
  "partner-connect-4": partner("connect-4"),
  "partner-core-sample-hunt": partner("core-sample-hunt"),
  "partner-dots-and-boxes": partner("dots-and-boxes"),
  "live-games": LivePlayerView,
  "gold-rush-live": LivePlayerView,
};
