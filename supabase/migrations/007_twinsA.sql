-- 007: Be Ready twins (wave-twinA): Quake Ready, Hazard PSA Challenge. Run once in Supabase → SQL Editor. Safe to re-run.
-- Adds new b_ tables and functions only. Nothing is deleted, dropped or truncated.
--
-- Same privacy model as supabase/schema.sql:
--   * RLS on, no policies: the site's public key can't touch these tables. Everything goes through the
--     security-definer functions below (students: p_id + p_pin_hash, teacher: _b_teacher(p_pass_hash)).
--   * Nothing here is graded from an answer key. The Quake Ready quick check is a practice check on the page
--     (like the Dopps Class CPR & AED side quest it twins), so "done" is what the page reports.
--
-- Pages: /quake-ready/ (quest + printables), /disaster-plan/ (no database: the family plan stays on paper at home),
--        /hazard-psa/ (group submission + each member's reflection). Teacher: Teacher dashboard → "Be Ready" tab.

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
