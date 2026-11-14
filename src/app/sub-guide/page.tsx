// ── wave-x7b ── Sub Guide: twin of Dopps Class sub_guide.html. A one-page printable guide for a substitute.
// Bedrock has no sub codes (Orion's decision): classroom games need no code, live games need the teacher code.
import type { Metadata } from "next";
import { arcadeGames } from "@/data/arcade";
import { PRINT_CSS } from "@/components/x7b/print-css";
import { SubFields, PrintButton } from "./sub-fields";

export const metadata: Metadata = { title: "Sub Guide", description: "Substitute teacher guide for Bedrock: what to put on the projector.", robots: { index: false } };

const SITE = "bedrock.doppsclass.com";
const pick = ["bedrock-jeopardy", "myth-busters", "would-you-rather", "escape-room", "millionaire", "earth-feud"];
const games = pick.map((s) => arcadeGames.find((g) => g.slug === s)).filter((g): g is NonNullable<typeof g> => !!g);

const CSS = `
.sg { max-width: 860px; margin: 0 auto; }
.sg-sheet { border: 1px solid var(--color-line); border-radius: 18px; padding: 26px; background: var(--panel); }
.sg h2 { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; margin: 0 0 6px; }
.sg ol { list-style: decimal; padding-left: 1.3rem; } .sg ul { list-style: disc; padding-left: 1.3rem; }
.sg li { margin: 3px 0; font-size: .92rem; line-height: 1.45; }
.sg .box { border: 1.5px solid var(--color-line); border-radius: 12px; padding: 12px 14px; break-inside: avoid; }
.sg .grid2 { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.sg kbd, .sg .url { font-family: var(--font-mono); font-weight: 700; overflow-wrap: anywhere; }
.sg input, .sg textarea { width: 100%; background: transparent; border: 0; border-bottom: 1.5px dashed var(--color-line); color: inherit; font: inherit; padding: 2px 0; }
.sg textarea { border: 1.5px dashed var(--color-line); border-radius: 8px; padding: 6px 8px; resize: vertical; }
@media print {
  .sg-sheet { border: 0; padding: 0; }
  .sg { max-width: none; font-size: 11.5px; }
  .sg li { font-size: 11.5px; margin: 1px 0; } .sg h2 { font-size: 13.5px; } .sg .box { padding: 8px 10px; }
  .sg input, .sg textarea { border-color: #999; }
  @page { size: letter portrait; margin: .45in; }
}` + PRINT_CSS;

export default function SubGuide() {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-28 sm:pt-32 print:!px-0 print:!pt-0">
      <style>{CSS}</style>
      <div className="no-print sg mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Fill in the boxes (optional), then print. Nothing you type is saved.</p>
        <PrintButton />
      </div>
      <article className="sg sg-sheet space-y-4" data-testid="sub-guide">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Mr. Dopp&apos;s Earth Science · {SITE}</div>
            <h1 className="font-display text-3xl font-extrabold">🌋 Sub Guide: Bedrock</h1>
          </div>
          <SubFields />
        </div>

        <div className="box">
          <h2>📝 Notes from Mr. Dopp</h2>
          <textarea rows={3} aria-label="Notes from Mr. Dopp" placeholder="Today's plan, which periods, anything special…" />
        </div>

        <div className="grid2">
          <div className="box">
            <h2>🎮 Classroom games (no code needed)</h2>
            <ol>
              <li>On the classroom computer, go to <span className="url">{SITE}/arcade/#classroom</span></li>
              <li>Under <b>Classroom Games</b>, pick one.</li>
              <li>Put that screen on the projector (press <kbd>F11</kbd> for full screen).</li>
              <li>Split the class into teams. The game keeps score.</li>
            </ol>
            <p className="mt-2 text-sm"><b>Good picks:</b> {games.map((g) => `${g.emoji} ${g.title}`).join(" · ")}</p>
          </div>
          <div className="box">
            <h2>📚 Reading day</h2>
            <ol>
              <li>Students go to <span className="url">{SITE}</span> and tap <b>Log in</b> (name, class period, 4-digit PIN).</li>
              <li>They open <b>My Quest</b> and do the next unchecked task: read the chapter, then take its quiz.</li>
              <li>Done early? Vocab Games, the Review Deck or Mastery Checks.</li>
            </ol>
          </div>
        </div>

        <div className="box">
          <h2>⚔️ Live class games (Pick a Side Live, Showdown, Realm Raid, Gold Rush Live)</h2>
          <p className="text-sm"><b>These need Mr. Dopp&apos;s teacher code to start. Bedrock has no sub codes</b>, so please use a classroom game above unless Mr. Dopp already started a live game for you.</p>
          <ul className="mt-1">
            <li>If a live game is already on the projector: students go to <span className="url">{SITE}/live/</span> and type the 6-digit code on the screen.</li>
            <li>Showdown and Realm Raid: after each question press <b>Next question</b>. Pick a Side Live: <b>Close voting</b>, let students discuss, then <b>Next question</b>.</li>
            <li>When you&apos;re done, press <b>End game</b>.</li>
          </ul>
        </div>

        <div className="grid2">
          <div className="box">
            <h2>⏱ Timed stations?</h2>
            <p className="text-sm">Open <span className="url">{SITE}/timer/</span> for a big projector timer with rounds and a countdown sound.</p>
          </div>
          <div className="box">
            <h2>🛠 If something goes wrong</h2>
            <ul>
              <li>Page froze? Refresh it. Games start over, nothing is lost from student accounts.</li>
              <li>Student forgot their PIN? Mr. Dopp can reset it. They can still read and play without logging in.</li>
              <li>No internet? Pages and games opened on this computer before still work from the saved copy.</li>
            </ul>
          </div>
        </div>

        <div className="box">
          <h2>✅ Good to know</h2>
          <ul>
            <li>Students may use phones only for the activity on the screen.</li>
            <li>Classroom games don&apos;t save anything and show no grades or student records.</li>
            <li>Pick a Side votes are anonymous on the screen.</li>
          </ul>
        </div>
        <p className="pt-1 text-center font-display text-lg font-extrabold">Thank you for covering my class! — Mr. Dopp</p>
      </article>
    </div>
  );
}
