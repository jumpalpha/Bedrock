---
name: sync-from-doc
description: Update the Bedrock site from its master Claude Doc (the curriculum). Use when Orion says "sync Bedrock from the doc", "update the site from the doc", "I added something to the doc", "pull the new chapter/questions/words in", or anything similar about bringing doc changes onto bedrock.doppsclass.com.
---

# Sync Bedrock from the doc

The Bedrock Claude Doc is the master copy of all curriculum. This routine copies what changed in the doc onto the
site **without changing anything else**: existing ids, student progress, scores and cleared realms stay put.
Answer keys never go into the repo (it is public); they go only into the Supabase table `b_keys`.

Doc: Claude Doc id `cd567fb9-9731-4c26-af49-2478a5378a60` (body node `09414f50-1349`).
Database: Supabase project `gmeyamrlqfrabtslsweu` (Bedrock's `b_` tables).
Scratch folder below = this session's scratchpad (outside the repo). Call it `$SC`.

## 1. Read the doc and save the XML pages
1. Use the Claude Docs MCP `read` tool on the doc (view projection). The doc is long, so it comes back in pages:
   keep calling `read` with the returned `next` cursor until the page says `complete`. If a page has a `<gap …/>`
   inside a list, read that list too (the gap's `from` id) the same way.
2. Save each page's raw XML (the `xml` string, starting with `<doc …>`) verbatim to `$SC/doc/page01.xml`,
   `page02.xml`, … **in the order you read them**. Overlap between pages is fine (blocks dedupe by id); missing
   blocks are not, so make sure every gap got read.

## 2. Dry run and show Orion the report
1. Optional but recommended (exact answer-key changes, small SQL): run with Supabase `execute_sql`
   ```sql
   select jsonb_object_agg(id, left(md5(kind || '|' || ref || '|' || answer), 8)) as h from public.b_keys;
   ```
   and save the JSON object to `$SC/db-hashes.json`. It holds hashes only, no answers.
2. From the repo root:
   ```bash
   git pull
   node scripts/sync/sync.mjs --xml $SC/doc/page*.xml --work $SC/sync --db-hashes $SC/db-hashes.json
   ```
3. Show Orion the change report **as printed** (plain English), plus any ⚠ lines. Ask: "Apply these?"
   - If it says **SYNC STOPPED** because of doc problems: tell Orion exactly which item in the doc to fix
     (usually a question without exactly one `[A]`–`[D]`, or not 4 choices), have him fix the doc, and start over at step 1.
   - If it stops because things would be **REMOVED**: explain each one. A reworded question or renamed section shows
     up as removed + added (it gets a new id; past scores are unaffected). Only if Orion confirms, rerun with `--allow-removals`.
   - `ANSWER KEY CHANGED` lines: make sure Orion meant it (future attempts get graded with the new answer).

## 3. Apply (only after Orion says OK)
```bash
node scripts/sync/sync.mjs --xml $SC/doc/page*.xml --work $SC/sync --db-hashes $SC/db-hashes.json --apply   # same flags as the dry run
npm run build          # runs scripts/sync/check.mjs first: fails if anything key-like is in a public file
git status             # only src/data/content/*.json should have changed. NEVER add keys*.json or *.sql from $SC.
git add src/data/content && git commit -m "Sync curriculum from the Bedrock doc: <one-line summary>"
git push
```
Then confirm the deploy: the "Deploy to GitHub Pages" GitHub Action on `main` goes green, and the changed pages load
on https://bedrock.doppsclass.com (e.g. a new chapter at `/chapters/12a/`).

## 4. Load the answer keys (right after the deploy is live)
Run each file the apply printed (`$SC/sync/keys-to-load.sql`, or `keys-to-load.part1.sql`, `part2`, … in order) with
Supabase MCP `execute_sql` on project `gmeyamrlqfrabtslsweu`. Each returns `{added, changed, deleted}` ids; check
they match the report. Do this after the deploy, not before: until then the live site still shows the old question
list, and keys for questions it doesn't show would count against students' scores. Never commit, paste or print
these files; they contain the answers.

## 5. Wrap up with Orion
- Say what went live, in plain words (the report lines).
- **Review bank**: `src/data/content/review.json` is written by Claude, not the doc, and sync never touches it.
  For every chapter the report says changed text, re-read that chapter and update its review questions if they no
  longer match; for a new chapter (e.g. 12A), offer to write ~12 review questions in the same format
  (`scripts/check-review.mjs` validates it). Commit that separately.

## Good to know
- Additions never renumber anything. A new chapter that belongs between two others goes in the doc as
  "Chapter 12A: Title" placed inside its realm (after Chapter 12, before the next "Unit N:" line), with its own
  Question Banks section ("Chapter 12A: …"), Glossary section and Answer Keys entry. Its URL is `/chapters/12a/`.
- Question ids come from the question wording (`c03-<hash>`), so new questions never shift others.
- Students who already cleared a realm keep the badge and rank when a chapter is added to it (`b_cleared`); the new
  tasks just show as to-do and still give XP.
- Parse only: `node scripts/sync/parse-doc.mjs <pages> --out <dir outside repo> --prev src/data/content`.
- Test fixture: `node scripts/sync/test/make-fixture.mjs <pages> --out <dir>` adds a sample Chapter 12A etc.
