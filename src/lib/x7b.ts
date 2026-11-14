"use client";
// ── wave-x7b ── database calls for the Daily Briefing, Suggest an Improvement, Visitors and the visit counter
// (supabase/migrations/010_x7b.sql). Same pattern as lib/db.ts: the page only calls security-definer functions.
import { db, dbReady, getStudent, hashSecret } from "@/lib/db";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export const x7bReady = dbReady;
/** True when the error means 010_x7b.sql hasn't been run yet. */
export const notInstalled = (e: unknown) => /function|schema cache|does not exist/i.test(String((e as Error)?.message ?? e));
export const needsUpdate = "Needs the database update (supabase/migrations/010_x7b.sql).";

// ---------- Daily Briefing ----------
export type Briefing = { announcement: string; updated_at: string };
export const briefingGet = () => rpc<Briefing>("b_briefing_get", {});
export const teacherBriefingSet = (h: string, text: string) => rpc<Briefing>("b_teacher_briefing_set", { p_pass_hash: h, p_announcement: text });

// ---------- Suggest an Improvement ----------
export const SUGGEST_CATS = [
  ["bug", "Bug or broken link"],
  ["game", "New game or activity idea"],
  ["content", "Chapter or content suggestion"],
  ["design", "Design or usability"],
  ["other", "Something else"],
] as const;
export type SuggestCat = (typeof SUGGEST_CATS)[number][0];
export const suggest = (name: string, category: SuggestCat, message: string, page: string) => {
  const s = getStudent();
  return rpc<{ ok: boolean }>("b_suggest", { p_id: s?.id ?? null, p_pin_hash: s?.pinHash ?? null, p_name: name, p_category: category, p_message: message, p_page: page });
};
export type SuggestionRow = { id: number; name: string | null; student: string | null; period: string | null; category: SuggestCat; message: string; page: string | null; status: "new" | "done" | "archived"; created_at: string };
export const teacherSuggestions = (h: string, archived: boolean) => rpc<SuggestionRow[]>("b_teacher_suggestions", { p_pass_hash: h, p_archived: archived });
export const teacherSuggestionSet = (h: string, id: number, status: SuggestionRow["status"]) => rpc<void>("b_teacher_suggestion_set", { p_pass_hash: h, p_suggestion: id, p_status: status });

// ---------- Visitors ----------
export type VisitorMe = { id: string; name: string; period: string; visitor: true; first: string; expires: string };
export type VisitorTouch = VisitorMe | { visitor: false } | { removed: true };
/** Saves the login the same way lib/db.ts does (key bedrock_student), so every Bedrock page sees it. */
function remember(v: VisitorMe, pinHash: string) {
  try { localStorage.setItem("bedrock_student", JSON.stringify({ id: v.id, name: v.name, period: v.period, pinHash })); } catch {}
  window.dispatchEvent(new Event("bedrock-student"));
}
export async function visitorRegister(first: string, last: string, pin: string) {
  const h = await hashSecret(pin);
  const v = await rpc<VisitorMe>("b_visitor_register", { p_first: first, p_last: last, p_pin_hash: h });
  remember(v, h);
  return v;
}
export async function visitorLogin(first: string, last: string, pin: string) {
  const h = await hashSecret(pin);
  const v = await rpc<VisitorMe>("b_visitor_login", { p_first: first, p_last: last, p_pin_hash: h });
  remember(v, h);
  return v;
}
export const visitorTouch = () => {
  const s = getStudent();
  if (!s) throw new Error("Log in first.");
  return rpc<VisitorTouch>("b_visitor_touch", { p_id: s.id, p_pin_hash: s.pinHash });
};
export type VisitorBoardRow = { name: string; xp: number; days: number; game_xp: number; pet: boolean };
export const visitorBoard = () => rpc<VisitorBoardRow[]>("b_visitor_board", {});
export type VisitorTeacherRow = { id: string; name: string; board_name: string; joined: string; last_seen: string; expires: string; days: number; game_xp: number; pet: boolean; removed: boolean; removed_why: string | null };
export const teacherVisitors = (h: string) => rpc<VisitorTeacherRow[]>("b_teacher_visitors", { p_pass_hash: h });
export const teacherVisitorRemove = (h: string, id: string, removed: boolean) => rpc<void>("b_teacher_visitor_remove", { p_pass_hash: h, p_student: id, p_removed: removed });

// ---------- Site visit counter ----------
export type Visits = { total: number; since: string };
/** Counts one visit per browser tab session (sessionStorage), then returns the all-time total. */
export async function siteVisits(): Promise<Visits | null> {
  if (!dbReady) return null;
  let counted = false;
  try { counted = sessionStorage.getItem("bedrock_visit") === "1"; } catch {}
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) counted = true; // local builds never add visits
  try {
    const v = await rpc<Visits>(counted ? "b_site_visit_count" : "b_site_visit_hit", {});
    try { sessionStorage.setItem("bedrock_visit", "1"); } catch {}
    return v;
  } catch { return null; }
}
// ── end wave-x7b ──
