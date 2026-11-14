-- 008: Earth science twins, wave B (wave-twinB). Run once in Supabase → SQL Editor. Safe to re-run.
-- Adds new b_ tables and functions only. Nothing existing is changed, dropped or deleted.
-- schema.sql has the same block (marked "wave-twinB").
--
--   1. Footprint Quest (/footprint/): twin of Dopps Class Weight Control Quest (weight_control_quest_progress,
--      wcq_learning.sql, wcq_recipes.sql). A student's whole quest is one jsonb draft, saved after every change.
--      The Swap Shop grows like the Island Recipe Book: students teach it items it doesn't know (most votes wins),
--      student-made swaps are shared with everyone once 2 different students make one with the same name,
--      and the teacher can add swaps to the book or remove anything.
--   2. Home Energy Budget (/energy-budget/): twin of finance_quest.sql ("The Cost of Your Future").
--      Step 2 estimates freeze once locked, a submitted plan is read-only until the teacher returns it,
--      required work is re-checked here on submit, and the teacher scores a 100-point rubric.
--   3. The Idaho Trail (/arcade/play/idaho-trail/): twin of wellness_trail.sql. 1,200 miles, at most 200 miles
--      per student per real day (America/Denver), miles only go up, finishes post to the trail leaderboard.
--      (Convoys, gifts and trail markers from the Dopps Class version are not part of this twin.)
--
-- Same privacy model as supabase/schema.sql:
--   * RLS on, NO policies: the public key can't touch these tables. Everything goes through the
--     security-definer functions below (students: p_id + p_pin_hash via _b_ok; teacher: _b_teacher(p_pass_hash)).
--   * Learned items and shared swaps store no student names. Leaderboard names are "First L." (_b_pub_name).
--   * Every function checks sizes, so a page can't stuff the database.
-- Needs supabase/schema.sql (b_students, _b_ok, _b_teacher, _b_set, _b_today) and 005_pet.sql (_b_pub_name).

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
