import chaptersJson from "./content/chapters.json";
import realmsJson from "./content/realms.json";
import themeJson from "./content/theme.json";

export type Section = { heading: string; markdown: string; part?: string };
export type Chapter = {
  n: number; realm: number; title: string; sections: Section[];
  thinkLikeAScientist: { prompt: string; standards: string }; checklist: string[]; keyWords: string[];
};
export const chapters = chaptersJson as unknown as Chapter[];

// Biome look per realm: the doc gives names and badges, the block texture and color are the reskin.
const biome: Record<number, { tex: string; color: string; icon: string; biome: string }> = {
  1: { tex: "grass_top", color: "#5fa83a", icon: "🧭", biome: "Grassland" },
  2: { tex: "cobble", color: "#9ca3af", icon: "⛏️", biome: "Mine" },
  3: { tex: "sand", color: "#d4b25a", icon: "🪏", biome: "Badlands" },
  4: { tex: "lava", color: "#f97316", icon: "🌋", biome: "Magma Caves" },
  5: { tex: "water", color: "#3b82f6", icon: "🔱", biome: "Ocean" },
  6: { tex: "sky", color: "#38bdf8", icon: "⚡", biome: "Sky" },
  7: { tex: "dirt", color: "#b0793f", icon: "🦴", biome: "Fossil Cliffs" },
  8: { tex: "emerald_ore", color: "#10b981", icon: "💎", biome: "Ore Fields" },
  9: { tex: "obsidian", color: "#a78bfa", icon: "⭐", biome: "The Stars" },
};

export type Realm = {
  n: number; name: string; tagline: string; description: string; chapters: [number, number];
  badge: string; badgeEarnedBy: string; testTitle: string; tex: string; color: string; icon: string; biome: string;
};
export const realms: Realm[] = (realmsJson as unknown as Omit<Realm, "tex" | "color" | "icon" | "biome">[]).map((r) => ({ ...r, ...biome[r.n] }));
export const realmForChapter = (n: number) => realms.find((r) => n >= r.chapters[0] && n <= r.chapters[1])!;
export const chaptersIn = (r: Realm) => chapters.filter((c) => c.n >= r.chapters[0] && c.n <= r.chapters[1]);

// ── XP: same rules as Dopps Class ──
export const XP_PER_TASK = 25;
export const XP_PER_DAY = 5;
export const XP_PER_SIDE_QUEST = 50;
export const SIDE_QUESTS_PER_TERM = 3;

/** Every realm's task list. A realm's badge (and the next mining rank) unlocks when all are done. */
export type Task = { key: string; label: string; auto: boolean; href: string };
export function realmTasks(r: Realm): Task[] {
  const t: Task[] = [];
  for (const c of chaptersIn(r)) {
    t.push({ key: `ch${c.n}_read`, label: `Read Chapter ${c.n}: ${c.title}`, auto: false, href: `/chapters/${c.n}/` });
    t.push({ key: `ch${c.n}_quiz`, label: `Pass the Chapter ${c.n} quiz (80%+)`, auto: true, href: `/chapters/${c.n}/quiz/` });
    t.push({ key: `ch${c.n}_tls`, label: `Think Like a Scientist: Chapter ${c.n}`, auto: false, href: `/chapters/${c.n}/#think` });
  }
  t.push({ key: `unit${r.n}`, label: `${r.testTitle} (70%+)`, auto: true, href: `/tests/${r.n}/` });
  return t;
}
export const allTasks = realms.flatMap(realmTasks);

export type Rank = { order: number; name: string; flavor: string };
/** 10 ranks: Dirt Digger at spawn, then one step per realm cleared, Diamond for all nine (the Dopps Class model). */
export const ranks = (themeJson.ranks.list as { order: number; name: string; flavor: string }[]).map(({ order, name, flavor }) => ({ order, name, flavor }));
export const bonusBadges = themeJson.bonusBadges.list as { badge: string; earnedBy: string }[];
const rankTex = ["dirt", "cobble", "sand", "stone", "bedrock", "obsidian", "snow", "redstone_ore", "gold_ore", "diamond_ore"];
export const rankTexture = (i: number) => rankTex[Math.min(i, rankTex.length - 1)];

export type Progress = {
  tasks: string[]; days: string[]; firstTry?: Record<string, number>; best?: Record<string, number>;
  sideQuests?: { id: string; term: string; approved: boolean }[]; term?: string;
};
export function computeStats(p: Progress) {
  const done = new Set(p.tasks);
  const taskXp = allTasks.filter((t) => done.has(t.key)).length * XP_PER_TASK;
  const cleared = realms.filter((r) => realmTasks(r).every((t) => done.has(t.key)));
  const approved = (p.sideQuests ?? []).filter((q) => q.approved);
  const xp = taskXp + p.days.length * XP_PER_DAY + approved.length * XP_PER_SIDE_QUEST;
  const rankIndex = Math.min(cleared.length, ranks.length - 1);
  const tlsDone = chapters.filter((c) => done.has(`ch${c.n}_tls`)).length;
  const bonus: Record<string, boolean> = {
    "Scientist's Eye": tlsDone >= 10,
    "Perfect Strike": Object.values(p.firstTry ?? {}).some((v) => v === 100),
    "Field Geologist": approved.length >= 1,
    "Bedrock Legend": cleared.length === realms.length,
  };
  const termApproved = approved.filter((q) => q.term === p.term).length;
  const maxXp = allTasks.length * XP_PER_TASK;
  return { xp, maxXp, cleared, rank: ranks[rankIndex], next: ranks[rankIndex + 1] ?? null, rankIndex, bonus, termApproved, tlsDone, done };
}

export const daysOfYear = (d = new Date()) => Math.floor((+d - +new Date(d.getFullYear(), 0, 0)) / 864e5);
