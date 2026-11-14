-- 005: Rock-alien class pet, Crystal Shop, Alien Gallery and Hall of Champions (wave-pet).
-- Run once in Supabase → SQL Editor (after 002 and 004). Safe to re-run. Adds b_ tables and functions only.
--
-- Bedrock's version of the Dopps Class Wellness Sprite (wellness_pet.sql + sprite_shop.sql + pet_quiz_cap.sql +
-- sprite_admin.sql + the sprite part of name_changes.sql). Same rules, Earth science theme:
--   * Each student adopts ONE rock alien (it crash-landed at Craters of the Moon) and names it.
--     Names show right away. The teacher can turn on name approval (b_settings pet_names_need_ok = 'true'), and can
--     always rename or remove an alien.
--     Students can rename once every 7 days; the teacher can approve, deny, rename or remove.
--   * Removing an alien is soft: b_pets.removed_at is set and every function treats that row as no alien.
--     The student can adopt again (the row is reused and reset). A future purge job could clear old removed rows.
--   * Needs decay every hour (minerals 1.625, heat 1.375, mood 1.25, shine 1.0). Health falls when needs are low;
--     a healthy alien left alone goes dormant after ~4 days. 10 correct vocab answers wake it up again.
--   * Field habits (honor system, like Dopps' healthy habits), a space-junk snack and play: daily caps.
--   * Its body evolves through the rock cycle as realms are cleared (b_cleared, recorded by the server):
--     geode (not hatched) → pebble (0) → sandstone (1–2) → quartzite (3–4) → magma (5–6) → granite (7–8) → titan (9).
--   * Crystals (the shop money) are earned ONLY from graded events, counted here, never claimed by the page:
--       - vocab questions graded here (b_pet_quiz_start/answer): +1 each, 15 a day also feed the alien, then 25 study a day
--       - each graded task in b_tasks: chapter quiz passed +10, unit test passed +30, Classwork turned in +20
--       - each b_attempts row: +1 per correct answer above that quiz's previous best (retakes can't farm), 40 a day max
--   * Shop prices and unlocks live in b_pet_items. Bigger items also need lifetime crystals to unlock.
-- Privacy model as schema.sql: RLS on, no policies, security-definer functions (students p_id + p_pin_hash,
-- teacher _b_teacher(p_pass_hash)). Public lists show first name + last initial, never PINs or full names.

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
