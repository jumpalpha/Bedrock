-- 004: Realm Classwork + Reflection Coach (wave-learnB). Run once in Supabase → SQL Editor. Safe to re-run.
-- Adds new b_ tables and functions only, plus one widened check on b_keys. Nothing is deleted.
--
-- Same privacy model as supabase/schema.sql:
--   * RLS on, no policies: the site's public key can't touch these tables. Everything goes through the
--     security-definer functions below (students: p_id + p_pin_hash, teacher: _b_teacher(p_pass_hash)).
--   * Graded answers live only in b_keys. Classwork tests use two kinds of keys:
--       kind 'chapter' – the chapter quiz bank that is already loaded (recall questions),
--       kind 'cw'      – new "think it through" questions. Their text is public in
--                        src/data/content/classwork_bank.json; their keys are loaded from a private file
--                        that is never committed. Students get right/wrong per question, never the answer.
--     Classwork tests never use the unit-test bank (kind 'unit'), so unlimited classwork retakes can't
--     leak anything about the 2-try realm tests.
--   * Vocabulary (b_cw_terms) is public data (the glossary). It lives in the database so Learn can be graded here.
--
-- AFTER this file: load the private 'cw' keys file (see the wave-learnB report). Until it is loaded,
-- Chapter and Unit Tests in Classwork use only the chapter-quiz questions.

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

-- ---------- vocabulary (public glossary data; regenerate with: node scripts/classwork/terms-sql.mjs) ----------
-- Classwork vocabulary: 661 words from src/data/content/glossary.json (generated by scripts/classwork/terms-sql.mjs).
delete from public.b_cw_terms;
insert into public.b_cw_terms (ref, realm, n, term, def, story_ok) values
(1, 1, 1, 'Earth science', 'The study of Earth and its neighbors in space.', true),
(1, 1, 2, 'Geology', 'The study of rocks, minerals, and the solid Earth.', true),
(1, 1, 3, 'Oceanography', 'The study of the oceans.', true),
(1, 1, 4, 'Meteorology', 'The study of weather and the atmosphere.', true),
(1, 1, 5, 'Astronomy', 'The study of the Moon, Sun, stars, and space.', true),
(1, 1, 6, 'Scientific method', 'A step-by-step way scientists answer questions.', true),
(1, 1, 7, 'Observation', 'Noticing something using your senses or tools.', true),
(1, 1, 8, 'Question', 'What you want to find out about an observation.', false),
(1, 1, 9, 'Hypothesis', 'A smart guess that can be tested.', true),
(1, 1, 10, 'Experiment', 'A fair test of a hypothesis.', true),
(1, 1, 11, 'Data', 'The facts and measurements you collect.', false),
(1, 1, 12, 'Analyze', 'To study data to find patterns.', true),
(1, 1, 13, 'Conclusion', 'What the data tells you about your hypothesis.', true),
(1, 1, 14, 'Independent variable', 'The thing you change on purpose in an experiment.', true),
(1, 1, 15, 'Dependent variable', 'The thing you measure in an experiment.', true),
(1, 1, 16, 'Control', 'What you keep the same so the test is fair.', false),
(1, 1, 17, 'Scientific theory', 'A well-tested explanation of why something happens, backed by lots of evidence.', true),
(1, 1, 18, 'Scientific law', 'A statement of what always happens, often written as math.', true),
(1, 1, 19, 'Evidence', 'Facts and data that support or reject an idea.', true),
(1, 1, 20, 'Metric system (SI)', 'The measuring system scientists use, based on tens.', true),
(1, 1, 21, 'Meter', 'The basic metric unit of length.', true),
(1, 1, 22, 'Gram', 'A metric unit of mass.', true),
(1, 1, 23, 'Kilogram', '1,000 grams.', true),
(1, 1, 24, 'Liter', 'The basic metric unit of volume.', true),
(1, 1, 25, 'Degrees Celsius', 'The metric temperature scale; water freezes at 0 and boils at 100.', true),
(1, 1, 26, 'Model', 'A map, diagram, globe, or computer program that represents something real.', false),
(1, 1, 27, 'Lab safety', 'Rules that keep you from getting hurt during experiments.', true),
(2, 1, 1, 'Latitude', 'Distance north or south of the equator, in degrees.', true),
(2, 1, 2, 'Longitude', 'Distance east or west of the prime meridian, in degrees.', true),
(2, 1, 3, 'Equator', 'The 0° latitude line around Earth''s middle.', true),
(2, 1, 4, 'Prime meridian', 'The 0° longitude line through Greenwich, England.', true),
(2, 1, 5, 'Degree', 'The unit for measuring latitude and longitude.', false),
(2, 1, 6, 'Minute', 'One-sixtieth of a degree.', false),
(2, 1, 7, 'Coordinates', 'The latitude and longitude that give a place''s exact address.', true),
(2, 1, 8, 'Time zone', 'A region that uses the same clock time, about 15° wide.', true),
(2, 1, 9, 'International Date Line', 'The line near 180° where the calendar date changes.', true),
(2, 1, 10, 'Map', 'A flat drawing of an area.', false),
(2, 1, 11, 'Globe', 'A round model of Earth; the only fully accurate map.', true),
(2, 1, 12, 'Map projection', 'A way to show round Earth on flat paper; always distorts something.', true),
(2, 1, 13, 'Mercator projection', 'A map good for navigation that makes land near the poles look too big.', true),
(2, 1, 14, 'Equal-area projection', 'A map that keeps sizes correct but bends shapes.', true),
(2, 1, 15, 'Legend (key)', 'The box that explains a map''s symbols.', true),
(2, 1, 16, 'Scale', 'Shows how distance on a map compares to real distance.', false),
(2, 1, 17, 'Compass rose', 'The symbol showing north, south, east, and west.', true),
(2, 1, 18, 'Topographic map', 'A map that shows the shape and height of the land.', true),
(2, 1, 19, 'Contour line', 'A line on a topo map connecting points of equal elevation.', true),
(2, 1, 20, 'Elevation', 'Height above sea level.', true),
(2, 1, 21, 'Contour interval', 'The height difference between contour lines.', true),
(2, 1, 22, 'GPS', 'Global Positioning System; uses satellites to find your exact location.', true),
(2, 1, 23, 'Satellite', 'An object that orbits a planet.', true),
(2, 1, 24, 'Remote sensing', 'Studying Earth from a distance using satellites or planes.', true),
(2, 1, 25, 'GIS', 'Geographic Information Systems; computer maps that stack layers of data.', true),
(3, 1, 1, 'Matter', 'Anything that has mass and takes up space.', true),
(3, 1, 2, 'Mass', 'The amount of matter in an object.', true),
(3, 1, 3, 'Atom', 'The tiny basic building block of matter.', true),
(3, 1, 4, 'Proton', 'A positive particle in an atom''s nucleus.', true),
(3, 1, 5, 'Neutron', 'A particle with no charge in an atom''s nucleus.', true),
(3, 1, 6, 'Electron', 'A negative particle that moves around an atom''s nucleus.', true),
(3, 1, 7, 'Nucleus', 'The center of an atom.', true),
(3, 1, 8, 'Element', 'A substance made of only one kind of atom.', true),
(3, 1, 9, 'Periodic table', 'The chart that organizes all the elements.', true),
(3, 1, 10, 'Compound', 'A substance made of two or more elements bonded together.', true),
(3, 1, 11, 'Chemical bond', 'The force that holds atoms together in a compound.', true),
(3, 1, 12, 'Silicon', 'The second most common element in Earth''s crust.', true),
(3, 1, 13, 'Oxygen', 'The most common element in Earth''s crust.', true),
(3, 1, 14, 'States of matter', 'The forms matter takes: solid, liquid, gas, plasma.', true),
(3, 1, 15, 'Solid', 'Matter with a fixed shape.', true),
(3, 1, 16, 'Liquid', 'Matter that takes the shape of its container.', true),
(3, 1, 17, 'Gas', 'Matter that spreads out to fill any space.', true),
(3, 1, 18, 'Plasma', 'Super-hot, electrically charged gas, like lightning and the Sun.', true),
(3, 1, 19, 'Melting', 'A solid turning into a liquid.', true),
(3, 1, 20, 'Evaporation', 'A liquid turning into a gas.', true),
(3, 1, 21, 'Condensation', 'A gas turning into a liquid.', true),
(3, 1, 22, 'Geosphere', 'The solid Earth: rocks, mountains, and the core.', true),
(3, 1, 23, 'Hydrosphere', 'All of Earth''s water.', true),
(3, 1, 24, 'Atmosphere', 'The layer of air around Earth.', true),
(3, 1, 25, 'Biosphere', 'All living things on Earth.', true),
(3, 1, 26, 'System', 'A group of parts that work together and affect each other.', true),
(3, 1, 27, 'Feedback', 'When one change causes other changes in a system.', true),
(3, 1, 28, 'Energy', 'The ability to cause change or do work.', true),
(3, 1, 29, 'Solar energy', 'Energy from the Sun.', true),
(3, 1, 30, 'Internal heat', 'Heat inside Earth left over from its formation and from radioactive elements.', true),
(3, 1, 31, 'Cycle', 'A process that repeats over and over.', true),
(4, 2, 1, 'Mineral', 'A natural, inorganic solid with a set chemical makeup and a crystal structure.', true),
(4, 2, 2, 'Inorganic', 'Not made by living things.', true),
(4, 2, 3, 'Crystal', 'A solid whose atoms line up in a repeating pattern.', true),
(4, 2, 4, 'Silicate', 'A mineral containing silicon and oxygen; makes up most of the crust.', true),
(4, 2, 5, 'Carbonate', 'A mineral containing carbon and oxygen, like calcite.', true),
(4, 2, 6, 'Oxide', 'A mineral made of a metal bonded to oxygen, like hematite.', true),
(4, 2, 7, 'Native element', 'A mineral made of one pure element, like gold or copper.', true),
(4, 2, 8, 'Streak', 'The color of a mineral''s powder.', true),
(4, 2, 9, 'Luster', 'How a mineral shines: metallic or nonmetallic.', true),
(4, 2, 10, 'Hardness', 'How easily a mineral can be scratched.', true),
(4, 2, 11, 'Mohs scale', 'Ranks mineral hardness from 1 (talc) to 10 (diamond).', true),
(4, 2, 12, 'Cleavage', 'When a mineral breaks along flat, smooth surfaces.', true),
(4, 2, 13, 'Fracture', 'When a mineral breaks unevenly or in curves.', true),
(4, 2, 14, 'Density', 'How much mass is packed into a certain space.', true),
(4, 2, 15, 'Gem', 'A rare, hard, beautiful mineral cut and polished for jewelry.', true),
(4, 2, 16, 'Ore', 'A mineral mined for profit, usually for a metal.', true),
(5, 2, 1, 'Igneous rock', 'Rock formed when melted rock cools and hardens.', true),
(5, 2, 2, 'Magma', 'Melted rock underground.', true),
(5, 2, 3, 'Lava', 'Melted rock at the surface.', true),
(5, 2, 4, 'Intrusive', 'Igneous rock that cooled slowly underground; big crystals.', true),
(5, 2, 5, 'Extrusive', 'Igneous rock that cooled quickly at the surface; small or no crystals.', true),
(5, 2, 6, 'Texture', 'The size, shape, and arrangement of a rock''s grains.', true),
(5, 2, 7, 'Coarse-grained', 'Having crystals big enough to see.', true),
(5, 2, 8, 'Fine-grained', 'Having crystals too small to see easily.', true),
(5, 2, 9, 'Glassy', 'Having no crystals because it cooled extremely fast.', true),
(5, 2, 10, 'Vesicular', 'Full of holes from gas bubbles.', true),
(5, 2, 11, 'Porphyritic', 'Big crystals in a fine-grained background.', true),
(5, 2, 12, 'Felsic', 'Light-colored igneous rock rich in silica.', true),
(5, 2, 13, 'Mafic', 'Dark-colored igneous rock rich in iron and magnesium.', true),
(5, 2, 14, 'Granite', 'A light, coarse-grained intrusive rock.', true),
(5, 2, 15, 'Basalt', 'A dark, fine-grained extrusive rock; covers the Snake River Plain.', true),
(5, 2, 16, 'Obsidian', 'Natural volcanic glass.', true),
(5, 2, 17, 'Pumice', 'A light, holey volcanic rock that can float.', true),
(6, 2, 1, 'Sediment', 'Loose bits of rock, sand, mud, and shells.', true),
(6, 2, 2, 'Sedimentary rock', 'Rock formed from sediment pressed and glued together.', true),
(6, 2, 3, 'Compaction', 'Squeezing sediment together under weight.', true),
(6, 2, 4, 'Cementation', 'Minerals gluing sediment together.', true),
(6, 2, 5, 'Clastic rock', 'Sedimentary rock made of broken rock pieces.', true),
(6, 2, 6, 'Chemical rock', 'Sedimentary rock formed from minerals coming out of water.', true),
(6, 2, 7, 'Organic rock', 'Sedimentary rock made from the remains of living things.', true),
(6, 2, 8, 'Conglomerate', 'Sedimentary rock of rounded pebbles cemented together.', true),
(6, 2, 9, 'Sandstone', 'Sedimentary rock made of sand grains.', true),
(6, 2, 10, 'Shale', 'Sedimentary rock made of fine mud.', true),
(6, 2, 11, 'Limestone', 'Sedimentary rock made mostly of calcite, often from shells.', true),
(6, 2, 12, 'Coal', 'Organic rock made from ancient swamp plants.', true),
(6, 2, 13, 'Strata', 'Layers of rock.', true),
(6, 2, 14, 'Fossil', 'Preserved remains or traces of ancient life.', true),
(6, 2, 15, 'Metamorphic rock', 'Rock changed by heat, pressure, or fluids without melting.', true),
(6, 2, 16, 'Contact metamorphism', 'Rock baked by nearby magma.', true),
(6, 2, 17, 'Regional metamorphism', 'Large areas of rock changed by heat and pressure during mountain building.', true),
(6, 2, 18, 'Foliated', 'Metamorphic rock with flat layers or bands.', true),
(6, 2, 19, 'Non-foliated', 'Metamorphic rock without layers.', true),
(6, 2, 20, 'Slate', 'A foliated rock formed from shale.', true),
(6, 2, 21, 'Schist', 'A sparkly foliated rock.', true),
(6, 2, 22, 'Gneiss', 'A foliated rock with striped bands.', true),
(6, 2, 23, 'Marble', 'A non-foliated rock formed from limestone.', true),
(6, 2, 24, 'Quartzite', 'A hard non-foliated rock formed from sandstone.', true),
(7, 2, 1, 'Rock cycle', 'The endless process of rocks changing from one type to another.', true),
(7, 2, 2, 'Melting', 'Heat turning rock into magma.', true),
(7, 2, 3, 'Crystallization', 'Magma or lava cooling into crystals.', true),
(7, 2, 4, 'Weathering', 'Breaking rock into smaller pieces.', true),
(7, 2, 5, 'Erosion', 'Moving weathered rock away.', true),
(7, 2, 6, 'Deposition', 'Dropping sediment in a new place.', true),
(7, 2, 7, 'Compaction', 'Pressing sediment together.', true),
(7, 2, 8, 'Cementation', 'Gluing sediment into rock.', true),
(7, 2, 9, 'Uplift', 'Forces pushing buried rock up to the surface.', true),
(8, 3, 1, 'Weathering', 'Breaking rock into smaller pieces where it sits.', true),
(8, 3, 2, 'Erosion', 'Moving weathered material to a new place.', true),
(8, 3, 3, 'Deposition', 'Dropping sediment when the mover slows down.', true),
(8, 3, 4, 'Mechanical weathering', 'Breaking rock without changing what it''s made of.', true),
(8, 3, 5, 'Frost wedging', 'Water freezing and expanding in cracks, splitting rock.', true),
(8, 3, 6, 'Abrasion', 'Rock being scraped and worn down by other particles.', true),
(8, 3, 7, 'Chemical weathering', 'Changing the minerals in a rock into new substances.', true),
(8, 3, 8, 'Oxidation', 'Oxygen reacting with iron in rock; rusting.', true),
(8, 3, 9, 'Acid rain', 'Rain made more acidic by pollution.', true),
(8, 3, 10, 'Soil', 'A mix of weathered rock, humus, water, air, and living things.', true),
(8, 3, 11, 'Humus', 'Dark, rotting plant and animal material in soil.', true),
(8, 3, 12, 'Horizon', 'A layer of soil.', true),
(8, 3, 13, 'Topsoil', 'The dark, rich A horizon where plants grow.', true),
(8, 3, 14, 'Subsoil', 'The lighter B horizon below topsoil.', true),
(8, 3, 15, 'Bedrock', 'The solid rock beneath soil.', true),
(8, 3, 16, 'Dust Bowl', '1930s disaster when drought and poor farming blew away Great Plains topsoil.', true),
(9, 3, 1, 'Mass movement', 'Rock and soil moving downhill because of gravity.', true),
(9, 3, 2, 'Creep', 'Very slow downhill movement of soil.', true),
(9, 3, 3, 'Slump', 'A block of ground sliding down along a curved surface.', true),
(9, 3, 4, 'Mudflow', 'A fast flow of water-soaked soil.', true),
(9, 3, 5, 'Landslide', 'A large mass of rock and soil suddenly sliding downhill.', true),
(9, 3, 6, 'Rockfall', 'Rocks falling freely from a cliff.', true),
(9, 3, 7, 'Deflation', 'Wind blowing away loose sand and dust.', true),
(9, 3, 8, 'Sand dune', 'A hill of wind-blown sand.', true),
(9, 3, 9, 'Loess', 'Fine, fertile, wind-blown dust deposits.', true),
(9, 3, 10, 'Glacier', 'A large mass of moving ice on land.', true),
(9, 3, 11, 'Valley glacier', 'A glacier that flows down a mountain valley.', true),
(9, 3, 12, 'Continental glacier', 'A huge ice sheet covering a large area of land.', true),
(9, 3, 13, 'U-shaped valley', 'A valley widened and carved by a glacier.', true),
(9, 3, 14, 'Cirque', 'A bowl-shaped hollow carved at the head of a glacier.', true),
(9, 3, 15, 'Horn', 'A sharp peak carved by glaciers on several sides.', true),
(9, 3, 16, 'Moraine', 'A ridge of rock and dirt dumped by a glacier.', true),
(9, 3, 17, 'Ice age', 'A long cold period when glaciers covered large areas.', true),
(10, 3, 1, 'Water cycle', 'The continuous movement of water between Earth''s surface and the air.', true),
(10, 3, 2, 'Evaporation', 'Liquid water turning into water vapor.', true),
(10, 3, 3, 'Transpiration', 'Plants releasing water vapor through their leaves.', true),
(10, 3, 4, 'Condensation', 'Water vapor cooling into liquid droplets.', true),
(10, 3, 5, 'Precipitation', 'Water falling from clouds as rain, snow, sleet, or hail.', true),
(10, 3, 6, 'Runoff', 'Water flowing over the ground into streams.', true),
(10, 3, 7, 'Infiltration', 'Water soaking into the ground.', true),
(10, 3, 8, 'Tributary', 'A smaller stream that flows into a larger river.', true),
(10, 3, 9, 'Watershed', 'All the land that drains into one river.', true),
(10, 3, 10, 'Divide', 'High ground that separates watersheds.', true),
(10, 3, 11, 'Continental Divide', 'The divide separating water flowing to the Pacific from water flowing to the Atlantic.', true),
(10, 3, 12, 'Meander', 'A loop or bend in a slow river.', true),
(10, 3, 13, 'Oxbow lake', 'A curved lake formed when a meander is cut off.', true),
(10, 3, 14, 'Delta', 'A fan of sediment where a river enters a lake or ocean.', true),
(10, 3, 15, 'Floodplain', 'Flat land beside a river that floods.', true),
(10, 3, 16, 'Levee', 'A raised wall along a river to prevent flooding.', true),
(10, 3, 17, 'Wetland', 'Land soaked with water, like a marsh or swamp.', true),
(11, 3, 1, 'Groundwater', 'Water stored underground in spaces in soil and rock.', true),
(11, 3, 2, 'Porosity', 'How much open space a rock or soil has.', true),
(11, 3, 3, 'Permeability', 'How easily water flows through rock or soil.', true),
(11, 3, 4, 'Zone of aeration', 'The upper underground zone where spaces hold air and some water.', true),
(11, 3, 5, 'Water table', 'The top of the zone of saturation.', true),
(11, 3, 6, 'Zone of saturation', 'The underground zone where all spaces are filled with water.', true),
(11, 3, 7, 'Aquifer', 'An underground layer of rock or sediment that holds and moves water.', true),
(11, 3, 8, 'Aquitard', 'A layer that blocks the flow of groundwater.', true),
(11, 3, 9, 'Recharge', 'Water refilling an aquifer.', true),
(11, 3, 10, 'Well', 'A hole dug or drilled to reach groundwater.', false),
(11, 3, 11, 'Spring', 'A place where groundwater flows out naturally.', false),
(11, 3, 12, 'Artesian well', 'A well where pressure pushes water up on its own.', true),
(11, 3, 13, 'Cave', 'An underground hollow, often dissolved in limestone.', true),
(11, 3, 14, 'Stalactite', 'A mineral formation hanging from a cave ceiling.', true),
(11, 3, 15, 'Stalagmite', 'A mineral formation growing up from a cave floor.', true),
(11, 3, 16, 'Sinkhole', 'A hole formed when ground collapses into an empty space below.', true),
(11, 3, 17, 'Hot spring', 'A spring of groundwater heated by hot rock.', true),
(11, 3, 18, 'Geyser', 'A hot spring that erupts water and steam.', true),
(12, 4, 1, 'Seismic wave', 'Energy from an earthquake traveling through Earth.', true),
(12, 4, 2, 'Seismograph', 'An instrument that records seismic waves.', true),
(12, 4, 3, 'P wave', 'The fastest seismic wave; travels through solids and liquids.', true),
(12, 4, 4, 'S wave', 'A slower seismic wave; travels only through solids.', true),
(12, 4, 5, 'Shadow zone', 'The area on Earth where no S waves are detected, showing the outer core is liquid.', true),
(12, 4, 6, 'Crust', 'Earth''s thin, rocky outer layer.', true),
(12, 4, 7, 'Oceanic crust', 'Thin, dense crust made of basalt under the oceans.', true),
(12, 4, 8, 'Continental crust', 'Thicker, lighter crust made mostly of granite.', true),
(12, 4, 9, 'Mantle', 'The thick, hot, slowly flowing layer under the crust.', true),
(12, 4, 10, 'Outer core', 'The liquid iron and nickel layer around the inner core.', true),
(12, 4, 11, 'Inner core', 'The solid iron and nickel center of Earth.', true),
(12, 4, 12, 'Lithosphere', 'The rigid outer layer made of crust and upper mantle.', true),
(12, 4, 13, 'Asthenosphere', 'The soft, flowing layer of mantle under the lithosphere.', true),
(12, 4, 14, 'Convection', 'Heat transfer by hot material rising and cool material sinking.', true),
(12, 4, 15, 'Convection current', 'A circular flow caused by convection, like in the mantle.', true),
(12, 4, 16, 'Magnetic field', 'The invisible force field around Earth created by its outer core.', true),
(12, 4, 17, 'Aurora', 'Glowing lights in the sky near the poles caused by solar particles.', true),
(13, 4, 1, 'Continental drift', 'Wegener''s idea that continents slowly move.', true),
(13, 4, 2, 'Pangaea', 'The supercontinent that broke apart about 200 million years ago.', true),
(13, 4, 3, 'Alfred Wegener', 'The scientist who proposed continental drift in 1912.', false),
(13, 4, 4, 'Mid-ocean ridge', 'An underwater mountain chain where new ocean crust forms.', true),
(13, 4, 5, 'Sea-floor spreading', 'New crust forming at ridges and pushing older crust away.', true),
(13, 4, 6, 'Magnetic reversal', 'A flip of Earth''s magnetic poles, recorded in rock.', true),
(13, 4, 7, 'Plate tectonics', 'The theory that Earth''s lithosphere is broken into moving plates.', true),
(13, 4, 8, 'Plate boundary', 'Where two plates meet.', true),
(13, 4, 9, 'Divergent boundary', 'Where plates move apart.', true),
(13, 4, 10, 'Rift valley', 'A valley formed where land is pulling apart.', true),
(13, 4, 11, 'Convergent boundary', 'Where plates move toward each other.', true),
(13, 4, 12, 'Subduction', 'One plate sinking beneath another.', true),
(13, 4, 13, 'Trench', 'A deep ocean valley formed at a subduction zone.', true),
(13, 4, 14, 'Transform boundary', 'Where plates slide past each other.', true),
(13, 4, 15, 'Slab pull', 'A sinking plate pulling the rest of the plate along.', true),
(13, 4, 16, 'Ridge push', 'New crust at a ridge pushing plates apart.', true),
(13, 4, 17, 'Hotspot', 'A plume of hot mantle that melts through a plate, like Yellowstone.', true),
(14, 4, 1, 'Earthquake', 'Shaking caused by rocks suddenly slipping along a fault.', true),
(14, 4, 2, 'Fault', 'A break in the crust where rocks have moved.', true),
(14, 4, 3, 'Elastic rebound', 'Rocks bending under stress, then snapping back.', true),
(14, 4, 4, 'Normal fault', 'A fault where rocks pull apart and one side drops down.', true),
(14, 4, 5, 'Reverse fault', 'A fault where rocks push together and one side moves up.', true),
(14, 4, 6, 'Strike-slip fault', 'A fault where rocks slide sideways past each other.', true),
(14, 4, 7, 'Focus', 'The point underground where an earthquake starts.', true),
(14, 4, 8, 'Epicenter', 'The point on the surface directly above the focus.', true),
(14, 4, 9, 'Surface wave', 'The slowest, most damaging seismic wave.', true),
(14, 4, 10, 'Triangulation', 'Using three stations to locate an epicenter.', true),
(14, 4, 11, 'Magnitude', 'A measure of the energy an earthquake releases.', true),
(14, 4, 12, 'Moment magnitude scale', 'The modern scale for earthquake magnitude.', true),
(14, 4, 13, 'Richter scale', 'An older scale for earthquake magnitude.', true),
(14, 4, 14, 'Intensity', 'How strongly shaking is felt in a certain place.', true),
(14, 4, 15, 'Modified Mercalli scale', 'A scale rating earthquake intensity by damage.', true),
(14, 4, 16, 'Fault scarp', 'A step in the ground formed by fault movement.', true),
(14, 4, 17, 'Liquefaction', 'Wet soil acting like liquid during shaking.', true),
(14, 4, 18, 'Tsunami', 'A giant ocean wave caused by an undersea earthquake.', true),
(15, 4, 1, 'Volcano', 'An opening in the crust where magma, gas, and ash escape.', true),
(15, 4, 2, 'Magma chamber', 'An underground pool of magma.', true),
(15, 4, 3, 'Vent', 'The opening where magma comes out.', true),
(15, 4, 4, 'Conduit', 'The pipe from the magma chamber to the vent.', true),
(15, 4, 5, 'Crater', 'The bowl-shaped pit at a volcano''s top.', true),
(15, 4, 6, 'Caldera', 'A huge crater formed when a volcano collapses.', true),
(15, 4, 7, 'Ring of Fire', 'The ring of volcanoes around the Pacific Ocean.', true),
(15, 4, 8, 'Viscosity', 'How thick and sticky a liquid is.', true),
(15, 4, 9, 'Silica', 'A compound of silicon and oxygen that makes magma thicker.', true),
(15, 4, 10, 'Effusive eruption', 'A gentle eruption with flowing lava.', true),
(15, 4, 11, 'Explosive eruption', 'A violent eruption caused by trapped gas.', true),
(15, 4, 12, 'Shield volcano', 'A wide, gently sloping volcano built by runny lava.', true),
(15, 4, 13, 'Cinder cone', 'A small, steep volcano made of lava chunks.', true),
(15, 4, 14, 'Composite volcano (stratovolcano)', 'A tall volcano built of lava and ash layers.', true),
(15, 4, 15, 'Pahoehoe', 'Smooth, ropey lava.', true),
(15, 4, 16, 'A''a', 'Rough, jagged lava.', true),
(15, 4, 17, 'Tephra', 'Rock fragments blasted from a volcano.', true),
(15, 4, 18, 'Volcanic ash', 'Tiny bits of rock and glass from an eruption.', true),
(15, 4, 19, 'Lapilli', 'Pebble-sized tephra.', true),
(15, 4, 20, 'Volcanic bomb', 'A large blob of lava thrown from a volcano.', true),
(15, 4, 21, 'Pyroclastic flow', 'A fast, deadly avalanche of hot gas, ash, and rock.', true),
(15, 4, 22, 'Lahar', 'A volcanic mudflow.', true),
(15, 4, 23, 'Supervolcano', 'A volcano capable of an enormous eruption, like Yellowstone.', true),
(15, 4, 24, 'Geothermal energy', 'Energy from Earth''s internal heat.', true),
(16, 4, 1, 'Orogeny', 'The process of mountain building.', true),
(16, 4, 2, 'Stress', 'Force acting on rock.', true),
(16, 4, 3, 'Compression', 'Stress that squeezes rock together.', true),
(16, 4, 4, 'Tension', 'Stress that pulls rock apart.', true),
(16, 4, 5, 'Shear', 'Stress that pushes rock in opposite directions side by side.', true),
(16, 4, 6, 'Deformation', 'A change in rock''s shape caused by stress.', true),
(16, 4, 7, 'Fold', 'A bend in rock layers.', true),
(16, 4, 8, 'Anticline', 'An upward, arch-shaped fold.', true),
(16, 4, 9, 'Syncline', 'A downward, U-shaped fold.', true),
(16, 4, 10, 'Monocline', 'A step-like bend in flat rock layers.', true),
(16, 4, 11, 'Folded mountain', 'A mountain formed by rock crumpled into folds.', true),
(16, 4, 12, 'Fault-block mountain', 'A mountain formed when blocks of crust are lifted along faults.', true),
(16, 4, 13, 'Horst', 'A raised block between faults.', true),
(16, 4, 14, 'Graben', 'A dropped-down block between faults.', true),
(16, 4, 15, 'Basin and Range', 'A region of alternating mountains and valleys formed by stretching crust.', true),
(16, 4, 16, 'Volcanic mountain', 'A mountain built by eruptions.', true),
(16, 4, 17, 'Dome mountain', 'A mountain formed when magma pushes rock layers up.', true),
(16, 4, 18, 'Batholith', 'A huge mass of intrusive igneous rock, like the Idaho Batholith.', true),
(16, 4, 19, 'Isostasy', 'The balance of crust floating on the mantle.', true),
(16, 4, 20, 'Uplift', 'The raising of Earth''s crust.', true),
(17, 5, 1, 'World ocean', 'The single connected body of salt water covering about 71% of Earth.', true),
(17, 5, 2, 'Oceanographer', 'A scientist who studies the ocean.', true),
(17, 5, 3, 'Salinity', 'The amount of dissolved salt in water.', true),
(17, 5, 4, 'Density', 'How much mass is packed into a space; cold, salty water is denser.', true),
(17, 5, 5, 'Thermocline', 'An ocean layer where temperature drops quickly with depth.', true),
(17, 5, 6, 'Pressure', 'The force of water pressing down; increases with depth.', true),
(17, 5, 7, 'Surface current', 'A wind-driven current in the ocean''s top layer.', true),
(17, 5, 8, 'Coriolis effect', 'Earth''s spin bending moving air and water to the side.', true),
(17, 5, 9, 'Gyre', 'A huge circular system of ocean currents.', true),
(17, 5, 10, 'Gulf Stream', 'A warm current flowing up the U.S. East Coast to Europe.', true),
(17, 5, 11, 'California Current', 'A cold current flowing down the U.S. West Coast.', true),
(17, 5, 12, 'Deep current', 'A slow current along the ocean floor driven by density.', true),
(17, 5, 13, 'Thermohaline circulation', 'Deep ocean circulation driven by temperature and salinity.', true),
(17, 5, 14, 'Global conveyor belt', 'The worldwide loop of deep and surface currents.', true),
(17, 5, 15, 'Upwelling', 'Cold, nutrient-rich deep water rising to the surface.', true),
(17, 5, 16, 'El Niño', 'A periodic warming of the eastern Pacific that changes world weather.', true),
(17, 5, 17, 'La Niña', 'A periodic cooling of the eastern Pacific.', true),
(17, 5, 18, 'Plankton', 'Tiny drifting organisms at the base of ocean food webs.', true),
(18, 5, 1, 'Sonar', 'Using sound echoes to measure distance underwater.', true),
(18, 5, 2, 'Bathymetry', 'The measurement of ocean depth.', true),
(18, 5, 3, 'Submersible', 'A small underwater vehicle for deep-sea exploring.', true),
(18, 5, 4, 'Continental margin', 'The underwater edge of a continent.', true),
(18, 5, 5, 'Continental shelf', 'The shallow, gently sloping edge of a continent underwater.', true),
(18, 5, 6, 'Continental slope', 'The steep drop from the shelf to the deep ocean.', true),
(18, 5, 7, 'Continental rise', 'The gentle pile of sediment at the base of the slope.', true),
(18, 5, 8, 'Submarine canyon', 'A deep canyon cut into the shelf and slope.', true),
(18, 5, 9, 'Abyssal plain', 'A flat, sediment-covered area of the deep sea floor.', true),
(18, 5, 10, 'Trench', 'A deep, narrow valley where one plate subducts.', true),
(18, 5, 11, 'Seamount', 'An underwater volcano that doesn''t reach the surface.', true),
(18, 5, 12, 'Guyot', 'A flat-topped seamount.', true),
(18, 5, 13, 'Hydrothermal vent', 'A hot spring on the sea floor.', true),
(18, 5, 14, 'Ooze', 'Sea-floor sediment made of tiny shells.', true),
(18, 5, 15, 'Wave', 'Energy moving through water.', true),
(18, 5, 16, 'Crest', 'The top of a wave.', true),
(18, 5, 17, 'Trough', 'The bottom of a wave.', true),
(18, 5, 18, 'Wavelength', 'The distance from one crest to the next.', true),
(18, 5, 19, 'Wave height', 'The distance from trough to crest.', true),
(18, 5, 20, 'Breaker', 'A wave that tips over in shallow water.', true),
(18, 5, 21, 'Tide', 'The daily rise and fall of sea level, caused mostly by the Moon.', true),
(18, 5, 22, 'Spring tide', 'An extra-large tide at new and full moon.', true),
(18, 5, 23, 'Neap tide', 'A smaller tide at quarter moons.', true),
(18, 5, 24, 'Sea stack', 'A pillar of rock left standing offshore by erosion.', true),
(18, 5, 25, 'Longshore current', 'A current moving sand along the shore.', true),
(18, 5, 26, 'Spit', 'A sandbar sticking out from shore.', true),
(18, 5, 27, 'Barrier island', 'A long sandy island parallel to the coast.', true),
(18, 5, 28, 'Jetty', 'A wall built into the sea to protect a harbor or trap sand.', true),
(19, 6, 1, 'Atmosphere', 'The layer of gases surrounding Earth.', true),
(19, 6, 2, 'Nitrogen', 'The most common gas in air, about 78%.', true),
(19, 6, 3, 'Oxygen', 'The gas we breathe, about 21% of air.', true),
(19, 6, 4, 'Carbon dioxide', 'A greenhouse gas, about 0.04% of air.', true),
(19, 6, 5, 'Water vapor', 'Water in gas form in the air.', true),
(19, 6, 6, 'Aerosol', 'Tiny solid or liquid particles in air, like dust or smoke.', true),
(19, 6, 7, 'Air pressure', 'The weight of air pressing down.', true),
(19, 6, 8, 'Barometer', 'An instrument that measures air pressure.', true),
(19, 6, 9, 'Altitude', 'Height above sea level.', true),
(19, 6, 10, 'Troposphere', 'The lowest layer, where weather happens.', true),
(19, 6, 11, 'Tropopause', 'The boundary between the troposphere and stratosphere.', true),
(19, 6, 12, 'Stratosphere', 'The layer containing the ozone layer.', true),
(19, 6, 13, 'Ozone layer', 'Ozone in the stratosphere that absorbs UV radiation.', true),
(19, 6, 14, 'Ultraviolet (UV) radiation', 'Harmful high-energy sunlight.', true),
(19, 6, 15, 'Mesosphere', 'The coldest layer, where meteors burn up.', true),
(19, 6, 16, 'Thermosphere', 'A very thin, hot layer where auroras occur.', true),
(19, 6, 17, 'Exosphere', 'The outermost layer, fading into space.', true),
(19, 6, 18, 'CFCs', 'Chemicals that destroyed ozone, now banned.', true),
(19, 6, 19, 'Radiation', 'Energy traveling as waves through space.', true),
(19, 6, 20, 'Conduction', 'Heat moving by direct contact.', true),
(19, 6, 21, 'Convection', 'Heat moving by rising and sinking currents.', true),
(19, 6, 22, 'Albedo', 'How much light a surface reflects.', true),
(19, 6, 23, 'Greenhouse effect', 'Gases trapping heat and keeping Earth warm.', true),
(19, 6, 24, 'Greenhouse gas', 'A gas that absorbs heat, like CO₂, methane, or water vapor.', true),
(19, 6, 25, 'Wind', 'Air moving from high to low pressure.', true),
(19, 6, 26, 'High pressure', 'An area of sinking air and usually clear weather.', true),
(19, 6, 27, 'Low pressure', 'An area of rising air and usually stormy weather.', true),
(19, 6, 28, 'Sea breeze', 'A cool wind blowing from sea to land during the day.', true),
(19, 6, 29, 'Trade winds', 'Steady global winds near the equator.', true),
(19, 6, 30, 'Prevailing westerlies', 'Global winds that blow west to east over the U.S.', true),
(19, 6, 31, 'Jet stream', 'A fast, high-altitude river of wind that steers storms.', true),
(20, 6, 1, 'Weather', 'The condition of the atmosphere at a certain time and place.', true),
(20, 6, 2, 'Humidity', 'The amount of water vapor in the air.', true),
(20, 6, 3, 'Relative humidity', 'How full the air is with water vapor compared to its maximum.', true),
(20, 6, 4, 'Saturated', 'Air holding as much water vapor as it can.', true),
(20, 6, 5, 'Dew point', 'The temperature at which air becomes saturated.', true),
(20, 6, 6, 'Condensation', 'Water vapor turning into liquid.', true),
(20, 6, 7, 'Condensation nuclei', 'Tiny particles water condenses onto.', true),
(20, 6, 8, 'Orographic lifting', 'Air forced upward over mountains.', true),
(20, 6, 9, 'Cirrus', 'Thin, wispy, high clouds of ice crystals.', true),
(20, 6, 10, 'Cumulus', 'Puffy clouds with flat bottoms.', true),
(20, 6, 11, 'Stratus', 'Flat, gray, sheet-like clouds.', true),
(20, 6, 12, 'Cumulonimbus', 'A towering thunderstorm cloud.', true),
(20, 6, 13, 'Nimbostratus', 'A thick gray cloud bringing steady rain or snow.', true),
(20, 6, 14, 'Fog', 'A cloud at ground level.', true),
(20, 6, 15, 'Temperature inversion', 'Warm air trapping cold air near the ground.', true),
(20, 6, 16, 'Precipitation', 'Water falling from clouds.', true),
(20, 6, 17, 'Sleet', 'Rain that freezes into ice pellets before landing.', true),
(20, 6, 18, 'Freezing rain', 'Rain that freezes when it hits cold surfaces.', true),
(20, 6, 19, 'Hail', 'Balls of ice formed in thunderstorms.', true),
(20, 6, 20, 'Rain shadow', 'A dry area on the far side of mountains.', true),
(20, 6, 21, 'Air mass', 'A huge body of air with similar temperature and humidity.', true),
(20, 6, 22, 'Continental', 'An air mass formed over land; dry.', true),
(20, 6, 23, 'Maritime', 'An air mass formed over water; humid.', true),
(20, 6, 24, 'Polar', 'An air mass formed near the poles; cold.', true),
(20, 6, 25, 'Tropical', 'An air mass formed near the equator; warm.', true),
(20, 6, 26, 'Front', 'The boundary between two air masses.', false),
(20, 6, 27, 'Cold front', 'Cold air pushing under warm air; quick storms.', true),
(20, 6, 28, 'Warm front', 'Warm air sliding over cold air; steady rain.', true),
(20, 6, 29, 'Stationary front', 'A front that stalls.', true),
(20, 6, 30, 'Occluded front', 'A cold front catching up to a warm front.', true),
(20, 6, 31, 'Cyclone', 'A low-pressure system with rising air.', true),
(20, 6, 32, 'Anticyclone', 'A high-pressure system with sinking air.', true),
(20, 6, 33, 'Meteorologist', 'A scientist who studies and forecasts weather.', true),
(20, 6, 34, 'Doppler radar', 'Radar that detects precipitation and wind in storms.', true),
(20, 6, 35, 'Anemometer', 'An instrument that measures wind speed.', true),
(20, 6, 36, 'Hygrometer', 'An instrument that measures humidity.', true),
(20, 6, 37, 'Isobar', 'A line on a map connecting places with equal air pressure.', true),
(21, 6, 1, 'Thunderstorm', 'A storm with lightning and thunder.', true),
(21, 6, 2, 'Unstable air', 'Warm air near the ground with cold air above, which rises easily.', true),
(21, 6, 3, 'Updraft', 'Rising air in a storm.', true),
(21, 6, 4, 'Downdraft', 'Sinking air in a storm.', true),
(21, 6, 5, 'Supercell', 'A powerful, long-lasting rotating thunderstorm.', true),
(21, 6, 6, 'Lightning', 'A giant electrical spark in a storm.', true),
(21, 6, 7, 'Thunder', 'The sound of air expanding from lightning''s heat.', true),
(21, 6, 8, 'Dry lightning', 'Lightning with little or no rain reaching the ground.', true),
(21, 6, 9, 'Tornado', 'A violently spinning column of air touching the ground.', true),
(21, 6, 10, 'Wind shear', 'Winds changing speed or direction with height.', true),
(21, 6, 11, 'Mesocyclone', 'A rotating updraft in a supercell.', true),
(21, 6, 12, 'Funnel cloud', 'A rotating cloud that hasn''t touched the ground.', true),
(21, 6, 13, 'Enhanced Fujita scale', 'Rates tornadoes from EF0 to EF5 by damage.', true),
(21, 6, 14, 'Tornado Alley', 'The region of the Great Plains with the most tornadoes.', true),
(21, 6, 15, 'Hurricane', 'A huge rotating tropical storm with winds of 74 mph or more.', true),
(21, 6, 16, 'Typhoon', 'A hurricane in the western Pacific.', true),
(21, 6, 17, 'Cyclone (tropical)', 'A hurricane in the Indian Ocean.', true),
(21, 6, 18, 'Eye', 'The calm center of a hurricane.', false),
(21, 6, 19, 'Eye wall', 'The ring of strongest winds around the eye.', true),
(21, 6, 20, 'Rain band', 'A spiral arm of storms in a hurricane.', true),
(21, 6, 21, 'Saffir-Simpson scale', 'Rates hurricanes from Category 1 to 5.', true),
(21, 6, 22, 'Storm surge', 'A wall of seawater pushed ashore by a hurricane.', true),
(21, 6, 23, 'Blizzard', 'A storm with heavy blowing snow and strong winds.', true),
(21, 6, 24, 'Ice storm', 'Freezing rain that coats everything in ice.', true),
(21, 6, 25, 'Avalanche', 'A mass of snow sliding down a mountain.', true),
(21, 6, 26, 'Flash flood', 'A sudden flood within hours of heavy rain.', true),
(21, 6, 27, 'Drought', 'A long period of below-normal precipitation.', true),
(21, 6, 28, 'Watch', 'Conditions are right for a hazard; be ready.', false),
(21, 6, 29, 'Warning', 'A hazard is happening or about to; take action.', false),
(22, 6, 1, 'Climate', 'The average weather of a place over 30 years or more.', true),
(22, 6, 2, 'Continental climate', 'An inland climate with big temperature swings.', true),
(22, 6, 3, 'Köppen system', 'A way of classifying climates by temperature and precipitation.', true),
(22, 6, 4, 'Arid', 'Very dry; a desert climate.', true),
(22, 6, 5, 'Semi-arid', 'Fairly dry, like southern Idaho''s high desert.', true),
(22, 6, 6, 'Temperate', 'Mild, with distinct seasons.', true),
(22, 6, 7, 'Tundra', 'A cold, treeless polar region.', true),
(22, 6, 8, 'Microclimate', 'The climate of a small area that differs from its surroundings.', true),
(22, 6, 9, 'Urban heat island', 'A city that stays warmer than the countryside around it.', true),
(22, 6, 10, 'Axis tilt', 'Earth''s 23.5° tilt, which causes seasons.', true),
(22, 6, 11, 'Ice age', 'A long cold period with widespread glaciers.', true),
(22, 6, 12, 'Milankovitch cycles', 'Long-term changes in Earth''s orbit and tilt that affect climate.', true),
(22, 6, 13, 'Proxy data', 'Natural clues like ice cores and tree rings that record past climate.', true),
(22, 6, 14, 'Ice core', 'A long tube of ice drilled to study ancient air and climate.', true),
(22, 6, 15, 'Tree rings', 'Yearly growth rings that record growing conditions.', true),
(22, 6, 16, 'Keeling Curve', 'The graph of CO₂ measured at Mauna Loa since 1958.', true),
(22, 6, 17, 'Parts per million (ppm)', 'A unit for measuring small amounts of a gas in air.', true),
(22, 6, 18, 'Fossil fuel', 'Coal, oil, or natural gas formed from ancient life.', true),
(22, 6, 19, 'Carbon isotope', 'A form of carbon whose mix reveals where carbon came from.', true),
(22, 6, 20, 'Global warming', 'The rise in Earth''s average surface temperature.', true),
(22, 6, 21, 'Climate change', 'Long-term changes in climate patterns.', true),
(22, 6, 22, 'Anthropogenic', 'Caused by humans.', true),
(22, 6, 23, 'Sea-level rise', 'The ocean''s surface rising as water warms and ice melts.', true),
(22, 6, 24, 'Ocean acidification', 'The ocean becoming more acidic as it absorbs CO₂.', true),
(22, 6, 25, 'Feedback loop', 'A process where a change causes effects that speed up or slow down the change.', true),
(22, 6, 26, 'Ice-albedo feedback', 'Melting ice exposing darker surfaces that absorb more heat.', true),
(22, 6, 27, 'Mitigation', 'Reducing greenhouse gas emissions.', true),
(22, 6, 28, 'Adaptation', 'Preparing for and adjusting to climate changes.', true),
(23, 7, 1, 'Fossil', 'Preserved remains or traces of ancient life.', true),
(23, 7, 2, 'Paleontologist', 'A scientist who studies fossils.', true),
(23, 7, 3, 'Petrified fossil', 'A fossil where minerals replaced the original material.', true),
(23, 7, 4, 'Mold', 'An empty print of an organism left in rock.', false),
(23, 7, 5, 'Cast', 'A copy formed when minerals fill a mold.', false),
(23, 7, 6, 'Carbon film', 'A thin carbon outline of an organism.', true),
(23, 7, 7, 'Trace fossil', 'Evidence of activity, like footprints or burrows.', true),
(23, 7, 8, 'Coprolite', 'Fossilized poop.', true),
(23, 7, 9, 'Amber', 'Hardened tree sap that can trap organisms.', true),
(23, 7, 10, 'Relative dating', 'Putting events in order without exact ages.', true),
(23, 7, 11, 'Law of superposition', 'In undisturbed layers, the oldest is on the bottom.', true),
(23, 7, 12, 'Original horizontality', 'Sediment is first laid down in flat layers.', true),
(23, 7, 13, 'Crosscutting relationships', 'Anything cutting across rock is younger than the rock.', true),
(23, 7, 14, 'Inclusion', 'A piece of rock inside another rock; it''s older than the rock around it.', true),
(23, 7, 15, 'Unconformity', 'A gap in the rock record.', true),
(23, 7, 16, 'Index fossil', 'A widespread, short-lived species used to date rock layers.', true),
(23, 7, 17, 'Correlation', 'Matching rock layers from different places.', true),
(23, 7, 18, 'Absolute dating', 'Finding the actual age of a rock in years.', true),
(23, 7, 19, 'Radiometric dating', 'Using radioactive decay to find a rock''s age.', true),
(23, 7, 20, 'Radioactive decay', 'Unstable atoms breaking down into other elements.', true),
(23, 7, 21, 'Isotope', 'A form of an element with a different number of neutrons.', true),
(23, 7, 22, 'Parent isotope', 'The original radioactive isotope.', true),
(23, 7, 23, 'Daughter isotope', 'What a parent isotope decays into.', true),
(23, 7, 24, 'Half-life', 'The time for half of a radioactive sample to decay.', true),
(23, 7, 25, 'Carbon-14', 'An isotope used to date once-living things up to about 50,000 years old.', true),
(23, 7, 26, 'Geologic time scale', 'The calendar of Earth''s history.', true),
(23, 7, 27, 'Eon', 'The largest division of geologic time.', true),
(23, 7, 28, 'Era', 'A division of an eon.', true),
(23, 7, 29, 'Period', 'A division of an era.', false),
(23, 7, 30, 'Epoch', 'A division of a period.', true),
(23, 7, 31, 'Precambrian', 'Earth''s earliest and longest time span, about 88% of its history.', true),
(23, 7, 32, 'Paleozoic', 'The era of "ancient life," 541–252 million years ago.', true),
(23, 7, 33, 'Mesozoic', 'The era of reptiles and dinosaurs, 252–66 million years ago.', true),
(23, 7, 34, 'Cenozoic', 'The era of mammals, 66 million years ago to now.', true),
(23, 7, 35, 'Mass extinction', 'The dying out of a huge share of species in a short time.', true),
(24, 7, 1, 'Nebula', 'A giant cloud of gas and dust in space.', true),
(24, 7, 2, 'Planetesimal', 'A small early chunk of rock that grew into planets.', true),
(24, 7, 3, 'Accretion', 'Small objects clumping together to form larger ones.', true),
(24, 7, 4, 'Differentiation', 'Earth separating into layers by density.', true),
(24, 7, 5, 'Giant impact hypothesis', 'The idea that a collision with a Mars-sized object formed the Moon.', true),
(24, 7, 6, 'Meteorite', 'A space rock that lands on Earth.', true),
(24, 7, 7, 'Early atmosphere', 'Earth''s first air, made of volcanic gases with almost no oxygen.', true),
(24, 7, 8, 'Stromatolite', 'A layered mound built by bacteria; among the oldest fossils.', true),
(24, 7, 9, 'Cyanobacteria', 'Bacteria that make food and oxygen by photosynthesis.', true),
(24, 7, 10, 'Photosynthesis', 'The process plants and some bacteria use to make food, releasing oxygen.', true),
(24, 7, 11, 'Great Oxygenation Event', 'Oxygen building up in the air about 2.4 billion years ago.', true),
(24, 7, 12, 'Banded iron formation', 'Striped rock formed as oxygen rusted iron in the oceans.', true),
(24, 7, 13, 'Snowball Earth', 'A time when Earth may have frozen nearly completely.', true),
(24, 7, 14, 'Coevolution', 'Life and Earth''s systems changing each other over time.', true),
(24, 7, 15, 'Cambrian Explosion', 'The rapid appearance of many new life forms about 541 million years ago.', true),
(24, 7, 16, 'Trilobite', 'An extinct ocean animal common in the Paleozoic.', true),
(24, 7, 17, 'Pangaea', 'The supercontinent that formed in the Paleozoic.', true),
(24, 7, 18, 'Permian extinction', 'The largest mass extinction, about 252 million years ago.', true),
(24, 7, 19, 'K-Pg extinction', 'The asteroid-caused extinction of the dinosaurs, 66 million years ago.', true),
(24, 7, 20, 'Chicxulub crater', 'The impact crater in Mexico linked to the K-Pg extinction.', true),
(24, 7, 21, 'Iridium', 'An element rare on Earth but common in asteroids.', true),
(25, 8, 1, 'Natural resource', 'Anything from nature that people use.', true),
(25, 8, 2, 'Renewable resource', 'A resource replaced naturally as fast as it''s used.', true),
(25, 8, 3, 'Nonrenewable resource', 'A resource that takes millions of years to form.', true),
(25, 8, 4, 'Coal', 'A fossil fuel from ancient swamp plants.', true),
(25, 8, 5, 'Peat', 'Partly decayed plant material, the first stage of coal.', true),
(25, 8, 6, 'Petroleum', 'Crude oil, a liquid fossil fuel.', true),
(25, 8, 7, 'Natural gas', 'A gas fossil fuel, mostly methane.', true),
(25, 8, 8, 'Hydraulic fracturing (fracking)', 'Cracking rock with high-pressure fluid to release oil and gas.', true),
(25, 8, 9, 'Nuclear energy', 'Energy released from atoms.', true),
(25, 8, 10, 'Nuclear fission', 'Splitting atoms to release energy.', true),
(25, 8, 11, 'Radioactive waste', 'Dangerous leftover material from nuclear reactors.', true),
(25, 8, 12, 'Hydroelectric power', 'Electricity from flowing water; Idaho''s biggest source.', true),
(25, 8, 13, 'Solar energy', 'Energy from sunlight.', true),
(25, 8, 14, 'Photovoltaic cell', 'A solar cell that turns sunlight into electricity.', true),
(25, 8, 15, 'Wind energy', 'Energy from moving air.', true),
(25, 8, 16, 'Biomass', 'Energy from plant and animal material.', true),
(25, 8, 17, 'Critical minerals', 'Minerals needed for modern tech, like lithium and cobalt.', true),
(25, 8, 18, 'Surface mining', 'Removing soil and rock to reach shallow deposits.', true),
(25, 8, 19, 'Underground mining', 'Digging tunnels to reach deep deposits.', true),
(25, 8, 20, 'Reclamation', 'Restoring land after mining.', true),
(25, 8, 21, 'Conservation', 'Using resources carefully so they last.', true),
(25, 8, 22, 'Energy efficiency', 'Using less energy to get the same result.', true),
(25, 8, 23, 'Sustainability', 'Meeting today''s needs without harming future generations.', true),
(26, 8, 1, 'Anthropocene', 'A proposed name for the age when humans strongly shape Earth.', true),
(26, 8, 2, 'Ecological footprint', 'The land and resources needed to support a person''s lifestyle.', true),
(26, 8, 3, 'Air pollution', 'Harmful substances in the air.', true),
(26, 8, 4, 'Smog', 'A brownish haze formed from car exhaust and sunlight.', true),
(26, 8, 5, 'Ground-level ozone', 'Ozone near the ground that harms lungs.', true),
(26, 8, 6, 'Particulate matter', 'Tiny particles of soot, dust, and smoke in air.', true),
(26, 8, 7, 'Air Quality Index (AQI)', 'A daily rating of how clean the air is.', true),
(26, 8, 8, 'Clean Air Act', 'A 1970 U.S. law limiting air pollution.', true),
(26, 8, 9, 'Point-source pollution', 'Pollution from one clear source, like a pipe.', true),
(26, 8, 10, 'Nonpoint-source pollution', 'Pollution from many spread-out sources, like farm runoff.', true),
(26, 8, 11, 'Eutrophication', 'Excess nutrients causing algae blooms that use up oxygen in water.', true),
(26, 8, 12, 'Clean Water Act', 'A 1972 U.S. law protecting water quality.', true),
(26, 8, 13, 'Deforestation', 'Clearing forests.', true),
(26, 8, 14, 'Urbanization', 'The growth of cities.', true),
(26, 8, 15, 'Desertification', 'Dry land turning into desert.', true),
(26, 8, 16, 'Landfill', 'A place where trash is buried.', true),
(26, 8, 17, 'Microplastics', 'Tiny pieces of broken-down plastic.', true),
(26, 8, 18, 'Biodiversity', 'The variety of life in an area.', true),
(26, 8, 19, 'Invasive species', 'A species introduced to a new place where it spreads and causes harm.', true),
(26, 8, 20, 'Habitat loss', 'The destruction of places where organisms live.', true),
(26, 8, 21, 'Endangered species', 'A species at risk of going extinct.', true),
(26, 8, 22, 'Wildland-urban interface', 'Where homes meet forests or wild land; high wildfire risk.', true),
(26, 8, 23, 'Hazard map', 'A map showing areas at risk from natural hazards.', true),
(26, 8, 24, 'Restoration', 'Returning damaged ecosystems to health.', true),
(27, 9, 1, 'Rotation', 'Earth spinning on its axis; causes day and night.', true),
(27, 9, 2, 'Axis', 'The imaginary line Earth spins around.', true),
(27, 9, 3, 'Revolution', 'Earth''s trip around the Sun; one year.', true),
(27, 9, 4, 'Orbit', 'The path of one object around another.', true),
(27, 9, 5, 'Ellipse', 'An oval shape; the shape of planetary orbits.', true),
(27, 9, 6, 'Leap year', 'A year with an extra day, every four years.', true),
(27, 9, 7, 'Gravity', 'The force of attraction between objects with mass.', true),
(27, 9, 8, 'Inertia', 'An object''s tendency to keep moving in a straight line.', true),
(27, 9, 9, 'Law of universal gravitation', 'Newton''s law explaining gravity between all objects.', true),
(27, 9, 10, 'Kepler''s laws', 'Three rules describing how planets orbit the Sun.', true),
(27, 9, 11, 'Astronomical unit (AU)', 'Earth''s average distance from the Sun, about 150 million km.', true),
(27, 9, 12, 'Solstice', 'The longest or shortest day of the year.', true),
(27, 9, 13, 'Equinox', 'A day when day and night are about equal.', true),
(27, 9, 14, 'Satellite', 'An object that orbits a planet.', true),
(27, 9, 15, 'Maria', 'Dark, flat lava plains on the Moon.', true),
(27, 9, 16, 'Highlands', 'Bright, mountainous areas of the Moon.', true),
(27, 9, 17, 'Crater', 'A bowl-shaped pit made by an impact.', true),
(27, 9, 18, 'Synchronous rotation', 'When an object rotates and orbits in the same time, always showing one side.', true),
(27, 9, 19, 'Phase', 'The shape of the Moon''s lit part as seen from Earth.', false),
(27, 9, 20, 'New moon', 'The phase when the Moon''s lit side faces away from Earth.', true),
(27, 9, 21, 'Crescent', 'A phase showing a thin sliver of the Moon.', true),
(27, 9, 22, 'Quarter moon', 'A phase showing half of the Moon''s face lit.', true),
(27, 9, 23, 'Gibbous', 'A phase showing more than half lit.', true),
(27, 9, 24, 'Full moon', 'The phase showing the whole face lit.', true),
(27, 9, 25, 'Waxing', 'The lit part growing.', true),
(27, 9, 26, 'Waning', 'The lit part shrinking.', true),
(27, 9, 27, 'Solar eclipse', 'The Moon blocking the Sun''s light from Earth.', true),
(27, 9, 28, 'Lunar eclipse', 'Earth''s shadow falling on the Moon.', true),
(27, 9, 29, 'Umbra', 'The darkest part of a shadow.', true),
(27, 9, 30, 'Penumbra', 'The lighter outer part of a shadow.', true),
(27, 9, 31, 'Nuclear fusion', 'Combining atoms to release energy; powers the Sun.', true),
(27, 9, 32, 'Sunspot', 'A cooler, darker area on the Sun.', true),
(27, 9, 33, 'Solar flare', 'A sudden burst of energy from the Sun.', true),
(27, 9, 34, 'Solar wind', 'A stream of charged particles from the Sun.', true),
(28, 9, 1, 'Solar system', 'The Sun and everything held by its gravity.', true),
(28, 9, 2, 'Terrestrial planet', 'A small, rocky inner planet.', true),
(28, 9, 3, 'Gas giant', 'A huge planet made mostly of gas, like Jupiter and Saturn.', true),
(28, 9, 4, 'Ice giant', 'A giant planet with lots of ices, like Uranus and Neptune.', true),
(28, 9, 5, 'Asteroid belt', 'The region of asteroids between Mars and Jupiter.', true),
(28, 9, 6, 'Kuiper Belt', 'A region of icy bodies beyond Neptune.', true),
(28, 9, 7, 'Dwarf planet', 'A round body orbiting the Sun that hasn''t cleared its orbit, like Pluto.', true),
(28, 9, 8, 'Asteroid', 'A rocky or metal chunk orbiting the Sun.', true),
(28, 9, 9, 'Comet', 'An icy body that grows a glowing tail near the Sun.', true),
(28, 9, 10, 'Coma', 'The glowing cloud around a comet''s head.', true),
(28, 9, 11, 'Meteoroid', 'A small piece of space rock.', true),
(28, 9, 12, 'Meteor', 'A meteoroid burning up in the atmosphere; a shooting star.', true),
(28, 9, 13, 'Star', 'A huge ball of hot gas powered by nuclear fusion.', true),
(28, 9, 14, 'Spectroscope', 'A tool that splits light into a spectrum.', true),
(28, 9, 15, 'Spectrum', 'The band of colors made when light is split.', true),
(28, 9, 16, 'Apparent magnitude', 'How bright a star looks from Earth.', true),
(28, 9, 17, 'Absolute magnitude', 'How bright a star actually is.', true),
(28, 9, 18, 'H-R diagram', 'A graph of stars'' brightness vs. temperature.', true),
(28, 9, 19, 'Main sequence', 'The band on the H-R diagram where most stars spend their lives.', true),
(28, 9, 20, 'Light-year', 'The distance light travels in one year, about 9.5 trillion km.', true),
(28, 9, 21, 'Protostar', 'A young star still forming.', true),
(28, 9, 22, 'Red giant', 'A large, cool star near the end of its life.', true),
(28, 9, 23, 'Planetary nebula', 'The glowing shell of gas shed by a dying Sun-like star.', true),
(28, 9, 24, 'White dwarf', 'The small, hot core left after a Sun-like star dies.', true),
(28, 9, 25, 'Supergiant', 'An extremely large, bright star.', true),
(28, 9, 26, 'Supernova', 'The explosion of a massive star.', true),
(28, 9, 27, 'Neutron star', 'A super-dense remnant of a supernova.', true),
(28, 9, 28, 'Black hole', 'An object with gravity so strong not even light escapes.', true),
(28, 9, 29, 'Stellar nucleosynthesis', 'Stars making new elements by fusion.', true),
(28, 9, 30, 'Galaxy', 'A huge system of stars, gas, and dust held by gravity.', true),
(28, 9, 31, 'Milky Way', 'Our home galaxy, a spiral.', true),
(28, 9, 32, 'Spiral galaxy', 'A galaxy with pinwheel arms.', true),
(28, 9, 33, 'Elliptical galaxy', 'An oval-shaped galaxy.', true),
(28, 9, 34, 'Irregular galaxy', 'A galaxy with no clear shape.', true),
(28, 9, 35, 'Big Bang theory', 'The theory that the universe began hot and dense about 13.8 billion years ago and has expanded since.', true),
(28, 9, 36, 'Redshift', 'Light from a receding object stretching toward red.', true),
(28, 9, 37, 'Doppler effect', 'The change in wave frequency when a source moves toward or away from you.', true),
(28, 9, 38, 'Cosmic microwave background (CMB)', 'Leftover radiation from the early universe.', true),
(28, 9, 39, 'Dark matter', 'Unseen matter detected by its gravity.', true),
(28, 9, 40, 'Dark energy', 'A mysterious force speeding up the universe''s expansion.', true);
