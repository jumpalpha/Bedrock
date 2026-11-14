"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// The publishable key is public by design:
// every table is locked, and the site can only call the functions in supabase/schema.sql.
// Bedrock's b_ tables live in the dopp-health-class project (Supabase free plan = 2 projects), with their own logins.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gmeyamrlqfrabtslsweu.supabase.co";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_zClDCZZQEfC9DILpesPiHg_IcyRqW-c";
export const dbReady = Boolean(SUPABASE_URL && SUPABASE_ANON);

let client: SupabaseClient | null = null;
export function db() {
  if (!dbReady) throw new Error("Bedrock's database isn't connected yet.");
  return (client ??= createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } }));
}

/** SHA-256 of the PIN plus a per-site salt, made in the browser (same scheme as Dopps Class). */
export async function hashSecret(secret: string, salt = "bedrock") {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret + "|" + salt + "|" + SUPABASE_URL));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Student = { id: string; name: string; period: string; pinHash: string };
const KEY = "bedrock_student";

export function getStudent(): Student | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function setStudent(s: Student | null) {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event("bedrock-student"));
}

export function useStudent() {
  const [s, setS] = useState<Student | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => { setS(getStudent()); setReady(true); };
    load();
    window.addEventListener("bedrock-student", load);
    return () => window.removeEventListener("bedrock-student", load);
  }, []);
  return { student: s, ready };
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function signIn(mode: "login" | "register", name: string, period: string, pin: string) {
  const pinHash = await hashSecret(pin);
  const r = await rpc<{ id: string; name: string; period: string }>(mode === "login" ? "b_login" : "b_register",
    { p_name: name, p_period: period, p_pin_hash: pinHash });
  setStudent({ ...r, pinHash });
  return r;
}
export const signOut = () => setStudent(null);

function me() {
  const s = getStudent();
  if (!s) throw new Error("Log in first (top right).");
  return { p_id: s.id, p_pin_hash: s.pinHash };
}

export type ServerState = {
  tasks: string[]; days: string[]; best: Record<string, number>; firstTry: Record<string, number>; unitTries: Record<string, number>;
  sideQuests: { id: string; term: string; approved: boolean }[]; votes: number; term: string; unitAttempts: number;
  /** Realms recorded as cleared on the server (b_cleared). Missing until supabase/migrations/002 is applied. */
  cleared?: number[];
  /** wave-live: XP the server logged from live games (b_xp_log). Missing until 006 is applied. */
  gameXp?: number;
};
export const loadState = () => rpc<ServerState>("b_state", me());
export const completeTask = (key: string) => rpc<void>("b_complete_task", { ...me(), p_task_key: key });
// ── wave-sync: earned stays earned ──
/** Records a realm clear on the server. The server checks the unit test task plus every key sent (the realm's current task list).
 *  Returns the student's recorded clears. */
export const claimRealm = (realm: number, taskKeys: string[]) =>
  rpc<number[]>("b_claim_realm", { ...me(), p_realm: realm, p_task_keys: taskKeys });
export type Graded = { score: number; total: number; pct: number; passed: boolean; results: Record<string, boolean> };
export const grade = (kind: "chapter" | "unit", ref: number, answers: Record<string, string>) =>
  rpc<Graded>("b_grade", { ...me(), p_kind: kind, p_ref: ref, p_answers: answers });
export const vote = (kind: "survey" | "debate", item: string, choice: string, reason?: string) =>
  rpc<Record<string, number>>("b_vote", { ...me(), p_kind: kind, p_item: item, p_choice: choice, p_reason: reason ?? null });
export const results = (kind: "survey" | "debate", item: string) => rpc<Record<string, number>>("b_results", { p_kind: kind, p_item: item });
export const submitSideQuest = (quest: string, note: string) => rpc<void>("b_side_quest_submit", { ...me(), p_quest: quest, p_note: note });

// Teacher: the Dopps Class teacher code, sent over HTTPS and checked in the database by Dopps Class's _teacher_ok
export const teacherHash = async (pass: string) => pass;
export const teacherCheck = (h: string) => rpc<boolean>("b_teacher_check", { p_pass_hash: h });
export const teacherKeys = (h: string) => rpc<Record<string, string>>("b_teacher_keys", { p_pass_hash: h });
export const teacherRoster = (h: string) => rpc<RosterRow[]>("b_teacher_roster", { p_pass_hash: h });
export const teacherApprove = (h: string, student: string, quest: string, ok: boolean) =>
  rpc<void>("b_teacher_approve", { p_pass_hash: h, p_student: student, p_quest: quest, p_ok: ok });
export const teacherResetPin = async (h: string, student: string, pin: string) =>
  rpc<void>("b_teacher_reset_pin", { p_pass_hash: h, p_student: student, p_pin_hash: await hashSecret(pin) });
export type RosterRow = {
  id: string; name: string; period: string; tasks: string[]; days: number; best: Record<string, number>; cleared?: number[];
  gameXp?: number; // wave-live
  sideQuests: { id: string; term: string; note: string; approved: boolean }[];
};

// ── wave-learnB: Classwork + Reflection Coach ──
// Classwork (supabase/migrations/004): graded in the database. Tests return right/wrong per question, never answers.
/** Chapter keys in these objects are chapter refs as text ("12", or "1201" for 12A). */
export type StoryScore = { words: number; sentences: number; has_a: boolean; has_b: boolean; cue: boolean; length: number; used: number; detail: number; total: number };
export type CwStory = { a: string; b: string; text: string; score: StoryScore; saved_at: string };
export type CwSwap = { term: string; ref: number; reason: string; at: string };
export type CwWork = {
  realm: number; status: "draft" | "submitted"; submitted_at: string | null; returned_at: string | null;
  learn_best: Record<string, number>; learn_tries: Record<string, number>; learn_grade: Record<string, number>;
  ch_test: Record<string, { best: number; tries: number }>; ch_stories: Record<string, (CwStory | null)[]>;
  swapped: CwSwap[]; story_open: Record<string, string>; unit_best: number; unit_tries: number;
  learn_avg: number | null; story_avg: number | null; final_score: number | null;
  chapters: number[]; need: Record<string, number>; swap_max: Record<string, number>;
  last_try: Record<string, string>; cooldown: number; now: string; learn_open: string | null; test_open: string | null;
};
export type CwLearn = { ref: number; words: string[]; defs: string[] };
export type CwLearnResult = { ref: number; score: number; right: number; total: number; best: number; tries: number; grade: number;
  passed: boolean; reveal: boolean; misses: { i: number; term: string; def?: string }[]; work: CwWork };
export type CwTestResult = { kind: "ch" | "unit"; ref: number | null; score: number; right: number; total: number; best: number; tries: number;
  passed: boolean; results: Record<string, boolean>; work: CwWork };
export const cwStatus = () => rpc<{ open: boolean; realms?: CwWork[] }>("b_cw_status", me());
export const cwGet = (realm: number) => rpc<CwWork>("b_cw_get", { ...me(), p_realm: realm });
export const cwLearnStart = (realm: number, ref: number) => rpc<CwLearn>("b_cw_learn_start", { ...me(), p_realm: realm, p_ref: ref });
export const cwLearnSubmit = (realm: number, answers: number[]) => rpc<CwLearnResult>("b_cw_learn_submit", { ...me(), p_realm: realm, p_answers: answers });
/** ref = chapter ref for a Chapter Test, null for the realm's Review Test. */
export const cwTestStart = (realm: number, ref: number | null) => rpc<{ kind: "ch" | "unit"; ref: number | null; ids: string[] }>("b_cw_test_start", { ...me(), p_realm: realm, p_ref: ref });
export const cwTestSubmit = (realm: number, answers: Record<string, string>) => rpc<CwTestResult>("b_cw_test_submit", { ...me(), p_realm: realm, p_answers: answers });
export const cwStoryOpen = (realm: number, ref: number, slot: number) => rpc<{ ok: boolean }>("b_cw_story_open", { ...me(), p_realm: realm, p_ref: ref, p_slot: slot });
export const cwStorySave = (realm: number, ref: number, slot: number, a: string, b: string, text: string) =>
  rpc<{ ok: boolean; score: StoryScore; work: CwWork }>("b_cw_story_save", { ...me(), p_realm: realm, p_ref: ref, p_slot: slot, p_a: a, p_b: b, p_text: text });
export const cwSwap = (realm: number, ref: number, term: string, reason: string) =>
  rpc<{ ok: boolean; work: CwWork }>("b_cw_swap", { ...me(), p_realm: realm, p_ref: ref, p_term: term, p_reason: reason });
export const cwSubmit = (realm: number) => rpc<{ ok: boolean; work: CwWork }>("b_cw_submit", { ...me(), p_realm: realm });
export type CwTeacherRow = {
  id: string; name: string; period: string; status: "not_started" | "draft" | "submitted";
  learn_best: Record<string, number>; learn_grade: Record<string, number>; learn_tries: Record<string, number>; learn_avg: number | null;
  ch_test: Record<string, { best: number; tries: number }>; ch_stories: Record<string, (CwStory | null)[]>; swapped: CwSwap[];
  story_avg: number | null; unit_best: number; unit_tries: number; final_score: number | null; submitted_at: string | null; updated_at: string | null;
};
export const cwTeacherList = (h: string, realm: number) =>
  rpc<{ live: boolean; chapters: number[]; need: Record<string, number>; rows: CwTeacherRow[] }>("b_cw_teacher_list", { p_pass_hash: h, p_realm: realm });
export const cwTeacherReturn = (h: string, student: string, realm: number) => rpc<void>("b_cw_teacher_return", { p_pass_hash: h, p_student: student, p_realm: realm });
export const cwTeacherLive = (h: string, live: boolean) => rpc<boolean>("b_cw_teacher_live", { p_pass_hash: h, p_live: live });

// Reflection Coach: one saved draft per student per chapter (logged-out students keep it in their browser).
export type ReflectionRow = { ref: number; words: number; done: boolean; updated_at: string };
export const reflectionGet = (ref: number) =>
  rpc<{ data: unknown; words: number; done: boolean; updated_at: string } | null>("b_reflection_get", { ...me(), p_ref: ref });
export const reflectionSave = (ref: number, data: unknown) => rpc<{ words: number; done: boolean; updated_at: string }>("b_reflection_save", { ...me(), p_ref: ref, p_data: data });
export const reflectionList = () => rpc<ReflectionRow[]>("b_reflection_list", me());
export const teacherReflections = (h: string, ref?: number) =>
  rpc<(ReflectionRow & { student: string; name: string; period: string; data: unknown })[]>("b_teacher_reflections", { p_pass_hash: h, p_ref: ref ?? null });
// ── end wave-learnB ──

/** Fisher–Yates. Every quiz and test shuffles its choices on every attempt. */
export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ── wave-pet: rock-alien class pet, Crystal Shop, gallery, Hall of Champions (supabase/migrations/005_pet.sql) ──
export type PetStage = "geode" | "pebble" | "sandstone" | "quartzite" | "magma" | "granite" | "titan";
export type PetMood = "happy" | "hungry" | "cold" | "dusty" | "sad" | "sick" | "rusty" | "dormant";
/** Public view of an alien (gallery). name = the teacher-approved name, null while pending. */
export type PetPublic = {
  name: string | null; color: string; stage: PetStage; cleared: number; form: string | null; mood_label: PetMood; alive: boolean;
  health: number; streak: number; age_days: number; gear: Record<string, string>; upgrades: number; words: number;
  owner?: string; period?: string;
};
/** The owner's view. */
export type Pet = PetPublic & {
  name: string; approved_name: string | null; name_ok: boolean; minerals: number; heat: number; mood: number; shine: number;
  best_streak: number; care_points: number; deaths: number; revive_progress: number; revive_needed: number;
  today: Record<string, number>; caps: Record<string, number>; crystals: number; crystals_total: number; owned: string[];
  learned: string[]; next_rename: string | null; result?: string; right?: boolean; answer?: string; action?: string | null;
};
export type PetItem = { key: string; slot: string; name: string; cost: number; unlock: number };
export type PetQuestion = { ref: number; def: string; opts: string[] };
export type PetFallen = { name: string | null; color: string; owner: string; died_at: string; revived: boolean };
export type Champion = { id: string; name: string; period: string; xp: number; verified_xp: number; game_xp?: number /* wave-live */; tasks: number; days: number; cleared: number; units: number; streak: number };
export type PetTeacherRow = {
  student: string; student_name: string; period: string; name: string; approved_name: string | null; name_ok: boolean; color: string;
  alive: boolean; stage: PetStage; health: number; care_points: number; deaths: number; upgrades: number; born: string; last_care: string;
};
export const petGet = () => rpc<Pet | null>("b_pet_get", me());
export const petCreate = (name: string, color: string) => rpc<Pet>("b_pet_create", { ...me(), p_name: name, p_color: color });
export const petAction = (action: string) => rpc<Pet>("b_pet_action", { ...me(), p_action: action });
export const petQuizStart = (ref: number | null) => rpc<PetQuestion>("b_pet_quiz_start", { ...me(), p_ref: ref });
export const petQuizAnswer = (choice: string) => rpc<Pet>("b_pet_quiz_answer", { ...me(), p_choice: choice });
export const petRename = (name: string) => rpc<Pet>("b_pet_rename", { ...me(), p_name: name });
export const petShopItems = () => rpc<PetItem[]>("b_pet_shop_items", {});
export const petShopBuy = (item: string) => rpc<Pet>("b_pet_shop_buy", { ...me(), p_item: item });
export const petEquip = (slot: string, item: string | null) => rpc<Pet>("b_pet_equip", { ...me(), p_slot: slot, p_item: item });
export const petGallery = () => rpc<PetPublic[]>("b_pet_gallery", {});
export const petFallen = (days = 14) => rpc<PetFallen[]>("b_pet_fallen", { p_days: days });
export const champions = () => rpc<Champion[]>("b_champions", {});
export const petTeacherList = (h: string) => rpc<PetTeacherRow[]>("b_pet_teacher_list", { p_pass_hash: h });
export const petTeacherName = (h: string, student: string, action: "approve" | "deny" | "rename", name?: string) =>
  rpc<{ ok: boolean; name: string }>("b_pet_teacher_name", { p_pass_hash: h, p_student: student, p_action: action, p_name: name ?? null });
export const petTeacherDelete = (h: string, student: string) => rpc<{ ok: boolean }>("b_pet_teacher_delete", { p_pass_hash: h, p_student: student });
/** need = null reads the setting; true/false turns name approval on/off. Returns whether names need approval. */
export const petTeacherNamesOk = (h: string, need: boolean | null) => rpc<boolean>("b_pet_teacher_names_ok", { p_pass_hash: h, p_need: need });
// ── end wave-pet ──
