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
  id text primary key,                -- c01-01 (chapter bank), u1-01 (unit test), tls-01 (Think Like a Scientist)
  kind text not null check (kind in ('chapter', 'unit', 'tls')),
  ref int not null,                   -- chapter number or realm number
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
revoke all on public.b_students, public.b_tasks, public.b_days, public.b_keys, public.b_attempts,
  public.b_votes, public.b_side_quests, public.b_settings from anon, authenticated;

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
    'term', public._b_set('term'),
    'unitAttempts', public._b_set('unit_attempts')::int
  );
end $$;

-- Self-checked tasks (reading, Think Like a Scientist). Quiz and test tasks are only set by b_grade.
create or replace function public.b_complete_task(p_id uuid, p_pin_hash text, p_task_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_task_key !~ '^ch\d+_(read|tls)$' then raise exception 'That task is checked off by passing its quiz or test'; end if;
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
      values (p_id, case p_kind when 'chapter' then 'ch' || p_ref || '_quiz' else 'unit' || p_ref end)
      on conflict do nothing;
  end if;
  return jsonb_build_object('score', right_n, 'total', total, 'pct', pct, 'passed', passed, 'results', results);
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
                 from public.b_side_quests q where q.student_id = s.id)
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
revoke execute on function public._b_set, public._b_ok, public._b_teacher, public._b_today,
  public.b_register, public.b_login, public.b_state, public.b_complete_task, public.b_grade, public.b_vote,
  public.b_results, public.b_side_quest_submit, public.b_teacher_check, public.b_teacher_keys,
  public.b_teacher_roster, public.b_teacher_approve, public.b_teacher_reset_pin from public, anon, authenticated;
grant execute on function public.b_register, public.b_login, public.b_state, public.b_complete_task, public.b_grade,
  public.b_vote, public.b_results, public.b_side_quest_submit, public.b_teacher_check,
  public.b_teacher_keys, public.b_teacher_roster, public.b_teacher_approve, public.b_teacher_reset_pin to anon;
