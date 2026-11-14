# Bedrock: Earth Science

Mr. Dopp's Earth science class site, live at **https://bedrock.doppsclass.com**. A blocky survival-planet
version of [Dopps Class](https://doppsclass.com), built from the same Next.js source: same nav, XP rules,
badges and light/dark modes.

- 28 chapters in 9 realms, glossary (661 terms), 20-question chapter quizzes, 30-question unit tests
- Pick a Side debates, Survey of the Day, side quests, teacher dashboard
- Mining ranks: Dirt Digger at spawn, one rank per realm cleared, Diamond for all nine

## XP (same as Dopps Class)
25 XP per task, 5 XP per day logged in, 50 XP per approved side quest (3 required per term).
Each chapter has 3 tasks (read, quiz at 80%+, Think Like a Scientist) and each realm a unit test (70%+).

## Answer keys stay private
This repo is public, so it holds **no answer keys**. Keys live only in the Supabase table `b_keys` (Bedrock's `b_` tables share the dopp-health-class project because the free plan allows 2 projects; logins and data stay separate), which
the website can't read. Quizzes are graded by the database function `b_grade`, which returns right/wrong
per question and never the correct answer. Answer choices are stored in a scrambled order and shuffled
again in the browser on every attempt. Only the Teacher page (passcode) can show keys.

## Editing
- Content: `src/data/content/*.json` (from the Bedrock doc). Database: `supabase/schema.sql`.
- `npm run dev` to preview, `npm run build` to build the static site into `out/`.
- Pushing to `main` deploys through `.github/workflows/pages.yml`.

## Adding curriculum mid-term
The Bedrock Claude Doc is the master copy. To add something you left out:
1. Add it to the doc, in the same style as what's there. A missing chapter that belongs between two others is
   "Chapter 12A: Title", placed after Chapter 12 (inside its realm), with its own quiz questions, glossary words and
   Think Like a Scientist answer key in those sections of the doc. New questions go anywhere in a chapter's list.
2. Tell Claude: **"sync Bedrock from the doc"**.
3. Claude shows you a short list of what changed. Say OK, and it updates the site and the answer keys.

Nothing else moves: chapter numbers and links stay the same, students keep their progress and scores, and anyone who
already cleared a realm keeps the badge and rank. New chapters just add new tasks (and XP) to that realm.
Details for Claude: `.claude/skills/sync-from-doc/SKILL.md` and `scripts/sync/`.
