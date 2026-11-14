-- 006: Live & multiplayer (wave-live). Run once in Supabase → SQL Editor (project gmeyamrlqfrabtslsweu). Safe to re-run.
-- Adds new b_ tables and functions only. Nothing existing is changed or removed. schema.sql has the same block.
-- No hard removals anywhere: finished games just stay ended, and teacher "remove" actions are soft (hidden_at).
--
--   1. Live class games (/live/ for students, /live/host/ for the projector): Pick a Side Live (class vote),
--      Rock Showdown (speed quiz with points) and Realm Raid (teams vs. a boss). Same rules as Dopps Class live_games.sql.
--   2. Gold Rush Live (/gold-rush-live/ + /gold-rush-live/host/): the live version of Gold Rush. Everyone answers at
--      their own pace for a set time; the server checks every answer and prices every upgrade (coin_live.sql twin).
--   3. Partner games (/partner/): Tic-Tac-Toe, Connect 4, Core Sample Hunt (Battleship), Dots & Boxes and Fossil Memory,
--      two devices, one 4-letter code. Moves are checked and winners decided here (duel_*.sql twins).
--   4. Ask Mr. Dopp (/ask/ + Teacher dashboard → Ask): anonymous questions, the teacher answers (ask_dopp.sql twin).
--   5. Lava Snipes network mode: a site-wide player cap for the Realtime broadcast game (snipes_capacity.sql twin).
--   6. Game XP (b_xp_log): +5 per right live answer (Gold Rush Live: the first 15 per game), +25 end-of-game bonuses,
--      written only by these functions, once per event. b_state, b_teacher_roster and b_champions include it.
--      Partner wins (both players logged in) go to b_duel_scores for the partner leaderboard (b_duel_board).
--
-- How the pages stay in sync: polling these functions about once a second, exactly like Dopps Class. No Realtime
-- table subscriptions, so no table publication and no RLS policies are needed. (Lava Snipes network mode is the one
-- exception: it uses a Realtime *broadcast* channel, which never touches a table; only its player cap lives here.)
--
-- Same privacy model as supabase/schema.sql:
--   * Every table has RLS ON and NO policies; the public key can only call the functions below.
--   * Hosts get a random host token (only its SHA-256 is stored); every host action needs it. Players and partners
--     get their own random tokens the same way. Answer keys for a live question stay hidden until the reveal.
--   * Starting a live game needs the teacher code (Dopps Class _teacher_ok, through _b_teacher). No sub codes.
--   * Ask Mr. Dopp questions are saved with NO student and only the day, so a question can't be traced to a name.
--   * Caps: 200 players per live game, 60 open live games, 400 open partner games, 600 ms between Gold Rush answers,
--     3 Ask questions per student per day. Stale games close themselves (live 12 h, partner 2 h idle) and stay
--     ended (no purge; a future purge job could clear old ended rows).
-- Needs pgcrypto in the "extensions" schema (Supabase has it by default).

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
