-- 010: wave-x7b. Run once in Supabase → SQL Editor. Safe to re-run. NOT applied yet.
-- Adds new b_ tables and functions only. Nothing existing is changed, dropped or deleted
-- (no DELETE anywhere: removals are soft flags).
--
--   1. Daily Briefing (/welcome/ + Teacher → Briefing): twin of Dopps Class daily_briefing.sql.
--      One announcement the teacher writes; students see it on the Welcome screen.
--      (The Survey of the Day half already exists in Bedrock: survey.json + b_vote, so it isn't repeated here.)
--   2. Suggest an Improvement (/suggest/ + Teacher → Suggestions): Dopps Class opened a mailto: link.
--      Bedrock keeps suggestions in b_suggestions so they reach the teacher dashboard; nobody types an email.
--   3. Visitors (/visitors/ + Teacher → Visitors): twin of visitor.html + visitor_admin.sql.
--      A visitor is an ordinary b_students row with period 'Visitor' (so the pet, live games and
--      every other feature just work) plus a b_visitors row. 90 days without a visit = the account
--      is switched off (soft: removed = true and the PIN is scrambled). The teacher can remove one.
--   4. Site visit counter (footer): twin of site_visits.sql. Counts one visit per browser tab session.
--
-- Same privacy model as supabase/schema.sql: RLS on, NO policies, the website only calls the
-- security-definer functions below (students: p_id + p_pin_hash via _b_ok; teacher: _b_teacher(p_pass_hash)).
-- Needs supabase/schema.sql (b_students, _b_ok, _b_teacher, _b_today, b_days, b_tasks, b_side_quests),
-- 005_pet.sql (_b_pub_name, b_pets) and 006_live.sql (_b_xp_total).

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

-- "Delete" = archive (soft). Archived ones are hidden unless the teacher asks for them.
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
      exists (select 1 from public.b_pets p where p.student_id = s.id) pet
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
      'pet', exists (select 1 from public.b_pets p where p.student_id = s.id),
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
