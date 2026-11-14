-- Bedrock database: its own b_ tables and logins, living in the dopp-health-class Supabase project
-- (the free plan allows only 2 projects). Nothing here touches Dopps Class tables or functions.
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.
--
-- Privacy model:
--   * Every table has Row Level Security ON and NO policies, so the public (anon) key can't read or
--     write any table directly. All access goes through the security-definer functions below.
--   * Answer keys live only in b_keys. They are loaded straight into the database, never committed to
--     the public GitHub repo. Students get right/wrong per question, never the correct answer.
--     Only b_teacher_keys (teacher passcode) returns keys.
--   * Student PINs arrive as a SHA-256 hash made in the browser (same scheme as Dopps Class).


create table if not exists public.b_students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period text not null,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  unique (period, name)
);
create table if not exists public.b_tasks (
  student_id uuid references public.b_students on delete cascade,
  task_key text not null,
  done_at timestamptz not null default now(),
  primary key (student_id, task_key)
);
create table if not exists public.b_days (
  student_id uuid references public.b_students on delete cascade,
  day date not null,
  primary key (student_id, day)
);
create table if not exists public.b_keys (
  id text primary key,                -- c01-<hash> (chapter bank), u1-<hash> (unit test), tls-01 / tls-12a (Think Like a Scientist),
                                      -- cw01-<hash> (Classwork think-it-through questions)
  kind text not null check (kind in ('chapter', 'unit', 'tls', 'cw')),
  ref int not null,                   -- chapter number or realm number; bonus chapters: 1201 = 12a, 1202 = 12b
  answer text not null                -- the exact correct choice text (tls: the model answer)
);
create table if not exists public.b_attempts (
  id bigserial primary key,
  student_id uuid references public.b_students on delete cascade,
  kind text not null,                 -- 'chapter' | 'unit'
  ref int not null,
  score int not null,
  total int not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.b_votes (
  student_id uuid references public.b_students on delete cascade,
  kind text not null check (kind in ('survey', 'debate')),
  item_id text not null,
  choice text not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (student_id, kind, item_id)
);
create table if not exists public.b_side_quests (
  student_id uuid references public.b_students on delete cascade,
  quest_id text not null,
  term text not null,
  note text,
  approved boolean not null default false,
  submitted_at timestamptz not null default now(),
  primary key (student_id, quest_id)
);
-- Realm clears, recorded once and kept even if the realm gets new chapters later (see b_claim_realm).
create table if not exists public.b_cleared (
  student_id uuid references public.b_students on delete cascade,
  realm int not null,
  cleared_at timestamptz not null default now(),
  primary key (student_id, realm)
);
create table if not exists public.b_settings (
  k text primary key,
  v text not null
);

alter table public.b_students enable row level security;
alter table public.b_tasks enable row level security;
alter table public.b_days enable row level security;
alter table public.b_keys enable row level security;
alter table public.b_attempts enable row level security;
alter table public.b_votes enable row level security;
alter table public.b_side_quests enable row level security;
alter table public.b_settings enable row level security;
alter table public.b_cleared enable row level security;
revoke all on public.b_students, public.b_tasks, public.b_days, public.b_keys, public.b_attempts,
  public.b_votes, public.b_side_quests, public.b_settings, public.b_cleared from anon, authenticated;

-- Rules the teacher can change later: update public.b_settings set v = '…' where k = '…';
insert into public.b_settings (k, v) values
  ('term', '2026-T2'),
  ('chapter_pass_pct', '80'),       -- chapter quiz score that checks off the quiz task
  ('unit_pass_pct', '70'),          -- unit test score that checks off the unit test task
  ('unit_attempts', '2')            -- tries per unit test; the best score counts
on conflict (k) do nothing;

create or replace function public._b_set(p_k text) returns text language sql stable security definer set search_path = public as $$
  select v from public.b_settings where k = p_k $$;

create or replace function public._b_ok(p_id uuid, p_pin_hash text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.b_students where id = p_id and pin_hash = p_pin_hash) $$;

-- Teacher check = the Dopps Class teacher code (same database). p_pass_hash carries the typed code.
create or replace function public._b_teacher(p_pass_hash text) returns boolean
language sql stable security definer set search_path = public as $$
  select public._teacher_ok(p_pass_hash) $$;

create or replace function public._b_today() returns date language sql stable set search_path = public as $$
  select (now() at time zone 'America/Denver')::date $$;

-- ── Students ──
create or replace function public.b_register(p_name text, p_period text, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
begin
  if length(v_name) < 2 or length(v_name) > 40 then raise exception 'Name must be 2 to 40 characters'; end if;
  if exists (select 1 from public.b_students where period = p_period and lower(name) = lower(v_name)) then
    raise exception 'That name is already taken in this class. Log in instead, or add your last initial.';
  end if;
  insert into public.b_students (name, period, pin_hash) values (v_name, p_period, p_pin_hash) returning id into v_id;
  return jsonb_build_object('id', v_id, 'name', v_name, 'period', p_period);
end $$;

create or replace function public.b_login(p_name text, p_period text, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.b_students;
begin
  select * into s from public.b_students where period = p_period and lower(name) = lower(btrim(p_name));
  if s.id is null or s.pin_hash <> p_pin_hash then raise exception 'Name or PIN does not match'; end if;
  return jsonb_build_object('id', s.id, 'name', s.name, 'period', s.period);
end $$;

-- Everything the Quest page needs. Also counts today as an active day (+5 XP, like Dopps Class).
create or replace function public.b_state(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  insert into public.b_days values (p_id, public._b_today()) on conflict do nothing;
  return jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(task_key) from public.b_tasks where student_id = p_id), '[]'),
    'days', coalesce((select jsonb_agg(day order by day) from public.b_days where student_id = p_id), '[]'),
    'best', coalesce((select jsonb_object_agg(kind || ref, best) from (
               select kind, ref, max(round(100.0 * score / total))::int best from public.b_attempts
               where student_id = p_id group by kind, ref) b), '{}'),
    'firstTry', coalesce((select jsonb_object_agg(ref, pct) from (
               select distinct on (ref) ref, round(100.0 * score / total)::int pct from public.b_attempts
               where student_id = p_id and kind = 'chapter' order by ref, created_at) f), '{}'),
    'unitTries', coalesce((select jsonb_object_agg(ref, n) from (
               select ref, count(*) n from public.b_attempts where student_id = p_id and kind = 'unit' group by ref) u), '{}'),
    'sideQuests', coalesce((select jsonb_agg(jsonb_build_object('id', quest_id, 'term', term, 'approved', approved))
               from public.b_side_quests where student_id = p_id), '[]'),
    'votes', (select count(*) from public.b_votes where student_id = p_id and kind = 'survey'),
    'cleared', coalesce((select jsonb_agg(realm order by realm) from public.b_cleared where student_id = p_id), '[]'),
    'term', public._b_set('term'),
    'unitAttempts', public._b_set('unit_attempts')::int
  );
end $$;

-- Self-checked tasks (reading, Think Like a Scientist). Quiz and test tasks are only set by b_grade.
create or replace function public.b_complete_task(p_id uuid, p_pin_hash text, p_task_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_task_key !~ '^ch\d+[a-z]?_(read|tls)$' then raise exception 'That task is checked off by passing its quiz or test'; end if;
  insert into public.b_tasks (student_id, task_key) values (p_id, p_task_key) on conflict do nothing;
end $$;

-- Grades a chapter quiz or unit test. p_answers = {"c01-03": "chosen choice text", …}.
-- Choices are shuffled in the browser, so grading is by choice text, never by letter.
-- Returns the score and right/wrong per question. Never returns the correct answer.
create or replace function public.b_grade(p_id uuid, p_pin_hash text, p_kind text, p_ref int, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare total int; right_n int; results jsonb; pct int; tries int; passed boolean;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_kind not in ('chapter', 'unit') then raise exception 'Unknown quiz'; end if;
  if p_kind = 'unit' then
    select count(*) into tries from public.b_attempts where student_id = p_id and kind = 'unit' and ref = p_ref;
    if tries >= public._b_set('unit_attempts')::int then raise exception 'You have used all your tries on this unit test'; end if;
  end if;
  select count(*), count(*) filter (where lower(btrim(p_answers ->> k.id)) = lower(btrim(k.answer))),
         jsonb_object_agg(k.id, lower(btrim(coalesce(p_answers ->> k.id, ''))) = lower(btrim(k.answer)))
    into total, right_n, results
    from public.b_keys k where k.kind = p_kind and k.ref = p_ref;
  if total = 0 then raise exception 'This quiz is not loaded yet'; end if;
  insert into public.b_attempts (student_id, kind, ref, score, total, answers) values (p_id, p_kind, p_ref, right_n, total, p_answers);
  pct := round(100.0 * right_n / total);
  passed := pct >= public._b_set(case p_kind when 'chapter' then 'chapter_pass_pct' else 'unit_pass_pct' end)::int;
  if passed then
    insert into public.b_tasks (student_id, task_key)
      values (p_id, case p_kind when 'chapter' then public._b_ch(p_ref) || '_quiz' else 'unit' || p_ref end)
      on conflict do nothing;
  end if;
  return jsonb_build_object('score', right_n, 'total', total, 'pct', pct, 'passed', passed, 'results', results);
end $$;

-- ── Realm clears: earned stays earned ──
-- Chapter ref (12, 1201) → task key prefix (ch12, ch12a).
create or replace function public._b_ch(p_ref int) returns text language sql immutable set search_path = public as $$
  select 'ch' || case when p_ref >= 100 then (p_ref / 100)::text || chr(96 + p_ref % 100) else p_ref::text end $$;

create or replace function public.b_claim_realm(p_id uuid, p_pin_hash text, p_realm int, p_task_keys text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; unit_key text := 'unit' || p_realm;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_realm is null or p_realm < 1 or p_realm > 99 then raise exception 'Unknown realm'; end if;
  if p_task_keys is null or not (unit_key = any(p_task_keys)) then raise exception 'The task list must include the unit test'; end if;
  if not exists (select 1 from unnest(p_task_keys) t where t ~ '^ch\d+[a-z]?_quiz$') then raise exception 'The task list must include chapter quizzes'; end if;
  foreach k in array p_task_keys loop
    if k !~ '^(ch\d+[a-z]?_(read|quiz|tls)|unit\d+)$' then raise exception 'Unknown task %', k; end if;
    if not exists (select 1 from public.b_tasks where student_id = p_id and task_key = k) then
      raise exception 'Not cleared yet: % is not done', k;
    end if;
  end loop;
  insert into public.b_cleared (student_id, realm) values (p_id, p_realm) on conflict do nothing;
  return coalesce((select jsonb_agg(realm order by realm) from public.b_cleared where student_id = p_id), '[]');
end $$;

-- ── Survey of the Day and Pick a Side ──
create or replace function public.b_vote(p_id uuid, p_pin_hash text, p_kind text, p_item text, p_choice text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  insert into public.b_votes (student_id, kind, item_id, choice, reason) values (p_id, p_kind, p_item, left(p_choice, 200), left(p_reason, 1000))
    on conflict (student_id, kind, item_id) do update set choice = excluded.choice, reason = excluded.reason, created_at = now();
  return public.b_results(p_kind, p_item);
end $$;

create or replace function public.b_results(p_kind text, p_item text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(choice, n), '{}') from (
    select choice, count(*) n from public.b_votes where kind = p_kind and item_id = p_item group by choice) t $$;

-- ── Side quests: students submit, the teacher approves (+50 XP each on the Quest page) ──
create or replace function public.b_side_quest_submit(p_id uuid, p_pin_hash text, p_quest text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  insert into public.b_side_quests (student_id, quest_id, term, note) values (p_id, p_quest, public._b_set('term'), left(p_note, 2000))
    on conflict (student_id, quest_id) do update set note = excluded.note, submitted_at = now();
end $$;

-- ── Teacher functions: unlocked by the Dopps Class teacher code (see _b_teacher above).

create or replace function public.b_teacher_check(p_pass_hash text) returns boolean
language sql stable security definer set search_path = public as $$ select public._b_teacher(p_pass_hash) $$;

create or replace function public.b_teacher_keys(p_pass_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select jsonb_object_agg(id, answer) from public.b_keys);
end $$;

create or replace function public.b_teacher_roster(p_pass_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'period', s.period,
      'tasks', (select coalesce(jsonb_agg(task_key), '[]') from public.b_tasks t where t.student_id = s.id),
      'days', (select count(*) from public.b_days d where d.student_id = s.id),
      'best', (select coalesce(jsonb_object_agg(kind || ref, best), '{}') from (
                 select kind, ref, max(round(100.0 * score / total))::int best from public.b_attempts a
                 where a.student_id = s.id group by kind, ref) b),
      'sideQuests', (select coalesce(jsonb_agg(jsonb_build_object('id', quest_id, 'term', term, 'note', note, 'approved', approved)), '[]')
                 from public.b_side_quests q where q.student_id = s.id),
      'cleared', (select coalesce(jsonb_agg(realm order by realm), '[]') from public.b_cleared c where c.student_id = s.id)
    ) order by s.period, s.name) from public.b_students s), '[]');
end $$;

create or replace function public.b_teacher_approve(p_pass_hash text, p_student uuid, p_quest text, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  update public.b_side_quests set approved = p_ok where student_id = p_student and quest_id = p_quest;
end $$;

create or replace function public.b_teacher_reset_pin(p_pass_hash text, p_student uuid, p_pin_hash text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  update public.b_students set pin_hash = p_pin_hash where id = p_student;
end $$;

-- Only the functions are callable from the website. Internal helpers stay locked.
-- Scoped to Bedrock's own functions, so this file is also safe to run in a database shared with Dopps Class.
revoke execute on function public._b_set, public._b_ok, public._b_teacher, public._b_today, public._b_ch, public.b_claim_realm,
  public.b_register, public.b_login, public.b_state, public.b_complete_task, public.b_grade, public.b_vote,
  public.b_results, public.b_side_quest_submit, public.b_teacher_check, public.b_teacher_keys,
  public.b_teacher_roster, public.b_teacher_approve, public.b_teacher_reset_pin from public, anon, authenticated;
grant execute on function public.b_register, public.b_login, public.b_state, public.b_complete_task, public.b_grade, public.b_claim_realm,
  public.b_vote, public.b_results, public.b_side_quest_submit, public.b_teacher_check,
  public.b_teacher_keys, public.b_teacher_roster, public.b_teacher_approve, public.b_teacher_reset_pin to anon;

-- ── wave-learnB: Classwork + Reflection Coach (same as supabase/migrations/004_classwork_reflection.sql) ──
-- The Classwork word list is data, not schema: load it with  node scripts/classwork/terms-sql.mjs  (004 already includes it).

-- ════════════════════════════════════════════════════════════════════
-- Classwork (classwork pages: /classwork/ and /classwork/<realm>/)
-- Per realm (= a Dopps Class unit), per chapter:
--   1. Learn (graded here): match every chapter word to a definition from one shared list (the chapter's own
--      plus a few from nearby chapters). 80% best opens the next chapter. Grade = average of all tries.
--   2. Practice: flashcards + matching (page only, no points).
--   3. Chapter Test (graded here): 20 questions, about 8 think-it-through + 12 recall. Best kept, no pass mark.
--   4. Real-world stories: 3 short true stories, 2 chapter words each, 25+ words, scored here by a fixed rubric.
-- Then the Unit Test (graded here, 20 questions across the realm, 80% to pass, best kept, its own grade)
-- and Turn In: Classwork score = (Learn average + story average) / 2, 70% minimum. 15-minute cooldown between tries.
-- ════════════════════════════════════════════════════════════════════

alter table public.b_keys drop constraint if exists b_keys_kind_check;
alter table public.b_keys add constraint b_keys_kind_check check (kind in ('chapter', 'unit', 'tls', 'cw'));

create table if not exists public.b_cw_terms (
  ref      int  not null,              -- chapter ref (12, or 1201 for 12A)
  realm    int  not null,
  n        int  not null,              -- position in the chapter's word list
  term     text not null,
  def      text not null,
  story_ok boolean not null default true,   -- false = in Learn/Practice/tests, but not offered for stories
  primary key (ref, n)
);
create index if not exists b_cw_terms_realm on public.b_cw_terms (realm);

create table if not exists public.b_cw_work (
  student_id   uuid not null references public.b_students on delete cascade,
  realm        int  not null check (realm between 1 and 99),
  learn_best   jsonb not null default '{}',   -- ref -> best %
  learn_tries  jsonb not null default '{}',   -- ref -> tries
  learn_sum    jsonb not null default '{}',   -- ref -> sum of all scores
  learn_grade  jsonb not null default '{}',   -- ref -> average of all tries
  learn_key    jsonb,                         -- the open Learn: {ref, words:[term], defs:[[ref, term]]} (never sent to the page)
  ch_test      jsonb not null default '{}',   -- ref -> {best, tries}
  test_key     jsonb,                         -- the open test: {kind:'ch'|'unit', ref, ids:[]}
  ch_stories   jsonb not null default '{}',   -- ref -> [story|null, story|null, story|null]
  story_open   jsonb not null default '{}',   -- "ref:slot" -> first time the writing box opened
  swapped      jsonb not null default '[]',   -- [{term, ref, reason, at}]  ("no story for this word")
  unit_best    int  not null default 0,
  unit_tries   int  not null default 0,
  last_try     jsonb not null default '{}',   -- L<ref> / T<ref> / U -> time of the last try (cooldown)
  status       text not null default 'draft' check (status in ('draft', 'submitted')),
  learn_avg    int,
  story_avg    int,
  final_score  int,
  submitted_at timestamptz,
  returned_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (student_id, realm)
);

alter table public.b_cw_terms enable row level security;
alter table public.b_cw_work enable row level security;
revoke all on public.b_cw_terms, public.b_cw_work from anon, authenticated;

-- 'true' = every student can use Classwork. 'false' = hidden ("Coming soon"); the teacher dashboard flips it.
insert into public.b_settings (k, v) values ('classwork_live', 'false') on conflict (k) do nothing;

-- ---------- rules (the page uses the same numbers) ----------
create or replace function public._b_cw_rule(k text) returns int language sql immutable set search_path = public as $$
  select case k when 'quiz_n' then 20 when 'reason_n' then 8 when 'learn_pass' then 80 when 'unit_pass' then 80
                when 'min_final' then 70 when 'min_words' then 25 when 'stories' then 3 when 'swaps' then 1
                when 'min_seconds' then 45 when 'extra_defs' then 6 when 'cooldown' then 900 end $$;

-- chapter ref → reading order (12 → 12, 1201 → 12.01), so bonus chapters sit after the chapter they follow
create or replace function public._b_cw_ord(p_ref int) returns numeric language sql immutable set search_path = public as $$
  select case when p_ref >= 100 then (p_ref / 100) + (p_ref % 100) / 100.0 else p_ref end $$;

create or replace function public._b_cw_live() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public._b_set('classwork_live'), 'false') = 'true' $$;

create or replace function public._b_cw_check(p_id uuid, p_pin_hash text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if not public._b_cw_live() then raise exception 'Classwork is not open yet'; end if;
end $$;

create or replace function public._b_cw_chapters(p_realm int) returns int[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(ref order by public._b_cw_ord(ref)), '{}') from (select distinct ref from public.b_cw_terms where realm = p_realm) c $$;

create or replace function public._b_cw_okwords(p_ref int) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.b_cw_terms where ref = p_ref and story_ok $$;

-- 3 stories per chapter, fewer when a chapter has too few story words (each story needs 2 new ones)
create or replace function public._b_cw_need(p_ref int) returns int language sql stable security definer set search_path = public as $$
  select least(public._b_cw_rule('stories'), public._b_cw_okwords(p_ref) / 2) $$;

-- the "no story for this word" swap is offered only when the chapter has a spare story word
create or replace function public._b_cw_swap_max(p_ref int) returns int language sql stable security definer set search_path = public as $$
  select case when public._b_cw_okwords(p_ref) - 2 * public._b_cw_need(p_ref) >= 1 then public._b_cw_rule('swaps') else 0 end $$;

-- story average across the realm (null until every chapter has all its stories)
create or replace function public._b_cw_story_avg(p_realm int, p_ch jsonb) returns int language sql stable security definer set search_path = public as $$
  select case when (select coalesce(bool_and((select count(*) from jsonb_array_elements(coalesce(p_ch -> (c::text), '[]')) e
                                              where jsonb_typeof(e) = 'object') >= public._b_cw_need(c)), false)
                      from unnest(public._b_cw_chapters(p_realm)) c)
              then round((select avg((e -> 'score' ->> 'total')::numeric)
                            from unnest(public._b_cw_chapters(p_realm)) c, jsonb_array_elements(coalesce(p_ch -> (c::text), '[]')) e
                           where jsonb_typeof(e) = 'object'))::int end $$;

create or replace function public._b_cw_learn_avg(p_realm int, p_lg jsonb) returns int language sql stable security definer set search_path = public as $$
  select round(avg(coalesce((p_lg ->> (c::text))::numeric, 0)))::int from unnest(public._b_cw_chapters(p_realm)) c $$;

create or replace function public._b_cw_learn_ok(p_lb jsonb, p_ref int) returns boolean language sql immutable set search_path = public as $$
  select coalesce((p_lb ->> (p_ref::text))::int, 0) >= public._b_cw_rule('learn_pass') $$;

create or replace function public._b_cw_all_learned(p_realm int, p_lb jsonb) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(bool_and(public._b_cw_learn_ok(p_lb, c)), false) from unnest(public._b_cw_chapters(p_realm)) c $$;

-- a chapter is open when every earlier chapter in the realm has Learn passed
create or replace function public._b_cw_ch_open(p_realm int, p_lb jsonb, p_ref int) returns boolean language sql stable security definer set search_path = public as $$
  select p_ref = any(public._b_cw_chapters(p_realm))
     and coalesce((select bool_and(public._b_cw_learn_ok(p_lb, c)) from unnest(public._b_cw_chapters(p_realm)) c
                    where public._b_cw_ord(c) < public._b_cw_ord(p_ref)), true) $$;

-- seconds left before this kind of try can start again (0 = go)
create or replace function public._b_cw_wait(p_last jsonb, p_key text) returns int language sql stable set search_path = public as $$
  select case when p_last ? p_key
              then greatest(0, ceil(public._b_cw_rule('cooldown') - extract(epoch from now() - (p_last ->> p_key)::timestamptz)))::int
              else 0 end $$;

create or replace function public._b_cw_row(p_id uuid, p_realm int) returns public.b_cw_work
language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work;
begin
  if not exists (select 1 from public.b_cw_terms where realm = p_realm) then raise exception 'No classwork for that realm yet'; end if;
  insert into public.b_cw_work (student_id, realm) values (p_id, p_realm) on conflict do nothing;
  select * into r from public.b_cw_work where student_id = p_id and realm = p_realm for update;
  return r;
end $$;

-- What the page sees. Never includes learn_key or test_key (the open answer keys).
create or replace function public._b_cw_view(r public.b_cw_work) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('realm', r.realm, 'status', r.status, 'submitted_at', r.submitted_at, 'returned_at', r.returned_at,
    'learn_best', r.learn_best, 'learn_tries', r.learn_tries, 'learn_grade', r.learn_grade, 'ch_test', r.ch_test,
    'ch_stories', r.ch_stories, 'swapped', r.swapped, 'story_open', r.story_open, 'unit_best', r.unit_best, 'unit_tries', r.unit_tries,
    'learn_avg', public._b_cw_learn_avg(r.realm, r.learn_grade), 'story_avg', public._b_cw_story_avg(r.realm, r.ch_stories),
    'final_score', case when r.status = 'submitted' then r.final_score
                        when public._b_cw_story_avg(r.realm, r.ch_stories) is not null
                        then round((public._b_cw_learn_avg(r.realm, r.learn_grade) + public._b_cw_story_avg(r.realm, r.ch_stories)) / 2.0)::int end,
    'chapters', to_jsonb(public._b_cw_chapters(r.realm)),
    'need', (select coalesce(jsonb_object_agg(c::text, public._b_cw_need(c)), '{}') from unnest(public._b_cw_chapters(r.realm)) c),
    'swap_max', (select coalesce(jsonb_object_agg(c::text, public._b_cw_swap_max(c)), '{}') from unnest(public._b_cw_chapters(r.realm)) c),
    'last_try', r.last_try, 'cooldown', public._b_cw_rule('cooldown'), 'now', now(),
    'learn_open', r.learn_key ->> 'ref', 'test_open', r.test_key ->> 'kind') $$;

-- ---------- story scoring (src/app/classwork/rubric.ts has the same rules for live feedback) ----------
-- regex for one term: case-insensitive, "-" and " " interchangeable, simple endings on the last word,
-- "a/b c" also accepts "a c" and "b c", "(XYZ)" also accepts XYZ by itself.
create or replace function public._b_cw_term_rx(p_term text) returns text language plpgsql immutable set search_path = public as $$
declare base text; abbr text; alts text[] := '{}'; v text; parts text[]; i int; rx text := ''; one text;
begin
  abbr := substring(p_term from '\(([^)]+)\)');
  base := btrim(regexp_replace(p_term, '\s*\([^)]*\)', '', 'g'));
  alts := array_append(alts, base);
  if base ~ '/' then
    parts := regexp_split_to_array(split_part(base, ' ', 1), '/');
    for i in 1 .. coalesce(array_length(parts, 1), 0) loop
      alts := array_append(alts, btrim(parts[i] || ' ' || substring(base from position(' ' in base) + 1)));
    end loop;
    if position(' ' in base) = 0 then alts := parts; end if;
  end if;
  if abbr is not null then alts := array_append(alts, regexp_replace(abbr, 's$', '')); end if;
  foreach v in array alts loop
    v := lower(btrim(v));
    if v = '' then continue; end if;
    one := regexp_replace(v, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g');
    one := regexp_replace(one, '[- ]+', '[- ]?', 'g');
    if one ~ '[a-z]$' then
      one := '(' || one || '|' || regexp_replace(one, '[ey]$', '') || '|' || regexp_replace(one, '(e?s)$', '') || ')(s|es|e|ed|d|ing|ies|ly|ness)?';
    end if;
    rx := rx || case when rx = '' then '' else '|' end || one;
  end loop;
  return '(^|[^a-z0-9])(' || rx || ')($|[^a-z0-9])';
end $$;

-- a real detail: who was there, where it happened, or when
create or replace function public._b_cw_cue(p_text text) returns boolean language sql immutable set search_path = public as $$
  select lower(coalesce(p_text, '')) ~ (
    '\m(my|our) (mom|dad|mother|father|parents?|brothers?|sisters?|siblings?|friends?|best friend|grandma|grandpa|grandmother|grandfather|grandparents?|coach|teacher|cousins?|aunt|uncle|family|team|teammates?|boss|neighbors?|dog|cat|class|troop)\M'
    || '|\m(at|in|on|near|by) (the|my|our|a) [a-z]+'
    || '|\m(home|school|practice|church|work|park|store|gym|field|class|game|camp|camping|vacation|trip|hike|hiking|trail|river|lake|creek|mountains?|canyon|desert|beach|cave|farm|ranch|backyard|yard|cabin|road|highway|boise|idaho|yellowstone|news)\M'
    || '|\m(yesterday|today|tonight|ago|once|weekend|morning|afternoon|evening|night|summer|winter|spring|fall|birthday|christmas|thanksgiving|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\M'
    || '|\mlast (week|year|month|night|time)\M|\mwhen i was\M|\myears? old\M|\m[0-9]{1,2}(st|nd|rd|th)? grade\M|\m(19|20)[0-9]{2}\M') $$;

create or replace function public._b_cw_story_score(p_text text, p_a text, p_b text) returns jsonb language plpgsql immutable set search_path = public as $$
declare t text := coalesce(p_text, ''); w int; s int; ha boolean; hb boolean; cue boolean; len int; used int; detail int;
begin
  w := (select count(*) from regexp_split_to_table(btrim(t), '\s+') x where x ~ '[A-Za-z]');
  s := (select count(*) from regexp_split_to_table(t, '[.!?]+') seg
         where (select count(*) from regexp_split_to_table(btrim(seg), '\s+') x where x ~ '[A-Za-z]') >= 3);
  ha := lower(t) ~ public._b_cw_term_rx(p_a);
  hb := lower(t) ~ public._b_cw_term_rx(p_b);
  cue := public._b_cw_cue(t);
  len := least(40, floor(40.0 * w / public._b_cw_rule('min_words'))::int);
  used := (case when ha then 15 else 0 end) + (case when hb then 15 else 0 end);
  detail := (case when s >= 2 then 15 else 0 end) + (case when cue then 15 else 0 end);
  return jsonb_build_object('words', w, 'sentences', s, 'has_a', ha, 'has_b', hb, 'cue', cue,
                            'length', len, 'used', used, 'detail', detail, 'total', len + used + detail);
end $$;

-- ---------- student ----------
-- Is Classwork open, and where am I in each realm?
create or replace function public.b_cw_status(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if not public._b_cw_live() then return jsonb_build_object('open', false); end if;
  return jsonb_build_object('open', true,
    'realms', (select coalesce(jsonb_agg(public._b_cw_view(w) order by w.realm), '[]') from public.b_cw_work w where w.student_id = p_id));
end $$;

create or replace function public.b_cw_get(p_id uuid, p_pin_hash text, p_realm int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  return public._b_cw_view(public._b_cw_row(p_id, p_realm));
end $$;

-- Learn: the chapter's words and one shared list of definitions (the chapter's own + a few from nearby chapters).
create or replace function public.b_cw_learn_start(p_id uuid, p_pin_hash text, p_realm int, p_ref int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work; words text[]; defs jsonb; o numeric := public._b_cw_ord(p_ref);
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  r := public._b_cw_row(p_id, p_realm);
  if r.status = 'submitted' then raise exception 'Already turned in'; end if;
  if not public._b_cw_ch_open(p_realm, r.learn_best, p_ref) then raise exception 'Finish Learn in the earlier chapter first'; end if;
  if public._b_cw_wait(r.last_try, 'L' || p_ref) > 0 then
    raise exception '%', format('You can retake Learn in %s min. Review the flashcards while you wait.', ceil(public._b_cw_wait(r.last_try, 'L' || p_ref) / 60.0));
  end if;
  select array_agg(term order by random()) into words from public.b_cw_terms where ref = p_ref;
  select jsonb_agg(jsonb_build_array(d.ref, d.term, d.def) order by random()) into defs from (
    select ref, term, def from public.b_cw_terms where ref = p_ref
    union all
    (select ref, term, def from public.b_cw_terms
      where ref <> p_ref and abs(public._b_cw_ord(ref) - o) <= 2
        and lower(def) not in (select lower(def) from public.b_cw_terms where ref = p_ref)
      order by random() limit public._b_cw_rule('extra_defs'))) d;
  update public.b_cw_work set updated_at = now(), learn_key = jsonb_build_object('ref', p_ref, 'words', to_jsonb(words),
           'defs', (select jsonb_agg(jsonb_build_array(e -> 0, e -> 1)) from jsonb_array_elements(defs) e))
   where student_id = p_id and realm = p_realm;
  return jsonb_build_object('ref', p_ref, 'words', to_jsonb(words), 'defs', (select jsonb_agg(e -> 2) from jsonb_array_elements(defs) e));
end $$;

-- p_answers: for each word (in order), the index of the definition picked (or -1)
create or replace function public.b_cw_learn_submit(p_id uuid, p_pin_hash text, p_realm int, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work; k jsonb; v_ref int; i int := 0; w text; pick int; d jsonb; right_n int := 0; total int; score int;
        misses jsonb := '[]'; best int; tries int; sm int; reveal boolean;
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  r := public._b_cw_row(p_id, p_realm);
  k := r.learn_key; if k is null then raise exception 'Start Learn first'; end if;
  v_ref := (k ->> 'ref')::int; total := jsonb_array_length(k -> 'words');
  for w in select x from jsonb_array_elements_text(k -> 'words') x loop
    pick := case when jsonb_typeof(p_answers -> i) = 'number' then (p_answers ->> i)::int else -1 end;
    d := case when pick >= 0 then k -> 'defs' -> pick end;
    if d is not null and (d ->> 0)::int = v_ref and d ->> 1 = w then right_n := right_n + 1;
    else misses := misses || jsonb_build_array(jsonb_build_object('i', i, 'term', w,
                     'def', (select def from public.b_cw_terms t where t.ref = v_ref and t.term = w limit 1)));
    end if;
    i := i + 1;
  end loop;
  score := round(100.0 * right_n / greatest(total, 1))::int;
  best := greatest(coalesce((r.learn_best ->> (v_ref::text))::int, 0), score);
  tries := coalesce((r.learn_tries ->> (v_ref::text))::int, 0) + 1;
  sm := coalesce((r.learn_sum ->> (v_ref::text))::int, 0) + score;
  -- definitions of missed words show after a pass or 3 tries (vocabulary is public, but make them work for it first)
  reveal := best >= public._b_cw_rule('learn_pass') or tries >= 3;
  if not reveal then select coalesce(jsonb_agg(m - 'def'), '[]') into misses from jsonb_array_elements(misses) m; end if;
  update public.b_cw_work set learn_key = null, updated_at = now(),
         learn_sum = learn_sum || jsonb_build_object(v_ref::text, sm),
         learn_grade = learn_grade || jsonb_build_object(v_ref::text, round(sm::numeric / tries)::int),
         learn_best = learn_best || jsonb_build_object(v_ref::text, best),
         learn_tries = learn_tries || jsonb_build_object(v_ref::text, tries),
         last_try = last_try || jsonb_build_object('L' || v_ref, now())
   where student_id = p_id and realm = p_realm returning * into r;
  return jsonb_build_object('ref', v_ref, 'score', score, 'right', right_n, 'total', total, 'best', best, 'tries', tries,
    'grade', round(sm::numeric / tries)::int, 'passed', best >= public._b_cw_rule('learn_pass'), 'reveal', reveal,
    'misses', misses, 'work', public._b_cw_view(r));
end $$;

-- Chapter Test (p_ref = chapter) or Unit Test (p_ref = null). Returns question ids; the page has the text.
-- About 8 think-it-through questions (kind 'cw') + recall questions from the chapter quiz bank (kind 'chapter').
create or replace function public.b_cw_test_start(p_id uuid, p_pin_hash text, p_realm int, p_ref int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work; chs int[]; ids text[]; wk text := coalesce('T' || p_ref, 'U');
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  r := public._b_cw_row(p_id, p_realm);
  if p_ref is null then
    if r.status <> 'submitted' and (not public._b_cw_all_learned(p_realm, r.learn_best) or public._b_cw_story_avg(p_realm, r.ch_stories) is null) then
      raise exception 'Finish Learn and the stories in every chapter first';
    end if;
    chs := public._b_cw_chapters(p_realm);
  else
    if not public._b_cw_ch_open(p_realm, r.learn_best, p_ref) or not public._b_cw_learn_ok(r.learn_best, p_ref) then
      raise exception 'Pass Learn (80%%) for this chapter first';
    end if;
    chs := array[p_ref];
  end if;
  if public._b_cw_wait(r.last_try, wk) > 0 then
    raise exception '%', format('You can retake this test in %s min. Review the chapter while you wait.', ceil(public._b_cw_wait(r.last_try, wk) / 60.0));
  end if;
  ids := array(select id from public.b_keys where kind = 'cw' and ref = any(chs) order by random() limit public._b_cw_rule('reason_n'));
  ids := ids || array(select id from public.b_keys where kind = 'chapter' and ref = any(chs) order by random()
                       limit public._b_cw_rule('quiz_n') - coalesce(array_length(ids, 1), 0));
  if coalesce(array_length(ids, 1), 0) = 0 then raise exception 'This test is not loaded yet'; end if;
  ids := array(select x from unnest(ids) x order by random());
  update public.b_cw_work set updated_at = now(),
         test_key = jsonb_build_object('kind', case when p_ref is null then 'unit' else 'ch' end, 'ref', p_ref, 'ids', to_jsonb(ids))
   where student_id = p_id and realm = p_realm;
  return jsonb_build_object('kind', case when p_ref is null then 'unit' else 'ch' end, 'ref', p_ref, 'ids', to_jsonb(ids));
end $$;

-- p_answers = {"cw13-ab12cd": "chosen choice text", …}. Graded by choice text (choices are shuffled in the browser).
-- Returns right/wrong per question. Never returns a correct answer.
create or replace function public.b_cw_test_submit(p_id uuid, p_pin_hash text, p_realm int, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work; k jsonb; total int; right_n int; results jsonb; score int; best int; cur jsonb; tries int;
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  r := public._b_cw_row(p_id, p_realm);
  k := r.test_key; if k is null then raise exception 'Start the test first'; end if;
  select count(*), count(*) filter (where b.answer is not null and lower(btrim(coalesce(p_answers ->> q.id, ''))) = lower(btrim(b.answer))),
         coalesce(jsonb_object_agg(q.id, b.answer is not null and lower(btrim(coalesce(p_answers ->> q.id, ''))) = lower(btrim(b.answer))), '{}')
    into total, right_n, results
    from jsonb_array_elements_text(k -> 'ids') q(id) left join public.b_keys b on b.id = q.id;
  score := round(100.0 * right_n / greatest(total, 1))::int;
  if k ->> 'kind' = 'unit' then
    update public.b_cw_work set test_key = null, updated_at = now(), last_try = last_try || jsonb_build_object('U', now()),
           unit_best = greatest(unit_best, score), unit_tries = unit_tries + 1
     where student_id = p_id and realm = p_realm returning * into r;
    best := r.unit_best; tries := r.unit_tries;
  else
    cur := coalesce(r.ch_test -> (k ->> 'ref'), '{}');
    best := greatest(coalesce((cur ->> 'best')::int, 0), score);
    tries := coalesce((cur ->> 'tries')::int, 0) + 1;
    update public.b_cw_work set test_key = null, updated_at = now(), last_try = last_try || jsonb_build_object('T' || (k ->> 'ref'), now()),
           ch_test = ch_test || jsonb_build_object(k ->> 'ref', jsonb_build_object('best', best, 'tries', tries))
     where student_id = p_id and realm = p_realm returning * into r;
  end if;
  return jsonb_build_object('kind', k ->> 'kind', 'ref', k -> 'ref', 'score', score, 'right', right_n, 'total', total, 'best', best, 'tries', tries,
    'passed', k ->> 'kind' <> 'unit' or best >= public._b_cw_rule('unit_pass'), 'results', results, 'work', public._b_cw_view(r));
end $$;

-- The writing box for a story was opened (starts the minimum writing time).
create or replace function public.b_cw_story_open(p_id uuid, p_pin_hash text, p_realm int, p_ref int, p_slot int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work; k text := p_ref || ':' || p_slot;
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  if p_slot < 0 or p_slot >= public._b_cw_need(p_ref) then raise exception 'No such story'; end if;
  r := public._b_cw_row(p_id, p_realm);
  if not (r.story_open ? k) then
    update public.b_cw_work set story_open = story_open || jsonb_build_object(k, now()) where student_id = p_id and realm = p_realm;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- p_a / p_b: the two chapter words, as written in the word list.
create or replace function public.b_cw_story_save(p_id uuid, p_pin_hash text, p_realm int, p_ref int, p_slot int, p_a text, p_b text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work; ta public.b_cw_terms; tb public.b_cw_terms; sc jsonb; opened timestamptz; i int; arr jsonb;
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  if p_slot < 0 or p_slot >= public._b_cw_need(p_ref) then raise exception 'No such story'; end if;
  r := public._b_cw_row(p_id, p_realm);
  if r.status = 'submitted' then raise exception 'Already turned in. Ask Mr. Dopp to return it if you need to change something.'; end if;
  if not public._b_cw_ch_open(p_realm, r.learn_best, p_ref) or not public._b_cw_learn_ok(r.learn_best, p_ref) then
    raise exception 'Pass Learn (80%%) for this chapter first';
  end if;
  select * into ta from public.b_cw_terms where realm = p_realm and ref = p_ref and lower(term) = lower(btrim(p_a)) limit 1;
  select * into tb from public.b_cw_terms where realm = p_realm and ref = p_ref and lower(term) = lower(btrim(p_b)) limit 1;
  if ta.term is null or tb.term is null then raise exception 'Pick two words from this chapter'; end if;
  if ta.n = tb.n then raise exception 'Pick two different words'; end if;
  if not ta.story_ok or not tb.story_ok then raise exception 'That word can''t be used for a story'; end if;
  if exists (select 1 from jsonb_array_elements(r.swapped) s where (s ->> 'ref')::int = p_ref and lower(s ->> 'term') in (lower(ta.term), lower(tb.term))) then
    raise exception 'You already swapped out that word';
  end if;
  arr := coalesce(r.ch_stories -> (p_ref::text), '[null,null,null]');
  for i in 0 .. 2 loop
    if i <> p_slot and jsonb_typeof(arr -> i) = 'object'
       and (lower(arr -> i ->> 'a') in (lower(ta.term), lower(tb.term)) or lower(arr -> i ->> 'b') in (lower(ta.term), lower(tb.term))) then
      raise exception 'Each story needs 2 new words (you used one already)';
    end if;
  end loop;
  if length(coalesce(p_text, '')) > 3000 then raise exception 'That story is too long'; end if;
  opened := (r.story_open ->> (p_ref || ':' || p_slot))::timestamptz;
  if opened is null or now() - opened < make_interval(secs => public._b_cw_rule('min_seconds')) then
    raise exception 'Take a little more time on your story before saving it';
  end if;
  sc := public._b_cw_story_score(p_text, ta.term, tb.term);
  arr := jsonb_set(arr, array[p_slot::text], jsonb_build_object('a', ta.term, 'b', tb.term, 'text', btrim(p_text), 'score', sc, 'saved_at', now()));
  update public.b_cw_work set ch_stories = ch_stories || jsonb_build_object(p_ref::text, arr), updated_at = now()
   where student_id = p_id and realm = p_realm returning * into r;
  return jsonb_build_object('ok', true, 'score', sc, 'work', public._b_cw_view(r));
end $$;

-- "No story for this word": a short reason, then the word is off the list. 1 per chapter, only when a spare word exists.
create or replace function public.b_cw_swap(p_id uuid, p_pin_hash text, p_realm int, p_ref int, p_term text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work; t public.b_cw_terms; arr jsonb; i int;
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  r := public._b_cw_row(p_id, p_realm);
  if r.status = 'submitted' then raise exception 'Already turned in'; end if;
  select * into t from public.b_cw_terms where realm = p_realm and ref = p_ref and lower(term) = lower(btrim(p_term)) limit 1;
  if t.term is null then raise exception 'No such word'; end if;
  if exists (select 1 from jsonb_array_elements(r.swapped) s where (s ->> 'ref')::int = p_ref and lower(s ->> 'term') = lower(t.term)) then
    return jsonb_build_object('ok', true, 'work', public._b_cw_view(r));
  end if;
  if public._b_cw_swap_max(p_ref) = 0 then raise exception 'This chapter has no spare words, so there is no word swap here'; end if;
  if (select count(*) from jsonb_array_elements(r.swapped) s where (s ->> 'ref')::int = p_ref) >= public._b_cw_swap_max(p_ref) then
    raise exception 'You''ve used the word swap for this chapter';
  end if;
  if (select count(*) from regexp_split_to_table(btrim(coalesce(p_reason, '')), '\s+') x where x ~ '[A-Za-z]') < 5 then
    raise exception 'Write at least 5 words about why you don''t have a story for this word';
  end if;
  arr := coalesce(r.ch_stories -> (p_ref::text), '[]');
  for i in 0 .. 2 loop
    if jsonb_typeof(arr -> i) = 'object' and (lower(arr -> i ->> 'a') = lower(t.term) or lower(arr -> i ->> 'b') = lower(t.term)) then
      raise exception 'That word is already in one of your stories';
    end if;
  end loop;
  update public.b_cw_work set updated_at = now(),
         swapped = swapped || jsonb_build_array(jsonb_build_object('term', t.term, 'ref', p_ref, 'reason', left(btrim(p_reason), 500), 'at', now()))
   where student_id = p_id and realm = p_realm returning * into r;
  return jsonb_build_object('ok', true, 'work', public._b_cw_view(r));
end $$;

create or replace function public.b_cw_submit(p_id uuid, p_pin_hash text, p_realm int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_cw_work; avg_s int; avg_l int; fin int;
begin
  perform public._b_cw_check(p_id, p_pin_hash);
  r := public._b_cw_row(p_id, p_realm);
  if r.status = 'submitted' then return jsonb_build_object('ok', true, 'already', true, 'work', public._b_cw_view(r)); end if;
  if not public._b_cw_all_learned(p_realm, r.learn_best) then raise exception 'Pass Learn (80%%) in every chapter first'; end if;
  avg_s := public._b_cw_story_avg(p_realm, r.ch_stories);
  if avg_s is null then raise exception 'Finish all the stories in every chapter first'; end if;
  avg_l := public._b_cw_learn_avg(p_realm, r.learn_grade);
  fin := round((avg_l + avg_s) / 2.0)::int;
  if fin < public._b_cw_rule('min_final') then
    raise exception '%', format('Your score is %s%%. You need at least %s%% to turn this in. Retake Learn or improve a story.', fin, public._b_cw_rule('min_final'));
  end if;
  update public.b_cw_work set status = 'submitted', submitted_at = now(), story_avg = avg_s, learn_avg = avg_l, final_score = fin, updated_at = now()
   where student_id = p_id and realm = p_realm returning * into r;
  -- bonus Quest task (+25 XP); kept even if the teacher later returns the work
  insert into public.b_tasks (student_id, task_key) values (p_id, 'cw' || p_realm) on conflict do nothing;
  return jsonb_build_object('ok', true, 'work', public._b_cw_view(r));
end $$;

-- ---------- teacher (Dopps Class teacher code, see _b_teacher in schema.sql) ----------
create or replace function public.b_cw_teacher_list(p_pass_hash text, p_realm int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return jsonb_build_object('live', public._b_cw_live(), 'chapters', to_jsonb(public._b_cw_chapters(p_realm)),
    'need', (select coalesce(jsonb_object_agg(c::text, public._b_cw_need(c)), '{}') from unnest(public._b_cw_chapters(p_realm)) c),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'period', s.period, 'status', coalesce(w.status, 'not_started'),
        'learn_best', coalesce(w.learn_best, '{}'), 'learn_grade', coalesce(w.learn_grade, '{}'), 'learn_tries', coalesce(w.learn_tries, '{}'),
        'learn_avg', public._b_cw_learn_avg(p_realm, coalesce(w.learn_grade, '{}')),
        'ch_test', coalesce(w.ch_test, '{}'), 'ch_stories', coalesce(w.ch_stories, '{}'), 'swapped', coalesce(w.swapped, '[]'),
        'story_avg', public._b_cw_story_avg(p_realm, coalesce(w.ch_stories, '{}')), 'unit_best', coalesce(w.unit_best, 0),
        'unit_tries', coalesce(w.unit_tries, 0), 'final_score', w.final_score, 'submitted_at', w.submitted_at, 'updated_at', w.updated_at)
      order by s.period, s.name), '[]')
      from public.b_students s left join public.b_cw_work w on w.student_id = s.id and w.realm = p_realm));
end $$;

-- Send turned-in work back so the student can change it and turn it in again.
create or replace function public.b_cw_teacher_return(p_pass_hash text, p_student uuid, p_realm int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  update public.b_cw_work set status = 'draft', submitted_at = null, final_score = null, returned_at = now(), updated_at = now()
   where student_id = p_student and realm = p_realm and status = 'submitted';
  if not found then raise exception 'Nothing turned in to return'; end if;
end $$;

-- Classwork on for everyone (true) or hidden behind "Coming soon" (false).
create or replace function public.b_cw_teacher_live(p_pass_hash text, p_live boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  insert into public.b_settings (k, v) values ('classwork_live', case when coalesce(p_live, false) then 'true' else 'false' end)
    on conflict (k) do update set v = excluded.v;
  return coalesce(p_live, false);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Reflection Coach (/reflection/ and /reflection/<chapter>/)
-- A rule-based coach (no AI service): one question at a time about a chapter, follow-ups, length feedback,
-- and a short paper built from the student's own words. Saved per student per chapter.
-- Logged-out students keep their draft in their own browser only.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.b_reflections (
  student_id uuid not null references public.b_students on delete cascade,
  ref        int  not null check (ref between 1 and 9999),   -- chapter ref (12, or 1201 for 12A)
  data       jsonb not null default '{}',                   -- the coach's saved state: {v, ans, tone, title, …}
  words      int  not null default 0,
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, ref)
);
alter table public.b_reflections enable row level security;
revoke all on public.b_reflections from anon, authenticated;

-- The five coach questions (same keys as src/app/reflection/prompts.ts). Done = all answered (or skipped) + a tone picked.
create or replace function public._b_ref_keys() returns text[] language sql immutable set search_path = public as $$
  select array['before', 'story', 'learned', 'connect', 'ahead'] $$;

create or replace function public._b_ref_words(p_data jsonb) returns int language sql immutable set search_path = public as $$
  select coalesce(sum((select count(*) from regexp_split_to_table(btrim(t), '\s+') x where x ~ '[A-Za-z0-9]')), 0)::int
    from (select p_data -> 'ans' -> k ->> 'a' t from unnest(public._b_ref_keys()) k
          union all select p_data -> 'ans' -> k -> 'fu' ->> 'a' from unnest(public._b_ref_keys()) k) a
   where t is not null $$;

create or replace function public._b_ref_done(p_data jsonb) returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_data ->> 'tone', '') <> ''
     and (select bool_and(coalesce(btrim(p_data -> 'ans' -> k ->> 'a'), '') <> '' or coalesce((p_data -> 'ans' -> k ->> 'skip')::boolean, false))
            from unnest(public._b_ref_keys()) k) $$;

create or replace function public.b_reflection_get(p_id uuid, p_pin_hash text, p_ref int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  return (select jsonb_build_object('data', data, 'words', words, 'done', done, 'updated_at', updated_at)
            from public.b_reflections where student_id = p_id and ref = p_ref);
end $$;

create or replace function public.b_reflection_save(p_id uuid, p_pin_hash text, p_ref int, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w int; d boolean; t timestamptz;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_ref is null or p_ref < 1 or p_ref > 9999 then raise exception 'Unknown chapter'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Nothing to save'; end if;
  if length(p_data::text) > 60000 then raise exception 'That reflection is too long to save'; end if;
  w := public._b_ref_words(p_data); d := public._b_ref_done(p_data);
  insert into public.b_reflections (student_id, ref, data, words, done) values (p_id, p_ref, p_data, w, d)
    on conflict (student_id, ref) do update set data = excluded.data, words = excluded.words, done = excluded.done, updated_at = now()
    returning updated_at into t;
  return jsonb_build_object('words', w, 'done', d, 'updated_at', t);
end $$;

-- My reflections (for the chapter picker): no text, just progress.
create or replace function public.b_reflection_list(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'words', words, 'done', done, 'updated_at', updated_at) order by ref), '[]')
            from public.b_reflections where student_id = p_id);
end $$;

-- Teacher: every reflection (progress only), or with p_ref, that chapter's reflections with their text.
create or replace function public.b_teacher_reflections(p_pass_hash text, p_ref int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('student', s.id, 'name', s.name, 'period', s.period, 'ref', x.ref,
                    'words', x.words, 'done', x.done, 'updated_at', x.updated_at,
                    'data', case when p_ref is not null then x.data end) order by s.period, s.name, x.ref), '[]')
            from public.b_reflections x join public.b_students s on s.id = x.student_id
           where p_ref is null or x.ref = p_ref);
end $$;

-- ---------- grants: only the public functions are callable from the website ----------
revoke execute on function public._b_cw_rule, public._b_cw_ord, public._b_cw_live, public._b_cw_check, public._b_cw_chapters,
  public._b_cw_okwords, public._b_cw_need, public._b_cw_swap_max, public._b_cw_story_avg, public._b_cw_learn_avg, public._b_cw_learn_ok,
  public._b_cw_all_learned, public._b_cw_ch_open, public._b_cw_wait, public._b_cw_row, public._b_cw_view, public._b_cw_term_rx,
  public._b_cw_cue, public._b_cw_story_score, public._b_ref_keys, public._b_ref_words, public._b_ref_done,
  public.b_cw_status, public.b_cw_get, public.b_cw_learn_start, public.b_cw_learn_submit, public.b_cw_test_start, public.b_cw_test_submit,
  public.b_cw_story_open, public.b_cw_story_save, public.b_cw_swap, public.b_cw_submit,
  public.b_cw_teacher_list, public.b_cw_teacher_return, public.b_cw_teacher_live,
  public.b_reflection_get, public.b_reflection_save, public.b_reflection_list, public.b_teacher_reflections
  from public, anon, authenticated;
grant execute on function public.b_cw_status, public.b_cw_get, public.b_cw_learn_start, public.b_cw_learn_submit, public.b_cw_test_start,
  public.b_cw_test_submit, public.b_cw_story_open, public.b_cw_story_save, public.b_cw_swap, public.b_cw_submit,
  public.b_cw_teacher_list, public.b_cw_teacher_return, public.b_cw_teacher_live,
  public.b_reflection_get, public.b_reflection_save, public.b_reflection_list, public.b_teacher_reflections to anon;
-- ── end wave-learnB ──

-- ── wave-pet: rock-alien class pet, Crystal Shop, Alien Gallery, Hall of Champions (same as supabase/migrations/005_pet.sql) ──
-- ════════════════════════════════════════════════════════════════════
-- Tables
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_pets (
  student_id      uuid primary key references public.b_students on delete cascade,
  name            text not null check (char_length(name) between 1 and 16),  -- what the owner sees
  approved_name   text,                                                       -- what everyone else sees (null = pending)
  name_ok         boolean not null default false,                             -- false = name waiting for the teacher
  color           text not null check (color in ('amethyst', 'citrine', 'emerald', 'sapphire', 'ruby')),
  born_at         timestamptz not null default now(),
  minerals        double precision not null default 100,
  heat            double precision not null default 100,
  mood            double precision not null default 100,
  shine           double precision not null default 100,
  health          double precision not null default 100,
  alive           boolean not null default true,       -- false = dormant
  died_at         timestamptz,
  deaths          int not null default 0,
  revive_progress int not null default 0,
  care_points     int not null default 0,
  junk_total      int not null default 0,
  streak          int not null default 0,
  best_streak     int not null default 0,
  streak_date     date,
  day_date        date,
  day_counts      jsonb not null default '{}',
  quiz_key        jsonb,                                -- the open vocab question {ref, term, at} (never sent to the page)
  quiz_crystals   int not null default 0,               -- crystals from vocab questions
  spent           int not null default 0,               -- crystals spent in the shop
  owned           text[] not null default '{}',
  equipped        jsonb not null default '{}',
  words           jsonb not null default '[]',          -- words it learned (right answers), newest last, max 80
  renamed_at      timestamptz,
  last_tick       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  removed_at      timestamptz                           -- set = the teacher removed it (soft); null = active
);
alter table public.b_pets add column if not exists removed_at timestamptz;
-- One row per counted graded event, so crystals are awarded exactly once.
create table if not exists public.b_pet_awards (
  student_id uuid not null references public.b_students on delete cascade,
  src        text not null,          -- 'task:ch3_quiz', 'att:123'
  amount     int  not null,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (student_id, src)
);
-- Permanent record of every alien that went dormant (kept after it wakes up).
create table if not exists public.b_pet_dormant (
  id         bigserial primary key,
  student_id uuid not null references public.b_students on delete cascade,
  pet_name   text,
  color      text not null,
  died_at    timestamptz not null,
  revived_at timestamptz
);
create index if not exists b_pet_dormant_recent on public.b_pet_dormant (died_at desc);
create table if not exists public.b_pet_items (
  key    text primary key,
  slot   text not null,
  name   text not null,
  cost   int  not null,            -- crystals spent
  unlock int  not null default 0,  -- lifetime crystals needed
  sort   int  not null default 0
);
alter table public.b_pets enable row level security;
alter table public.b_pet_awards enable row level security;
alter table public.b_pet_dormant enable row level security;
alter table public.b_pet_items enable row level security;
revoke all on public.b_pets, public.b_pet_awards, public.b_pet_dormant, public.b_pet_items from anon, authenticated;

insert into public.b_settings (k, v) values ('pet_names_need_ok', 'false') on conflict (k) do nothing;

insert into public.b_pet_items (key, slot, name, cost, unlock, sort) values
  ('hardhat',   'hat',   'Hard Hat',            10,   0,  1),
  ('loupe',     'face',  'Hand Lens',           12,   0,  2),
  ('hammer',    'hand',  'Rock Hammer',         12,   0,  3),
  ('vest',      'body',  'Field Vest',          15,   0,  4),
  ('headlamp',  'hat',   'Headlamp',            18,  10,  5),
  ('goggles',   'face',  'Safety Goggles',      20,  10,  6),
  ('rose',      'skin',  'Rose Quartz Crystals',25,  15,  7),
  ('compass',   'hand',  'Field Compass',       28,  20,  8),
  ('boots',     'feet',  'Hiking Boots',        30,  25,  9),
  ('ranger',    'hat',   'Ranger Hat',          30,  25, 10),
  ('pack',      'back',  'Sample Backpack',     35,  30, 11),
  ('shades',    'face',  'Eclipse Glasses',     35,  35, 12),
  ('stand',     'stand', 'Geode Display Stand', 40,  40, 13),
  ('pick',      'hand',  'Gold Pan',            40,  40, 14),
  ('opal',      'skin',  'Opal Crystals',       45,  50, 15),
  ('sawtooth',  'scene', 'Sawtooth Sunset',     50,  60, 16),
  ('glow',      'aura',  'Geothermal Glow',     60,  80, 17),
  ('medal',     'neck',  'Star Garnet Medal',   80, 100, 18),
  ('jetpack',   'back',  'Meteor Jetpack',      90, 120, 19),
  ('aurora',    'scene', 'Aurora Backdrop',    100, 140, 20),
  ('obsidian',  'skin',  'Obsidian Crystals',  110, 150, 21),
  ('cosmos',    'scene', 'Craters of the Moon Night Sky', 120, 180, 22),
  ('crown',     'hat',   'Star Garnet Crown',  200, 300, 23),
  ('gold',      'skin',  'Native Gold Crystals',250, 400, 24)
on conflict (key) do update set slot = excluded.slot, name = excluded.name, cost = excluded.cost,
  unlock = excluded.unlock, sort = excluded.sort;

-- ════════════════════════════════════════════════════════════════════
-- Private helpers
-- ════════════════════════════════════════════════════════════════════
create or replace function public._b_pet_caps() returns jsonb language sql immutable set search_path = public as $$
  select '{"rock":2,"sky":1,"moon":1,"water":1,"explain":1,"litter":1,"quiz":15,"study":25,"junk":3,"play":3}'::jsonb $$;
create or replace function public._b_pet_habits() returns text[] language sql immutable set search_path = public as $$
  select array['rock','sky','moon','water','explain','litter'] $$;

-- "Ana Lopez" → "Ana L."
create or replace function public._b_pub_name(p_name text) returns text language sql immutable set search_path = public as $$
  select case when array_length(w, 1) > 1 then w[1] || ' ' || upper(left(w[array_length(w, 1)], 1)) || '.' else coalesce(w[1], 'Student') end
    from (select regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+') w) x $$;

create or replace function public._b_pet_cleared(p_id uuid) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.b_cleared where student_id = p_id $$;

create or replace function public._b_pet_stage(p_cleared int, p_care int) returns text language sql immutable set search_path = public as $$
  select case when p_care = 0 then 'geode'
              when p_cleared >= 9 then 'titan' when p_cleared >= 7 then 'granite' when p_cleared >= 5 then 'magma'
              when p_cleared >= 3 then 'quartzite' when p_cleared >= 1 then 'sandstone' else 'pebble' end $$;

-- Count graded events into b_pet_awards (idempotent).
create or replace function public._b_pet_sync(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a record; used int; amt int;
begin
  insert into public.b_pet_awards (student_id, src, amount, day)
  select t.student_id, 'task:' || t.task_key,
         case when t.task_key ~ '^unit\d+$' then 30 when t.task_key ~ '^cw\d+$' then 20 else 10 end,
         (t.done_at at time zone 'America/Denver')::date
    from public.b_tasks t
   where t.student_id = p_id and t.task_key ~ '^(ch\d+[a-z]?_quiz|unit\d+|cw\d+)$'
  on conflict do nothing;
  for a in
    select x.id, x.day, greatest(0, x.score - coalesce(x.prev, 0)) gain from (
      select b.id, (b.created_at at time zone 'America/Denver')::date as day, b.score,
             max(b.score) over (partition by b.kind, b.ref order by b.id rows between unbounded preceding and 1 preceding) prev
        from public.b_attempts b where b.student_id = p_id) x
     where not exists (select 1 from public.b_pet_awards w where w.student_id = p_id and w.src = 'att:' || x.id)
     order by x.id
  loop
    select coalesce(sum(amount), 0) into used from public.b_pet_awards
     where student_id = p_id and day = a.day and src like 'att:%';
    amt := greatest(0, least(a.gain, 40 - used));
    insert into public.b_pet_awards (student_id, src, amount, day) values (p_id, 'att:' || a.id, amt, a.day) on conflict do nothing;
  end loop;
end $$;

create or replace function public._b_pet_earned(p_id uuid) returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from public.b_pet_awards where student_id = p_id $$;

-- Apply whole hours of time passing and save. Returns the updated row (null if no alien).
create or replace function public._b_pet_tick(p_id uuid) returns public.b_pets
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; h int; i int; avg_need double precision; min_need double precision;
begin
  select * into r from public.b_pets where student_id = p_id and removed_at is null for update;
  if not found then return null; end if;
  h := floor(extract(epoch from now() - r.last_tick) / 3600)::int;
  if h <= 0 then return r; end if;
  for i in 1 .. least(h, 400) loop
    exit when not r.alive;
    r.minerals := greatest(0, r.minerals - 1.625);
    r.heat     := greatest(0, r.heat - 1.375);
    r.mood     := greatest(0, r.mood - 1.25);
    r.shine    := greatest(0, r.shine - 1.0);
    avg_need := (r.minerals + r.heat + r.mood + r.shine) / 4;
    min_need := least(r.minerals, r.heat, r.mood, r.shine);
    if min_need <= 0 then r.health := r.health - 2.5;
    elsif avg_need < 30 then r.health := r.health - 1.25;
    elsif avg_need > 60 then r.health := least(100, r.health + 0.625);
    end if;
    if r.health <= 0 then
      r.health := 0; r.alive := false; r.died_at := r.last_tick + make_interval(hours => i);
    end if;
  end loop;
  r.last_tick := r.last_tick + make_interval(hours => h);
  if not r.alive and r.died_at is not null
     and not exists (select 1 from public.b_pet_dormant d where d.student_id = r.student_id and d.died_at = r.died_at) then
    insert into public.b_pet_dormant (student_id, pet_name, color, died_at) values (r.student_id, r.approved_name, r.color, r.died_at);
  end if;
  update public.b_pets set minerals = r.minerals, heat = r.heat, mood = r.mood, shine = r.shine, health = r.health,
         alive = r.alive, died_at = r.died_at, last_tick = r.last_tick
   where student_id = r.student_id;
  return r;
end $$;

-- p_full = the owner's view. The public view never has the private name, needs detail or crystals.
create or replace function public._b_pet_view(r public.b_pets, p_full boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  age_days double precision := extract(epoch from now() - r.born_at) / 86400;
  cl int := public._b_pet_cleared(r.student_id);
  stage text := public._b_pet_stage(cl, r.care_points);
  form text; mood_label text; earned int;
  counts jsonb := case when r.day_date = public._b_today() then r.day_counts else '{}'::jsonb end;
  v jsonb;
begin
  if stage = 'titan' then
    form := case when r.junk_total * 3 > r.care_points then 'rusty'
                 when r.care_points / greatest(age_days, 1) >= 4 then 'radiant'
                 when r.care_points / greatest(age_days, 1) >= 2 then 'steady' else 'dusty' end;
  end if;
  mood_label := case when not r.alive then 'dormant' when r.health < 35 then 'sick' when r.minerals < 25 then 'hungry'
                     when r.heat < 25 then 'cold' when r.shine < 25 then 'dusty' when r.mood < 25 then 'sad'
                     when coalesce((counts ->> 'junk')::int, 0) >= 2 then 'rusty' else 'happy' end;
  v := jsonb_build_object('name', case when p_full then r.name else r.approved_name end, 'color', r.color, 'stage', stage,
    'cleared', cl, 'form', form, 'mood_label', mood_label, 'alive', r.alive, 'health', round(r.health::numeric),
    'streak', r.streak, 'age_days', floor(age_days)::int, 'gear', r.equipped, 'upgrades', coalesce(cardinality(r.owned), 0),
    'words', jsonb_array_length(r.words));
  if p_full then
    earned := public._b_pet_earned(r.student_id) + r.quiz_crystals;
    v := v || jsonb_build_object('approved_name', r.approved_name, 'name_ok', r.name_ok,
      'minerals', round(r.minerals::numeric), 'heat', round(r.heat::numeric), 'mood', round(r.mood::numeric),
      'shine', round(r.shine::numeric), 'best_streak', r.best_streak, 'care_points', r.care_points, 'deaths', r.deaths,
      'revive_progress', r.revive_progress, 'revive_needed', 10, 'today', counts, 'caps', public._b_pet_caps(),
      'crystals', earned - r.spent, 'crystals_total', earned, 'owned', to_jsonb(r.owned), 'learned', r.words,
      'next_rename', case when r.renamed_at is not null and r.renamed_at > now() - interval '7 days' then r.renamed_at + interval '7 days' end);
  end if;
  return v;
end $$;

create or replace function public._b_pet_clean_name(p_name text) returns text language plpgsql immutable set search_path = public as $$
declare n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(n) < 1 or char_length(n) > 16 then raise exception 'Alien names can be 1 to 16 characters'; end if;
  if n !~ '^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ .''-]*$' then raise exception 'Use letters and numbers (spaces, hyphens and apostrophes are OK)'; end if;
  return n;
end $$;

-- Save the needs/counters part of a row (used by actions and the quiz).
create or replace function public._b_pet_save(r public.b_pets) returns void
language sql security definer set search_path = public as $$
  update public.b_pets set minerals = r.minerals, heat = r.heat, mood = r.mood, shine = r.shine, health = r.health,
    alive = r.alive, died_at = r.died_at, deaths = r.deaths, revive_progress = r.revive_progress, care_points = r.care_points,
    junk_total = r.junk_total, streak = r.streak, best_streak = r.best_streak, streak_date = r.streak_date,
    day_date = r.day_date, day_counts = r.day_counts, quiz_key = r.quiz_key, quiz_crystals = r.quiz_crystals,
    words = r.words, updated_at = now()
  where student_id = r.student_id and removed_at is null $$;

-- One counted action: needs, caps, streak, revive. Returns the row and a result word.
create or replace function public._b_pet_apply(r public.b_pets, p_action text, out o public.b_pets, out msg text)
language plpgsql security definer set search_path = public as $$
declare caps jsonb := public._b_pet_caps(); today date := public._b_today(); used int; kinds int;
begin
  if r.day_date is distinct from today then r.day_counts := '{}'; r.day_date := today; end if;
  used := coalesce((r.day_counts ->> p_action)::int, 0);
  if r.alive and used >= (caps ->> p_action)::int then raise exception 'Daily limit reached for that one. Come back tomorrow!'; end if;
  if not r.alive and p_action <> 'quiz' then raise exception 'Your alien is dormant. Answer vocab questions to wake it up!'; end if;
  if p_action in ('quiz', 'study') then r.quiz_crystals := r.quiz_crystals + 1; end if;
  if not r.alive then
    r.revive_progress := r.revive_progress + 1;
    if r.revive_progress >= 10 then
      r.alive := true; r.health := 40; r.minerals := 50; r.heat := 50; r.mood := 50; r.shine := 50;
      r.deaths := r.deaths + 1; r.revive_progress := 0; r.died_at := null;
      update public.b_pet_dormant set revived_at = now() where student_id = r.student_id and revived_at is null;
      msg := 'revived';
    else msg := 'revive_progress'; end if;
  else
    case p_action
      when 'rock'    then r.minerals := r.minerals + 35;
      when 'sky'     then r.heat := r.heat + 10; r.health := r.health + 3;
      when 'moon'    then r.heat := r.heat + 45;
      when 'water'   then r.mood := r.mood + 20; r.heat := r.heat + 5; r.health := r.health + 4; r.shine := r.shine - 10;
      when 'explain' then r.mood := r.mood + 30;
      when 'litter'  then r.shine := r.shine + 55;
      when 'quiz'    then r.minerals := r.minerals + 8; r.mood := r.mood + 4;
      when 'study'   then null;
      when 'junk'    then r.mood := r.mood + 12; r.minerals := r.minerals + 10; r.health := r.health - 5; r.heat := r.heat - 8;
                          r.junk_total := r.junk_total + 1;
      when 'play'    then r.mood := r.mood + 12; r.heat := r.heat - 6; r.shine := r.shine - 6;
    end case;
    if p_action = any(public._b_pet_habits()) or p_action = 'quiz' then r.care_points := r.care_points + 1; end if;
    msg := 'ok';
  end if;
  r.minerals := least(100, greatest(0, r.minerals)); r.heat := least(100, greatest(0, r.heat));
  r.mood := least(100, greatest(0, r.mood)); r.shine := least(100, greatest(0, r.shine));
  r.health := least(100, greatest(0, r.health));
  if r.alive and r.health <= 0 then r.health := 1; end if;   -- junk alone never knocks it out
  r.day_counts := jsonb_set(r.day_counts, array[p_action], to_jsonb(used + 1));
  -- streak: a day counts once 3 different field habits are logged
  select count(*) into kinds from unnest(public._b_pet_habits()) k where coalesce((r.day_counts ->> k)::int, 0) > 0;
  if kinds >= 3 and r.streak_date is distinct from today then
    r.streak := case when r.streak_date = today - 1 then r.streak + 1 else 1 end;
    r.streak_date := today; r.best_streak := greatest(r.best_streak, r.streak);
  end if;
  o := r;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Student functions
-- ════════════════════════════════════════════════════════════════════
create or replace function public.b_pet_get(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  perform public._b_pet_sync(p_id);
  r := public._b_pet_tick(p_id);
  if r.student_id is null then return null; end if;
  return public._b_pet_view(r, true);
end $$;

create or replace function public.b_pet_create(p_id uuid, p_pin_hash text, p_name text, p_color text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; n text; ok boolean := coalesce(public._b_set('pet_names_need_ok'), 'false') <> 'true';
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  n := public._b_pet_clean_name(p_name);
  if exists (select 1 from public.b_pets where student_id = p_id and removed_at is null) then raise exception 'You already have an alien'; end if;
  -- A removed alien's row is reused: every column goes back to its default, as if it were a new row
  -- (spent and quiz crystals reset; crystals from graded work in b_pet_awards carry over).
  insert into public.b_pets as b (student_id, name, approved_name, name_ok, color)
  values (p_id, n, case when ok then n end, ok, coalesce(p_color, 'amethyst'))
  on conflict (student_id) do update set name = excluded.name, approved_name = excluded.approved_name,
    name_ok = excluded.name_ok, color = excluded.color, born_at = excluded.born_at, minerals = excluded.minerals,
    heat = excluded.heat, mood = excluded.mood, shine = excluded.shine, health = excluded.health, alive = excluded.alive,
    died_at = excluded.died_at, deaths = excluded.deaths, revive_progress = excluded.revive_progress,
    care_points = excluded.care_points, junk_total = excluded.junk_total, streak = excluded.streak,
    best_streak = excluded.best_streak, streak_date = excluded.streak_date, day_date = excluded.day_date,
    day_counts = excluded.day_counts, quiz_key = excluded.quiz_key, quiz_crystals = excluded.quiz_crystals,
    spent = excluded.spent, owned = excluded.owned, equipped = excluded.equipped, words = excluded.words,
    renamed_at = excluded.renamed_at, last_tick = excluded.last_tick, updated_at = excluded.updated_at, removed_at = null
    where b.removed_at is not null
  returning * into r;
  if r.student_id is null then raise exception 'You already have an alien'; end if;
  perform public._b_pet_sync(p_id);
  return public._b_pet_view(r, true);
end $$;

-- Field habits (honor system), junk snack, play. Vocab questions go through b_pet_quiz_*.
create or replace function public.b_pet_action(p_id uuid, p_pin_hash text, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; res record;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_action is null or not (p_action = any(public._b_pet_habits()) or p_action in ('junk', 'play')) then raise exception 'Unknown action'; end if;
  r := public._b_pet_tick(p_id);
  if r.student_id is null then raise exception 'Adopt your alien first'; end if;
  select * into res from public._b_pet_apply(r, p_action);
  perform public._b_pet_save(res.o);
  return public._b_pet_view(res.o, true) || jsonb_build_object('result', res.msg);
end $$;

-- A vocab question graded here: a definition from the glossary (b_cw_terms) and 4 chapter words.
-- p_ref = a chapter ref (12, 1201) or null for any chapter.
create or replace function public.b_pet_quiz_start(p_id uuid, p_pin_hash text, p_ref int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; v_ref int := p_ref; t public.b_cw_terms; opts jsonb; v_def text;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  select * into r from public.b_pets where student_id = p_id and removed_at is null for update;
  if r.student_id is null then raise exception 'Adopt your alien first'; end if;
  if v_ref is null then
    select ref into v_ref from (select ref from public.b_cw_terms group by ref having count(*) >= 4) c order by random() limit 1;
  end if;
  select * into t from public.b_cw_terms where ref = v_ref order by random() limit 1;
  if t.term is null then raise exception 'No words loaded for that chapter yet'; end if;
  select jsonb_agg(term order by random()) into opts from (
    select t.term as term union all
    (select term from (select distinct on (lower(term)) term from public.b_cw_terms
                        where ref = v_ref and lower(term) <> lower(t.term) and lower(def) <> lower(t.def)
                        order by lower(term), random()) d order by random() limit 3)) x;
  v_def := regexp_replace(t.def, regexp_replace(regexp_replace(t.term, '\s*\([^)]*\)', '', 'g'), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g'), '_____', 'gi');
  update public.b_pets set quiz_key = jsonb_build_object('ref', v_ref, 'term', t.term, 'at', now()) where student_id = p_id;
  return jsonb_build_object('ref', v_ref, 'def', v_def, 'opts', opts);
end $$;

create or replace function public.b_pet_quiz_answer(p_id uuid, p_pin_hash text, p_choice text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; k jsonb; right_ boolean; act text; res record; caps jsonb := public._b_pet_caps(); today jsonb; msg text := 'no_reward';
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  r := public._b_pet_tick(p_id);
  if r.student_id is null then raise exception 'Adopt your alien first'; end if;
  k := r.quiz_key;
  if k is null then raise exception 'Ask for a question first'; end if;
  if now() - (k ->> 'at')::timestamptz < interval '1.5 seconds' then raise exception 'Read the whole question first'; end if;
  r.quiz_key := null;
  right_ := lower(btrim(coalesce(p_choice, ''))) = lower(k ->> 'term');
  if right_ then
    if not (r.words @> jsonb_build_array(k ->> 'term')) then
      r.words := r.words || jsonb_build_array(k ->> 'term');
      if jsonb_array_length(r.words) > 80 then r.words := r.words - 0; end if;
    end if;
    today := case when r.day_date = public._b_today() then r.day_counts else '{}' end;
    act := case when not r.alive or coalesce((today ->> 'quiz')::int, 0) < (caps ->> 'quiz')::int then 'quiz'
                when coalesce((today ->> 'study')::int, 0) < (caps ->> 'study')::int then 'study' end;
    if act is not null then
      select * into res from public._b_pet_apply(r, act);
      r := res.o; msg := res.msg;
    end if;
  end if;
  perform public._b_pet_save(r);
  return public._b_pet_view(r, true) || jsonb_build_object('right', right_, 'answer', k ->> 'term', 'result', msg, 'action', act);
end $$;

-- Rename: once every 7 days. With pet_names_need_ok on, the new name waits for the teacher (the old approved name stays public).
create or replace function public.b_pet_rename(p_id uuid, p_pin_hash text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; n text; ok boolean := coalesce(public._b_set('pet_names_need_ok'), 'false') <> 'true';
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  select * into r from public.b_pets where student_id = p_id and removed_at is null for update;
  if r.student_id is null then raise exception 'Adopt your alien first'; end if;
  n := public._b_pet_clean_name(p_name);
  if n = r.name then raise exception 'That is already your alien''s name'; end if;
  if r.renamed_at is not null and r.renamed_at > now() - interval '7 days' then
    raise exception 'You can rename your alien again on %', to_char((r.renamed_at + interval '7 days') at time zone 'America/Denver', 'Dy Mon DD');
  end if;
  update public.b_pets set name = n, name_ok = ok, approved_name = case when ok then n else approved_name end,
         renamed_at = now(), updated_at = now()
   where student_id = p_id returning * into r;
  return public._b_pet_view(r, true);
end $$;

-- ── Crystal Shop ──
create or replace function public.b_pet_shop_items() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', key, 'slot', slot, 'name', name, 'cost', cost, 'unlock', unlock) order by sort), '[]')
    from public.b_pet_items $$;

create or replace function public.b_pet_shop_buy(p_id uuid, p_pin_hash text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; it public.b_pet_items; earned int;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  select * into it from public.b_pet_items where key = p_item;
  if it.key is null then raise exception 'That item doesn''t exist'; end if;
  select * into r from public.b_pets where student_id = p_id and removed_at is null for update;
  if r.student_id is null then raise exception 'Adopt your alien first'; end if;
  if it.key = any(r.owned) then raise exception 'You already own that'; end if;
  perform public._b_pet_sync(p_id);
  earned := public._b_pet_earned(p_id) + r.quiz_crystals;
  if earned < it.unlock then raise exception 'Locked: mine % more crystals to unlock it', it.unlock - earned; end if;
  if earned - r.spent < it.cost then raise exception 'You need % more crystals for that', it.cost - (earned - r.spent); end if;
  update public.b_pets set spent = spent + it.cost, owned = array_append(owned, it.key),
         equipped = jsonb_set(equipped, array[it.slot], to_jsonb(it.key)), updated_at = now()
   where student_id = p_id returning * into r;
  return public._b_pet_view(r, true) || jsonb_build_object('result', 'bought');
end $$;

-- p_item = null takes off whatever is in that slot.
create or replace function public.b_pet_equip(p_id uuid, p_pin_hash text, p_slot text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; it public.b_pet_items;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  select * into r from public.b_pets where student_id = p_id and removed_at is null for update;
  if r.student_id is null then raise exception 'Adopt your alien first'; end if;
  if p_item is null then
    update public.b_pets set equipped = equipped - p_slot, updated_at = now() where student_id = p_id returning * into r;
  else
    select * into it from public.b_pet_items where key = p_item;
    if it.key is null or it.slot <> p_slot then raise exception 'That doesn''t go there'; end if;
    if not (it.key = any(r.owned)) then raise exception 'Buy it first'; end if;
    update public.b_pets set equipped = jsonb_set(equipped, array[p_slot], to_jsonb(p_item)), updated_at = now()
     where student_id = p_id returning * into r;
  end if;
  return public._b_pet_view(r, true);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Public: gallery, dormant list, Hall of Champions
-- ════════════════════════════════════════════════════════════════════
create or replace function public.b_pet_gallery() returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  for sid in select student_id from public.b_pets where removed_at is null loop perform public._b_pet_tick(sid); end loop;
  return (select coalesce(jsonb_agg(public._b_pet_view(p, false) || jsonb_build_object('owner', public._b_pub_name(s.name), 'period', s.period)
            order by p.alive desc, p.health desc, p.streak desc, p.care_points desc), '[]')
            from public.b_pets p join public.b_students s on s.id = p.student_id where p.removed_at is null);
end $$;

create or replace function public.b_pet_fallen(p_days int default 14) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  for sid in select student_id from public.b_pets where alive and removed_at is null loop perform public._b_pet_tick(sid); end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('name', d.pet_name, 'color', d.color, 'owner', public._b_pub_name(s.name),
                    'died_at', d.died_at, 'revived', d.revived_at is not null) order by d.died_at desc), '[]')
            from (select * from public.b_pet_dormant
                   where died_at > now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 60))
                   order by died_at desc limit 30) d
            join public.b_students s on s.id = d.student_id);
end $$;

-- Login-day streak: consecutive days ending today (or yesterday, if today isn't logged yet).
create or replace function public._b_streak(p_id uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare d date := public._b_today(); n int := 0;
begin
  if not exists (select 1 from public.b_days where student_id = p_id and day = d) then d := d - 1; end if;
  while exists (select 1 from public.b_days where student_id = p_id and day = d) loop n := n + 1; d := d - 1; end loop;
  return n;
end $$;

-- Hall of Champions: every student with any progress. XP uses the Quest page rules (25 per task, 5 per day,
-- 50 per approved side quest). Verified XP = only the tasks the database graded (quizzes, unit tests, Classwork).
create or replace function public.b_champions() returns jsonb
language sql stable security definer set search_path = public as $$
  with t as (
    select s.id, s.name, s.period,
      (select count(*) from public.b_tasks x where x.student_id = s.id and x.task_key ~ '^(ch\d+[a-z]?_(read|quiz|tls)|unit\d+|cw\d+)$') tasks,
      (select count(*) from public.b_tasks x where x.student_id = s.id and x.task_key ~ '^(ch\d+[a-z]?_quiz|unit\d+|cw\d+)$') graded,
      (select count(*) from public.b_days d where d.student_id = s.id) days,
      (select count(*) from public.b_side_quests q where q.student_id = s.id and q.approved) quests,
      (select count(*) from public.b_cleared c where c.student_id = s.id) cleared,
      (select count(*) from public.b_tasks x where x.student_id = s.id and x.task_key ~ '^unit\d+$') units,
      public._b_streak(s.id) streak
    from public.b_students s)
  select coalesce(jsonb_agg(jsonb_build_object('id', md5(id::text), 'name', public._b_pub_name(name), 'period', period,
           'xp', tasks * 25 + days * 5 + quests * 50, 'verified_xp', graded * 25, 'tasks', tasks, 'days', days,
           'cleared', cleared, 'units', units, 'streak', streak)
         order by graded desc, tasks * 25 + days * 5 + quests * 50 desc, streak desc, days desc), '[]')
    from t $$;

-- ════════════════════════════════════════════════════════════════════
-- Teacher (Dopps Class teacher code, like every other b_teacher_* function)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.b_pet_teacher_list(p_pass_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  for sid in select student_id from public.b_pets where removed_at is null loop perform public._b_pet_tick(sid); end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('student', p.student_id, 'student_name', s.name, 'period', s.period,
            'name', p.name, 'approved_name', p.approved_name, 'name_ok', p.name_ok, 'color', p.color, 'alive', p.alive,
            'stage', public._b_pet_stage(public._b_pet_cleared(p.student_id), p.care_points), 'health', round(p.health::numeric),
            'care_points', p.care_points, 'deaths', p.deaths, 'upgrades', cardinality(p.owned), 'born', p.born_at, 'last_care', p.updated_at)
          order by p.name_ok, s.period, s.name), '[]')
          from public.b_pets p join public.b_students s on s.id = p.student_id where p.removed_at is null);
end $$;

-- p_action: 'approve' (the name the student picked), 'deny' (back to the last approved name, or "Geode"), 'rename' (p_name).
create or replace function public.b_pet_teacher_name(p_pass_hash text, p_student uuid, p_action text, p_name text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_pets; n text;
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  select * into r from public.b_pets where student_id = p_student and removed_at is null for update;
  if r.student_id is null then raise exception 'That alien no longer exists'; end if;
  n := case p_action when 'approve' then r.name when 'deny' then coalesce(r.approved_name, 'Geode')
                     when 'rename' then public._b_pet_clean_name(p_name) end;
  if n is null then raise exception 'Unknown action'; end if;
  update public.b_pets set name = n, approved_name = n, name_ok = true, updated_at = now() where student_id = p_student and removed_at is null;
  return jsonb_build_object('ok', true, 'name', n);
end $$;

-- Remove = soft: the alien disappears everywhere and the student can adopt a new one.
-- (A future purge job could clear rows removed long ago.)
create or replace function public.b_pet_teacher_remove(p_pass_hash text, p_student uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  update public.b_pets set removed_at = now(), quiz_key = null, updated_at = now()
   where student_id = p_student and removed_at is null;
  if not found then raise exception 'That alien no longer exists'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- p_need = null only reads the setting; true/false turns name approval on/off. Returns the current setting.
create or replace function public.b_pet_teacher_names_ok(p_pass_hash text, p_need boolean default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if p_need is not null then
    insert into public.b_settings (k, v) values ('pet_names_need_ok', case when p_need then 'true' else 'false' end)
      on conflict (k) do update set v = excluded.v;
  end if;
  return coalesce(public._b_set('pet_names_need_ok'), 'false') = 'true';
end $$;

-- ---------- grants: only the public functions are callable from the website ----------
revoke execute on function public._b_pet_caps, public._b_pet_habits, public._b_pub_name, public._b_pet_cleared, public._b_pet_stage,
  public._b_pet_sync, public._b_pet_earned, public._b_pet_tick, public._b_pet_view, public._b_pet_clean_name, public._b_pet_save,
  public._b_pet_apply, public._b_streak,
  public.b_pet_get, public.b_pet_create, public.b_pet_action, public.b_pet_quiz_start, public.b_pet_quiz_answer, public.b_pet_rename,
  public.b_pet_shop_items, public.b_pet_shop_buy, public.b_pet_equip, public.b_pet_gallery, public.b_pet_fallen, public.b_champions,
  public.b_pet_teacher_list, public.b_pet_teacher_name, public.b_pet_teacher_remove, public.b_pet_teacher_names_ok
  from public, anon, authenticated;
grant execute on function public.b_pet_get, public.b_pet_create, public.b_pet_action, public.b_pet_quiz_start, public.b_pet_quiz_answer,
  public.b_pet_rename, public.b_pet_shop_items, public.b_pet_shop_buy, public.b_pet_equip, public.b_pet_gallery, public.b_pet_fallen,
  public.b_champions, public.b_pet_teacher_list, public.b_pet_teacher_name, public.b_pet_teacher_remove, public.b_pet_teacher_names_ok to anon;
-- ── end wave-pet ──

-- ── wave-live: Live & multiplayer (same as supabase/migrations/006_live.sql) ──
-- ════════════════════════════════════════════════════════════════════
-- Shared helpers
-- ════════════════════════════════════════════════════════════════════
create or replace function public._b_sha(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex') $$;

-- ════════════════════════════════════════════════════════════════════
-- Game XP log: server-written XP from live games, one row per event (ref is unique per student).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_xp_log (
  id         bigserial primary key,
  student_id uuid not null references public.b_students on delete cascade,
  term       text not null,
  source     text not null,                -- 'live' | 'live_bonus'
  ref        text not null,                -- e.g. live:<session>:<q>, live:<session>:c3, live_bonus:<session>
  xp         int  not null check (xp > 0 and xp <= 500),
  created_at timestamptz not null default now(),
  unique (student_id, ref)
);
alter table public.b_xp_log enable row level security;
revoke all on public.b_xp_log from anon, authenticated;

create or replace function public._b_xp_add(p_student uuid, p_source text, p_ref text, p_xp int) returns void
language sql security definer set search_path = public as $$
  insert into public.b_xp_log (student_id, term, source, ref, xp)
  select p_student, public._b_set('term'), p_source, p_ref, p_xp where p_student is not null
  on conflict (student_id, ref) do nothing $$;
create or replace function public._b_xp_total(p_student uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(xp), 0)::int from public.b_xp_log where student_id = p_student $$;

-- ════════════════════════════════════════════════════════════════════
-- 1. Live class games
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_live_sessions (
  id              uuid primary key default gen_random_uuid(),
  join_code       text not null,
  game_type       text not null check (game_type in ('pick_a_side', 'showdown', 'raid', 'coins')),
  host_token_hash text not null,
  phase           text not null default 'lobby' check (phase in ('lobby', 'question', 'reveal', 'leaderboard', 'ended')),
  q_index         int  not null default -1,
  question        jsonb,                  -- public: prompt + choices
  answer_key      text,                   -- hidden until the reveal; null for votes
  q_seconds       int,
  q_started_at    timestamptz,
  settings        jsonb not null default '{}',   -- require_login ('true'/'false'), teams ('2'-'4'), hp (raid)
  created_at      timestamptz not null default now(),
  ended_at        timestamptz
);
create unique index if not exists b_live_sessions_open_code on public.b_live_sessions (join_code) where phase <> 'ended';

create table if not exists public.b_live_players (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.b_live_sessions on delete cascade,
  student_id uuid references public.b_students on delete set null,
  nickname   text not null check (char_length(nickname) between 1 and 24),
  team       int check (team between 1 and 4),
  token_hash text not null,
  joined_at  timestamptz not null default now()
);
create index if not exists b_live_players_session on public.b_live_players (session_id);
create unique index if not exists b_live_players_one_per_student on public.b_live_players (session_id, student_id) where student_id is not null;

create table if not exists public.b_live_answers (
  session_id  uuid not null references public.b_live_sessions on delete cascade,
  player_id   uuid not null references public.b_live_players on delete cascade,
  q_index     int  not null,
  answer      text not null check (char_length(answer) <= 40),
  is_correct  boolean,                    -- null for votes
  points      int  not null default 0,
  answered_at timestamptz not null default now(),
  primary key (player_id, q_index)
);
create index if not exists b_live_answers_session_q on public.b_live_answers (session_id, q_index);

alter table public.b_live_sessions enable row level security;
alter table public.b_live_players enable row level security;
alter table public.b_live_answers enable row level security;
revoke all on public.b_live_sessions, public.b_live_players, public.b_live_answers from anon, authenticated;

-- The session, if p_host_token is its host token.
create or replace function public._b_live_host(p_session_id uuid, p_host_token text) returns public.b_live_sessions
language sql stable security definer set search_path = public as $$
  select s.* from public.b_live_sessions s where s.id = p_session_id and s.host_token_hash = public._b_sha(p_host_token) $$;

-- Host: start a game. Needs the teacher code. Returns {session_id, join_code, host_token}.
create or replace function public.b_live_create(p_pass_hash text, p_game_type text, p_settings jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_token text := gen_random_uuid()::text || gen_random_uuid()::text; v_code text; v_id uuid; v_set jsonb;
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if p_game_type not in ('pick_a_side', 'showdown', 'raid', 'coins') then raise exception 'Unknown game'; end if;
  -- tidy: games left open 12 hours end (ended games are kept; a future purge job could clear old ones)
  update public.b_live_sessions s set phase = 'ended', ended_at = now() where s.phase <> 'ended' and s.created_at < now() - interval '12 hours';
  if (select count(*) from public.b_live_sessions s where s.phase <> 'ended') >= 60 then
    raise exception 'Too many live games are open right now. End an old one and try again.';
  end if;
  v_set := jsonb_build_object('require_login', case when coalesce(p_settings ->> 'require_login', 'false') = 'true' then 'true' else 'false' end);
  if coalesce(p_settings ->> 'teams', '') ~ '^[2-4]$' and p_game_type in ('raid', 'coins') then
    v_set := v_set || jsonb_build_object('teams', p_settings ->> 'teams');
  elsif p_game_type = 'raid' then
    v_set := v_set || jsonb_build_object('teams', '3');
  end if;
  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.b_live_sessions s where s.join_code = v_code and s.phase <> 'ended');
  end loop;
  insert into public.b_live_sessions (join_code, game_type, host_token_hash, settings)
  values (v_code, p_game_type, public._b_sha(v_token), v_set) returning id into v_id;
  return jsonb_build_object('session_id', v_id, 'join_code', v_code, 'host_token', v_token);
end $$;

-- Host: show a question. p_answer_key = the correct letter (null for a vote).
create or replace function public.b_live_set_question(p_session_id uuid, p_host_token text, p_q_index int,
  p_question jsonb, p_answer_key text, p_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s public.b_live_sessions := public._b_live_host(p_session_id, p_host_token);
begin
  if s.id is null or s.phase = 'ended' or s.game_type = 'coins' then return false; end if;
  if p_q_index is null or p_q_index < 0 or p_q_index > 500 then raise exception 'Bad question number'; end if;
  if p_question is null or jsonb_typeof(p_question) <> 'object' or length(p_question::text) > 4000 then raise exception 'Bad question'; end if;
  if p_answer_key is not null and p_answer_key !~ '^[A-D]$' then raise exception 'Bad answer key'; end if;
  if (s.game_type = 'pick_a_side') <> (p_answer_key is null) then raise exception 'Votes have no answer key; quiz questions need one'; end if;
  update public.b_live_sessions x
     set phase = 'question', q_index = p_q_index, question = p_question, answer_key = p_answer_key,
         q_seconds = case when p_seconds is null then null else greatest(5, least(p_seconds, 120)) end, q_started_at = now()
   where x.id = s.id;
  return true;
end $$;

-- Host (Realm Raid): record the boss's HP when the raid starts.
create or replace function public.b_live_set_hp(p_session_id uuid, p_host_token text, p_hp int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s public.b_live_sessions := public._b_live_host(p_session_id, p_host_token);
begin
  if s.id is null or s.phase = 'ended' or s.game_type <> 'raid' then return false; end if;
  update public.b_live_sessions x set settings = x.settings || jsonb_build_object('hp', greatest(1, least(coalesce(p_hp, 1), 5000))) where x.id = s.id;
  return true;
end $$;

-- End-of-game bonuses (once per game, +25, logged-in students only), same as Dopps Class:
--   Showdown: the top 3 scores. Realm Raid: if the boss fell, everyone on the team with the most hits.
--   Gold Rush Live: the top 3 by gold, or with teams, everyone on the richest team.
create or replace function public._b_live_award_bonus(p_session_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.b_live_sessions; v_hp int; v_total int; v_team int; r record; v_ref text := 'live_bonus:' || p_session_id;
begin
  select * into s from public.b_live_sessions where id = p_session_id;
  if s.game_type = 'showdown' then
    for r in select p.student_id from public.b_live_players p join public.b_live_answers a on a.player_id = p.id
              where p.session_id = s.id and p.student_id is not null
              group by p.student_id having sum(a.points) > 0 order by sum(a.points) desc limit 3 loop
      perform public._b_xp_add(r.student_id, 'live_bonus', v_ref, 25);
    end loop;
  elsif s.game_type = 'raid' then
    v_hp := nullif(s.settings ->> 'hp', '')::int;
    select count(*) into v_total from public.b_live_answers a where a.session_id = s.id and a.is_correct;
    if v_hp is not null and v_total >= v_hp then
      select p.team into v_team from public.b_live_players p join public.b_live_answers a on a.player_id = p.id
       where p.session_id = s.id and a.is_correct and p.team is not null group by p.team order by count(*) desc limit 1;
      for r in select p.student_id from public.b_live_players p where p.session_id = s.id and p.team = v_team and p.student_id is not null loop
        perform public._b_xp_add(r.student_id, 'live_bonus', v_ref, 25);
      end loop;
    end if;
  elsif s.game_type = 'coins' then
    if nullif(s.settings ->> 'teams', '') is not null then
      select p.team into v_team from public.b_live_players p join public.b_coin_players c on c.player_id = p.id
       where p.session_id = s.id and p.team is not null group by p.team having sum(c.cash) > 0 order by sum(c.cash) desc limit 1;
      for r in select p.student_id from public.b_live_players p where p.session_id = s.id and p.team = v_team and p.student_id is not null loop
        perform public._b_xp_add(r.student_id, 'live_bonus', v_ref, 25);
      end loop;
    else
      for r in select p.student_id from public.b_live_players p join public.b_coin_players c on c.player_id = p.id
                where p.session_id = s.id and p.student_id is not null and c.cash > 0 order by c.cash desc limit 3 loop
        perform public._b_xp_add(r.student_id, 'live_bonus', v_ref, 25);
      end loop;
    end if;
  end if;
end $$;

-- Host: move to lobby / reveal / leaderboard / ended. Ending pays the bonuses.
create or replace function public.b_live_set_phase(p_session_id uuid, p_host_token text, p_phase text) returns boolean
language plpgsql security definer set search_path = public as $$
declare s public.b_live_sessions := public._b_live_host(p_session_id, p_host_token);
begin
  if p_phase not in ('lobby', 'reveal', 'leaderboard', 'ended') then raise exception 'Bad phase'; end if;
  if s.id is null or s.phase = 'ended' then return false; end if;
  update public.b_live_sessions x set phase = p_phase, ended_at = case when p_phase = 'ended' then now() else x.ended_at end where x.id = s.id;
  if p_phase = 'ended' then perform public._b_live_award_bonus(s.id); end if;
  return true;
end $$;

-- Host: scores, this question's tally, team totals.
create or replace function public.b_live_results(p_session_id uuid, p_host_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.b_live_sessions := public._b_live_host(p_session_id, p_host_token);
begin
  if s.id is null then return null; end if;
  return jsonb_build_object(
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', p.id, 'nickname', p.nickname, 'team', p.team, 'signed_in', p.student_id is not null,
                  'score', coalesce(sc.score, 0), 'correct', coalesce(sc.correct, 0),
                  'answered_current', exists (select 1 from public.b_live_answers a2 where a2.player_id = p.id and a2.q_index = s.q_index))
                order by coalesce(sc.score, 0) desc, p.joined_at), '[]')
                from public.b_live_players p
                left join (select a.player_id, sum(a.points) score, count(*) filter (where a.is_correct) correct
                             from public.b_live_answers a where a.session_id = s.id group by a.player_id) sc on sc.player_id = p.id
               where p.session_id = s.id),
    'tally', (select coalesce(jsonb_object_agg(t.answer, t.n), '{}')
                from (select a.answer, count(*) n from public.b_live_answers a
                       where a.session_id = s.id and a.q_index = s.q_index group by a.answer) t),
    'teams', (select coalesce(jsonb_object_agg(t.team::text, t.correct), '{}')
                from (select p.team, count(a.*) filter (where a.is_correct) correct
                        from public.b_live_players p left join public.b_live_answers a on a.player_id = p.id
                       where p.session_id = s.id and p.team is not null group by p.team) t));
end $$;

-- Student: join with the 6-digit code, as a logged-in Bedrock student (p_id + p_pin_hash) or with a nickname
-- (unless the host asked for logins). Rejoining (refresh / new device) keeps the same player with a new token.
create or replace function public.b_live_join(p_join_code text, p_nickname text, p_id uuid default null, p_pin_hash text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.b_live_sessions; v_token text := gen_random_uuid()::text || gen_random_uuid()::text;
        v_name text; v_pid uuid; v_team int; v_n int; v_tn int;
begin
  select * into s from public.b_live_sessions x where x.join_code = btrim(coalesce(p_join_code, '')) and x.phase <> 'ended'
   order by x.created_at desc limit 1;
  if s.id is null then raise exception 'No game with that code'; end if;
  if p_id is not null then
    if not public._b_ok(p_id, p_pin_hash) then raise exception 'Login expired - log in again'; end if;
    select left(st.name, 24) into v_name from public.b_students st where st.id = p_id;
    select p.id, p.team into v_pid, v_team from public.b_live_players p where p.session_id = s.id and p.student_id = p_id;
    if v_pid is not null then
      update public.b_live_players set token_hash = public._b_sha(v_token) where id = v_pid;
      return jsonb_build_object('session_id', s.id, 'player_id', v_pid, 'player_token', v_token, 'game_type', s.game_type, 'team', v_team);
    end if;
  else
    if coalesce(s.settings ->> 'require_login', 'false') = 'true' then raise exception 'This game needs your Bedrock login'; end if;
    v_name := left(btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g')), 24);
    if v_name = '' then raise exception 'Enter a nickname'; end if;
  end if;
  select count(*) into v_n from public.b_live_players p where p.session_id = s.id;
  if v_n >= 200 then raise exception 'Game is full'; end if;
  if coalesce(s.settings ->> 'teams', '') ~ '^[2-4]$' then
    v_tn := (s.settings ->> 'teams')::int;
    -- the smallest team (ties: lowest number)
    select t into v_team from generate_series(1, v_tn) t
     order by (select count(*) from public.b_live_players p where p.session_id = s.id and p.team = t), t limit 1;
  end if;
  insert into public.b_live_players (session_id, student_id, nickname, team, token_hash)
  values (s.id, p_id, v_name, v_team, public._b_sha(v_token)) returning id into v_pid;
  return jsonb_build_object('session_id', s.id, 'player_id', v_pid, 'player_token', v_token, 'game_type', s.game_type, 'team', v_team);
end $$;

-- Student: answer the current question. The server checks the timing and the answer.
-- Quiz answers are final; votes can change until voting closes. 500 for a right answer + up to 500 for speed.
create or replace function public.b_live_answer(p_player_id uuid, p_player_token text, p_q_index int, p_answer text) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.b_live_players; s public.b_live_sessions; v_el numeric; v_ok boolean; v_pts int := 0;
begin
  select * into p from public.b_live_players x where x.id = p_player_id and x.token_hash = public._b_sha(p_player_token);
  if p.id is null then return false; end if;
  select * into s from public.b_live_sessions x where x.id = p.session_id;
  if s.phase <> 'question' or s.q_index <> p_q_index or s.game_type = 'coins' then return false; end if;
  if coalesce(p_answer, '') !~ '^[A-D]$' then return false; end if;
  v_el := extract(epoch from now() - s.q_started_at);
  if s.q_seconds is not null and v_el > s.q_seconds + 2 then return false; end if;
  if s.answer_key is not null then
    v_ok := p_answer = s.answer_key;
    if v_ok then v_pts := 500 + greatest(0, round(500 * (1 - v_el / greatest(coalesce(s.q_seconds, 20), 1))))::int; end if;
  end if;
  insert into public.b_live_answers (session_id, player_id, q_index, answer, is_correct, points)
  values (s.id, p.id, p_q_index, p_answer, v_ok, v_pts)
  on conflict (player_id, q_index) do update set answer = excluded.answer, answered_at = now()
   where public.b_live_answers.is_correct is null;      -- votes only
  if not found then return false; end if;
  -- +5 XP per right answer for logged-in students (Showdown, Realm Raid)
  if v_ok then perform public._b_xp_add(p.student_id, 'live', 'live:' || s.id || ':' || p_q_index, 5); end if;
  return true;
end $$;

-- Everyone (projector + phones): the public state. The answer key only after the reveal.
-- With a player id + token, also "me": my score, my answer and (after the reveal) whether I was right.
create or replace function public.b_live_state(p_session_id uuid, p_player_id uuid default null, p_player_token text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.b_live_sessions; v_shown boolean;
begin
  select * into s from public.b_live_sessions x where x.id = p_session_id;
  if s.id is null then return null; end if;
  v_shown := s.phase in ('reveal', 'leaderboard', 'ended');
  return jsonb_build_object(
    'phase', s.phase, 'game_type', s.game_type, 'q_index', s.q_index, 'question', s.question, 'q_seconds', s.q_seconds,
    'seconds_left', case when s.phase = 'question' and s.q_seconds is not null
                         then greatest(0, s.q_seconds - extract(epoch from now() - s.q_started_at))::int end,
    'answer_key', case when v_shown then s.answer_key end,
    'require_login', coalesce(s.settings ->> 'require_login', 'false') = 'true',
    'player_count', (select count(*) from public.b_live_players p where p.session_id = s.id),
    'answer_count', (select count(*) from public.b_live_answers a where a.session_id = s.id and a.q_index = s.q_index),
    'teams', case when s.game_type = 'raid' then (
       select coalesce(jsonb_object_agg(t.team::text, t.correct), '{}')
         from (select p.team, count(a.*) filter (where a.is_correct) correct
                 from public.b_live_players p left join public.b_live_answers a on a.player_id = p.id
                where p.session_id = s.id and p.team is not null group by p.team) t) end,
    'me', (select jsonb_build_object(
             'nickname', p.nickname, 'team', p.team, 'signed_in', p.student_id is not null,
             'score', (select coalesce(sum(a.points), 0) from public.b_live_answers a where a.player_id = p.id),
             'my_answer', (select a.answer from public.b_live_answers a where a.player_id = p.id and a.q_index = s.q_index),
             'my_correct', case when v_shown then (select a.is_correct from public.b_live_answers a where a.player_id = p.id and a.q_index = s.q_index) end)
             from public.b_live_players p
            where p.id = p_player_id and p.session_id = s.id and p.token_hash = public._b_sha(p_player_token)));
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 2. Gold Rush Live (game_type 'coins'). Same gear, values and prices as public/classic-games/gold-rush.html:
--    Pickaxe (gold per right answer), Sluice Box (multiplier), Rich Vein (streak bonus, up to 10), Timber Supports.
--    Optional teams: a team's score is the sum of its members' gold (wallets stay separate).
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_coin_bank (
  session_id uuid not null references public.b_live_sessions on delete cascade,
  idx        int  not null,
  ch         int,
  prompt     text not null,
  choices    jsonb not null,             -- 4 strings
  answer     text not null,
  why        text,
  hidden_at  timestamptz,                -- set = replaced by a later b_coin_setup (soft); null = in this game's bank
  primary key (session_id, idx)
);
alter table public.b_coin_bank add column if not exists hidden_at timestamptz;
create table if not exists public.b_coin_players (
  player_id  uuid primary key references public.b_live_players on delete cascade,
  session_id uuid not null references public.b_live_sessions on delete cascade,
  cash       bigint not null default 0,
  earned     bigint not null default 0,
  l_mpq      int not null default 0,
  l_mult     int not null default 0,
  l_streak   int not null default 0,
  l_ins      int not null default 0,
  streak     int not null default 0,
  cur_q      int,
  answered   int not null default 0,
  correct    int not null default 0,
  last_at    timestamptz
);
create index if not exists b_coin_players_session on public.b_coin_players (session_id, cash desc);
alter table public.b_coin_bank enable row level security;
alter table public.b_coin_players enable row level security;
revoke all on public.b_coin_bank, public.b_coin_players from anon, authenticated;

create or replace function public._b_coin_val(p_kind text, p_lvl int) returns numeric language sql immutable as $$
  select (case p_kind
    when 'mpq'    then array[10, 25, 60, 150, 400, 1000, 2500]::numeric[]
    when 'mult'   then array[1, 1.5, 2, 3, 4]::numeric[]
    when 'streak' then array[0, 5, 15, 40, 100, 250]::numeric[]
    when 'ins'    then array[0, .25, .5, .75, 1]::numeric[] end)[p_lvl + 1] $$;
create or replace function public._b_coin_cost(p_kind text, p_lvl int) returns bigint language sql immutable as $$
  select (case p_kind
    when 'mpq'    then array[0, 50, 200, 700, 2500, 8000, 25000]::bigint[]
    when 'mult'   then array[0, 100, 500, 2500, 10000]::bigint[]
    when 'streak' then array[0, 40, 180, 700, 2500, 8000]::bigint[]
    when 'ins'    then array[0, 60, 300, 1500, 6000]::bigint[] end)[p_lvl + 1] $$;

-- Host: load the questions (lobby only). p_questions = [{ch, prompt, choices: [4], answer, why}] from the review bank.
create or replace function public.b_coin_setup(p_session_id uuid, p_host_token text, p_questions jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare s public.b_live_sessions := public._b_live_host(p_session_id, p_host_token); v_n int;
begin
  if s.id is null or s.game_type <> 'coins' then raise exception 'Not your game'; end if;
  if s.phase <> 'lobby' then raise exception 'Game already started'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 4 and 800 then
    raise exception 'Need 4 to 800 questions';
  end if;
  -- loading again replaces the bank: old rows are hidden, the new ones written over them (soft, no removal)
  update public.b_coin_bank b set hidden_at = now() where b.session_id = s.id and b.hidden_at is null;
  insert into public.b_coin_bank (session_id, idx, ch, prompt, choices, answer, why)
  select s.id, (q.ord - 1)::int, case when q.v ->> 'ch' ~ '^\d{1,4}$' then (q.v ->> 'ch')::int end, left(q.v ->> 'prompt', 400),
         q.v -> 'choices', left(q.v ->> 'answer', 200), left(q.v ->> 'why', 600)
    from jsonb_array_elements(p_questions) with ordinality q(v, ord)
   where jsonb_typeof(q.v -> 'choices') = 'array' and jsonb_array_length(q.v -> 'choices') between 2 and 6
     and coalesce(q.v ->> 'prompt', '') <> '' and coalesce(q.v ->> 'answer', '') <> ''
  on conflict (session_id, idx) do update set ch = excluded.ch, prompt = excluded.prompt, choices = excluded.choices,
    answer = excluded.answer, why = excluded.why, hidden_at = null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Host: start the clock (1 to 30 minutes).
create or replace function public.b_coin_start(p_session_id uuid, p_host_token text, p_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare s public.b_live_sessions := public._b_live_host(p_session_id, p_host_token);
begin
  if s.id is null or s.game_type <> 'coins' or s.phase <> 'lobby' then return false; end if;
  if not exists (select 1 from public.b_coin_bank b where b.session_id = s.id and b.hidden_at is null) then raise exception 'No questions loaded'; end if;
  update public.b_live_sessions x set phase = 'question', q_index = 0, q_started_at = now(),
         q_seconds = greatest(60, least(coalesce(p_seconds, 420), 1800)) where x.id = s.id;
  return true;
end $$;

-- Host: the live leaderboard.
create or replace function public.b_coin_board(p_session_id uuid, p_host_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.b_live_sessions := public._b_live_host(p_session_id, p_host_token);
begin
  if s.id is null or s.game_type <> 'coins' then return null; end if;
  return jsonb_build_object(
    'phase', s.phase, 'q_seconds', s.q_seconds,
    'seconds_left', case when s.phase = 'question' then greatest(0, s.q_seconds - extract(epoch from now() - s.q_started_at))::int end,
    'teams_n', nullif(s.settings ->> 'teams', '')::int,
    'bank', (select count(*) from public.b_coin_bank b where b.session_id = s.id and b.hidden_at is null),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'team', p.team, 'signed_in', p.student_id is not null,
                  'cash', coalesce(c.cash, 0), 'correct', coalesce(c.correct, 0), 'answered', coalesce(c.answered, 0))
                  order by coalesce(c.cash, 0) desc, p.joined_at), '[]')
                  from public.b_live_players p left join public.b_coin_players c on c.player_id = p.id where p.session_id = s.id),
    'teams', (select coalesce(jsonb_object_agg(t.team::text, t.cash), '{}')
                from (select p.team, sum(coalesce(c.cash, 0)) cash from public.b_live_players p
                        left join public.b_coin_players c on c.player_id = p.id
                       where p.session_id = s.id and p.team is not null group by p.team) t),
    'answered', (select coalesce(sum(c.answered), 0) from public.b_coin_players c where c.session_id = s.id),
    'correct', (select coalesce(sum(c.correct), 0) from public.b_coin_players c where c.session_id = s.id));
end $$;

-- Player helpers: check the token, make the wallet, lock it for this call.
create or replace function public._b_coin_player(p_player_id uuid, p_token text,
  out o_p public.b_live_players, out o_s public.b_live_sessions, out o_c public.b_coin_players)
language plpgsql security definer set search_path = public as $$
begin
  select * into o_p from public.b_live_players p where p.id = p_player_id and p.token_hash = public._b_sha(p_token);
  if o_p.id is null then raise exception 'Not in this game'; end if;
  select * into o_s from public.b_live_sessions s where s.id = o_p.session_id and s.game_type = 'coins';
  if o_s.id is null then raise exception 'Not a Gold Rush game'; end if;
  insert into public.b_coin_players (player_id, session_id) values (o_p.id, o_s.id) on conflict do nothing;
  select * into o_c from public.b_coin_players c where c.player_id = o_p.id for update;
end $$;

create or replace function public._b_coin_running(s public.b_live_sessions, p_grace int default 0) returns boolean
language sql stable as $$
  select s.phase = 'question' and s.q_started_at is not null and now() <= s.q_started_at + make_interval(secs => s.q_seconds + p_grace) $$;

-- A random question for this player (never the one they just had).
create or replace function public._b_coin_pick(p_session_id uuid, p_not int) returns int
language sql volatile security definer set search_path = public as $$
  select b.idx from public.b_coin_bank b where b.session_id = p_session_id and b.hidden_at is null and b.idx is distinct from p_not order by random() limit 1 $$;

-- What my phone shows.
create or replace function public._b_coin_view(p public.b_live_players, s public.b_live_sessions, c public.b_coin_players) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'phase', s.phase, 'running', public._b_coin_running(s),
    'seconds_left', case when s.phase = 'question' then greatest(0, s.q_seconds - extract(epoch from now() - s.q_started_at))::int end,
    'nickname', p.nickname, 'team', p.team, 'signed_in', p.student_id is not null,
    'cash', c.cash, 'earned', c.earned, 'streak', c.streak, 'answered', c.answered, 'correct', c.correct,
    'lv', jsonb_build_object('mpq', c.l_mpq, 'mult', c.l_mult, 'streak', c.l_streak, 'ins', c.l_ins),
    'rank', (select count(*) + 1 from public.b_coin_players c2 where c2.session_id = s.id and c2.cash > c.cash),
    'players', (select count(*) from public.b_live_players p2 where p2.session_id = s.id),
    'teams', case when p.team is not null then (
       select coalesce(jsonb_object_agg(t.team::text, t.cash), '{}')
         from (select p3.team, sum(coalesce(c3.cash, 0)) cash from public.b_live_players p3
                 left join public.b_coin_players c3 on c3.player_id = p3.id
                where p3.session_id = s.id and p3.team is not null group by p3.team) t) end,
    'question', case when public._b_coin_running(s) and c.cur_q is not null then (
       select jsonb_build_object('idx', b.idx, 'ch', b.ch, 'prompt', b.prompt, 'choices', b.choices)
         from public.b_coin_bank b where b.session_id = s.id and b.idx = c.cur_q and b.hidden_at is null) end) $$;

create or replace function public.b_coin_me(p_player_id uuid, p_player_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_p public.b_live_players; v_s public.b_live_sessions; v_c public.b_coin_players;
begin
  select * into r from public._b_coin_player(p_player_id, p_player_token);
  v_p := r.o_p; v_s := r.o_s; v_c := r.o_c;
  if public._b_coin_running(v_s) and v_c.cur_q is null then
    update public.b_coin_players c set cur_q = public._b_coin_pick(v_s.id, null) where c.player_id = v_p.id returning * into v_c;
  end if;
  return public._b_coin_view(v_p, v_s, v_c);
end $$;

-- Answer my current question. Right: Pickaxe + Rich Vein × streak (up to 10), × Sluice Box.
-- Wrong: lose half a Pickaxe haul, less Timber Supports. Returns the result and my new view.
create or replace function public.b_coin_answer(p_player_id uuid, p_player_token text, p_idx int, p_answer text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; b public.b_coin_bank; v_ok boolean; v_d bigint := 0;
        v_p public.b_live_players; v_s public.b_live_sessions; v_c public.b_coin_players;
begin
  select * into r from public._b_coin_player(p_player_id, p_player_token);
  v_p := r.o_p; v_s := r.o_s; v_c := r.o_c;
  if not public._b_coin_running(v_s, 2) then raise exception 'Time is up'; end if;
  if v_c.cur_q is null or v_c.cur_q <> p_idx then
    return jsonb_build_object('stale', true, 'me', public._b_coin_view(v_p, v_s, v_c));
  end if;
  if v_c.last_at is not null and now() - v_c.last_at < interval '600 milliseconds' then raise exception 'Too fast'; end if;
  select * into b from public.b_coin_bank x where x.session_id = v_s.id and x.idx = p_idx and x.hidden_at is null;
  v_ok := btrim(coalesce(p_answer, '')) = btrim(b.answer);
  if v_ok then
    v_d := round((public._b_coin_val('mpq', v_c.l_mpq) + public._b_coin_val('streak', v_c.l_streak) * least(v_c.streak, 10))
                 * public._b_coin_val('mult', v_c.l_mult));
    update public.b_coin_players c set cash = c.cash + v_d, earned = c.earned + v_d, streak = c.streak + 1,
           answered = c.answered + 1, correct = c.correct + 1, last_at = now(), cur_q = public._b_coin_pick(v_s.id, p_idx)
     where c.player_id = v_p.id returning * into v_c;
    -- +5 XP for each of the first 15 right answers per game (logged-in students)
    if v_c.correct <= 15 then perform public._b_xp_add(v_p.student_id, 'live', 'live:' || v_s.id || ':c' || v_c.correct, 5); end if;
  else
    v_d := - least(v_c.cash, round(public._b_coin_val('mpq', v_c.l_mpq) * 0.5 * (1 - public._b_coin_val('ins', v_c.l_ins)))::bigint);
    update public.b_coin_players c set cash = c.cash + v_d, streak = 0, answered = c.answered + 1, last_at = now(),
           cur_q = public._b_coin_pick(v_s.id, p_idx)
     where c.player_id = v_p.id returning * into v_c;
  end if;
  return jsonb_build_object('correct', v_ok, 'answer', b.answer, 'why', b.why, 'delta', v_d, 'me', public._b_coin_view(v_p, v_s, v_c));
end $$;

-- Buy the next level of a piece of gear.
create or replace function public.b_coin_buy(p_player_id uuid, p_player_token text, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_lvl int; v_cost bigint; v_p public.b_live_players; v_s public.b_live_sessions; v_c public.b_coin_players;
begin
  if p_kind not in ('mpq', 'mult', 'streak', 'ins') then raise exception 'Unknown upgrade'; end if;
  select * into r from public._b_coin_player(p_player_id, p_player_token);
  v_p := r.o_p; v_s := r.o_s; v_c := r.o_c;
  if not public._b_coin_running(v_s, 2) then raise exception 'Time is up'; end if;
  v_lvl := case p_kind when 'mpq' then v_c.l_mpq when 'mult' then v_c.l_mult when 'streak' then v_c.l_streak else v_c.l_ins end;
  v_cost := public._b_coin_cost(p_kind, v_lvl + 1);
  if v_cost is null then raise exception 'Already maxed'; end if;
  if v_cost > v_c.cash then raise exception 'Not enough gold'; end if;
  update public.b_coin_players c set cash = c.cash - v_cost,
         l_mpq = c.l_mpq + (p_kind = 'mpq')::int, l_mult = c.l_mult + (p_kind = 'mult')::int,
         l_streak = c.l_streak + (p_kind = 'streak')::int, l_ins = c.l_ins + (p_kind = 'ins')::int
   where c.player_id = v_p.id returning * into v_c;
  return public._b_coin_view(v_p, v_s, v_c);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 3. Partner games: two devices, one 4-letter code.
--   tictactoe  board 9 · connect4 board 42 (7 × 6, p_cell = column)
--   battleship "Core Sample Hunt": 8×8, 5 deposits (4, 3, 3, 2, 2 squares, never touching).
--              secret 128 = player 1's deposits (64) then player 2's. board 128 = player 1's drills then player 2's
--              ('0' not drilled, 'm' miss, 'h' hit, 's' whole deposit found). The other map is only sent after the round.
--   dots       6×6 dots: board 85 = 30 lines across, 30 lines down, 25 boxes ('0' open, '1'/'2' owner)
--   memory     Fossil Memory: 16 cards, secret = fossil letters (A-M), board = owners. Only flipped cards are sent.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_duel_games (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  game        text not null check (game in ('tictactoe', 'connect4', 'battleship', 'dots', 'memory')),
  board       text not null,
  secret      text,
  turn        int  not null default 1 check (turn in (1, 2)),
  starter     int  not null default 1 check (starter in (1, 2)),
  status      text not null default 'waiting' check (status in ('waiting', 'playing', 'done')),
  winner      int,                         -- 0 draw, 1, 2
  reason      text,                        -- 'win', 'draw', 'left', 'timeout', 'expired'
  last_move   int,
  moves       int  not null default 0,
  round       int  not null default 1,
  score1      int  not null default 0,
  score2      int  not null default 0,
  flip1       int,
  peek        text,
  peek_until  timestamptz,
  ready1      boolean not null default false,
  ready2      boolean not null default false,
  p1_name     text not null,
  p2_name     text,
  p1_tok      text not null,
  p2_tok      text,
  p1_student  uuid references public.b_students on delete set null,
  p2_student  uuid references public.b_students on delete set null,
  p1_seen     timestamptz not null default now(),
  p2_seen     timestamptz,
  rematch1    boolean not null default false,
  rematch2    boolean not null default false,
  recorded    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists b_duel_games_open_code on public.b_duel_games (code) where status <> 'done';
alter table public.b_duel_games enable row level security;
revoke all on public.b_duel_games from anon, authenticated;

-- Partner leaderboard: one row per student per game per term. Only rounds where BOTH players are
-- logged in (and are different students) count, so nobody can farm wins against themselves.
create table if not exists public.b_duel_scores (
  student_id uuid not null references public.b_students on delete cascade,
  term       text not null,
  game       text not null,
  wins       int  not null default 0,
  plays      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, term, game)
);
alter table public.b_duel_scores enable row level security;
revoke all on public.b_duel_scores from anon, authenticated;

-- 0 = nobody yet, 1 / 2 = that player has a line, 3 = board full (draw). Tic-Tac-Toe and Connect 4.
create or replace function public._b_duel_result(p_game text, b text) returns int
language plpgsql immutable as $$
declare cols int := case when p_game = 'connect4' then 7 else 3 end; rws int := case when p_game = 'connect4' then 6 else 3 end;
        need int := case when p_game = 'connect4' then 4 else 3 end; r int; c int; d int; k int; ch text; ok boolean;
        dr int[] := array[0, 1, 1, 1]; dc int[] := array[1, 0, 1, -1];
begin
  for r in 0..rws - 1 loop for c in 0..cols - 1 loop
    ch := substr(b, r * cols + c + 1, 1);
    if ch = '0' then continue; end if;
    for d in 1..4 loop
      ok := true;
      for k in 1..need - 1 loop
        if r + dr[d] * k < 0 or r + dr[d] * k >= rws or c + dc[d] * k < 0 or c + dc[d] * k >= cols
           or substr(b, (r + dr[d] * k) * cols + (c + dc[d] * k) + 1, 1) <> ch then ok := false; exit; end if;
      end loop;
      if ok then return ch::int; end if;
    end loop;
  end loop; end loop;
  if position('0' in b) = 0 then return 3; end if;
  return 0;
end $$;

-- One random 64-square map of 5 deposits; they never overlap or touch (not even corners).
create or replace function public._b_duel_bs_fleet() returns text
language plpgsql volatile as $$
declare lens int[] := array[4, 3, 3, 2, 2]; g text; ship int; tries int; ok boolean; horiz boolean;
        r int; c int; k int; rr int; cc int; dr int; dc int;
begin
  <<whole>> loop
    g := repeat('0', 64);
    for ship in 1..5 loop
      tries := 0; ok := false;
      while not ok and tries < 200 loop
        tries := tries + 1; horiz := random() < 0.5;
        r := floor(random() * (case when horiz then 8 else 9 - lens[ship] end))::int;
        c := floor(random() * (case when horiz then 9 - lens[ship] else 8 end))::int;
        ok := true;
        for k in 0..lens[ship] - 1 loop
          for dr in -1..1 loop for dc in -1..1 loop
            rr := r + (case when horiz then 0 else k end) + dr; cc := c + (case when horiz then k else 0 end) + dc;
            if rr between 0 and 7 and cc between 0 and 7 and substr(g, rr * 8 + cc + 1, 1) <> '0' then ok := false; end if;
          end loop; end loop;
        end loop;
      end loop;
      if not ok then continue whole; end if;
      for k in 0..lens[ship] - 1 loop
        rr := r + (case when horiz then 0 else k end); cc := c + (case when horiz then k else 0 end);
        g := overlay(g placing ship::text from rr * 8 + cc + 1 for 1);
      end loop;
    end loop;
    return g;
  end loop;
end $$;

-- Fossil Memory deck: 8 of the 13 fossils (letters A-M, same order as src/games/wave-b/fossil-art.ts), each twice, shuffled.
create or replace function public._b_duel_memory_deck() returns text
language sql volatile as $$
  select string_agg(l, '' order by random()) from (
    select l from (select chr(65 + i) l from generate_series(0, 12) i order by random() limit 8) p, generate_series(1, 2)) d $$;

create or replace function public._b_duel_size(p_game text) returns int language sql immutable as $$
  select case p_game when 'connect4' then 42 when 'battleship' then 128 when 'dots' then 85 when 'memory' then 16 else 9 end $$;
create or replace function public._b_duel_secret(p_game text) returns text language sql volatile as $$
  select case p_game when 'memory' then public._b_duel_memory_deck()
                     when 'battleship' then public._b_duel_bs_fleet() || public._b_duel_bs_fleet() end $$;

-- who is calling: 1, 2 or null
create or replace function public._b_duel_seat(g public.b_duel_games, p_token text) returns int
language sql stable set search_path = public as $$
  select case when g.p1_tok = public._b_sha(p_token) then 1 when g.p2_tok = public._b_sha(p_token) then 2 end $$;

create or replace function public._b_duel_finish(p_id uuid, p_winner int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare g public.b_duel_games; v_s uuid;
begin
  update public.b_duel_games set status = 'done', winner = p_winner, reason = p_reason, updated_at = now(),
         score1 = score1 + (case when p_winner = 1 then 1 else 0 end), score2 = score2 + (case when p_winner = 2 then 1 else 0 end)
   where id = p_id and status = 'playing' returning * into g;
  if g.id is null or g.recorded or g.p1_student is null or g.p2_student is null or g.p1_student = g.p2_student then return; end if;
  foreach v_s in array array[g.p1_student, g.p2_student] loop
    insert into public.b_duel_scores (student_id, term, game, wins, plays)
    values (v_s, public._b_set('term'), g.game, case when (p_winner = 1 and v_s = g.p1_student) or (p_winner = 2 and v_s = g.p2_student) then 1 else 0 end, 1)
    on conflict (student_id, term, game) do update set wins = b_duel_scores.wins + excluded.wins, plays = b_duel_scores.plays + 1, updated_at = now();
  end loop;
  update public.b_duel_games set recorded = true where id = p_id;
end $$;

-- What each player may see.
create or replace function public._b_duel_view(g public.b_duel_games, me int) returns jsonb
language plpgsql stable as $$
declare faces jsonb := '{}'; i int; p text; extra jsonb := '{}';
begin
  if g.game = 'memory' and g.secret is not null then
    for i in 0..15 loop
      if substr(g.board, i + 1, 1) <> '0' or g.flip1 = i or g.status = 'done' then faces := faces || jsonb_build_object(i::text, substr(g.secret, i + 1, 1)); end if;
    end loop;
    if g.peek is not null and g.peek_until > now() then
      foreach p in array string_to_array(g.peek, ',') loop faces := faces || jsonb_build_object(p, substr(g.secret, p::int + 1, 1)); end loop;
    end if;
  end if;
  if g.game = 'battleship' and g.secret is not null then
    extra := jsonb_build_object('ready1', g.ready1, 'ready2', g.ready2,
      'my_fleet', substr(g.secret, case when me = 1 then 1 else 65 end, 64),
      'opp_fleet', case when g.status = 'done' then substr(g.secret, case when me = 1 then 65 else 1 end, 64) end);
  end if;
  return jsonb_build_object(
    'id', g.id, 'code', g.code, 'game', g.game, 'board', g.board, 'turn', g.turn, 'status', g.status,
    'winner', g.winner, 'reason', g.reason, 'last_move', g.last_move, 'moves', g.moves, 'round', g.round,
    'score1', g.score1, 'score2', g.score2, 'p1_name', g.p1_name, 'p2_name', g.p2_name, 'me', me,
    'both_signed_in', g.p1_student is not null and g.p2_student is not null and g.p1_student <> g.p2_student,
    'rematch1', g.rematch1, 'rematch2', g.rematch2, 'faces', faces, 'flip1', g.flip1,
    'peek', case when g.peek_until > now() then g.peek end,
    'peek_ms', case when g.peek_until > now() then (extract(epoch from g.peek_until - now()) * 1000)::int else 0 end,
    'opp_online', case when me = 1 then g.p2_seen > now() - interval '15 seconds' else g.p1_seen > now() - interval '15 seconds' end) || extra;
end $$;

-- Player name: the Bedrock login's name if the login checks out, otherwise the typed name.
create or replace function public._b_duel_name(p_name text, p_id uuid, p_pin_hash text, out o_name text, out o_student uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_id is not null and public._b_ok(p_id, p_pin_hash) then
    select left(s.name, 16), s.id into o_name, o_student from public.b_students s where s.id = p_id;
  else
    o_name := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 16);
  end if;
  if coalesce(o_name, '') = '' then raise exception 'Enter a name'; end if;
end $$;

create or replace function public.b_duel_create(p_game text, p_token text, p_name text, p_id uuid default null, p_pin_hash text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n record; c text; g public.b_duel_games; tries int := 0;
begin
  if p_game not in ('tictactoe', 'connect4', 'battleship', 'dots', 'memory') then raise exception 'Unknown game'; end if;
  if length(coalesce(p_token, '')) < 16 then raise exception 'Bad token'; end if;
  -- tidy: open games idle 2 hours close (finished games are kept as 'done'; a future purge job could clear old ones)
  update public.b_duel_games set status = 'done', reason = coalesce(reason, 'expired') where status <> 'done' and updated_at < now() - interval '2 hours';
  if (select count(*) from public.b_duel_games where status <> 'done') >= 400 then raise exception 'Too many partner games are open right now. Try again in a minute.'; end if;
  select * into n from public._b_duel_name(p_name, p_id, p_pin_hash);
  loop
    c := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 4));
    begin
      insert into public.b_duel_games (code, game, board, secret, p1_name, p1_tok, p1_student)
      values (c, p_game, repeat('0', public._b_duel_size(p_game)), public._b_duel_secret(p_game), n.o_name, public._b_sha(p_token), n.o_student)
      returning * into g;
      exit;
    exception when unique_violation then
      tries := tries + 1; if tries > 20 then raise exception 'Try again'; end if;
    end;
  end loop;
  return public._b_duel_view(g, 1);
end $$;

create or replace function public.b_duel_join(p_code text, p_token text, p_name text, p_id uuid default null, p_pin_hash text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n record; g public.b_duel_games; me int;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'Bad token'; end if;
  select * into g from public.b_duel_games where code = upper(btrim(coalesce(p_code, ''))) and status <> 'done' for update;
  if g.id is null then raise exception 'No open game with that code'; end if;
  me := public._b_duel_seat(g, p_token);
  if me is not null then return public._b_duel_view(g, me); end if;
  if g.status <> 'waiting' then raise exception 'That game already has two players'; end if;
  select * into n from public._b_duel_name(p_name, p_id, p_pin_hash);
  update public.b_duel_games set p2_name = n.o_name, p2_tok = public._b_sha(p_token), p2_student = n.o_student,
         p2_seen = now(), status = 'playing', updated_at = now()
   where id = g.id returning * into g;
  return public._b_duel_view(g, 2);
end $$;

create or replace function public.b_duel_state(p_game_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g public.b_duel_games; me int;
begin
  select * into g from public.b_duel_games where id = p_game_id;
  if g.id is null then raise exception 'Game not found'; end if;
  me := public._b_duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  update public.b_duel_games set p1_seen = case when me = 1 then now() else p1_seen end,
                                 p2_seen = case when me = 2 then now() else p2_seen end where id = p_game_id;
  -- the other player gone for a minute during play: you win
  if g.status = 'playing' and ((me = 1 and g.p2_seen < now() - interval '60 seconds') or (me = 2 and g.p1_seen < now() - interval '60 seconds')) then
    perform public._b_duel_finish(p_game_id, me, 'timeout');
  end if;
  select * into g from public.b_duel_games where id = p_game_id;
  return public._b_duel_view(g, me);
end $$;

create or replace function public.b_duel_move(p_game_id uuid, p_token text, p_cell int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g public.b_duel_games; me int; idx int; r int; cc int; res int; b text; n1 int; n2 int;
        shots_at int; fleet_at int; ship text; i int; sunk boolean; hits int; got int;
begin
  select * into g from public.b_duel_games where id = p_game_id for update;
  if g.id is null then raise exception 'Game not found'; end if;
  me := public._b_duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.status <> 'playing' then raise exception 'Game is not in play'; end if;
  if p_cell is null then raise exception 'Bad move'; end if;

  if g.game = 'battleship' then
    if not (g.ready1 and g.ready2) then raise exception 'Waiting for both players to be ready'; end if;
    if g.turn <> me then raise exception 'Not your turn'; end if;
    if p_cell < 0 or p_cell > 63 then raise exception 'Bad square'; end if;
    shots_at := case when me = 1 then 0 else 64 end;     -- my drill sites in the board
    fleet_at := case when me = 1 then 64 else 0 end;     -- the map I am drilling into
    if substr(g.board, shots_at + p_cell + 1, 1) <> '0' then raise exception 'You already drilled there'; end if;
    ship := substr(g.secret, fleet_at + p_cell + 1, 1);
    if ship = '0' then
      b := overlay(g.board placing 'm' from shots_at + p_cell + 1 for 1);
    else
      b := overlay(g.board placing 'h' from shots_at + p_cell + 1 for 1);
      sunk := true;
      for i in 0..63 loop
        if substr(g.secret, fleet_at + i + 1, 1) = ship and substr(b, shots_at + i + 1, 1) = '0' then sunk := false; end if;
      end loop;
      if sunk then
        for i in 0..63 loop
          if substr(g.secret, fleet_at + i + 1, 1) = ship then b := overlay(b placing 's' from shots_at + i + 1 for 1); end if;
        end loop;
      end if;
    end if;
    update public.b_duel_games set board = b, last_move = shots_at + p_cell, moves = moves + 1, turn = 3 - me, updated_at = now(),
           p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
     where id = p_game_id;
    hits := 64 - length(replace(replace(substr(b, shots_at + 1, 64), 'h', ''), 's', ''));
    if hits >= 14 then perform public._b_duel_finish(p_game_id, me, 'win'); end if;
    select * into g from public.b_duel_games where id = p_game_id;
    return public._b_duel_view(g, me);
  end if;

  if g.turn <> me then raise exception 'Not your turn'; end if;

  if g.game = 'dots' then
    if p_cell < 0 or p_cell > 59 or substr(g.board, p_cell + 1, 1) <> '0' then raise exception 'That line is already drawn'; end if;
    b := overlay(g.board placing me::text from p_cell + 1 for 1);
    got := 0;
    for r in 0..4 loop for cc in 0..4 loop
      if substr(b, 61 + r * 5 + cc, 1) = '0'
         and substr(b, r * 5 + cc + 1, 1) <> '0' and substr(b, (r + 1) * 5 + cc + 1, 1) <> '0'
         and substr(b, 31 + r * 6 + cc, 1) <> '0' and substr(b, 32 + r * 6 + cc, 1) <> '0' then
        b := overlay(b placing me::text from 61 + r * 5 + cc for 1); got := got + 1;
      end if;
    end loop; end loop;
    -- closing a box earns another turn
    update public.b_duel_games set board = b, last_move = p_cell, moves = moves + 1, turn = case when got > 0 then me else 3 - me end, updated_at = now(),
           p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
     where id = p_game_id;
    if position('0' in substr(b, 61, 25)) = 0 then
      n1 := 25 - length(replace(substr(b, 61, 25), '1', '')); n2 := 25 - n1;
      perform public._b_duel_finish(p_game_id, case when n1 > n2 then 1 else 2 end, 'win');
    end if;
    select * into g from public.b_duel_games where id = p_game_id;
    return public._b_duel_view(g, me);
  end if;

  if g.game = 'memory' then
    if g.peek_until > now() then raise exception 'Wait for the cards to flip back'; end if;
    if p_cell < 0 or p_cell > 15 or substr(g.board, p_cell + 1, 1) <> '0' or g.flip1 = p_cell then raise exception 'Pick a face-down card'; end if;
    if g.flip1 is null then
      update public.b_duel_games set flip1 = p_cell, last_move = p_cell, peek = null, peek_until = null, updated_at = now(),
             p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
       where id = p_game_id;
    elsif substr(g.secret, g.flip1 + 1, 1) = substr(g.secret, p_cell + 1, 1) then
      -- a match: both cards are yours, and you go again
      b := overlay(overlay(g.board placing me::text from g.flip1 + 1 for 1) placing me::text from p_cell + 1 for 1);
      update public.b_duel_games set board = b, flip1 = null, last_move = p_cell, moves = moves + 1, peek = null, peek_until = null, updated_at = now(),
             p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
       where id = p_game_id;
      if position('0' in b) = 0 then
        n1 := length(b) - length(replace(b, '1', '')); n2 := length(b) - length(replace(b, '2', ''));
        perform public._b_duel_finish(p_game_id, case when n1 > n2 then 1 when n2 > n1 then 2 else 0 end, case when n1 = n2 then 'draw' else 'win' end);
      end if;
    else
      -- a miss: both show for a moment, then it's the other player's turn
      update public.b_duel_games set flip1 = null, last_move = p_cell, moves = moves + 1, turn = 3 - me,
             peek = g.flip1 || ',' || p_cell, peek_until = now() + interval '1.6 seconds', updated_at = now(),
             p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
       where id = p_game_id;
    end if;
    select * into g from public.b_duel_games where id = p_game_id;
    return public._b_duel_view(g, me);
  end if;

  if g.game = 'connect4' then      -- p_cell is the column; the piece drops to the lowest open spot
    if p_cell < 0 or p_cell > 6 then raise exception 'Bad column'; end if;
    idx := null;
    for r in reverse 5..0 loop if substr(g.board, r * 7 + p_cell + 1, 1) = '0' then idx := r * 7 + p_cell; exit; end if; end loop;
    if idx is null then raise exception 'Column is full'; end if;
  else
    if p_cell < 0 or p_cell > 8 or substr(g.board, p_cell + 1, 1) <> '0' then raise exception 'Square taken'; end if;
    idx := p_cell;
  end if;
  b := overlay(g.board placing me::text from idx + 1 for 1);
  update public.b_duel_games set board = b, last_move = idx, moves = moves + 1, turn = 3 - me, updated_at = now(),
         p1_seen = case when me = 1 then now() else p1_seen end, p2_seen = case when me = 2 then now() else p2_seen end
   where id = p_game_id;
  res := public._b_duel_result(g.game, b);
  if res in (1, 2) then perform public._b_duel_finish(p_game_id, res, 'win');
  elsif res = 3 then perform public._b_duel_finish(p_game_id, 0, 'draw'); end if;
  select * into g from public.b_duel_games where id = p_game_id;
  return public._b_duel_view(g, me);
end $$;

-- Core Sample Hunt setup: 'shuffle' my map (before I'm ready) or say I'm 'ready'.
create or replace function public.b_duel_setup(p_game_id uuid, p_token text, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g public.b_duel_games; me int;
begin
  select * into g from public.b_duel_games where id = p_game_id for update;
  if g.id is null then raise exception 'Game not found'; end if;
  me := public._b_duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.game <> 'battleship' then raise exception 'Not a Core Sample Hunt game'; end if;
  if g.status = 'done' then raise exception 'Game is over'; end if;
  if (me = 1 and g.ready1) or (me = 2 and g.ready2) then return public._b_duel_view(g, me); end if;
  if p_action = 'shuffle' then
    update public.b_duel_games set secret = case when me = 1 then public._b_duel_bs_fleet() || substr(secret, 65, 64)
                                                  else substr(secret, 1, 64) || public._b_duel_bs_fleet() end, updated_at = now()
     where id = p_game_id returning * into g;
  elsif p_action = 'ready' then
    update public.b_duel_games set ready1 = ready1 or me = 1, ready2 = ready2 or me = 2, updated_at = now()
     where id = p_game_id returning * into g;
  else raise exception 'Unknown action'; end if;
  return public._b_duel_view(g, me);
end $$;

create or replace function public.b_duel_leave(p_game_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g public.b_duel_games; me int;
begin
  select * into g from public.b_duel_games where id = p_game_id;
  if g.id is null then return null; end if;
  me := public._b_duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.status = 'playing' then perform public._b_duel_finish(p_game_id, 3 - me, 'left');
  elsif g.status = 'waiting' then update public.b_duel_games set status = 'done', reason = 'left', updated_at = now() where id = p_game_id;
  else update public.b_duel_games set reason = 'left', rematch1 = false, rematch2 = false, updated_at = now() where id = p_game_id; end if;
  select * into g from public.b_duel_games where id = p_game_id;
  return public._b_duel_view(g, me);
end $$;

-- Both press Rematch: a fresh board, the other player goes first, the series score is kept.
create or replace function public.b_duel_rematch(p_game_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g public.b_duel_games; me int;
begin
  select * into g from public.b_duel_games where id = p_game_id for update;
  if g.id is null then raise exception 'Game not found'; end if;
  me := public._b_duel_seat(g, p_token); if me is null then raise exception 'Not your game'; end if;
  if g.status <> 'done' or g.reason in ('left', 'expired') then raise exception 'Rematch not available'; end if;
  update public.b_duel_games set rematch1 = rematch1 or me = 1, rematch2 = rematch2 or me = 2, updated_at = now()
   where id = p_game_id returning * into g;
  if g.rematch1 and g.rematch2 then
    update public.b_duel_games set board = repeat('0', length(board)), status = 'playing', winner = null, reason = null,
           last_move = null, moves = 0, round = round + 1, starter = 3 - starter, turn = 3 - starter,
           secret = public._b_duel_secret(game), flip1 = null, peek = null, peek_until = null, ready1 = false, ready2 = false,
           rematch1 = false, rematch2 = false, recorded = false, updated_at = now(), p1_seen = now(), p2_seen = now()
     where id = p_game_id returning * into g;
  end if;
  return public._b_duel_view(g, me);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 4. Ask Mr. Dopp: anonymous student questions.
--   Only logged-in students can ask (keeps spam out), but a question is saved WITHOUT the student and with only
--   the day. b_ask_limits counts questions per student per day (max 3) and nothing else.
--   The teacher reads every question, answers, and posts it to the class board or keeps it for class.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_ask_questions (
  id          uuid primary key default gen_random_uuid(),
  term        text not null,
  day         date not null default public._b_today(),
  topic       text not null default 'Earth science question',
  body        text not null check (char_length(body) between 3 and 1000),
  answer      text,
  status      text not null default 'new' check (status in ('new', 'posted', 'in_class', 'skipped')),
  answered_on date,
  hidden_at   timestamptz             -- set = the teacher removed it (soft); hidden from every list
);
alter table public.b_ask_questions add column if not exists hidden_at timestamptz;
create index if not exists b_ask_questions_term on public.b_ask_questions (term, status);
create table if not exists public.b_ask_limits (
  student_id uuid not null references public.b_students on delete cascade,
  day        date not null,
  n          int  not null default 0,
  primary key (student_id, day)
);
alter table public.b_ask_questions enable row level security;
alter table public.b_ask_limits enable row level security;
revoke all on public.b_ask_questions, public.b_ask_limits from anon, authenticated;

create or replace function public.b_ask_submit(p_id uuid, p_pin_hash text, p_topic text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := public._b_today(); used int; v_body text := btrim(coalesce(p_body, ''));
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if char_length(v_body) < 3 then raise exception 'Please type your question'; end if;
  if char_length(v_body) > 1000 then raise exception 'Please keep it under 1000 characters'; end if;
  -- (old b_ask_limits days are simply ignored; a future purge job could clear them)
  select n into used from public.b_ask_limits where student_id = p_id and day = d;
  if coalesce(used, 0) >= 3 then raise exception 'You can ask 3 questions a day. Try again tomorrow!'; end if;
  insert into public.b_ask_limits (student_id, day, n) values (p_id, d, 1)
    on conflict (student_id, day) do update set n = public.b_ask_limits.n + 1;
  insert into public.b_ask_questions (term, day, topic, body)
    values (public._b_set('term'), d, left(coalesce(nullif(btrim(p_topic), ''), 'Earth science question'), 60), v_body);
  return jsonb_build_object('ok', true, 'left_today', 2 - coalesce(used, 0));
end $$;

-- The class board: answered questions the teacher posted this term, newest first.
create or replace function public.b_ask_board(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('topic', q.topic, 'body', q.body, 'answer', q.answer, 'answered_on', q.answered_on)
                     order by q.answered_on desc nulls last, q.day desc)
                     from public.b_ask_questions q where q.term = public._b_set('term') and q.status = 'posted' and q.hidden_at is null), '[]');
end $$;

create or replace function public.b_ask_teacher_list(p_pass_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'day', q.day, 'topic', q.topic, 'body', q.body,
                     'answer', q.answer, 'status', q.status, 'answered_on', q.answered_on) order by (q.status = 'new') desc, q.day desc)
                     from public.b_ask_questions q where q.term = public._b_set('term') and q.hidden_at is null), '[]');
end $$;

-- p_status: 'posted' (class board), 'in_class' (answered out loud), 'skipped', or 'new'.
-- p_body lets the teacher tidy the wording (typos, names) before posting; null keeps it.
create or replace function public.b_ask_teacher_set(p_pass_hash text, p_question uuid, p_answer text, p_status text, p_body text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if p_status not in ('new', 'posted', 'in_class', 'skipped') then raise exception 'Bad status'; end if;
  if p_status = 'posted' and char_length(btrim(coalesce(p_answer, ''))) = 0 then raise exception 'Write an answer before posting'; end if;
  update public.b_ask_questions set
    answer = left(nullif(btrim(coalesce(p_answer, '')), ''), 4000),
    body = case when char_length(btrim(coalesce(p_body, ''))) >= 3 then left(btrim(p_body), 1000) else body end,
    status = p_status,
    answered_on = case when p_status in ('posted', 'in_class') then coalesce(answered_on, public._b_today()) end
  where id = p_question and hidden_at is null;
  return public.b_ask_teacher_list(p_pass_hash);
end $$;

-- Remove = soft: hidden_at is set and the question leaves every list (a future purge job could clear old ones).
create or replace function public.b_ask_teacher_hide(p_pass_hash text, p_question uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  update public.b_ask_questions set hidden_at = now() where id = p_question and hidden_at is null;
  return public.b_ask_teacher_list(p_pass_hash);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 5. Lava Snipes network mode: site-wide player cap.
--   The game itself runs over a Supabase Realtime broadcast channel per game code (no table, no policies).
--   Realtime's free-plan budget (~100 messages/second) is shared with Dopps Class's Germ Snipes in this project,
--   so Bedrock keeps its own small cap (b_settings 'snipes_cap', default 6 players across all Bedrock games).
--   Hosts reserve a seat with b_snipes_host, check in with b_snipes_beat every 10 s (and before letting someone
--   join), and free it with b_snipes_end. A game silent for 25 s frees its seats. Ended or silent games are just
--   ignored (b_snipes_end marks players = 0 and an old beat_at); the code can be hosted again.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_snipes_games (
  code       text primary key check (code ~ '^[A-Z0-9]{4}$'),
  token_hash text not null,
  players    int  not null default 1 check (players between 0 and 8),
  created_at timestamptz not null default now(),
  beat_at    timestamptz not null default now()
);
alter table public.b_snipes_games enable row level security;
revoke all on public.b_snipes_games from anon, authenticated;
insert into public.b_settings (k, v) values ('snipes_cap', '6') on conflict (k) do nothing;

create or replace function public._b_snipes_cap() returns int language sql stable security definer set search_path = public as $$
  select coalesce(nullif(public._b_set('snipes_cap'), '')::int, 6) $$;

create or replace function public.b_snipes_host(p_code text, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_used int; v_games int; v_cap int := public._b_snipes_cap();
begin
  if coalesce(p_code, '') !~ '^[A-Z0-9]{4}$' or length(coalesce(p_token, '')) < 16 then raise exception 'Bad game code'; end if;
  select coalesce(sum(players), 0), count(*) into v_used, v_games from public.b_snipes_games
   where code <> p_code and beat_at >= now() - interval '25 seconds';
  if v_used + 1 > v_cap then return jsonb_build_object('ok', false, 'players', v_used, 'games', v_games, 'cap', v_cap); end if;
  insert into public.b_snipes_games (code, token_hash) values (p_code, public._b_sha(p_token))
    on conflict (code) do update set token_hash = excluded.token_hash, players = 1, beat_at = now(),
      created_at = case when public.b_snipes_games.beat_at < now() - interval '25 seconds' then now() else public.b_snipes_games.created_at end
    where public.b_snipes_games.token_hash = excluded.token_hash or public.b_snipes_games.beat_at < now() - interval '25 seconds';
  if not found then return jsonb_build_object('ok', false, 'taken', true, 'players', v_used, 'games', v_games, 'cap', v_cap); end if;
  return jsonb_build_object('ok', true, 'players', v_used + 1, 'games', v_games + 1, 'cap', v_cap);
end $$;

-- p_players = players the host wants to have (current + anyone asking to join). ok=false means "don't let them in".
create or replace function public.b_snipes_beat(p_code text, p_token text, p_players int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_used int; v_games int; v_cap int := public._b_snipes_cap(); v_n int := greatest(1, least(coalesce(p_players, 1), 8));
begin
  select coalesce(sum(players), 0), count(*) into v_used, v_games from public.b_snipes_games
   where code <> p_code and beat_at >= now() - interval '25 seconds';
  if v_used + v_n > v_cap then
    update public.b_snipes_games set beat_at = now()
     where code = p_code and token_hash = public._b_sha(p_token) and beat_at >= now() - interval '25 seconds';
    return jsonb_build_object('ok', false, 'players', v_used, 'games', v_games, 'cap', v_cap, 'room', greatest(0, v_cap - v_used));
  end if;
  update public.b_snipes_games set players = v_n, beat_at = now()
   where code = p_code and token_hash = public._b_sha(p_token) and beat_at >= now() - interval '25 seconds';
  if not found then raise exception 'Game not found'; end if;
  return jsonb_build_object('ok', true, 'players', v_used + v_n, 'games', v_games + 1, 'cap', v_cap, 'room', v_cap - v_used);
end $$;

create or replace function public.b_snipes_end(p_code text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.b_snipes_games set players = 0, beat_at = now() - interval '1 day'
   where code = p_code and token_hash = public._b_sha(p_token) and beat_at >= now() - interval '25 seconds';
  return found;
end $$;

-- Partner leaderboard (this term): wins per game and overall. Names are shortened like the Hall of Champions.
create or replace function public.b_duel_board() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', md5(x.student_id::text), 'name', public._b_pub_name(st.name), 'period', st.period,
           'wins', x.wins, 'plays', x.plays, 'games', x.games) order by x.wins desc, x.plays, st.name), '[]')
    from (select student_id, sum(wins)::int wins, sum(plays)::int plays,
                 jsonb_object_agg(game, jsonb_build_object('wins', wins, 'plays', plays)) games
            from public.b_duel_scores where term = public._b_set('term') group by student_id) x
    join public.b_students st on st.id = x.student_id
   where x.plays > 0 $$;

-- ════════════════════════════════════════════════════════════════════
-- 6. Game XP in the Quest page, the teacher roster and the Hall of Champions.
--    These replace the versions in schema.sql / 005_pet.sql; the only change is the added game XP.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.b_state(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  insert into public.b_days values (p_id, public._b_today()) on conflict do nothing;
  return jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(task_key) from public.b_tasks where student_id = p_id), '[]'),
    'days', coalesce((select jsonb_agg(day order by day) from public.b_days where student_id = p_id), '[]'),
    'best', coalesce((select jsonb_object_agg(kind || ref, best) from (
               select kind, ref, max(round(100.0 * score / total))::int best from public.b_attempts
               where student_id = p_id group by kind, ref) b), '{}'),
    'firstTry', coalesce((select jsonb_object_agg(ref, pct) from (
               select distinct on (ref) ref, round(100.0 * score / total)::int pct from public.b_attempts
               where student_id = p_id and kind = 'chapter' order by ref, created_at) f), '{}'),
    'unitTries', coalesce((select jsonb_object_agg(ref, n) from (
               select ref, count(*) n from public.b_attempts where student_id = p_id and kind = 'unit' group by ref) u), '{}'),
    'sideQuests', coalesce((select jsonb_agg(jsonb_build_object('id', quest_id, 'term', term, 'approved', approved))
               from public.b_side_quests where student_id = p_id), '[]'),
    'votes', (select count(*) from public.b_votes where student_id = p_id and kind = 'survey'),
    'cleared', coalesce((select jsonb_agg(realm order by realm) from public.b_cleared where student_id = p_id), '[]'),
    'term', public._b_set('term'),
    'unitAttempts', public._b_set('unit_attempts')::int,
    'gameXp', public._b_xp_total(p_id)
  );
end $$;

create or replace function public.b_teacher_roster(p_pass_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'period', s.period,
      'tasks', (select coalesce(jsonb_agg(task_key), '[]') from public.b_tasks t where t.student_id = s.id),
      'days', (select count(*) from public.b_days d where d.student_id = s.id),
      'best', (select coalesce(jsonb_object_agg(kind || ref, best), '{}') from (
                 select kind, ref, max(round(100.0 * score / total))::int best from public.b_attempts a
                 where a.student_id = s.id group by kind, ref) b),
      'sideQuests', (select coalesce(jsonb_agg(jsonb_build_object('id', quest_id, 'term', term, 'note', note, 'approved', approved)), '[]')
                 from public.b_side_quests q where q.student_id = s.id),
      'cleared', (select coalesce(jsonb_agg(realm order by realm), '[]') from public.b_cleared c where c.student_id = s.id),
      'gameXp', public._b_xp_total(s.id)
    ) order by s.period, s.name) from public.b_students s), '[]');
end $$;

-- Hall of Champions (005_pet.sql) plus game XP: it is server-written, so it counts toward both Quest XP and Verified XP.
create or replace function public.b_champions() returns jsonb
language sql stable security definer set search_path = public as $$
  with t as (
    select s.id, s.name, s.period,
      (select count(*) from public.b_tasks x where x.student_id = s.id and x.task_key ~ '^(ch\d+[a-z]?_(read|quiz|tls)|unit\d+|cw\d+)$') tasks,
      (select count(*) from public.b_tasks x where x.student_id = s.id and x.task_key ~ '^(ch\d+[a-z]?_quiz|unit\d+|cw\d+)$') graded,
      (select count(*) from public.b_days d where d.student_id = s.id) days,
      (select count(*) from public.b_side_quests q where q.student_id = s.id and q.approved) quests,
      (select count(*) from public.b_cleared c where c.student_id = s.id) cleared,
      (select count(*) from public.b_tasks x where x.student_id = s.id and x.task_key ~ '^unit\d+$') units,
      public._b_xp_total(s.id) game_xp,
      public._b_streak(s.id) streak
    from public.b_students s)
  select coalesce(jsonb_agg(jsonb_build_object('id', md5(id::text), 'name', public._b_pub_name(name), 'period', period,
           'xp', tasks * 25 + days * 5 + quests * 50 + game_xp, 'verified_xp', graded * 25 + game_xp, 'game_xp', game_xp,
           'tasks', tasks, 'days', days, 'cleared', cleared, 'units', units, 'streak', streak)
         order by graded * 25 + game_xp desc, tasks * 25 + days * 5 + quests * 50 + game_xp desc, streak desc, days desc), '[]')
    from t $$;

-- ---------- grants: only the public functions are callable from the website ----------
revoke execute on function public._b_sha, public._b_xp_add, public._b_xp_total, public._b_live_award_bonus, public._b_live_host, public._b_coin_val, public._b_coin_cost,
  public._b_coin_player, public._b_coin_running, public._b_coin_pick, public._b_coin_view,
  public._b_duel_result, public._b_duel_bs_fleet, public._b_duel_memory_deck, public._b_duel_size, public._b_duel_secret,
  public._b_duel_seat, public._b_duel_finish, public._b_duel_view, public._b_duel_name, public._b_snipes_cap,
  public.b_live_create, public.b_live_set_question, public.b_live_set_hp, public.b_live_set_phase, public.b_live_results,
  public.b_live_join, public.b_live_answer, public.b_live_state,
  public.b_coin_setup, public.b_coin_start, public.b_coin_board, public.b_coin_me, public.b_coin_answer, public.b_coin_buy,
  public.b_duel_create, public.b_duel_join, public.b_duel_state, public.b_duel_move, public.b_duel_setup, public.b_duel_leave, public.b_duel_rematch,
  public.b_ask_submit, public.b_ask_board, public.b_ask_teacher_list, public.b_ask_teacher_set, public.b_ask_teacher_hide,
  public.b_snipes_host, public.b_snipes_beat, public.b_snipes_end, public.b_duel_board
  from public, anon, authenticated;
grant execute on function public.b_live_create, public.b_live_set_question, public.b_live_set_hp, public.b_live_set_phase, public.b_live_results,
  public.b_live_join, public.b_live_answer, public.b_live_state,
  public.b_coin_setup, public.b_coin_start, public.b_coin_board, public.b_coin_me, public.b_coin_answer, public.b_coin_buy,
  public.b_duel_create, public.b_duel_join, public.b_duel_state, public.b_duel_move, public.b_duel_setup, public.b_duel_leave, public.b_duel_rematch,
  public.b_ask_submit, public.b_ask_board, public.b_ask_teacher_list, public.b_ask_teacher_set, public.b_ask_teacher_hide,
  public.b_snipes_host, public.b_snipes_beat, public.b_snipes_end, public.b_duel_board,
  public.b_state, public.b_teacher_roster, public.b_champions to anon;
-- ── end wave-live ──

-- ── wave-twinA: Be Ready twins: Quake Ready, Hazard PSA (same as supabase/migrations/007_twinsA.sql) ──
-- ════════════════════════════════════════════════════════════════════
-- Project saves (Dopps Class student-save.js / save_project_data, one row per student per project)
--   quake_ready : Quake Ready quest steps {protect, spot, hold, after, quiz}, done when the quick check is passed.
--                 drill_ok = the teacher checked off the in-class earthquake drill (paper check-off sheet → dashboard).
--   hazard_psa  : the member's own Hazard PSA reflection {group, title, contribution, learned}.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.b_projects (
  student_id uuid not null references public.b_students on delete cascade,
  key        text not null check (key in ('quake_ready', 'hazard_psa')),
  data       jsonb not null default '{}',
  done_at    timestamptz,                       -- first time the page reported the project done (kept after that)
  drill_ok   boolean not null default false,    -- teacher check-off (quake_ready)
  drill_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, key)
);
alter table public.b_projects enable row level security;
revoke all on public.b_projects from anon, authenticated;

create or replace function public._b_proj_view(r public.b_projects) returns jsonb language sql stable set search_path = public as $$
  select case when r.student_id is null then null else
    jsonb_build_object('data', r.data, 'done_at', r.done_at, 'drill_ok', r.drill_ok, 'drill_at', r.drill_at, 'updated_at', r.updated_at) end $$;

create or replace function public.b_project_get(p_id uuid, p_pin_hash text, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_projects;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  select * into r from public.b_projects where student_id = p_id and key = p_key;
  if not found then return null; end if;
  return public._b_proj_view(r);
end $$;

create or replace function public.b_project_save(p_id uuid, p_pin_hash text, p_key text, p_data jsonb, p_done boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_projects;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_key is null or p_key not in ('quake_ready', 'hazard_psa') then raise exception 'Unknown project'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Nothing to save'; end if;
  if length(p_data::text) > 20000 then raise exception 'That is too long to save'; end if;
  insert into public.b_projects as x (student_id, key, data, done_at)
    values (p_id, p_key, p_data, case when coalesce(p_done, false) then now() end)
    on conflict (student_id, key) do update
      set data = excluded.data, updated_at = now(),
          done_at = coalesce(x.done_at, excluded.done_at)        -- done stays done; drill fields are the teacher's
    returning * into r;
  return public._b_proj_view(r);
end $$;

-- Teacher: every student (also ones who never opened the page, so the drill can be checked off for anyone).
create or replace function public.b_teacher_projects(p_pass_hash text, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('student', s.id, 'name', s.name, 'period', s.period,
                    'data', x.data, 'done_at', x.done_at, 'drill_ok', coalesce(x.drill_ok, false), 'drill_at', x.drill_at,
                    'updated_at', x.updated_at) order by s.period, s.name), '[]')
            from public.b_students s left join public.b_projects x on x.student_id = s.id and x.key = p_key);
end $$;

create or replace function public.b_teacher_project_drill(p_pass_hash text, p_student uuid, p_key text, p_ok boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_projects;
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if p_key is null or p_key <> 'quake_ready' then raise exception 'Only Quake Ready has a drill check-off'; end if;
  if not exists (select 1 from public.b_students where id = p_student) then raise exception 'Unknown student'; end if;
  insert into public.b_projects as x (student_id, key, drill_ok, drill_at)
    values (p_student, p_key, coalesce(p_ok, false), case when coalesce(p_ok, false) then now() end)
    on conflict (student_id, key) do update
      set drill_ok = excluded.drill_ok, drill_at = excluded.drill_at
    returning * into r;
  return public._b_proj_view(r);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Hazard PSA Challenge (Dopps Class psa_challenge.html sent groups to a Google Form; Bedrock keeps the link here)
-- One person per group turns in the group's video link. Mr. Dopp scores it on the page's 100-point rubric.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.b_psa (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.b_students on delete cascade,   -- the group member who turned it in
  term          text not null,
  group_name    text not null,
  title         text not null,
  hazard        text not null,
  link          text not null,
  length_sec    int  check (length_sec between 1 and 3600),
  roster        text not null,          -- members and roles
  ai_tools      text,
  contributions text,
  on_camera     boolean not null default false,
  source        text,                   -- the agency the group's facts came from (USGS, NWS, Ready.gov, ...)
  scores        jsonb,                  -- {plan, team, message, creative, production, rules}
  total         int,
  note          text,                   -- teacher's note to the group
  graded_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (student_id, term)
);
alter table public.b_psa enable row level security;
revoke all on public.b_psa from anon, authenticated;

-- Rubric (same 100 points as the page): planning 20, teamwork 20, message 20, creativity 15, production 15, requirements 10.
create or replace function public._b_psa_rubric() returns jsonb language sql immutable set search_path = public as $$
  select '{"plan": 20, "team": 20, "message": 20, "creative": 15, "production": 15, "rules": 10}'::jsonb $$;

create or replace function public._b_psa_view(r public.b_psa) returns jsonb language sql stable set search_path = public as $$
  select case when r.id is null then null else
    jsonb_build_object('id', r.id, 'term', r.term, 'group_name', r.group_name, 'title', r.title, 'hazard', r.hazard, 'link', r.link,
      'length_sec', r.length_sec, 'roster', r.roster, 'ai_tools', r.ai_tools, 'contributions', r.contributions, 'on_camera', r.on_camera,
      'source', r.source, 'scores', r.scores, 'total', r.total, 'note', r.note, 'graded_at', r.graded_at,
      'created_at', r.created_at, 'updated_at', r.updated_at) end $$;

create or replace function public._b_psa_txt(p jsonb, k text, p_max int) returns text language sql immutable set search_path = public as $$
  select nullif(left(btrim(coalesce(p ->> k, '')), p_max), '') $$;

create or replace function public.b_psa_mine(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_psa;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  select * into r from public.b_psa where student_id = p_id and term = public._b_set('term');
  if not found then return null; end if;
  return public._b_psa_view(r);
end $$;

create or replace function public.b_psa_submit(p_id uuid, p_pin_hash text, p_psa jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_psa; t text := public._b_set('term'); lnk text; secs int;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_psa is null or jsonb_typeof(p_psa) <> 'object' then raise exception 'Nothing to turn in'; end if;
  if exists (select 1 from public.b_psa where student_id = p_id and term = t and graded_at is not null) then
    raise exception 'Mr. Dopp already scored this PSA. Ask him if something needs to change.';
  end if;
  lnk := public._b_psa_txt(p_psa, 'link', 500);
  if lnk is null or lnk !~* '^https://[^\s]+$' then raise exception 'Paste the full video link (it starts with https://)'; end if;
  if public._b_psa_txt(p_psa, 'group_name', 80) is null or public._b_psa_txt(p_psa, 'title', 120) is null
     or public._b_psa_txt(p_psa, 'hazard', 80) is null or public._b_psa_txt(p_psa, 'roster', 2000) is null then
    raise exception 'Fill in the group name, title, hazard and roster';
  end if;
  secs := case when coalesce(p_psa ->> 'length_sec', '') ~ '^\d{1,4}$' then (p_psa ->> 'length_sec')::int end;
  if secs is not null and (secs < 1 or secs > 3600) then secs := null; end if;
  insert into public.b_psa as x (student_id, term, group_name, title, hazard, link, length_sec, roster, ai_tools, contributions, on_camera, source)
    values (p_id, t, public._b_psa_txt(p_psa, 'group_name', 80), public._b_psa_txt(p_psa, 'title', 120), public._b_psa_txt(p_psa, 'hazard', 80),
            lnk, secs, public._b_psa_txt(p_psa, 'roster', 2000), public._b_psa_txt(p_psa, 'ai_tools', 2000),
            public._b_psa_txt(p_psa, 'contributions', 3000), coalesce((p_psa ->> 'on_camera')::boolean, false), public._b_psa_txt(p_psa, 'source', 300))
    on conflict (student_id, term) do update set
      group_name = excluded.group_name, title = excluded.title, hazard = excluded.hazard, link = excluded.link, length_sec = excluded.length_sec,
      roster = excluded.roster, ai_tools = excluded.ai_tools, contributions = excluded.contributions, on_camera = excluded.on_camera,
      source = excluded.source, updated_at = now()
    returning * into r;
  return public._b_psa_view(r);
end $$;

-- Teacher: every PSA (this term by default, or p_term = 'all'), with who turned it in.
create or replace function public.b_teacher_psa_list(p_pass_hash text, p_term text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text := coalesce(p_term, public._b_set('term'));
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select coalesce(jsonb_agg(public._b_psa_view(p) || jsonb_build_object('student', s.id, 'name', s.name, 'period', s.period)
                    order by s.period, p.group_name), '[]')
            from public.b_psa p join public.b_students s on s.id = p.student_id
           where t = 'all' or p.term = t);
end $$;

-- Teacher: score a PSA on the rubric (each part 0..its max). p_scores = null reopens it (unscored, the group can edit again).
create or replace function public.b_teacher_psa_grade(p_pass_hash text, p_psa uuid, p_scores jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rub jsonb := public._b_psa_rubric(); k text; v int; tot int := 0; clean jsonb := '{}'; r public.b_psa;
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if not exists (select 1 from public.b_psa where id = p_psa) then raise exception 'Unknown PSA'; end if;
  if p_scores is null then
    update public.b_psa set scores = null, total = null, graded_at = null, note = left(nullif(btrim(coalesce(p_note, '')), ''), 2000), updated_at = now()
     where id = p_psa returning * into r;
    return public._b_psa_view(r);
  end if;
  if jsonb_typeof(p_scores) <> 'object' then raise exception 'Scores must be an object'; end if;
  for k in select jsonb_object_keys(rub) loop
    if coalesce(p_scores ->> k, '') !~ '^\d{1,3}$' then raise exception 'Score every part of the rubric (missing %)', k; end if;
    v := (p_scores ->> k)::int;
    if v > (rub ->> k)::int then raise exception '% can be at most %', k, rub ->> k; end if;
    clean := clean || jsonb_build_object(k, v); tot := tot + v;
  end loop;
  update public.b_psa set scores = clean, total = tot, graded_at = now(), note = left(nullif(btrim(coalesce(p_note, '')), ''), 2000), updated_at = now()
   where id = p_psa returning * into r;
  return public._b_psa_view(r);
end $$;

-- ---------- grants: only the public functions are callable from the website ----------
revoke execute on function public._b_proj_view, public._b_psa_rubric, public._b_psa_view, public._b_psa_txt,
  public.b_project_get, public.b_project_save, public.b_teacher_projects, public.b_teacher_project_drill,
  public.b_psa_mine, public.b_psa_submit, public.b_teacher_psa_list, public.b_teacher_psa_grade
  from public, anon, authenticated;
grant execute on function public.b_project_get, public.b_project_save, public.b_teacher_projects, public.b_teacher_project_drill,
  public.b_psa_mine, public.b_psa_submit, public.b_teacher_psa_list, public.b_teacher_psa_grade to anon;
-- ── end wave-twinA ──

-- ── wave-twinB: Footprint Quest, Home Energy Budget, The Idaho Trail (same as supabase/migrations/008_twinsB.sql) ──
-- ════════════════════════════════════════════════════════════════════
-- 1. Footprint Quest
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_fp_progress (
  student_id   uuid primary key references public.b_students on delete cascade,
  data         jsonb not null default '{}'::jsonb,     -- the whole quest (items, meter readings, 3-day log, goal, test, report)
  stage        int not null default 0,                 -- 0–6 steps done (for the teacher dashboard)
  submitted    boolean not null default false,
  submitted_at timestamptz,
  updated_at   timestamptz not null default now()
);
-- items the class taught the Swap Shop (the item's type: most votes wins)
create table if not exists public.b_fp_learned (
  norm_name  text primary key,
  name       text not null,
  votes      jsonb not null default '{}'::jsonb,
  category   text not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);
-- swaps students made from their own 15 items; shared once 2 different students made one with the same name
create table if not exists public.b_fp_made (
  norm_name  text primary key,
  name       text not null,
  ings       jsonb not null,                           -- [[itemKey or "x:<item>", amount], ...]
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.b_fp_makers (
  norm_name  text not null references public.b_fp_made(norm_name) on delete cascade,
  student_id uuid not null references public.b_students on delete cascade,
  made_at    timestamptz not null default now(),
  primary key (norm_name, student_id)
);
-- swaps the teacher added to the book
create table if not exists public.b_fp_book (
  id         text primary key,
  name       text not null check (char_length(name) between 2 and 60),
  ings       jsonb not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.b_fp_progress enable row level security;
alter table public.b_fp_learned enable row level security;
alter table public.b_fp_made enable row level security;
alter table public.b_fp_makers enable row level security;
alter table public.b_fp_book enable row level security;
revoke all on public.b_fp_progress, public.b_fp_learned, public.b_fp_made, public.b_fp_makers, public.b_fp_book from anon, authenticated;

create or replace function public._b_fp_norm(p text) returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g')) $$;
create or replace function public._b_fp_clean(p text) returns boolean language sql immutable set search_path = public as $$
  select public._b_fp_norm(p) !~ '(^| )(fuck\w*|shit\w*|bitch\w*|ass|asshole|damn|dick\w*|cock\w*|pussy|sex\w*|porn\w*|nigg\w*|fag\w*|retard\w*|crap|piss\w*|weed|drugs?|cocaine|meth|beer|vodka|wine|poop|pee|butt|boob\w*|penis|vagina|kill\w*|die)( |$)' $$;

create or replace function public.b_fp_get(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.b_fp_progress;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  select * into r from public.b_fp_progress where student_id = p_id;
  if not found then return null; end if;
  return jsonb_build_object('data', r.data, 'stage', r.stage, 'submitted', r.submitted, 'submitted_at', r.submitted_at, 'updated_at', r.updated_at);
end $$;

-- Saves the whole draft. Turned in stays turned in (changes still save, like Weight Control Quest).
create or replace function public.b_fp_save(p_id uuid, p_pin_hash text, p_data jsonb, p_stage int, p_submitted boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_fp_progress;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  if jsonb_typeof(coalesce(p_data, 'null'::jsonb)) <> 'object' or pg_column_size(p_data) > 120000 then raise exception 'Save is too large'; end if;
  insert into public.b_fp_progress (student_id, data, stage, submitted, submitted_at)
    values (p_id, p_data, greatest(0, least(coalesce(p_stage, 0), 6)), coalesce(p_submitted, false), case when p_submitted then now() end)
  on conflict (student_id) do update set
    data = excluded.data, stage = excluded.stage,
    submitted = b_fp_progress.submitted or excluded.submitted,
    submitted_at = coalesce(b_fp_progress.submitted_at, excluded.submitted_at),
    updated_at = now()
  returning * into r;
  return jsonb_build_object('ok', true, 'submitted', r.submitted, 'updated_at', r.updated_at);
end $$;

-- everyone: what the class taught the Swap Shop (+ teacher-added swaps)
create or replace function public.b_fp_learned() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('n', f.norm_name, 'name', f.name, 'cat', f.category))
                       from public.b_fp_learned f where f.active), '[]'::jsonb),
    'swaps', coalesce((select jsonb_agg(jsonb_build_object('id', 's-' || replace(d.norm_name, ' ', '-'), 'name', d.name, 'ings', d.ings, 'makers', m.c))
                       from public.b_fp_made d
                       join (select norm_name, count(*) c from public.b_fp_makers group by norm_name) m on m.norm_name = d.norm_name
                       where d.active and m.c >= 2), '[]'::jsonb),
    'book', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'ings', b.ings) order by b.name)
                      from public.b_fp_book b where b.active), '[]'::jsonb)) $$;

create or replace function public.b_fp_learn_item(p_id uuid, p_pin_hash text, p_name text, p_category text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_norm text := public._b_fp_norm(p_name); v_votes jsonb; v_cat text;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  if p_category not in ('water', 'power', 'heat', 'travel', 'food', 'stuff', 'waste') then raise exception 'bad type'; end if;
  if char_length(v_norm) < 2 or char_length(v_norm) > 40 or not public._b_fp_clean(p_name) then return jsonb_build_object('ok', false); end if;
  insert into public.b_fp_learned (norm_name, name, votes, category)
    values (v_norm, left(btrim(p_name), 40), jsonb_build_object(p_category, 1), p_category)
    on conflict (norm_name) do update set
      votes = b_fp_learned.votes || jsonb_build_object(p_category, coalesce((b_fp_learned.votes ->> p_category)::int, 0) + 1),
      updated_at = now();
  select votes into v_votes from public.b_fp_learned where norm_name = v_norm;
  select key into v_cat from jsonb_each_text(v_votes) order by value::int desc, key limit 1;
  update public.b_fp_learned set category = v_cat where norm_name = v_norm;
  return jsonb_build_object('ok', true, 'cat', v_cat);
end $$;

create or replace function public.b_fp_make_swap(p_id uuid, p_pin_hash text, p_name text, p_ings jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_norm text := public._b_fp_norm(p_name); v_n int;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  if char_length(v_norm) < 3 or char_length(v_norm) > 50 then raise exception 'Give your swap a name (3–50 letters)'; end if;
  if not public._b_fp_clean(p_name) then raise exception 'Please pick a different name for your swap'; end if;
  if jsonb_typeof(p_ings) <> 'array' or jsonb_array_length(p_ings) < 1 or jsonb_array_length(p_ings) > 8 or pg_column_size(p_ings) > 2000 then
    raise exception 'Pick 1 to 8 items'; end if;
  if (select count(*) from public.b_fp_makers where student_id = p_id) >= 20 then raise exception 'You have made 20 swaps already!'; end if;
  insert into public.b_fp_made (norm_name, name, ings) values (v_norm, left(btrim(p_name), 50), p_ings) on conflict (norm_name) do nothing;
  insert into public.b_fp_makers (norm_name, student_id) values (v_norm, p_id) on conflict do nothing;
  select count(*) into v_n from public.b_fp_makers where norm_name = v_norm;
  return jsonb_build_object('ok', true, 'makers', v_n, 'shared', v_n >= 2);
end $$;

-- teacher: the class list (twin of get_weight_control_quest_teacher_summary) + one student's work
create or replace function public.b_fp_teacher_list(p_pass_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'period', s.period, 'stage', coalesce(p.stage, 0), 'submitted', coalesce(p.submitted, false),
      'submitted_at', p.submitted_at, 'updated_at', p.updated_at,
      'tries', case when (p.data #>> '{bal,tries}') ~ '^[0-9]+$' then (p.data #>> '{bal,tries}')::int end,
      'test', case when (p.data #>> '{quiz,best}') ~ '^[0-9]+$' then (p.data #>> '{quiz,best}')::int end,
      'group', left(coalesce(p.data ->> 'group', ''), 80))
    order by s.period, s.name), '[]'::jsonb)
    from public.b_students s left join public.b_fp_progress p on p.student_id = s.id);
end $$;
create or replace function public.b_fp_teacher_get(p_pass_hash text, p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select data from public.b_fp_progress where student_id = p_student);
end $$;
create or replace function public.b_fp_teacher_learning(p_pass_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('n', f.norm_name, 'name', f.name, 'cat', f.category, 'votes', f.votes) order by f.updated_at desc)
                       from public.b_fp_learned f where f.active), '[]'::jsonb),
    'swaps', coalesce((select jsonb_agg(jsonb_build_object('n', d.norm_name, 'name', d.name, 'ings', d.ings,
                          'makers', (select count(*) from public.b_fp_makers m where m.norm_name = d.norm_name)) order by d.updated_at desc)
                       from public.b_fp_made d where d.active), '[]'::jsonb),
    'book', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'ings', b.ings) order by b.name)
                      from public.b_fp_book b where b.active), '[]'::jsonb));
end $$;
create or replace function public.b_fp_teacher_remove(p_pass_hash text, p_kind text, p_norm text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if p_kind = 'item' then update public.b_fp_learned set active = false, updated_at = now() where norm_name = p_norm;
  elsif p_kind = 'swap' then update public.b_fp_made set active = false, updated_at = now() where norm_name = p_norm;
  elsif p_kind = 'book' then update public.b_fp_book set active = false where id = p_norm;
  else raise exception 'bad kind'; end if;
  return public.b_fp_teacher_learning(p_pass_hash);
end $$;
-- Teacher adds (or replaces) a swap in the book. p_ings: [[itemKey, amount], ...]
create or replace function public.b_fp_teacher_book_add(p_pass_hash text, p_name text, p_ings jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_name text := left(btrim(coalesce(p_name, '')), 60);
  v_id text := 'u-' || trim(both '-' from regexp_replace(lower(btrim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g'));
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if char_length(v_name) < 2 then raise exception 'Give the swap a name'; end if;
  if jsonb_typeof(p_ings) <> 'array' or jsonb_array_length(p_ings) < 1 or jsonb_array_length(p_ings) > 8 then raise exception 'Add 1 to 8 items'; end if;
  insert into public.b_fp_book (id, name, ings) values (v_id, v_name, p_ings)
    on conflict (id) do update set name = excluded.name, ings = excluded.ings, active = true;
  return public.b_fp_teacher_learning(p_pass_hash);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 2. Home Energy Budget
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_eb_work (
  student_id      uuid primary key references public.b_students on delete cascade,
  data            jsonb not null default '{}'::jsonb,   -- the student's working copy
  predicted       jsonb,                                -- Step 2 estimates, frozen at lock time
  pred_locked_at  timestamptz,
  evidence_img    text,                                 -- optional screenshot of a bill or calculator (small JPEG)
  status          text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at    timestamptz,
  submitted_data  jsonb,                                -- exact copy of what was turned in
  returned_at     timestamptz,
  scores          jsonb,                                -- teacher's rubric points
  teacher_note    text,
  scored_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.b_eb_work enable row level security;
revoke all on public.b_eb_work from anon, authenticated;

create or replace function public._b_eb_keys() returns text[] language sql immutable set search_path = public as $$
  select array['heating','cooling','hotwater','lighting','fridge','cooking','laundry','dishes','electronics','plugs','transport','upgrades'] $$;
create or replace function public._b_eb_num(v jsonb) returns boolean language sql immutable set search_path = public as $$
  select v is not null and jsonb_typeof(v) in ('number', 'string')
     and (v #>> '{}') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' and (v #>> '{}')::numeric <= 10000000 $$;
create or replace function public._b_eb_sentences(t text) returns int language sql immutable set search_path = public as $$
  select count(*)::int from regexp_matches(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'), '[^.!?]+[.!?]+', 'g') m
   where (select count(*) from regexp_split_to_table(btrim(m[1]), '\s+') w where w ~ '[A-Za-z0-9]') >= 4 $$;
create or replace function public._b_eb_view(r public.b_eb_work) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'data', r.data, 'status', r.status, 'submitted_at', r.submitted_at, 'returned_at', r.returned_at,
    'pred_locked_at', r.pred_locked_at, 'updated_at', r.updated_at, 'image', r.evidence_img,
    'scores', case when r.scored_at is not null then r.scores end,
    'teacher_note', case when r.scored_at is not null then r.teacher_note end) $$;

create or replace function public.b_eb_get(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.b_eb_work;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  select * into r from public.b_eb_work where student_id = p_id;
  if not found then return null; end if;
  return public._b_eb_view(r);
end $$;

create or replace function public.b_eb_save(p_id uuid, p_pin_hash text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_eb_work; d jsonb := coalesce(p_data, '{}'::jsonb); k text; v_exists boolean;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  if jsonb_typeof(d) <> 'object' or pg_column_size(d) > 60000 then raise exception 'Save is too large'; end if;
  d := d - 'image';                                          -- screenshots go through b_eb_image only
  select * into r from public.b_eb_work where student_id = p_id for update;
  v_exists := found;
  if v_exists and r.status = 'submitted' then raise exception 'Already submitted. Ask Mr. Dopp to return it if you need to change something.'; end if;
  if v_exists and r.pred_locked_at is not null then
    d := jsonb_set(d, '{predicted}', r.predicted);           -- estimates are frozen: keep the locked copy
    d := jsonb_set(d, '{predLockedAt}', to_jsonb(r.pred_locked_at));
  elsif d ? 'predLockedAt' and d->>'predLockedAt' is not null then
    foreach k in array public._b_eb_keys() loop
      if not public._b_eb_num(d->'predicted'->k) then raise exception 'Fill in every estimate (use 0 if none) before locking'; end if;
    end loop;
  end if;
  if not v_exists then
    insert into public.b_eb_work (student_id, data) values (p_id, d) returning * into r;
  else
    update public.b_eb_work set data = d, updated_at = now() where student_id = p_id returning * into r;
  end if;
  if r.pred_locked_at is null and d->>'predLockedAt' is not null then
    update public.b_eb_work set predicted = d->'predicted', pred_locked_at = now(), data = jsonb_set(data, '{predLockedAt}', to_jsonb(now()))
     where student_id = p_id returning * into r;
  end if;
  return jsonb_build_object('ok', true, 'updated_at', r.updated_at, 'pred_locked_at', r.pred_locked_at);
end $$;

-- p_img null removes the screenshot
create or replace function public.b_eb_image(p_id uuid, p_pin_hash text, p_img text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_eb_work;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  if p_img is not null then
    if length(p_img) > 700000 then raise exception 'Image is too large'; end if;
    if p_img !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Image must be a JPEG'; end if;
  end if;
  select * into r from public.b_eb_work where student_id = p_id for update;
  if found and r.status = 'submitted' then raise exception 'Already submitted'; end if;
  if not found then insert into public.b_eb_work (student_id, evidence_img) values (p_id, p_img);
  else update public.b_eb_work set evidence_img = p_img, updated_at = now() where student_id = p_id; end if;
  return jsonb_build_object('ok', true, 'has_image', p_img is not null);
end $$;

-- Submits what is already saved and re-checks the required work. Submitting twice is harmless.
create or replace function public.b_eb_submit(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_eb_work; d jsonb; k text; miss text[] := '{}';
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  select * into r from public.b_eb_work where student_id = p_id for update;
  if not found then raise exception 'Nothing saved yet'; end if;
  if r.status = 'submitted' then return jsonb_build_object('ok', true, 'already', true, 'submitted_at', r.submitted_at); end if;
  d := r.data;
  if coalesce(d->'step0'->>'quiz', '') = '' then miss := array_append(miss, 'energy question'::text); end if;
  if btrim(coalesce(d->'home'->>'place', '')) = '' then miss := array_append(miss, 'where the home is'::text); end if;
  if btrim(coalesce(d->'home'->>'type', '')) = '' then miss := array_append(miss, 'home type'::text); end if;
  if not public._b_eb_num(d->'home'->'people') or (d->'home'->>'people')::numeric not between 1 and 20 then miss := array_append(miss, 'people in the home'::text); end if;
  if not public._b_eb_num(d->'home'->'budget') or (d->'home'->>'budget')::numeric <= 0 then miss := array_append(miss, 'monthly energy budget'::text); end if;
  if not public._b_eb_num(d->'home'->'elec') or (d->'home'->>'elec')::numeric <= 0 then miss := array_append(miss, 'electricity price'::text); end if;
  if r.pred_locked_at is null then miss := array_append(miss, 'locked estimates'::text); end if;
  if btrim(coalesce(d->'research'->>'location', '')) = '' then miss := array_append(miss, 'location researched'::text); end if;
  if btrim(coalesce(d->'research'->>'household', '')) = '' then miss := array_append(miss, 'source type'::text); end if;
  if coalesce(d->'research'->>'url', '') !~* '^\s*https?://\S+\.\S+' then miss := array_append(miss, 'source web address'::text); end if;
  foreach k in array public._b_eb_keys() loop
    if not public._b_eb_num(d->'research'->'values'->k->'v') then miss := array_append(miss, ('researched ' || k)::text); end if;
  end loop;
  if public._b_eb_sentences(d->>'reflection') < 5 then miss := array_append(miss, '5 complete sentences'::text); end if;
  if array_length(miss, 1) > 0 then raise exception 'Still missing: %', array_to_string(miss, ', '); end if;
  update public.b_eb_work set status = 'submitted', submitted_at = now(), submitted_data = d, updated_at = now()
   where student_id = p_id returning * into r;
  return jsonb_build_object('ok', true, 'submitted_at', r.submitted_at);
end $$;

create or replace function public.b_eb_teacher_list(p_pass_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'name', s.name, 'period', s.period, 'status', coalesce(w.status, 'not_started'),
            'updated_at', w.updated_at, 'submitted_at', w.submitted_at, 'returned_at', w.returned_at,
            'pred_locked_at', w.pred_locked_at, 'has_image', w.evidence_img is not null,
            'data', (case when w.status = 'submitted' then w.submitted_data else w.data end) - 'whatif',
            'scores', w.scores, 'teacher_note', w.teacher_note, 'scored_at', w.scored_at)
          order by s.period, s.name), '[]'::jsonb)
          from public.b_students s left join public.b_eb_work w on w.student_id = s.id);
end $$;
create or replace function public.b_eb_teacher_image(p_pass_hash text, p_student uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select evidence_img from public.b_eb_work where student_id = p_student);
end $$;
-- Rubric keys: home(10) predictions(15) research(25) calc(20) reflection(20) completion(10). null = not graded yet.
create or replace function public.b_eb_teacher_score(p_pass_hash text, p_student uuid, p_scores jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lim jsonb := '{"home":10,"predictions":15,"research":25,"calc":20,"reflection":20,"completion":10}'; k text; v jsonb; clean jsonb := '{}';
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if jsonb_typeof(coalesce(p_scores, '{}'::jsonb)) <> 'object' then raise exception 'bad scores'; end if;
  for k in select jsonb_object_keys(lim) loop
    v := p_scores->k;
    if v is null or jsonb_typeof(v) = 'null' then clean := clean || jsonb_build_object(k, null);
    elsif jsonb_typeof(v) = 'number' and (v::text)::numeric between 0 and (lim->>k)::numeric then clean := clean || jsonb_build_object(k, v);
    else raise exception '% must be 0 to %', k, lim->>k; end if;
  end loop;
  update public.b_eb_work set scores = clean, teacher_note = left(p_note, 1000), scored_at = now() where student_id = p_student;
  if not found then raise exception 'That student has not started this assignment'; end if;
  return jsonb_build_object('ok', true, 'scores', clean);
end $$;
-- Reopen a submitted plan so the student can fix it and submit again (locked estimates stay locked).
create or replace function public.b_eb_teacher_return(p_pass_hash text, p_student uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  update public.b_eb_work set status = 'draft', submitted_at = null, returned_at = now(), updated_at = now()
   where student_id = p_student and status = 'submitted';
  if not found then raise exception 'Nothing submitted to return'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 3. The Idaho Trail
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_trail_runs (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.b_students on delete cascade,
  term        text not null,
  run_no      int  not null default 1,
  status      text not null default 'active' check (status in ('active', 'done', 'over')),
  miles       int  not null default 0,
  state       jsonb not null default '{}'::jsonb,
  score       int,
  started_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists b_trail_runs_one_active on public.b_trail_runs (student_id) where status = 'active';
create index if not exists b_trail_runs_term on public.b_trail_runs (term, status);
create table if not exists public.b_trail_daily (          -- miles traveled per student per real (Denver) day
  student_id uuid not null references public.b_students on delete cascade,
  day        date not null,
  miles      int  not null default 0,
  primary key (student_id, day)
);
alter table public.b_trail_runs enable row level security;
alter table public.b_trail_daily enable row level security;
revoke all on public.b_trail_runs, public.b_trail_daily from anon, authenticated;

create or replace function public._b_trail_term() returns text language sql stable security definer set search_path = public as $$
  select coalesce(public._b_set('term'), 'term') $$;
create or replace function public._b_trail_left(p_id uuid) returns int language sql stable security definer set search_path = public as $$
  select 200 - coalesce((select miles from public.b_trail_daily where student_id = p_id and day = public._b_today()), 0) $$;

create or replace function public.b_trail_load(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.b_trail_runs; t text := public._b_trail_term();
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  select * into r from public.b_trail_runs where student_id = p_id and status = 'active';
  return jsonb_build_object(
    'run', case when r.id is null then null else jsonb_build_object('id', r.id, 'run_no', r.run_no, 'miles', r.miles, 'state', r.state) end,
    'left_today', public._b_trail_left(p_id),
    'finished', (select count(*) from public.b_trail_runs where student_id = p_id and term = t and status = 'done'),
    'best', (select max(score) from public.b_trail_runs where student_id = p_id and term = t and status = 'done'));
end $$;

-- start a new journey (an active one is ended first). The daily mile cap carries over.
create or replace function public.b_trail_start(p_id uuid, p_pin_hash text, p_state jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.b_trail_runs; n int;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  if jsonb_typeof(coalesce(p_state, 'null'::jsonb)) <> 'object' or pg_column_size(p_state) > 60000 then raise exception 'Save is too big'; end if;
  update public.b_trail_runs set status = 'over', finished_at = now(), updated_at = now() where student_id = p_id and status = 'active';
  select coalesce(max(run_no), 0) + 1 into n from public.b_trail_runs where student_id = p_id;
  insert into public.b_trail_runs (student_id, term, run_no, state) values (p_id, public._b_trail_term(), n, jsonb_set(p_state, '{miles}', '0'))
  returning * into r;
  return jsonb_build_object('id', r.id, 'run_no', r.run_no, 'miles', 0, 'state', r.state, 'left_today', public._b_trail_left(p_id));
end $$;

-- save after each trail day. Miles only go up, and never past today's 200-mile allowance.
create or replace function public.b_trail_save(p_id uuid, p_pin_hash text, p_run_id uuid, p_state jsonb, p_status text default 'active', p_score int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.b_trail_runs; want int; allowed int; gain int; st jsonb; sc int; res jsonb;
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Log in first'; end if;
  if jsonb_typeof(coalesce(p_state, 'null'::jsonb)) <> 'object' or pg_column_size(p_state) > 60000 then raise exception 'Save is too big'; end if;
  select * into r from public.b_trail_runs where id = p_run_id and student_id = p_id for update;
  if not found then raise exception 'Journey not found'; end if;
  if r.status <> 'active' then raise exception 'This journey is over'; end if;
  want := greatest(case when (p_state->>'miles') ~ '^[0-9]+$' then (p_state->>'miles')::int else r.miles end, r.miles);
  allowed := greatest(public._b_trail_left(p_id), 0);
  gain := least(want - r.miles, allowed);
  if gain > 0 then
    insert into public.b_trail_daily (student_id, day, miles) values (p_id, public._b_today(), gain)
    on conflict (student_id, day) do update set miles = b_trail_daily.miles + excluded.miles;
  else gain := 0;
  end if;
  st := jsonb_set(p_state, '{miles}', to_jsonb(r.miles + gain));
  update public.b_trail_runs set state = st, miles = r.miles + gain, updated_at = now() where id = r.id returning * into r;
  res := jsonb_build_object('miles', r.miles, 'left_today', public._b_trail_left(p_id), 'clamped', want > r.miles);
  if p_status = 'done' and r.miles >= 1200 then
    sc := least(greatest(coalesce(p_score, 0), 0), 5000);
    update public.b_trail_runs set status = 'done', score = sc, finished_at = now() where id = r.id;
    res := res || jsonb_build_object('status', 'done', 'score', sc,
      'finished', (select count(*) from public.b_trail_runs where student_id = p_id and term = r.term and status = 'done'));
  elsif p_status = 'over' then
    update public.b_trail_runs set status = 'over', finished_at = now() where id = r.id;
    res := res || jsonb_build_object('status', 'over');
  end if;
  return res;
end $$;

-- leaderboard: best finishes this term, and the wagons farthest along right now
create or replace function public.b_trail_board() returns jsonb
language sql stable security definer set search_path = public as $$
  with fin as (
    select r.student_id, max(r.score) best, count(*) finishes,
           min(case when (r.state->>'day') ~ '^[0-9]+$' then (r.state->>'day')::int end) fastest
    from public.b_trail_runs r where r.term = public._b_trail_term() and r.status = 'done' group by r.student_id
  ), act as (
    select r.student_id, r.miles, r.updated_at, case when (r.state->>'day') ~ '^[0-9]+$' then (r.state->>'day')::int end as day
    from public.b_trail_runs r where r.status = 'active' and r.term = public._b_trail_term()
  )
  select jsonb_build_object(
    'finishers', (select coalesce(jsonb_agg(x order by (x->>'best')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('name', public._b_pub_name(s.name), 'period', s.period, 'best', f.best, 'finishes', f.finishes, 'fastest', f.fastest) x
        from fin f join public.b_students s on s.id = f.student_id order by f.best desc limit 15) t),
    'leaders', (select coalesce(jsonb_agg(x order by (x->>'miles')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('name', public._b_pub_name(s.name), 'period', s.period, 'miles', a.miles, 'day', a.day,
                                  'finishes', coalesce((select finishes from fin where fin.student_id = a.student_id), 0)) x
        from act a join public.b_students s on s.id = a.student_id where a.miles > 0 order by a.miles desc, a.updated_at limit 10) t),
    'wagons_out', (select count(*) from act)) $$;

create or replace function public.b_trail_teacher_list(p_pass_hash text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t text := public._b_trail_term();
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return (select coalesce(jsonb_agg(x order by x->>'period', x->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('id', s.id, 'name', s.name, 'period', s.period,
      'miles', (select r.miles from public.b_trail_runs r where r.student_id = s.id and r.status = 'active'),
      'day', (select r.state->>'day' from public.b_trail_runs r where r.student_id = s.id and r.status = 'active'),
      'runs', (select count(*) from public.b_trail_runs r where r.student_id = s.id and r.term = t),
      'finished', (select count(*) from public.b_trail_runs r where r.student_id = s.id and r.term = t and r.status = 'done'),
      'best', (select max(score) from public.b_trail_runs r where r.student_id = s.id and r.term = t and r.status = 'done'),
      'today', coalesce((select miles from public.b_trail_daily d where d.student_id = s.id and d.day = public._b_today()), 0),
      'last', (select max(updated_at) from public.b_trail_runs r where r.student_id = s.id)) x
    from public.b_students s where exists (select 1 from public.b_trail_runs r where r.student_id = s.id)) q);
end $$;

-- ---------- grants: only the public functions are callable from the website ----------
revoke execute on function public._b_fp_norm, public._b_fp_clean, public._b_eb_keys, public._b_eb_num, public._b_eb_sentences, public._b_eb_view,
  public._b_trail_term, public._b_trail_left,
  public.b_fp_get, public.b_fp_save, public.b_fp_learned, public.b_fp_learn_item, public.b_fp_make_swap,
  public.b_fp_teacher_list, public.b_fp_teacher_get, public.b_fp_teacher_learning, public.b_fp_teacher_remove, public.b_fp_teacher_book_add,
  public.b_eb_get, public.b_eb_save, public.b_eb_image, public.b_eb_submit,
  public.b_eb_teacher_list, public.b_eb_teacher_image, public.b_eb_teacher_score, public.b_eb_teacher_return,
  public.b_trail_load, public.b_trail_start, public.b_trail_save, public.b_trail_board, public.b_trail_teacher_list
  from public, anon, authenticated;
grant execute on function
  public.b_fp_get, public.b_fp_save, public.b_fp_learned, public.b_fp_learn_item, public.b_fp_make_swap,
  public.b_fp_teacher_list, public.b_fp_teacher_get, public.b_fp_teacher_learning, public.b_fp_teacher_remove, public.b_fp_teacher_book_add,
  public.b_eb_get, public.b_eb_save, public.b_eb_image, public.b_eb_submit,
  public.b_eb_teacher_list, public.b_eb_teacher_image, public.b_eb_teacher_score, public.b_eb_teacher_return,
  public.b_trail_load, public.b_trail_start, public.b_trail_save, public.b_trail_board, public.b_trail_teacher_list
  to anon;
-- ── end wave-twinB ──

-- ── wave-x7b: Daily Briefing, Suggestions, Visitors, site visits (same as supabase/migrations/010_x7b.sql) ──
-- ════════════════════════════════════════════════════════════════════
-- 1. Daily Briefing
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_briefing (
  id           int primary key default 1 check (id = 1),
  announcement text not null default '',
  updated_at   timestamptz not null default now()
);
alter table public.b_briefing enable row level security;
revoke all on public.b_briefing from anon, authenticated;
insert into public.b_briefing (id) values (1) on conflict (id) do nothing;

-- Public read: the announcement is for the whole class (no student data in it).
create or replace function public.b_briefing_get() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('announcement', announcement, 'updated_at', updated_at) from public.b_briefing where id = 1 $$;

create or replace function public.b_teacher_briefing_set(p_pass_hash text, p_announcement text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  insert into public.b_briefing (id, announcement, updated_at) values (1, left(btrim(coalesce(p_announcement, '')), 2000), now())
  on conflict (id) do update set announcement = excluded.announcement, updated_at = now();
  return public.b_briefing_get();
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 2. Suggest an Improvement
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_suggestions (
  id          bigserial primary key,
  student_id  uuid references public.b_students on delete set null,  -- null when sent without logging in
  name        text,                                                  -- optional, typed by the sender
  category    text not null check (category in ('bug', 'game', 'content', 'design', 'other')),
  message     text not null check (char_length(message) between 5 and 2000),
  page        text,                                                  -- which page they were on (optional)
  status      text not null default 'new' check (status in ('new', 'done', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.b_suggestions enable row level security;
revoke all on public.b_suggestions from anon, authenticated;

-- p_id / p_pin_hash are optional: a logged-in student's suggestion is linked to them.
-- Limits: 5 a day per logged-in student; 40 an hour for everyone who isn't logged in.
create or replace function public.b_suggest(p_id uuid, p_pin_hash text, p_name text, p_category text, p_message text, p_page text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_sid uuid := null; v_msg text := btrim(coalesce(p_message, ''));
begin
  if p_id is not null then
    if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
    v_sid := p_id;
    if (select count(*) from public.b_suggestions where student_id = v_sid and created_at > now() - interval '1 day') >= 5 then
      raise exception 'You have sent 5 suggestions today. Thank you! Try again tomorrow.'; end if;
  elsif (select count(*) from public.b_suggestions where student_id is null and created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Lots of suggestions right now. Please try again in an hour.';
  end if;
  if char_length(v_msg) < 5 then raise exception 'Please write a little more.'; end if;
  if p_category not in ('bug', 'game', 'content', 'design', 'other') then raise exception 'Pick what it is about.'; end if;
  insert into public.b_suggestions (student_id, name, category, message, page)
  values (v_sid, nullif(left(btrim(coalesce(p_name, '')), 60), ''), p_category, left(v_msg, 2000), nullif(left(btrim(coalesce(p_page, '')), 200), ''));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.b_teacher_suggestions(p_pass_hash text, p_archived boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'student', s.name, 'period', s.period,
      'category', g.category, 'message', g.message, 'page', g.page, 'status', g.status, 'created_at', g.created_at)
      order by (g.status = 'new') desc, g.created_at desc)
    from public.b_suggestions g left join public.b_students s on s.id = g.student_id
    where coalesce(p_archived, false) or g.status <> 'archived'), '[]'::jsonb);
end $$;

-- "Remove" = archive (soft). Archived ones are hidden unless the teacher asks for them.
create or replace function public.b_teacher_suggestion_set(p_pass_hash text, p_suggestion bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if p_status not in ('new', 'done', 'archived') then raise exception 'Unknown status'; end if;
  update public.b_suggestions set status = p_status, updated_at = now() where id = p_suggestion;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 3. Visitors (past students and guests)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_visitors (
  student_id  uuid primary key references public.b_students on delete cascade,
  first_name  text not null,
  last_name   text not null,
  last_seen   timestamptz not null default now(),
  removed     boolean not null default false,
  removed_at  timestamptz,
  removed_why text,                                  -- 'expired' | 'teacher'
  created_at  timestamptz not null default now()
);
alter table public.b_visitors enable row level security;
revoke all on public.b_visitors from anon, authenticated;

create or replace function public._b_visitor_clean(p text) returns boolean language sql immutable set search_path = public as $$
  select lower(coalesce(p, '')) !~ '(fuck|shit|bitch|cunt|dick|cock|pussy|nigg|fag|slut|whore|porn|sex|nazi|hitler|kill)' $$;

-- Switch off (soft) every visitor not seen for 90 days. Their PIN is scrambled so the old login stops working everywhere.
create or replace function public._b_visitor_expire() returns void
language sql security definer set search_path = public as $$
  with gone as (
    update public.b_visitors set removed = true, removed_at = now(), removed_why = 'expired'
     where not removed and last_seen < now() - interval '90 days' returning student_id)
  update public.b_students s set pin_hash = 'off:' || gen_random_uuid()::text from gone where s.id = gone.student_id $$;

create or replace function public._b_visitor_view(v public.b_visitors, s public.b_students) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'name', s.name, 'period', s.period, 'visitor', true,
    'first', v.first_name, 'expires', (v.last_seen + interval '90 days')::date) $$;

create or replace function public.b_visitor_register(p_first text, p_last text, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_first text := btrim(regexp_replace(coalesce(p_first, ''), '\s+', ' ', 'g'));
        v_last text := btrim(regexp_replace(coalesce(p_last, ''), '\s+', ' ', 'g'));
        v_name text; v_id uuid; v public.b_visitors; s public.b_students;
begin
  perform public._b_visitor_expire();
  if v_first !~ '^[A-Za-zÀ-ÿ'' -]{2,16}$' then raise exception 'First name: 2 to 16 letters.'; end if;
  if v_last !~ '^[A-Za-zÀ-ÿ'' -]{2,30}$' then raise exception 'Please enter your last name.'; end if;
  if not public._b_visitor_clean(v_first) or not public._b_visitor_clean(v_last) then raise exception 'Please use your real name.'; end if;
  if coalesce(p_pin_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Bad PIN'; end if;
  v_name := v_first || ' ' || upper(left(v_last, 1)) || '.';
  if exists (select 1 from public.b_students st join public.b_visitors x on x.student_id = st.id
             where st.period = 'Visitor' and lower(st.name) = lower(v_name) and not x.removed) then
    raise exception 'A visitor with that name already exists. Try signing in instead.';
  end if;
  -- an old switched-off account holding the same board name is renamed ("Ana L. (off 3f2a9c)") so the new one can use it
  update public.b_students st set name = st.name || ' (off ' || left(st.id::text, 6) || ')'
    from public.b_visitors x where x.student_id = st.id and x.removed and st.period = 'Visitor' and lower(st.name) = lower(v_name);
  insert into public.b_students (name, period, pin_hash) values (v_name, 'Visitor', p_pin_hash) returning id into v_id;
  insert into public.b_visitors (student_id, first_name, last_name) values (v_id, v_first, v_last);
  select * into v from public.b_visitors where student_id = v_id;
  select * into s from public.b_students where id = v_id;
  return public._b_visitor_view(v, s);
end $$;

-- Returning visitor: first name + last name + PIN.
create or replace function public.b_visitor_login(p_first text, p_last text, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.b_visitors; s public.b_students;
begin
  perform public._b_visitor_expire();
  select x.* into v from public.b_visitors x join public.b_students st on st.id = x.student_id
   where lower(x.first_name) = lower(btrim(coalesce(p_first, ''))) and lower(x.last_name) = lower(btrim(coalesce(p_last, '')))
     and not x.removed and st.pin_hash = p_pin_hash
   limit 1;
  if v.student_id is null then
    raise exception 'No visitor account with that name and PIN. (Accounts switch off after 90 days without a visit.)';
  end if;
  update public.b_visitors set last_seen = now() where student_id = v.student_id returning * into v;
  select * into s from public.b_students where id = v.student_id;
  return public._b_visitor_view(v, s);
end $$;

-- Every visit to /visitors/ while signed in: keeps the account alive and counts the day.
-- Returns {visitor:false} for a class student, {removed:true} for a switched-off visitor.
create or replace function public.b_visitor_touch(p_id uuid, p_pin_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.b_visitors; s public.b_students;
begin
  perform public._b_visitor_expire();
  if not public._b_ok(p_id, p_pin_hash) then
    if exists (select 1 from public.b_visitors where student_id = p_id and removed) then return jsonb_build_object('removed', true); end if;
    raise exception 'Please log in again';
  end if;
  select * into v from public.b_visitors where student_id = p_id;
  if v.student_id is null then return jsonb_build_object('visitor', false); end if;
  update public.b_visitors set last_seen = now() where student_id = p_id returning * into v;
  insert into public.b_days values (p_id, public._b_today()) on conflict do nothing;
  select * into s from public.b_students where id = p_id;
  return public._b_visitor_view(v, s);
end $$;

-- Top visitors: same XP rules as the Hall of Champions. Names are "First L." only.
create or replace function public.b_visitor_board() returns jsonb
language sql stable security definer set search_path = public as $$
  with t as (
    select s.id, s.name,
      (select count(*) from public.b_tasks x where x.student_id = s.id) tasks,
      (select count(*) from public.b_days d where d.student_id = s.id) days,
      (select count(*) from public.b_side_quests q where q.student_id = s.id and q.approved) quests,
      public._b_xp_total(s.id) game_xp,
      exists (select 1 from public.b_pets p where p.student_id = s.id and p.removed_at is null) pet
    from public.b_students s join public.b_visitors v on v.student_id = s.id
    where not v.removed and v.last_seen > now() - interval '90 days')
  select coalesce(jsonb_agg(jsonb_build_object('name', public._b_pub_name(name), 'xp', tasks * 25 + days * 5 + quests * 50 + game_xp,
           'days', days, 'game_xp', game_xp, 'pet', pet) order by tasks * 25 + days * 5 + quests * 50 + game_xp desc, days desc), '[]'::jsonb)
    from (select * from t order by tasks * 25 + days * 5 + quests * 50 + game_xp desc, days desc limit 10) top $$;

create or replace function public.b_teacher_visitors(p_pass_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  perform public._b_visitor_expire();
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', v.first_name || ' ' || v.last_name, 'board_name', s.name,
      'joined', v.created_at, 'last_seen', v.last_seen, 'expires', (v.last_seen + interval '90 days')::date,
      'days', (select count(*) from public.b_days d where d.student_id = s.id),
      'game_xp', public._b_xp_total(s.id),
      'pet', exists (select 1 from public.b_pets p where p.student_id = s.id and p.removed_at is null),
      'removed', v.removed, 'removed_why', v.removed_why) order by v.removed, v.last_seen desc)
    from public.b_visitors v join public.b_students s on s.id = v.student_id), '[]'::jsonb);
end $$;

-- Remove (soft) ONE visitor. Refuses class students. To bring a visitor back, the teacher un-removes
-- them here and sets a new PIN with Reset PIN on the roster.
create or replace function public.b_teacher_visitor_remove(p_pass_hash text, p_student uuid, p_removed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_teacher(p_pass_hash) then raise exception 'Wrong teacher passcode'; end if;
  if not exists (select 1 from public.b_visitors where student_id = p_student) then raise exception 'Only visitor accounts can be removed here'; end if;
  if p_removed then
    update public.b_visitors set removed = true, removed_at = now(), removed_why = 'teacher' where student_id = p_student;
    update public.b_students set pin_hash = 'off:' || gen_random_uuid()::text where id = p_student;
  else
    update public.b_visitors set removed = false, removed_at = null, removed_why = null, last_seen = now() where student_id = p_student;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- 4. Site visit counter
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.b_site_visits (
  id         int primary key default 1 check (id = 1),
  total      bigint not null default 0,
  started_at timestamptz not null default now()
);
alter table public.b_site_visits enable row level security;
revoke all on public.b_site_visits from anon, authenticated;
insert into public.b_site_visits (id) values (1) on conflict (id) do nothing;

create or replace function public.b_site_visit_hit() returns jsonb
language sql security definer set search_path = public as $$
  update public.b_site_visits set total = total + 1 where id = 1 returning jsonb_build_object('total', total, 'since', started_at) $$;
create or replace function public.b_site_visit_count() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('total', total, 'since', started_at) from public.b_site_visits where id = 1 $$;

-- ---------- grants: only the public functions are callable from the website ----------
revoke execute on function public._b_visitor_clean, public._b_visitor_expire, public._b_visitor_view,
  public.b_briefing_get, public.b_teacher_briefing_set,
  public.b_suggest, public.b_teacher_suggestions, public.b_teacher_suggestion_set,
  public.b_visitor_register, public.b_visitor_login, public.b_visitor_touch, public.b_visitor_board,
  public.b_teacher_visitors, public.b_teacher_visitor_remove,
  public.b_site_visit_hit, public.b_site_visit_count
  from public, anon, authenticated;
grant execute on function
  public.b_briefing_get, public.b_teacher_briefing_set,
  public.b_suggest, public.b_teacher_suggestions, public.b_teacher_suggestion_set,
  public.b_visitor_register, public.b_visitor_login, public.b_visitor_touch, public.b_visitor_board,
  public.b_teacher_visitors, public.b_teacher_visitor_remove,
  public.b_site_visit_hit, public.b_site_visit_count
  to anon;
-- ── end wave-x7b ──
