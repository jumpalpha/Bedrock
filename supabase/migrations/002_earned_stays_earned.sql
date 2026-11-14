-- Earned stays earned + bonus chapters. Run once in Supabase (project gmeyamrlqfrabtslsweu). Safe to re-run.
-- schema.sql already contains everything below, so a fresh database only needs schema.sql.
--
-- 1. b_cleared: a realm clear is recorded the moment the site sees a student finish every task in it. Later
--    curriculum additions (a new chapter in that realm = new tasks) never take the badge or rank away; the
--    new tasks still show as to-do and still give XP.
-- 2. b_claim_realm: records a clear. Requires the realm's unit test task (unit{r}) plus every task key the site
--    sends (the realm's current task list), all already in b_tasks.
-- 3. b_state and b_teacher_roster also return `cleared`.
-- 4. Bonus chapters ("Chapter 12A"): task keys like ch12a_read are allowed, and quiz refs >= 100 mean bonus
--    chapters (1201 = 12a, 1202 = 12b), so passing that quiz checks off ch12a_quiz.

create table if not exists public.b_cleared (
  student_id uuid references public.b_students on delete cascade,
  realm int not null,
  cleared_at timestamptz not null default now(),
  primary key (student_id, realm)
);
alter table public.b_cleared enable row level security;
revoke all on public.b_cleared from anon, authenticated;

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

create or replace function public.b_complete_task(p_id uuid, p_pin_hash text, p_task_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._b_ok(p_id, p_pin_hash) then raise exception 'Please log in again'; end if;
  if p_task_key !~ '^ch\d+[a-z]?_(read|tls)$' then raise exception 'That task is checked off by passing its quiz or test'; end if;
  insert into public.b_tasks (student_id, task_key) values (p_id, p_task_key) on conflict do nothing;
end $$;

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

revoke execute on function public._b_ch, public.b_claim_realm from public, anon, authenticated;
grant execute on function public.b_claim_realm to anon;
