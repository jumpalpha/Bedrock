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
insert into public.b_settings (k, v) values ('classwork_live', 'true') on conflict (k) do nothing;

-- ---------- rules (the page uses the same numbers) ----------
create or replace function public._b_cw_rule(k text) returns int language sql immutable set search_path = public as $$
  select case k when 'quiz_n' then 20 when 'reason_n' then 8 when 'learn_pass' then 80 when 'unit_pass' then 80
                when 'min_final' then 70 when 'min_words' then 25 when 'stories' then 3 when 'swaps' then 1
                when 'min_seconds' then 45 when 'extra_defs' then 6 when 'cooldown' then 900 end $$;

-- chapter ref → reading order (12 → 12, 1201 → 12.01), so bonus chapters sit after the chapter they follow
create or replace function public._b_cw_ord(p_ref int) returns numeric language sql immutable set search_path = public as $$
  select case when p_ref >= 100 then (p_ref / 100) + (p_ref % 100) / 100.0 else p_ref end $$;

create or replace function public._b_cw_live() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public._b_set('classwork_live'), 'true') = 'true' $$;

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
