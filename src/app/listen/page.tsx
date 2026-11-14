import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { ListenClient } from "./listen-client";

// ── wave-x7a ── twin of Dopps Class listen.html + listen-core.js.
// Dopps plays pre-made chapter MP3s. Bedrock has none yet, so every chapter is read aloud by the
// device's voice from chapters.json. To use a real recording instead, drop it in public/audio/ as
// ch<id>.mp3 (ch1.mp3, ch01.mp3 and ch12a.mp3 all work) and rebuild: it is picked up here at build time.
export const metadata: Metadata = {
  title: "Listen",
  description: "Every Bedrock chapter read aloud. Play, pause, change speed, jump to a section, and let the next chapter start on its own. Finish a realm to earn its listener badge.",
};

function audioFiles(): Record<string, string> {
  const dir = path.join(process.cwd(), "public", "audio");
  const out: Record<string, string> = {};
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^ch0*(\d+[a-z]?)\.(mp3|m4a|ogg)$/i);
      if (m) out[m[1].toLowerCase()] = `/audio/${f}`;
    }
  } catch { /* no public/audio yet: everything uses the device voice */ }
  return out;
}

export default function ListenPage() {
  return (
    <>
      <PageHead eyebrow="Listen · Every chapter, read aloud" title="📻 Listen"
        art={{ slug: "link-listen", fallback: "🎧" }}
        sub="Every chapter in one place. Play it on the bus, at practice, or while you do chores. Finish a whole realm to earn its listener badge." />
      <ListenClient audio={audioFiles()} />
    </>
  );
}
