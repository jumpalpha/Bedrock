"use client";

// ── wave-live ── Live class games, Gold Rush Live, Partner games, Ask Mr. Dopp, Lava Snipes seats.
// Every call goes to a security-definer function in supabase/migrations/006_live.sql. The pages poll these about once a
// second (same as Dopps Class); nothing subscribes to tables.
import { db, getStudent } from "@/lib/db";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
/** The logged-in student, as RPC args (or nothing). */
export function loginArgs(): { p_id: string; p_pin_hash: string } | Record<string, never> {
  const s = getStudent();
  return s ? { p_id: s.id, p_pin_hash: s.pinHash } : {};
}
function me() {
  const s = getStudent();
  if (!s) throw new Error("Log in first (top right).");
  return { p_id: s.id, p_pin_hash: s.pinHash };
}
/** A random secret for this tab (hex). */
export function randomToken(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
export const store = {
  get<T>(k: string, d: T, session = false): T {
    try { const v = (session ? sessionStorage : localStorage).getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; }
  },
  set(k: string, v: unknown, session = false) {
    try { if (v == null) (session ? sessionStorage : localStorage).removeItem(k); else (session ? sessionStorage : localStorage).setItem(k, JSON.stringify(v)); } catch {}
  },
};

// ---------- Live class games ----------
export type LiveGameType = "pick_a_side" | "showdown" | "raid" | "coins";
export type LivePhase = "lobby" | "question" | "reveal" | "leaderboard" | "ended";
export type LiveQuestion = { prompt: string; choices: string[]; chapter?: number; light?: string; revote?: boolean; side?: string };
export type LiveState = {
  phase: LivePhase; game_type: LiveGameType; q_index: number; question: LiveQuestion | null; q_seconds: number | null;
  seconds_left: number | null; answer_key: string | null; require_login: boolean; player_count: number; answer_count: number;
  teams: Record<string, number> | null;
  me: { nickname: string; team: number | null; signed_in: boolean; score: number; my_answer: string | null; my_correct: boolean | null } | null;
};
export type LivePlayerRow = { id: string; nickname: string; team: number | null; signed_in: boolean; score: number; correct: number; answered_current: boolean };
export type LiveResults = { players: LivePlayerRow[]; tally: Record<string, number>; teams: Record<string, number> };
export type HostSession = { session_id: string; join_code: string; host_token: string };
export type JoinResult = { session_id: string; player_id: string; player_token: string; game_type: LiveGameType; team: number | null };

export const liveCreate = (pass: string, game: LiveGameType, settings: Record<string, string>) =>
  rpc<HostSession>("b_live_create", { p_pass_hash: pass, p_game_type: game, p_settings: settings });
export const liveSetQuestion = (h: HostSession, qi: number, q: LiveQuestion, key: string | null, seconds: number | null) =>
  rpc<boolean>("b_live_set_question", { p_session_id: h.session_id, p_host_token: h.host_token, p_q_index: qi, p_question: q, p_answer_key: key, p_seconds: seconds });
export const liveSetHp = (h: HostSession, hp: number) => rpc<boolean>("b_live_set_hp", { p_session_id: h.session_id, p_host_token: h.host_token, p_hp: hp });
export const liveSetPhase = (h: HostSession, phase: "lobby" | "reveal" | "leaderboard" | "ended") =>
  rpc<boolean>("b_live_set_phase", { p_session_id: h.session_id, p_host_token: h.host_token, p_phase: phase });
export const liveResults = (h: HostSession) => rpc<LiveResults | null>("b_live_results", { p_session_id: h.session_id, p_host_token: h.host_token });
export const liveJoin = (code: string, nickname: string, useLogin: boolean) =>
  rpc<JoinResult>("b_live_join", { p_join_code: code, p_nickname: nickname, ...(useLogin ? loginArgs() : {}) });
export const liveAnswer = (pid: string, tok: string, qi: number, letter: string) =>
  rpc<boolean>("b_live_answer", { p_player_id: pid, p_player_token: tok, p_q_index: qi, p_answer: letter });
export const liveState = (sid: string, pid?: string, tok?: string) =>
  rpc<LiveState | null>("b_live_state", { p_session_id: sid, p_player_id: pid ?? null, p_player_token: tok ?? null });

// ---------- Gold Rush Live ----------
export type GearKey = "mpq" | "mult" | "streak" | "ins";
export type CoinView = {
  phase: LivePhase; running: boolean; seconds_left: number | null; nickname: string; team: number | null; signed_in: boolean;
  cash: number; earned: number; streak: number; answered: number; correct: number; lv: Record<GearKey, number>;
  rank: number; players: number; teams: Record<string, number> | null;
  question: { idx: number; ch: number | null; prompt: string; choices: string[] } | null;
};
export type CoinAnswer = { stale?: boolean; correct?: boolean; answer?: string; why?: string; delta?: number; me: CoinView };
export type CoinBoard = {
  phase: LivePhase; q_seconds: number | null; seconds_left: number | null; teams_n: number | null; bank: number;
  players: { nickname: string; team: number | null; signed_in: boolean; cash: number; correct: number; answered: number }[];
  teams: Record<string, number>; answered: number; correct: number;
};
export const coinSetup = (h: HostSession, qs: { ch: number; prompt: string; choices: string[]; answer: string; why: string }[]) =>
  rpc<number>("b_coin_setup", { p_session_id: h.session_id, p_host_token: h.host_token, p_questions: qs });
export const coinStart = (h: HostSession, seconds: number) => rpc<boolean>("b_coin_start", { p_session_id: h.session_id, p_host_token: h.host_token, p_seconds: seconds });
export const coinBoard = (h: HostSession) => rpc<CoinBoard | null>("b_coin_board", { p_session_id: h.session_id, p_host_token: h.host_token });
export const coinMe = (pid: string, tok: string) => rpc<CoinView>("b_coin_me", { p_player_id: pid, p_player_token: tok });
export const coinAnswer = (pid: string, tok: string, idx: number, answer: string) =>
  rpc<CoinAnswer>("b_coin_answer", { p_player_id: pid, p_player_token: tok, p_idx: idx, p_answer: answer });
export const coinBuy = (pid: string, tok: string, kind: GearKey) => rpc<CoinView>("b_coin_buy", { p_player_id: pid, p_player_token: tok, p_kind: kind });

/** Same gear, values and prices as Gold Rush (public/classic-games/gold-rush.html) and the server. Display only. */
export const GEAR: { key: GearKey; icon: string; name: string; desc: (v: number) => string; vals: number[]; cost: number[] }[] = [
  { key: "mpq", icon: "⛏️", name: "Pickaxe", desc: (v) => `Dig ${money(v)} of gold for each right answer.`, vals: [10, 25, 60, 150, 400, 1000, 2500], cost: [0, 50, 200, 700, 2500, 8000, 25000] },
  { key: "mult", icon: "🪣", name: "Sluice Box", desc: (v) => `Every right answer pays ×${v}.`, vals: [1, 1.5, 2, 3, 4], cost: [0, 100, 500, 2500, 10000] },
  { key: "streak", icon: "💎", name: "Rich Vein", desc: (v) => (v ? `+${money(v)} for each answer in your streak (up to 10).` : "No bonus yet for answering right in a row."), vals: [0, 5, 15, 40, 100, 250], cost: [0, 40, 180, 700, 2500, 8000] },
  { key: "ins", icon: "🪵", name: "Timber Supports", desc: (v) => (v ? `Wrong answers cost ${Math.round(v * 100)}% less.` : "A wrong answer costs half of your Pickaxe haul."), vals: [0, 0.25, 0.5, 0.75, 1], cost: [0, 60, 300, 1500, 6000] },
];
export const money = (n: number) => "$" + Math.floor(n).toLocaleString();

// ---------- Partner games ----------
export type DuelGame = "tictactoe" | "connect4" | "battleship" | "dots" | "memory";
export type DuelView = {
  id: string; code: string; game: DuelGame; board: string; turn: 1 | 2; status: "waiting" | "playing" | "done";
  winner: 0 | 1 | 2 | null; reason: string | null; last_move: number | null; moves: number; round: number;
  score1: number; score2: number; p1_name: string; p2_name: string | null; me: 1 | 2; both_signed_in: boolean;
  rematch1: boolean; rematch2: boolean; faces: Record<string, string>; flip1: number | null; peek: string | null; peek_ms: number;
  opp_online: boolean; ready1?: boolean; ready2?: boolean; my_fleet?: string; opp_fleet?: string | null;
};
export const duelCreate = (game: DuelGame, token: string, name: string) => rpc<DuelView>("b_duel_create", { p_game: game, p_token: token, p_name: name, ...loginArgs() });
export const duelJoin = (code: string, token: string, name: string) => rpc<DuelView>("b_duel_join", { p_code: code, p_token: token, p_name: name, ...loginArgs() });
export const duelState = (id: string, token: string) => rpc<DuelView>("b_duel_state", { p_game_id: id, p_token: token });
export const duelMove = (id: string, token: string, cell: number) => rpc<DuelView>("b_duel_move", { p_game_id: id, p_token: token, p_cell: cell });
export const duelSetup = (id: string, token: string, action: "shuffle" | "ready") => rpc<DuelView>("b_duel_setup", { p_game_id: id, p_token: token, p_action: action });
export const duelLeave = (id: string, token: string) => rpc<DuelView | null>("b_duel_leave", { p_game_id: id, p_token: token });
export type DuelBoardRow = { id: string; name: string; period: string; wins: number; plays: number; games: Record<string, { wins: number; plays: number }> };
/** Partner leaderboard (this term): rounds where both players were logged in. */
export const duelBoard = () => rpc<DuelBoardRow[]>("b_duel_board", {});
export const duelRematch = (id: string, token: string) => rpc<DuelView>("b_duel_rematch", { p_game_id: id, p_token: token });

// ---------- Ask Mr. Dopp ----------
export type AskPosted = { topic: string; body: string; answer: string; answered_on: string | null };
export type AskStatus = "new" | "posted" | "in_class" | "skipped";
export type AskRow = { id: string; day: string; topic: string; body: string; answer: string | null; status: AskStatus; answered_on: string | null };
export const askSubmit = (topic: string, body: string) => rpc<{ ok: boolean; left_today: number }>("b_ask_submit", { ...me(), p_topic: topic, p_body: body });
export const askBoard = () => rpc<AskPosted[]>("b_ask_board", me());
export const askTeacherList = (h: string) => rpc<AskRow[]>("b_ask_teacher_list", { p_pass_hash: h });
export const askTeacherSet = (h: string, id: string, answer: string, status: AskStatus, body: string | null) =>
  rpc<AskRow[]>("b_ask_teacher_set", { p_pass_hash: h, p_question: id, p_answer: answer, p_status: status, p_body: body });
export const askTeacherDelete = (h: string, id: string) => rpc<AskRow[]>("b_ask_teacher_delete", { p_pass_hash: h, p_question: id });
// ── end wave-live ──
