"use client";
// ── wave-twinB ── database calls for Footprint Quest, Home Energy Budget and The Idaho Trail
// (supabase/migrations/008_twinsB.sql). Same pattern as lib/db.ts: the page only calls security-definer functions.
import { db, dbReady, getStudent } from "@/lib/db";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
function me() {
  const s = getStudent();
  if (!s) throw new Error("Log in first (top right).");
  return { p_id: s.id, p_pin_hash: s.pinHash };
}
export const twinReady = dbReady;
/** True when the error means 008_twinsB.sql hasn't been run yet. */
export const notInstalled = (e: unknown) => /function|schema cache|does not exist/i.test(String((e as Error)?.message ?? e));

// ---------- Footprint Quest ----------
export type FpRow = { data: Record<string, unknown>; stage: number; submitted: boolean; submitted_at: string | null; updated_at: string };
export type FpLearned = { items: { n: string; name: string; cat: string }[]; swaps: { id: string; name: string; ings: [string, number][]; makers: number }[]; book: { id: string; name: string; ings: [string, number][] }[] };
export const fpGet = () => rpc<FpRow | null>("b_fp_get", me());
export const fpSave = (data: unknown, stage: number, submitted: boolean) =>
  rpc<{ ok: boolean; submitted: boolean; updated_at: string }>("b_fp_save", { ...me(), p_data: data, p_stage: stage, p_submitted: submitted });
export const fpLearned = () => rpc<FpLearned>("b_fp_learned", {});
export const fpLearnItem = (name: string, cat: string) => rpc<{ ok: boolean; cat?: string }>("b_fp_learn_item", { ...me(), p_name: name, p_category: cat });
export const fpMakeSwap = (name: string, ings: [string, number][]) => rpc<{ ok: boolean; makers: number; shared: boolean }>("b_fp_make_swap", { ...me(), p_name: name, p_ings: ings });
export type FpTeacherRow = { id: string; name: string; period: string; stage: number; submitted: boolean; submitted_at: string | null; updated_at: string | null; tries: number | null; test: number | null; group: string };
export type FpTeacherLearning = { items: { n: string; name: string; cat: string; votes: Record<string, number> }[]; swaps: { n: string; name: string; ings: [string, number][]; makers: number }[]; book: { id: string; name: string; ings: [string, number][] }[] };
export const fpTeacherList = (h: string) => rpc<FpTeacherRow[]>("b_fp_teacher_list", { p_pass_hash: h });
export const fpTeacherGet = (h: string, student: string) => rpc<Record<string, unknown> | null>("b_fp_teacher_get", { p_pass_hash: h, p_student: student });
export const fpTeacherLearning = (h: string) => rpc<FpTeacherLearning>("b_fp_teacher_learning", { p_pass_hash: h });
export const fpTeacherRemove = (h: string, kind: "item" | "swap" | "book", n: string) => rpc<FpTeacherLearning>("b_fp_teacher_remove", { p_pass_hash: h, p_kind: kind, p_norm: n });
export const fpTeacherBookAdd = (h: string, name: string, ings: [string, number][]) => rpc<FpTeacherLearning>("b_fp_teacher_book_add", { p_pass_hash: h, p_name: name, p_ings: ings });

// ---------- Home Energy Budget ----------
export type EbRow = { data: Record<string, unknown>; status: "draft" | "submitted"; submitted_at: string | null; returned_at: string | null; pred_locked_at: string | null; updated_at: string; image: string | null; scores: Record<string, number | null> | null; teacher_note: string | null };
export const ebGet = () => rpc<EbRow | null>("b_eb_get", me());
export const ebSave = (data: unknown) => rpc<{ ok: boolean; updated_at: string; pred_locked_at: string | null }>("b_eb_save", { ...me(), p_data: data });
export const ebImage = (img: string | null) => rpc<{ ok: boolean }>("b_eb_image", { ...me(), p_img: img });
export const ebSubmit = () => rpc<{ ok: boolean; submitted_at: string }>("b_eb_submit", me());
export type EbTeacherRow = { id: string; name: string; period: string; status: string; updated_at: string | null; submitted_at: string | null; returned_at: string | null; pred_locked_at: string | null; has_image: boolean; data: Record<string, unknown> | null; scores: Record<string, number | null> | null; teacher_note: string | null; scored_at: string | null };
export const ebTeacherList = (h: string) => rpc<EbTeacherRow[]>("b_eb_teacher_list", { p_pass_hash: h });
export const ebTeacherImage = (h: string, student: string) => rpc<string | null>("b_eb_teacher_image", { p_pass_hash: h, p_student: student });
export const ebTeacherScore = (h: string, student: string, scores: Record<string, number | null>, note: string) =>
  rpc<{ ok: boolean }>("b_eb_teacher_score", { p_pass_hash: h, p_student: student, p_scores: scores, p_note: note || null });
export const ebTeacherReturn = (h: string, student: string) => rpc<{ ok: boolean }>("b_eb_teacher_return", { p_pass_hash: h, p_student: student });

// ---------- The Idaho Trail ----------
export type TrailRun = { id: string; run_no: number; miles: number; state: unknown };
export const trailLoad = () => rpc<{ run: TrailRun | null; left_today: number; finished: number; best: number | null }>("b_trail_load", me());
export const trailStart = (state: unknown) => rpc<TrailRun & { left_today: number }>("b_trail_start", { ...me(), p_state: state });
export const trailSave = (runId: string, state: unknown, status: "active" | "done" | "over" = "active", score: number | null = null) =>
  rpc<{ miles: number; left_today: number; clamped: boolean; status?: string; score?: number; finished?: number }>("b_trail_save", { ...me(), p_run_id: runId, p_state: state, p_status: status, p_score: score });
export type TrailBoard = { finishers: { name: string; period: string; best: number; finishes: number; fastest: number | null }[]; leaders: { name: string; period: string; miles: number; day: number | null; finishes: number }[]; wagons_out: number };
export const trailBoard = () => rpc<TrailBoard>("b_trail_board", {});
export type TrailTeacherRow = { id: string; name: string; period: string; miles: number | null; day: string | null; runs: number; finished: number; best: number | null; today: number; last: string | null };
export const trailTeacherList = (h: string) => rpc<TrailTeacherRow[]>("b_trail_teacher_list", { p_pass_hash: h });
// ── end wave-twinB ──
