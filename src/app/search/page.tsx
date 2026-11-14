import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { chapters, realmChapterLabel, realms } from "@/data/site";
import { arcadeGames } from "@/data/arcade";
import { classicGames } from "@/data/arcade-classic";
import glossary from "@/data/content/glossary.json";
import { vocabModes } from "@/data/learn";
import { SiteSearch, type Hit } from "./site-search";

// ── wave-learnA: Search (port of Dopps Class search.html) ──
export const metadata: Metadata = { title: "Search", description: "Search every chapter, key word, realm, game and page on Bedrock." };

const pages: Hit[] = [
  { type: "Page", icon: "🗺️", title: "World Map", desc: "Start here: the realms, your player card and the arcade.", url: "/" },
  { type: "Page", icon: "📖", title: "All Chapters", desc: "Every chapter, grouped by realm.", url: "/chapters/" },
  { type: "Page", icon: "🎮", title: "Sprite Arcade", desc: "Every Earth science game in one place.", url: "/arcade/" },
  { type: "Page", icon: "📋", title: "My Quest", desc: "Log in to see your XP, mining rank, badges and checklist.", url: "/quest/" },
  { type: "Page", icon: "⚔️", title: "Unit Tests", desc: "One test per realm. Pass to clear the realm.", url: "/tests/" },
  { type: "Page", icon: "🗳️", title: "Pick a Side", desc: "Earth science debates: pick a side and bring evidence.", url: "/pick-a-side/" },
  { type: "Page", icon: "📊", title: "Survey of the Day", desc: "Vote, then see how the class answered.", url: "/survey/" },
  { type: "Page", icon: "🔭", title: "Side Quests", desc: "Real science outside class for bonus XP.", url: "/side-quests/" },
  { type: "Page", icon: "📚", title: "Glossary", desc: "Every key word with its definition.", url: "/glossary/" },
  { type: "Page", icon: "🔤", title: "Vocab Games", desc: "Flashcard Flip, Speed Quiz, Word Builder and Concept Map for every chapter.", url: "/vocab/" },
  { type: "Page", icon: "🃏", title: "Review Deck", desc: "Practice the Quick Check questions you missed in the chapters.", url: "/review/" },
  { type: "Page", icon: "🎓", title: "Mastery Checks", desc: "A 10-question warm-up for each chapter before the graded quiz.", url: "/mastery/" },
  { type: "Page", icon: "🧑‍🏫", title: "Teacher Dashboard", desc: "Class roster, progress and side quest approvals.", url: "/teacher/" },
];

function buildIndex(): Hit[] {
  const out: Hit[] = [];
  for (const r of realms) out.push({ type: "Realm", icon: r.icon, title: `Realm ${r.n}: ${r.name}`, desc: `${r.tagline} Chapters ${realmChapterLabel(r)}.`, url: `/realms/${r.n}/` });
  for (const c of chapters) {
    out.push({ type: "Chapter", icon: "📘", title: `Chapter ${c.label}: ${c.title}`, desc: c.sections.map((s) => s.heading).join(" · "), url: `/chapters/${c.id}/`, keys: c.keyWords.join(" ") });
    out.push({ type: "Page", icon: "🔤", title: `Chapter ${c.label} vocab games`, desc: vocabModes.map((m) => m.title).join(", ") + ` for ${c.title}.`, url: `/vocab/?ch=${c.id}` });
  }
  for (const g of glossary as { term: string; definition: string; chapter: number | string }[])
    out.push({ type: "Word", icon: "🔑", title: g.term, desc: `${g.definition} (Chapter ${String(g.chapter).toUpperCase()})`, url: `/glossary/?q=${encodeURIComponent(g.term)}` });
  for (const g of arcadeGames) out.push({ type: "Game", icon: g.emoji, title: g.title, desc: g.subtitle, url: `/arcade/play/${g.slug}/` });
  for (const g of classicGames) out.push({ type: "Game", icon: g.emoji, title: g.title, desc: g.subtitle, url: g.href });
  return [...out, ...pages];
}

export default function SearchPage() {
  const index = buildIndex();
  return (
    <>
      <PageHead eyebrow="Search everything" title="Find anything, fast"
        sub={`Search all ${chapters.length} chapters, ${realms.length} realms, ${glossary.length} key words and ${arcadeGames.length + classicGames.length} games in one place.`} />
      <SiteSearch index={index} />
    </>
  );
}
